import { VocabularyService } from './vocabulary.service';

const prisma = {
  courseVocabulary: { findMany: jest.fn() },
} as any;

describe('VocabularyService.getBaseline', () => {
  beforeEach(() => {
    prisma.courseVocabulary.findMany.mockReset();
  });

  it('includes only lessons at or below maxLessonOrder and builds a lookup index', async () => {
    prisma.courseVocabulary.findMany.mockResolvedValue([
      { word: 'schule', lemma: null, translation: 'школа', lessonOrder: 1, source: 'THEME' },
      { word: 'wohnen', lemma: 'wohnen', translation: 'жить', lessonOrder: 3, source: 'ITEM' },
    ]);
    const svc = new VocabularyService(prisma);
    const baseline = await svc.getBaseline('seven:german:ru', 'de', 4);

    expect(prisma.courseVocabulary.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ lessonOrder: { lte: 4 } }) }),
    );
    expect(baseline.index).toEqual(expect.arrayContaining(['schule', 'wohnen']));
    expect(baseline.maxLessonOrder).toBe(4);
  });

  it('returns an empty baseline rather than throwing when a course has no vocabulary', async () => {
    prisma.courseVocabulary.findMany.mockResolvedValue([]);
    const svc = new VocabularyService(prisma);
    const baseline = await svc.getBaseline('seven:greek:ru', 'el', 5);
    expect(baseline.words).toEqual([]);
    expect(baseline.index).toEqual([]);
  });

  it('filters by courseKey, not language, matching the query shape sent to Prisma', async () => {
    prisma.courseVocabulary.findMany.mockResolvedValue([]);
    const svc = new VocabularyService(prisma);
    await svc.getBaseline('seven:french:ru', 'fr', 10);
    expect(prisma.courseVocabulary.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { courseKey: 'seven:french:ru', lessonOrder: { lte: 10 } } }),
    );
  });

  it('echoes courseKey, languageCode and maxLessonOrder back on the returned baseline unchanged', async () => {
    prisma.courseVocabulary.findMany.mockResolvedValue([]);
    const svc = new VocabularyService(prisma);
    const baseline = await svc.getBaseline('seven:chinese:ru', 'zh', 7);
    expect(baseline.courseKey).toBe('seven:chinese:ru');
    expect(baseline.languageCode).toBe('zh');
    expect(baseline.maxLessonOrder).toBe(7);
  });

  it('deduplicates the index when the same surface word appears from two different sources', async () => {
    prisma.courseVocabulary.findMany.mockResolvedValue([
      { word: 'haus', lemma: null, translation: 'дом', lessonOrder: 1, source: 'ITEM' },
      { word: 'haus', lemma: null, translation: 'дом', lessonOrder: 2, source: 'LESSON_BODY' },
    ]);
    const svc = new VocabularyService(prisma);
    const baseline = await svc.getBaseline('seven:german:ru', 'de', 5);
    expect(baseline.words).toHaveLength(2); // both rows preserved on `words`...
    expect(baseline.index).toEqual(['haus']); // ...but the lookup index is deduplicated
  });

  it('adds the lemma to the index alongside the surface word when they differ', async () => {
    prisma.courseVocabulary.findMany.mockResolvedValue([
      { word: 'ging', lemma: 'gehen', translation: 'шёл', lessonOrder: 2, source: 'ITEM' },
    ]);
    const svc = new VocabularyService(prisma);
    const baseline = await svc.getBaseline('seven:german:ru', 'de', 5);
    expect(baseline.index).toEqual(expect.arrayContaining(['ging', 'gehen']));
    expect(baseline.index).toHaveLength(2);
  });

  it('passes a still-unpopulated THEME row through untouched (schema allows it even though nothing writes it yet)', async () => {
    prisma.courseVocabulary.findMany.mockResolvedValue([
      { word: 'schule', lemma: null, translation: 'школа', lessonOrder: 1, source: 'THEME' },
    ]);
    const svc = new VocabularyService(prisma);
    const baseline = await svc.getBaseline('seven:german:ru', 'de', 5);
    expect(baseline.words[0].source).toBe('THEME');
  });
});
