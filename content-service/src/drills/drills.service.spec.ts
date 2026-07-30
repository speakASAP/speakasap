import { DrillsService } from './drills.service';

const prisma = {
  drillItem: { findMany: jest.fn() },
  drillTopic: { findMany: jest.fn() },
  grammarLesson: { findMany: jest.fn() },
} as any;
const vocabulary = { getBaseline: jest.fn() } as any;

describe('DrillsService.searchItems', () => {
  beforeEach(() => jest.resetAllMocks());

  it('excludes items whose hash is in excludeHashes', async () => {
    prisma.drillItem.findMany.mockResolvedValue([]);
    const svc = new DrillsService(prisma, vocabulary);
    await svc.searchItems({
      languageCode: 'de', materialLanguage: 'ru', topicSlugs: ['prepositions'],
      limit: 10, excludeHashes: ['abc'],
    });
    expect(prisma.drillItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ hash: { notIn: ['abc'] } }),
      }),
    );
  });

  it('does not send a hash filter at all when excludeHashes is absent', async () => {
    prisma.drillItem.findMany.mockResolvedValue([]);
    const svc = new DrillsService(prisma, vocabulary);
    await svc.searchItems({
      languageCode: 'de', materialLanguage: 'ru', topicSlugs: ['prepositions'], limit: 10,
    });
    const call = prisma.drillItem.findMany.mock.calls[0][0];
    expect(call.where.hash).toBeUndefined();
  });

  it('does not send a hash filter when excludeHashes is an empty array (would be a Prisma error)', async () => {
    prisma.drillItem.findMany.mockResolvedValue([]);
    const svc = new DrillsService(prisma, vocabulary);
    await svc.searchItems({
      languageCode: 'de', materialLanguage: 'ru', topicSlugs: ['prepositions'],
      limit: 10, excludeHashes: [],
    });
    const call = prisma.drillItem.findMany.mock.calls[0][0];
    expect(call.where.hash).toBeUndefined();
  });

  it('restricts course-material items to maxLessonOrder', async () => {
    prisma.drillItem.findMany.mockResolvedValue([]);
    const svc = new DrillsService(prisma, vocabulary);
    await svc.searchItems({
      languageCode: 'de', materialLanguage: 'ru', topicSlugs: [],
      courseKey: 'seven:german:ru', maxLessonOrder: 4, limit: 10,
    });
    expect(prisma.drillItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lessonOrder: { lte: 4 } }),
      }),
    );
  });

  it('does not send a topic filter when topicSlugs is empty', async () => {
    prisma.drillItem.findMany.mockResolvedValue([]);
    const svc = new DrillsService(prisma, vocabulary);
    await svc.searchItems({
      languageCode: 'de', materialLanguage: 'ru', topicSlugs: [],
      courseKey: 'seven:german:ru', maxLessonOrder: 4, limit: 10,
    });
    const call = prisma.drillItem.findMany.mock.calls[0][0];
    expect(call.where.topic).toBeUndefined();
  });

  it('drops items violating the vocabulary baseline when one is supplied', async () => {
    prisma.drillItem.findMany.mockResolvedValue([
      { id: 1, plainText: 'bekannt wort', blanks: [], template: 'x', hash: 'h1',
        languageId: 1, materialLanguage: 'ru', sourceType: 'BANK_GRAMMAR',
        courseKey: null, lessonOrder: null, level: null, hint: null,
        unknownWords: [], timesShown: 0, timesCorrectFirstTry: 0, topic: { slug: 'prepositions' } },
      { id: 2, plainText: 'unbekannt fremd exotisch', blanks: [], template: 'y', hash: 'h2',
        languageId: 1, materialLanguage: 'ru', sourceType: 'BANK_GRAMMAR',
        courseKey: null, lessonOrder: null, level: null, hint: null,
        unknownWords: [], timesShown: 0, timesCorrectFirstTry: 0, topic: { slug: 'prepositions' } },
    ]);
    const svc = new DrillsService(prisma, vocabulary);
    const res = await svc.searchItems({
      languageCode: 'de', materialLanguage: 'ru', topicSlugs: ['prepositions'],
      limit: 10, vocabularyBaseline: ['bekannt', 'wort'],
    });
    expect(res.items.map((i) => i.id)).toEqual([1]);
  });

  it('reports totalAvailable from before the vocabulary filter, so a caller can tell '
    + 'a strict baseline emptied the result apart from "nothing matched at all"', async () => {
    prisma.drillItem.findMany.mockResolvedValue([
      { id: 1, plainText: 'unbekannt fremd exotisch', blanks: [], template: 'x', hash: 'h1',
        languageId: 1, materialLanguage: 'ru', sourceType: 'BANK_GRAMMAR',
        courseKey: null, lessonOrder: null, level: null, hint: null,
        unknownWords: [], timesShown: 0, timesCorrectFirstTry: 0, topic: { slug: 'prepositions' } },
    ]);
    const svc = new DrillsService(prisma, vocabulary);
    const res = await svc.searchItems({
      languageCode: 'de', materialLanguage: 'ru', topicSlugs: ['prepositions'],
      limit: 10, vocabularyBaseline: [],
    });
    expect(res.items).toEqual([]);
    expect(res.totalAvailable).toBe(1);
    expect(vocabulary.getBaseline).not.toHaveBeenCalled();
  });

  it('maps rows to DrillItemDTO field by field, exposing topicSlug and never topicId', async () => {
    prisma.drillItem.findMany.mockResolvedValue([
      { id: 1, plainText: 'a b', blanks: [{ index: 0, prompt: '', answer: 'b', alternatives: [] }],
        template: 'a [ ]{b}', hash: 'h1', languageId: 1, materialLanguage: 'ru',
        sourceType: 'BANK_GRAMMAR', courseKey: null, lessonOrder: null, level: 'A1', hint: 'h',
        unknownWords: ['b'], timesShown: 0, timesCorrectFirstTry: 0, topicId: 99,
        topic: { slug: 'prepositions' } },
    ]);
    const svc = new DrillsService(prisma, vocabulary);
    const res = await svc.searchItems({
      languageCode: 'de', materialLanguage: 'ru', topicSlugs: ['prepositions'], limit: 10,
    });
    expect(res.items[0]).toEqual({
      id: 1,
      languageCode: 'de',
      materialLanguage: 'ru',
      topicSlug: 'prepositions',
      level: 'A1',
      template: 'a [ ]{b}',
      blanks: [{ index: 0, prompt: '', answer: 'b', alternatives: [] }],
      hint: 'h',
      sourceType: 'BANK_GRAMMAR',
      courseKey: null,
      lessonOrder: null,
      unknownWords: ['b'],
      hash: 'h1',
    });
    expect((res.items[0] as any).topicId).toBeUndefined();
  });

  it('search response is answer-bearing, which is why the route is internal-only', async () => {
    // This is NOT a bug: DrillItemDTO.blanks legitimately includes answer and
    // alternatives, because Track D's generation orchestration needs them to build
    // and grade drill sets. That is exactly why POST /drill-items/search must be
    // gateway-routed under /api/v1/internal (x-internal-token required) and never
    // promoted to a public prefix a student's JWT could reach — the gateway's auth
    // guard checks for a valid token, not a role. If this assertion ever needs to
    // change because answers stop being returned here, that's fine; if it changes
    // because someone strips this comment and moves the route back to public
    // without another look, it's not.
    prisma.drillItem.findMany.mockResolvedValue([
      { id: 1, plainText: 'a b', blanks: [{ index: 0, prompt: '', answer: 'secret-answer', alternatives: ['alt'] }],
        template: 'a [ ]{secret-answer}', hash: 'h1', languageId: 1, materialLanguage: 'ru',
        sourceType: 'BANK_GRAMMAR', courseKey: null, lessonOrder: null, level: null, hint: null,
        unknownWords: [], timesShown: 0, timesCorrectFirstTry: 0, topic: { slug: 'prepositions' } },
    ]);
    const svc = new DrillsService(prisma, vocabulary);
    const res = await svc.searchItems({
      languageCode: 'de', materialLanguage: 'ru', topicSlugs: ['prepositions'], limit: 10,
    });
    expect(res.items[0].blanks).toEqual([
      { index: 0, prompt: '', answer: 'secret-answer', alternatives: ['alt'] },
    ]);
  });

  it('orders items with no history (timesShown=0) without dividing by zero, deterministically for a given seed', async () => {
    prisma.drillItem.findMany.mockResolvedValue([
      { id: 1, plainText: 'one', blanks: [], template: 'one', hash: 'h1', languageId: 1,
        materialLanguage: 'ru', sourceType: 'BANK_GRAMMAR', courseKey: null, lessonOrder: null,
        level: null, hint: null, unknownWords: [], timesShown: 0, timesCorrectFirstTry: 0,
        topic: { slug: 'prepositions' } },
      { id: 2, plainText: 'two', blanks: [], template: 'two', hash: 'h2', languageId: 1,
        materialLanguage: 'ru', sourceType: 'BANK_GRAMMAR', courseKey: null, lessonOrder: null,
        level: null, hint: null, unknownWords: [], timesShown: 0, timesCorrectFirstTry: 0,
        topic: { slug: 'prepositions' } },
      { id: 3, plainText: 'three', blanks: [], template: 'three', hash: 'h3', languageId: 1,
        materialLanguage: 'ru', sourceType: 'BANK_GRAMMAR', courseKey: null, lessonOrder: null,
        level: null, hint: null, unknownWords: [], timesShown: 0, timesCorrectFirstTry: 0,
        topic: { slug: 'prepositions' } },
    ]);
    const svc = new DrillsService(prisma, vocabulary);
    const first = await svc.searchItems({
      languageCode: 'de', materialLanguage: 'ru', topicSlugs: ['prepositions'], limit: 10, seed: 123,
    });
    const second = await svc.searchItems({
      languageCode: 'de', materialLanguage: 'ru', topicSlugs: ['prepositions'], limit: 10, seed: 123,
    });
    expect(first.items.map((i) => i.id)).toEqual(second.items.map((i) => i.id));
    expect(first.items.map((i) => i.id).sort()).toEqual([1, 2, 3]);
  });

  it('prefers items whose timesCorrectFirstTry/timesShown ratio falls in the 0.55-0.90 band', async () => {
    prisma.drillItem.findMany.mockResolvedValue([
      // ratio 0/10 = 0 -> outside band
      { id: 1, plainText: 'a', blanks: [], template: 'a', hash: 'h1', languageId: 1,
        materialLanguage: 'ru', sourceType: 'BANK_GRAMMAR', courseKey: null, lessonOrder: null,
        level: null, hint: null, unknownWords: [], timesShown: 10, timesCorrectFirstTry: 0,
        topic: { slug: 'prepositions' } },
      // ratio 7/10 = 0.7 -> inside band
      { id: 2, plainText: 'b', blanks: [], template: 'b', hash: 'h2', languageId: 1,
        materialLanguage: 'ru', sourceType: 'BANK_GRAMMAR', courseKey: null, lessonOrder: null,
        level: null, hint: null, unknownWords: [], timesShown: 10, timesCorrectFirstTry: 7,
        topic: { slug: 'prepositions' } },
    ]);
    const svc = new DrillsService(prisma, vocabulary);
    const res = await svc.searchItems({
      languageCode: 'de', materialLanguage: 'ru', topicSlugs: ['prepositions'], limit: 10, seed: 1,
    });
    expect(res.items[0].id).toBe(2);
  });
});

describe('DrillsService.listTopics', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns publicUrl: null for topics with no matching GrammarLesson (e.g. GrammarLesson has 0 rows)', async () => {
    prisma.drillTopic.findMany.mockResolvedValue([
      { id: 1, slug: 'prepositions', title: 'Prepositions', level: 'A1', isNew: false,
        grammarLessonId: null, language: { code: 'de' }, materialLanguage: 'ru' },
    ]);
    const svc = new DrillsService(prisma, vocabulary);
    const res = await svc.listTopics('de', 'ru');
    expect(res).toEqual([{
      id: 1, slug: 'prepositions', title: 'Prepositions', languageCode: 'de',
      materialLanguage: 'ru', level: 'A1', publicUrl: null, isNew: false,
    }]);
    expect(prisma.grammarLesson.findMany).not.toHaveBeenCalled();
  });

  it('resolves publicUrl from GrammarLesson.url when grammarLessonId matches', async () => {
    prisma.drillTopic.findMany.mockResolvedValue([
      { id: 2, slug: 'articles', title: 'Articles', level: 'A2', isNew: true,
        grammarLessonId: 42, language: { code: 'de' }, materialLanguage: 'ru' },
    ]);
    prisma.grammarLesson.findMany.mockResolvedValue([
      { id: 42, url: '/grammar/de/pravila-chteniya' },
    ]);
    const svc = new DrillsService(prisma, vocabulary);
    const res = await svc.listTopics('de', 'ru');
    expect(res[0].publicUrl).toBe('/grammar/de/pravila-chteniya');
    expect(prisma.grammarLesson.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [42] } } }),
    );
  });
});
