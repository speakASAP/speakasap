import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { VocabularyBaseline, VocabularyWord } from '../drills/contracts';

/**
 * Reads the materialized CourseVocabulary baseline — what a student knows by lesson N —
 * for Track D's 80/20 known-word check. Never computes anything itself: the heavy lifting
 * (tokenizing, HTML-stripping, source selection, earliest-lesson dedup) happens once, ahead
 * of time, in scripts/build-course-vocabulary.ts. This keeps the per-generation read cheap
 * and simple, which matters because Track D calls it before every generation.
 */
@Injectable()
export class VocabularyService {
  constructor(private readonly prisma: PrismaService) {}

  async getBaseline(
    courseKey: string,
    languageCode: string,
    maxLessonOrder: number,
  ): Promise<VocabularyBaseline> {
    const rows = await this.prisma.courseVocabulary.findMany({
      where: { courseKey, lessonOrder: { lte: maxLessonOrder } },
      select: { word: true, lemma: true, translation: true, lessonOrder: true, source: true },
    });

    const words: VocabularyWord[] = rows.map((r) => ({
      word: r.word,
      lemma: r.lemma,
      translation: r.translation,
      lessonOrder: r.lessonOrder,
      source: r.source as VocabularyWord['source'],
    }));

    // O(1)-membership lookup for Track D: surface form plus lemma (when it differs from the
    // surface form) so an inflected form in a generated sentence can still match a lemma-only
    // baseline entry. `words` above is the full, non-deduplicated record (kept for provenance
    // — which lesson/source first introduced a row); `index` is the flattened lookup set.
    const index = Array.from(
      new Set(words.flatMap((w) => (w.lemma ? [w.word, w.lemma] : [w.word]))),
    );

    // hasBaseline must answer "does ANY CourseVocabulary row exist for this courseKey, at
    // any lesson order" — NOT "did the filtered (lessonOrder <= maxLessonOrder) query
    // return rows". Those are different questions: a student at lesson 1 of a course whose
    // vocabulary starts at lesson 3 legitimately gets an empty `words` here, and that must
    // read as "no known words yet", not as "this course has no baseline at all" (which
    // means "do not attempt the 80/20 check — there is nothing to check against").
    //
    // A non-empty filtered result already proves a baseline exists, so the common case
    // (rows.length > 0) is answered for free. Only when the filtered query comes back
    // empty do we need the extra existence check, which is a cheap `LIMIT 1`-shaped
    // findFirst, not a count of every row.
    let hasBaseline = rows.length > 0;
    if (!hasBaseline) {
      const anyRow = await this.prisma.courseVocabulary.findFirst({
        where: { courseKey },
        select: { id: true },
      });
      hasBaseline = anyRow !== null;
    }

    return { courseKey, languageCode, maxLessonOrder, words, index, hasBaseline };
  }
}
