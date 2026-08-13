import { KNOWN_LANGUAGE_CODES } from '../src/drills/teacher/course-language';
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

  it('seeds every language the platform actually supports, not merely every language it happens to seed', () => {
    // Regression guard: this must be asserted against course-language.ts's own
    // KNOWN_LANGUAGE_CODES, not derived from GRAMMAR_TOPICS itself — a set derived from
    // this file would trivially pass no matter how many languages were missing.
    for (const language of KNOWN_LANGUAGE_CODES) {
      expect(GRAMMAR_TOPICS.some((t) => t.languageCode === language)).toBe(true);
    }
  });

  it('gives every language an `other` fallback the analyzer can always use', () => {
    for (const language of KNOWN_LANGUAGE_CODES) {
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
