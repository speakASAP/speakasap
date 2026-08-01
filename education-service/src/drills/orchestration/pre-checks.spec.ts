import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { runPreChecks, PreCheckContext } from './pre-checks';
import { hashItem } from '../template';

const ctx: PreCheckContext = {
  languageCode: 'de',
  materialLanguage: 'ru',
  topicSlugs: ['prepositions'],
  baseline: {
    courseKey: 'c',
    languageCode: 'de',
    maxLessonOrder: 5,
    words: [],
    index: ['bus', 'schule', 'warte', 'gehe', 'die', 'den'],
    hasBaseline: true,
  },
  existingHashes: new Set<string>(),
};

const item = (template: string, blanks: any[]) => ({ template, blanks, hint: null });

describe('runPreChecks', () => {
  it('passes a clean preposition item', () => {
    const r = runPreChecks(
      [item('Ich warte [на]{auf} den Bus.', [{ index: 0, prompt: 'на', answer: 'auf', alternatives: [] }])],
      ctx,
    );
    expect(r[0].issues).toEqual([]);
    expect(r[0].fatal).toBe(false);
  });

  it('flags a blank count mismatch as fatal', () => {
    const r = runPreChecks(
      [
        item('Ich warte [на]{auf} den [x]{Bus}.', [
          { index: 0, prompt: 'на', answer: 'auf', alternatives: [] },
        ]),
      ],
      ctx,
    );
    expect(r[0].issues[0].code).toBe('BLANK_COUNT_MISMATCH');
    expect(r[0].fatal).toBe(true);
  });

  it('flags an empty answer as fatal', () => {
    const r = runPreChecks(
      [item('Ich warte []{} den Bus.', [{ index: 0, prompt: '', answer: '', alternatives: [] }])],
      ctx,
    );
    expect(r[0].issues.some((i) => i.code === 'EMPTY_ANSWER')).toBe(true);
    expect(r[0].fatal).toBe(true);
  });

  it('flags a Cyrillic answer in a German drill as fatal', () => {
    const r = runPreChecks(
      [item('Ich warte [на]{на} den Bus.', [{ index: 0, prompt: 'на', answer: 'на', alternatives: [] }])],
      ctx,
    );
    expect(r[0].issues.some((i) => i.code === 'WRONG_SCRIPT')).toBe(true);
    expect(r[0].fatal).toBe(true);
  });

  it('flags an off-list answer for a closed-list topic, NOT fatal', () => {
    const r = runPreChecks(
      [item('Ich sehe [die]{die} Schule.', [{ index: 0, prompt: 'die', answer: 'die', alternatives: [] }])],
      ctx,
    );
    expect(r[0].issues.some((i) => i.code === 'CLOSED_LIST_MISMATCH')).toBe(true);
    expect(r[0].fatal).toBe(false);
  });

  it('flags a duplicate against existing hashes as fatal', () => {
    const withHash: PreCheckContext = {
      ...ctx,
      existingHashes: new Set([hashItem('Ich warte auf den Bus.', 'de')]),
    };
    const r = runPreChecks(
      [item('Ich warte [на]{auf} den Bus.', [{ index: 0, prompt: 'на', answer: 'auf', alternatives: [] }])],
      withHash,
    );
    expect(r[0].issues.some((i) => i.code === 'DUPLICATE')).toBe(true);
    expect(r[0].fatal).toBe(true);
  });

  it('flags a vocabulary breach across the batch, NOT fatal per item', () => {
    const r = runPreChecks(
      [
        item('Ich [x]{auf} exotisch fremdartig ungewöhnlich.', [
          { index: 0, prompt: 'x', answer: 'auf', alternatives: [] },
        ]),
      ],
      ctx,
    );
    expect(r[0].issues.some((i) => i.code === 'VOCABULARY_RATIO')).toBe(true);
    expect(r[0].fatal).toBe(false);
  });

  // A duplicate WITHIN one generated batch is as unusable as one against the bank,
  // and the model repeats itself far more often than it collides with history.
  // Checking only `existingHashes` would let a batch of ten identical sentences
  // through to the validator and then to the teacher.
  it('flags a duplicate of an earlier item in the same batch as fatal', () => {
    const blanks = [{ index: 0, prompt: 'на', answer: 'auf', alternatives: [] }];
    const r = runPreChecks(
      [item('Ich warte [на]{auf} den Bus.', blanks), item('Ich warte [на]{auf} den Bus.', blanks)],
      ctx,
    );
    expect(r[0].issues.some((i) => i.code === 'DUPLICATE')).toBe(false);
    expect(r[1].issues.some((i) => i.code === 'DUPLICATE')).toBe(true);
    expect(r[1].fatal).toBe(true);
  });

  // parseTemplate substitutes answers into plainText, so unbalanced markup that the
  // parser cannot match survives verbatim. Shipping that puts literal "[" and "{"
  // in front of the student.
  it('flags residual markup left by unparseable brackets', () => {
    const r = runPreChecks(
      [item('Ich warte [на{auf} den Bus.', [{ index: 0, prompt: 'на', answer: 'auf', alternatives: [] }])],
      ctx,
    );
    expect(r[0].issues.some((i) => i.code === 'RESIDUAL_MARKUP')).toBe(true);
    expect(r[0].fatal).toBe(true);
  });

  // Mixed script is legitimate — loanwords, transliterations and proper nouns quoted
  // in the material language. Only an answer whose letters are ENTIRELY in the wrong
  // script is WRONG_SCRIPT.
  //
  // The answer here mixes Cyrillic and Latin letters deliberately. An earlier version
  // of this test used "Café", which is entirely Latin — it therefore passed against a
  // mutant that flagged ANY wrong-script letter, and proved nothing.
  it('does not flag an answer that mixes scripts', () => {
    const r = runPreChecks(
      [item('Ich fahre nach [x]{Мoskau} heute.', [
        { index: 0, prompt: 'x', answer: 'Мoskau', alternatives: [] },
      ])],
      ctx,
    );
    expect(r[0].issues.some((i) => i.code === 'WRONG_SCRIPT')).toBe(false);
  });

  it('reports itemRef by position in the input batch', () => {
    const good = item('Ich warte [на]{auf} den Bus.', [
      { index: 0, prompt: 'на', answer: 'auf', alternatives: [] },
    ]);
    const bad = item('Ich gehe []{} zur Schule.', [{ index: 0, prompt: '', answer: '', alternatives: [] }]);
    const r = runPreChecks([good, bad], ctx);
    expect(r.map((x) => x.itemRef)).toEqual([0, 1]);
    expect(r[1].fatal).toBe(true);
  });

  // The 80/20 gate is meaningless without a baseline: every word is unknown by
  // construction, so every item would be flagged. content-service's own ratio.ts
  // says distinguishing "no baseline built" from "baseline is legitimately empty"
  // is a CALLER decision — this is that decision, made explicitly rather than by
  // letting a broken vocabulary build masquerade as a hundred bad sentences.
  it('skips the vocabulary gate when the course has no baseline at all', () => {
    const noBaseline: PreCheckContext = {
      ...ctx,
      baseline: { ...ctx.baseline!, index: [], hasBaseline: false },
    };
    const r = runPreChecks(
      [
        item('Ich [x]{auf} exotisch fremdartig ungewöhnlich.', [
          { index: 0, prompt: 'x', answer: 'auf', alternatives: [] },
        ]),
      ],
      noBaseline,
    );
    expect(r[0].issues.some((i) => i.code === 'VOCABULARY_RATIO')).toBe(false);
  });
});

/**
 * `ratio.ts`, `tokenize.ts` and `stopwords.ts` beside this test are VENDORED COPIES
 * of the content-service originals. education-service cannot import across services,
 * and two services scoring the same sentence differently is a silent correctness bug:
 * content-service would accept an item into the bank that the orchestrator rejects,
 * or the reverse. These tests fail the moment a copy diverges by a single byte.
 *
 * If one fails: re-copy the content-service file, do not patch the copy in place.
 *
 * `template.ts` is deliberately NOT re-vendored here — Track B2 already vendored it at
 * `src/drills/template.ts` with its own drift test, and a second copy in this directory
 * would be a third parser free to drift from both.
 */
describe('vendored vocabulary modules', () => {
  const cases = [
    ['ratio.ts', '../../../../content-service/src/vocabulary/ratio.ts'],
    ['tokenize.ts', '../../../../content-service/src/vocabulary/tokenize.ts'],
    ['stopwords.ts', '../../../../content-service/src/vocabulary/stopwords.ts'],
  ];

  it.each(cases)('%s is byte-identical to the content-service source', (mine, theirs) => {
    const digest = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
    expect(digest(join(__dirname, mine))).toBe(digest(join(__dirname, theirs)));
  });
});
