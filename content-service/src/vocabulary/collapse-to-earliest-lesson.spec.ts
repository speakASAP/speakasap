import { collapseToEarliestLesson, VocabEntry } from './collapse-to-earliest-lesson';

function entry(overrides: Partial<VocabEntry>): VocabEntry {
  return {
    courseKey: 'seven:german:ru',
    languageId: 1,
    lessonOrder: 1,
    word: 'haus',
    lemma: null,
    translation: null,
    source: 'ITEM',
    ...overrides,
  };
}

describe('collapseToEarliestLesson', () => {
  it('keeps the lowest lessonOrder when a word appears later then earlier (5 then 2)', () => {
    const result = collapseToEarliestLesson([
      entry({ word: 'haus', lessonOrder: 5 }),
      entry({ word: 'haus', lessonOrder: 2 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].lessonOrder).toBe(2);
  });

  it('keeps the lowest lessonOrder regardless of input order (2 then 5) — order independence', () => {
    const result = collapseToEarliestLesson([
      entry({ word: 'haus', lessonOrder: 2 }),
      entry({ word: 'haus', lessonOrder: 5 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].lessonOrder).toBe(2);
  });

  it('keeps each of two different words at its own minimum lessonOrder', () => {
    const result = collapseToEarliestLesson([
      entry({ word: 'haus', lessonOrder: 3 }),
      entry({ word: 'wohnen', lessonOrder: 7 }),
      entry({ word: 'haus', lessonOrder: 1 }),
      entry({ word: 'wohnen', lessonOrder: 4 }),
    ]);
    expect(result).toHaveLength(2);
    expect(result.find((e) => e.word === 'haus')?.lessonOrder).toBe(1);
    expect(result.find((e) => e.word === 'wohnen')?.lessonOrder).toBe(4);
  });

  it('keeps the same word from two different sources as separate rows (unique key includes source)', () => {
    const result = collapseToEarliestLesson([
      entry({ word: 'haus', source: 'ITEM', lessonOrder: 3 }),
      entry({ word: 'haus', source: 'LESSON_BODY', lessonOrder: 1 }),
    ]);
    expect(result).toHaveLength(2);
    const item = result.find((e) => e.source === 'ITEM');
    const body = result.find((e) => e.source === 'LESSON_BODY');
    expect(item?.lessonOrder).toBe(3);
    expect(body?.lessonOrder).toBe(1);
  });

  it('returns an empty array for empty input without throwing', () => {
    expect(() => collapseToEarliestLesson([])).not.toThrow();
    expect(collapseToEarliestLesson([])).toEqual([]);
  });

  it('does not merge the same word across two different courseKeys or languageIds', () => {
    const result = collapseToEarliestLesson([
      entry({ word: 'haus', courseKey: 'seven:german:ru', languageId: 1, lessonOrder: 2 }),
      entry({ word: 'haus', courseKey: 'seven:german:en', languageId: 1, lessonOrder: 5 }),
      entry({ word: 'haus', courseKey: 'seven:german:ru', languageId: 2, lessonOrder: 9 }),
    ]);
    expect(result).toHaveLength(3);
  });
});
