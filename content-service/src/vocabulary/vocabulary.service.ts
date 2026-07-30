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

    return { courseKey, languageCode, maxLessonOrder, words, index };
  }
}
