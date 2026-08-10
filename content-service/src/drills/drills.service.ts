import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../shared/prisma.service';
import { VocabularyService } from '../vocabulary/vocabulary.service';
import { checkVocabularyRatio } from '../vocabulary/ratio';
import { seededShuffle } from './seeded-shuffle';
import { blankAnswersMatchTopic } from './topic-blanks';
import {
  CefrLevel,
  DrillItemDTO,
  DrillItemSearchRequest,
  DrillItemSearchResponse,
  DrillLanguageDTO,
  DrillTopicDTO,
  VocabularyBaseline,
  VOCABULARY_MAX_NEW_WORDS_PER_SENTENCE,
} from './contracts';

/** Ordering prefers items whose past-performance ratio sits in this band — not too
 *  easy (near 1), not too hard (near 0) — over items with no signal either way. */
const RATIO_BAND_MIN = 0.55;
const RATIO_BAND_MAX = 0.9;

type DrillItemRow = Prisma.DrillItemGetPayload<{
  include: { topic: { select: { slug: true } } };
}>;

@Injectable()
export class DrillsService {
  constructor(
    private readonly prisma: PrismaService,
    // Reserved for parity with the rest of this module's DI shape. searchItems does
    // NOT call vocabulary.getBaseline itself: DrillItemSearchRequest.vocabularyBaseline
    // already carries a resolved word list, and per the vocabulary/ratio.ts contract,
    // deciding whether a course with no baseline may skip the 80/20 gate is the
    // *caller's* job (Track D, which owns GET /course-vocabulary and its hasBaseline
    // flag) — not this search endpoint's. See searchItems() below for how the response
    // still surfaces enough information for that caller decision.
    private readonly vocabulary: VocabularyService,
  ) {}

  async searchItems(request: DrillItemSearchRequest): Promise<DrillItemSearchResponse> {
    const where: Prisma.DrillItemWhereInput = {
      status: 'ACTIVE',
      language: { code: request.languageCode },
      materialLanguage: request.materialLanguage,
    };
    if (request.topicSlugs.length > 0) {
      where.topic = { slug: { in: request.topicSlugs } };
    }
    if (request.level) {
      where.level = request.level;
    }
    if (request.courseKey) {
      where.courseKey = request.courseKey;
    }
    if (request.maxLessonOrder !== undefined) {
      where.lessonOrder = { lte: request.maxLessonOrder };
    }
    // An empty `notIn` array is a Prisma error, not a no-op — only add the clause when
    // there is at least one hash to exclude.
    if (request.excludeHashes && request.excludeHashes.length > 0) {
      where.hash = { notIn: request.excludeHashes };
    }

    const all: DrillItemRow[] = await this.prisma.drillItem.findMany({
      where,
      include: { topic: { select: { slug: true } } },
    });

    // Filed under a topic is not the same as testing it. A bank item carries a topic but
    // blanks whatever its source blanked, so a "prepositions" item may blank the noun —
    // "I will call you before and after the [совещания]{meeting}". A student who asked
    // for a preposition drill was handed `meeting`, `girlfriend`, `flowers` (2026-08-10).
    // Opt-in per topic: a topic with no word list is not filtered at all.
    const rows = all.filter((row) =>
      blankAnswersMatchTopic(
        { blanks: row.blanks as unknown as { answer?: string | null }[] },
        request.topicSlugs ?? [],
        request.languageCode,
      ),
    );

    // Every row already matched the search criteria (topic/course/lesson/exclude). This
    // count is taken BEFORE the in-memory vocabulary filter below, deliberately: it is
    // what tells a caller whose `items` comes back empty "there WAS a match, the
    // vocabulary baseline excluded it" as opposed to "nothing in the bank matches your
    // topic at all". Collapsing that distinction would silently answer the "should a
    // no-baseline (or overly strict) course skip the gate?" question on the caller's
    // behalf instead of giving it the information to decide.
    const totalAvailable = rows.length;

    const filtered = this.applyVocabularyFilter(rows, request);

    const ordered = this.orderItems(filtered, request.seed ?? Date.now());
    const items = ordered.slice(0, request.limit).map((row) => this.toDTO(row, request));

    return { items, totalAvailable };
  }

  /**
   * The languages a drill set can be created for.
   *
   * `CreateSetInput.languageId` is this service's numeric `Language.id`, but every
   * caller upstream works in ISO codes — education-service has no Language table of its
   * own, and the teacher UI has only a code. Without this route the id had to be
   * duplicated in config or passed through a public request body, both of which encode
   * a primary key of this database somewhere that cannot be kept in step with it.
   *
   * Ordered by the same `order` column the rest of the site lists languages by, so a
   * picker built on this matches what a teacher sees elsewhere.
   */
  async listLanguages(): Promise<DrillLanguageDTO[]> {
    const languages = await this.prisma.language.findMany({
      orderBy: [{ order: 'asc' }, { code: 'asc' }],
      select: { id: true, code: true, name: true },
    });
    return languages.map((language) => ({
      id: language.id,
      code: language.code,
      name: language.name,
    }));
  }

  async listTopics(languageCode?: string, materialLanguage?: string): Promise<DrillTopicDTO[]> {
    const topics = await this.prisma.drillTopic.findMany({
      where: {
        ...(languageCode ? { language: { code: languageCode } } : {}),
        ...(materialLanguage ? { materialLanguage } : {}),
      },
      include: { language: { select: { code: true } } },
    });

    const lessonIds = Array.from(
      new Set(
        topics
          .map((t) => t.grammarLessonId)
          .filter((id): id is number => id !== null && id !== undefined),
      ),
    );

    // Only query GrammarLesson when there is at least one id to look up — mirrors the
    // same "don't send an empty filter" discipline used for excludeHashes above, and
    // also means this never issues a query on today's data, where GrammarLesson has 0
    // rows and every grammarLessonId lookup would come back empty anyway.
    const urlByLessonId = new Map<number, string>();
    if (lessonIds.length > 0) {
      const lessons = await this.prisma.grammarLesson.findMany({
        where: { id: { in: lessonIds } },
      });
      for (const lesson of lessons) {
        urlByLessonId.set(lesson.id, lesson.url);
      }
    }

    return topics.map((topic) => ({
      id: topic.id,
      slug: topic.slug,
      title: topic.title,
      languageCode: topic.language.code,
      materialLanguage: topic.materialLanguage,
      level: (topic.level as CefrLevel | null) ?? null,
      publicUrl:
        topic.grammarLessonId != null
          ? urlByLessonId.get(topic.grammarLessonId) ?? null
          : null,
      isNew: topic.isNew,
    }));
  }

  private applyVocabularyFilter(
    rows: DrillItemRow[],
    request: DrillItemSearchRequest,
  ): DrillItemRow[] {
    if (request.vocabularyBaseline === undefined) {
      return rows;
    }
    const syntheticBaseline: VocabularyBaseline = {
      courseKey: request.courseKey ?? '',
      languageCode: request.languageCode,
      maxLessonOrder: request.maxLessonOrder ?? 0,
      words: [],
      index: request.vocabularyBaseline,
      hasBaseline: true,
    };
    return rows.filter((row) => {
      const result = checkVocabularyRatio([row.plainText], syntheticBaseline);
      return result.perItemUnknownCount[0] <= VOCABULARY_MAX_NEW_WORDS_PER_SENTENCE;
    });
  }

  private orderItems(rows: DrillItemRow[], seed: number): DrillItemRow[] {
    const band: DrillItemRow[] = [];
    const rest: DrillItemRow[] = [];
    for (const row of rows) {
      const ratio = row.timesCorrectFirstTry / Math.max(row.timesShown, 1);
      if (ratio >= RATIO_BAND_MIN && ratio <= RATIO_BAND_MAX) {
        band.push(row);
      } else {
        rest.push(row);
      }
    }
    // Freshly imported items have timesShown=0, timesCorrectFirstTry=0 -> ratio 0, which
    // is outside the band, so on day one every item lands in `rest` and is ordered by
    // the seeded shuffle alone. That is the expected degenerate case, not a bug.
    return [...seededShuffle(band, seed), ...seededShuffle(rest, seed)];
  }

  private toDTO(row: DrillItemRow, request: DrillItemSearchRequest): DrillItemDTO {
    // Mapped field by field, never spread: a spread is how internal fields (topicId,
    // languageId, sourceRef, status, timesShown, timesCorrectFirstTry, createdAt) leaked
    // into a DTO earlier in this feature.
    return {
      id: row.id,
      languageCode: request.languageCode,
      materialLanguage: row.materialLanguage,
      topicSlug: row.topic?.slug ?? null,
      level: (row.level as CefrLevel | null) ?? null,
      template: row.template,
      blanks: row.blanks as unknown as DrillItemDTO['blanks'],
      hint: row.hint,
      sourceType: row.sourceType as DrillItemDTO['sourceType'],
      courseKey: row.courseKey,
      lessonOrder: row.lessonOrder,
      unknownWords: row.unknownWords as string[],
      hash: row.hash,
    };
  }
}
