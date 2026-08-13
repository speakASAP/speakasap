import { GRAMMAR_TOPICS } from './seed-grammar-topics';

describe('grammar topic taxonomy', () => {
  it('has unique slugs', () => {
    const slugs = GRAMMAR_TOPICS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('prefixes every slug with its language code', () => {
    for (const topic of GRAMMAR_TOPICS) {
      expect(topic.slug.startsWith(`${topic.languageCode}.`)).toBe(true);
    }
  });

  it('gives every language an `other` fallback the analyzer can always use', () => {
    const languages = new Set(GRAMMAR_TOPICS.map((t) => t.languageCode));
    for (const language of languages) {
      expect(GRAMMAR_TOPICS.some((t) => t.slug === `${language}.other`)).toBe(true);
    }
  });

  it('titles every topic in both material languages', () => {
    for (const topic of GRAMMAR_TOPICS) {
      expect(typeof topic.titles.ru).toBe('string');
      expect(topic.titles.ru.length).toBeGreaterThan(0);
      expect(typeof topic.titles.en).toBe('string');
      expect(topic.titles.en.length).toBeGreaterThan(0);
    }
  });

  it('fits every slug in the column width', () => {
    for (const topic of GRAMMAR_TOPICS) {
      expect(topic.slug.length).toBeLessThanOrEqual(128);
    }
  });
});
