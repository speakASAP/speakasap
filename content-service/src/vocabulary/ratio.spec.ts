import { checkVocabularyRatio } from './ratio';
import { VocabularyBaseline } from '../drills/contracts';

const baseline = (words: string[], overrides: Partial<VocabularyBaseline> = {}): VocabularyBaseline => ({
  courseKey: 'seven:german:ru', languageCode: 'de', maxLessonOrder: 5,
  words: [], index: words, hasBaseline: true,
  ...overrides,
});

describe('checkVocabularyRatio', () => {
  it('passes when every content word is known', () => {
    const r = checkVocabularyRatio(['Ich gehe zur Schule'], baseline(['gehe', 'zur', 'schule']));
    expect(r.knownRatio).toBe(1);
    expect(r.unknownWords).toEqual([]);
    expect(r.passes).toBe(true);
  });

  it('passes at exactly 80 percent', () => {
    // 5 content words, 1 unknown => 0.8
    const r = checkVocabularyRatio(
      ['Hund Katze Maus Vogel Elefant'],
      baseline(['hund', 'katze', 'maus', 'vogel']),
    );
    expect(r.knownRatio).toBeCloseTo(0.8);
    expect(r.passes).toBe(true);
  });

  it('fails just below 80 percent', () => {
    const r = checkVocabularyRatio(
      ['Hund Katze Maus Vogel Elefant Tiger Loewe Baer Fuchs Wolf'],
      baseline(['hund', 'katze', 'maus', 'vogel', 'elefant', 'tiger', 'loewe']),
    );
    expect(r.knownRatio).toBeCloseTo(0.7);
    expect(r.passes).toBe(false);
  });

  it('fails when one sentence has 3 unknown words even if the set ratio passes', () => {
    // Letters-only distinct tokens: the frozen tokenizer matches \p{L}\p{M}'’- only, so a
    // digit-bearing fixture like `w${i}` would collapse every entry to the single token "w".
    // Prefixed with "xz"/"xy" (not "w") specifically so no generated token can ever collide
    // with a German stopword ('war', 'wir', 'wie', 'waren' all start with "w") — the exact
    // class of bug that a "wa"+letter scheme produced for i=17 ("war").
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const known = Array.from({ length: 40 }, (_, i) =>
      i < 26 ? `xz${letters[i]}` : `xy${letters[i - 26]}`);
    const sentences = [known.slice(0, 20).join(' '), 'alpha beta gamma'];
    const r = checkVocabularyRatio(sentences, baseline(known));
    expect(r.knownRatio).toBeCloseTo(20 / 23);
    expect(r.knownRatio).toBeGreaterThanOrEqual(0.8);
    expect(r.perItemUnknownCount[1]).toBe(3);
    expect(r.passes).toBe(false);
  });

  it('reports unknown words deduplicated in first-appearance order', () => {
    const r = checkVocabularyRatio(['Zebra Zebra Yak'], baseline([]));
    expect(r.unknownWords).toEqual(['zebra', 'yak']);
  });

  it('treats an empty baseline as everything unknown, without dividing by zero', () => {
    const r = checkVocabularyRatio([''], baseline([]));
    expect(r.knownRatio).toBe(1);
    expect(r.passes).toBe(true);
  });

  describe('hasBaseline: false — no vocabulary ever built for this course', () => {
    // checkVocabularyRatio has no special case for hasBaseline: it is not this function's
    // job to decide whether a course is intentionally unsupported (e.g. chinese/english/
    // japanese today) versus a failed or never-run vocabulary build — that policy call
    // belongs to the caller, which holds course context this function does not. So a
    // hasBaseline: false baseline reports the honest, unmasked answer: everything is
    // unknown, the ratio is 0, and the check fails, exactly as it would for any other
    // student who is missing all of this vocabulary.

    it('still computes real ratio and unknown-word numbers instead of hardcoding zero', () => {
      const r = checkVocabularyRatio(
        ['Ni hao ma'],
        baseline([], { hasBaseline: false, languageCode: 'zh' }),
      );
      expect(r.knownRatio).toBe(0);
      expect(r.unknownWords).toEqual(['ni', 'hao', 'ma']);
      expect(r.perItemUnknownCount).toEqual([3]);
    });

    it('reports honestly when a course has no baseline rather than masking it', () => {
      const r = checkVocabularyRatio(
        ['Ni hao ma wo shi xue sheng'],
        baseline([], { hasBaseline: false, languageCode: 'zh' }),
      );
      expect(r.knownRatio).toBe(0);
      expect(r.knownRatio).toBeLessThan(0.8);
      expect(r.passes).toBe(false);
    });

    it('fails on the per-sentence cap too, honestly, when there is no baseline', () => {
      const r = checkVocabularyRatio(
        ['alpha beta gamma delta'],
        baseline([], { hasBaseline: false }),
      );
      expect(r.perItemUnknownCount[0]).toBeGreaterThan(2);
      expect(r.passes).toBe(false);
    });
  });
});
