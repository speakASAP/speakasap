import { parseTemplate, hashItem, toSegments } from './template';

describe('parseTemplate', () => {
  it('extracts a single blank', () => {
    const r = parseTemplate('Ich gehe [in]{in} die Schule.');
    expect(r.blanks).toEqual([
      { index: 0, prompt: 'in', answer: 'in', alternatives: [] },
    ]);
    expect(r.plainText).toBe('Ich gehe in die Schule.');
  });

  it('extracts multiple blanks in order', () => {
    const r = parseTemplate('A whale is [big]{bigger} and [heavy]{heavier} than an elephant.');
    expect(r.blanks.map((b) => b.answer)).toEqual(['bigger', 'heavier']);
    expect(r.blanks.map((b) => b.index)).toEqual([0, 1]);
    expect(r.plainText).toBe('A whale is bigger and heavier than an elephant.');
  });

  it('accepts an empty prompt (suffix drill)', () => {
    const r = parseTemplate('Ich heiß[]{e} Peter.');
    expect(r.blanks).toEqual([{ index: 0, prompt: '', answer: 'e', alternatives: [] }]);
    expect(r.plainText).toBe('Ich heiße Peter.');
  });

  it('handles an apostrophe inside the answer', () => {
    const r = parseTemplate("Is [такой]{zo'} woordenboek ook duur?");
    expect(r.blanks[0].answer).toBe("zo'");
  });

  it('returns no blanks for a template without markup', () => {
    const r = parseTemplate('Das ist ein Satz.');
    expect(r.blanks).toEqual([]);
    expect(r.plainText).toBe('Das ist ein Satz.');
  });

  it('strips HTML from plainText but leaves it in the template', () => {
    const t = 'Ich gehe [in]{in} die Schule. <span class="mute">(gehen – идти)</span>';
    const r = parseTemplate(t);
    expect(r.plainText).toBe('Ich gehe in die Schule. (gehen – идти)');
  });

  it('preserves literal brackets in text before markup', () => {
    const r = parseTemplate('Use [ and { in text, then [a]{x} works.');
    expect(r.blanks).toEqual([{ index: 0, prompt: 'a', answer: 'x', alternatives: [] }]);
    expect(r.plainText).toBe('Use [ and { in text, then x works.');
  });

  it('preserves self-closed literal bracket pairs', () => {
    const r = parseTemplate('A [sic] note then [a]{x}.');
    expect(r.blanks).toEqual([{ index: 0, prompt: 'a', answer: 'x', alternatives: [] }]);
    expect(r.plainText).toBe('A [sic] note then x.');
  });
});

describe('toSegments', () => {
  it('interleaves text and blank markers without leaking answers', () => {
    const segs = toSegments('Ich gehe [in]{in} die Schule.');
    expect(segs).toEqual([
      { type: 'text', value: 'Ich gehe ' },
      { type: 'blank', index: 0 },
      { type: 'text', value: ' die Schule.' },
    ]);
    expect(JSON.stringify(segs)).not.toContain('{in}');
  });
});

describe('hashItem', () => {
  it('is stable and case/whitespace insensitive', () => {
    expect(hashItem('Ich gehe in die Schule.', 'de'))
      .toBe(hashItem('  ich   gehe in die schule. ', 'de'));
  });

  it('differs across languages', () => {
    expect(hashItem('Hallo', 'de')).not.toBe(hashItem('Hallo', 'en'));
  });
});

describe('Idempotency', () => {
  it('parseTemplate and toSegments produce consistent results on repeated calls', () => {
    const template = 'Ich gehe [in]{in} die Schule. [Das]{Die} ist ein Satz.';

    const r1 = parseTemplate(template);
    const r2 = parseTemplate(template);
    expect(r1).toEqual(r2);

    const segs1 = toSegments(template);
    const segs2 = toSegments(template);
    expect(segs1).toEqual(segs2);
  });
});

/**
 * `blankRe()` rebuilds the pattern from `DRILL_BLANK_PATTERN.source` and hard-codes
 * `'g'`, so any other flag on the shared constant is silently dropped.
 *
 * `template.drift.spec.ts` cannot catch this: both vendored copies would be equally
 * wrong, so they stay byte-identical while parsing markup differently from what the
 * constant declares.
 *
 * The probe pattern uses `s` (dotAll) with `.` because that flag has an observable
 * effect on this grammar — a blank spanning a newline matches only while `s` survives
 * the rebuild. `i` would prove nothing: the real pattern is built from character
 * classes, so case-insensitivity changes none of its matches.
 */
describe('blankRe flag propagation', () => {
  const DOT_ALL = /\[(.*)\]\{(.*)\}/gs;

  afterEach(() => {
    jest.resetModules();
  });

  it('honours every flag on DRILL_BLANK_PATTERN, not just g', () => {
    jest.isolateModules(() => {
      jest.doMock('./contracts', () => ({
        ...jest.requireActual('./contracts'),
        DRILL_BLANK_PATTERN: DOT_ALL,
      }));

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { parseTemplate: parse } = require('./template');

      const result = parse('Ich [ge\nhen]{gehe} weg.');

      expect(result.blanks).toHaveLength(1);
      expect(result.blanks[0].answer).toBe('gehe');
    });
  });
});
