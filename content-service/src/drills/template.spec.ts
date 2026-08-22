import { parseTemplate, hashItem, hashItemLoose, sameDrill, toSegments } from './template';

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

describe('hashItemLoose', () => {
  it('ignores trailing sentence punctuation so an edit that drops it still finds the row', () => {
    // The defect this exists for: a teacher re-blanking a sentence in the review screen
    // retyped it without its final period. `hashItem` hashes the plain text verbatim, so
    // the bank lookup missed, a second row was created, and the set ended up holding the
    // sentence twice. Production set 3c9a3b78 collected three such pairs on 2026-08-22.
    expect(hashItemLoose('The train is coming in fifteen minutes.', 'en')).toBe(
      hashItemLoose('The train is coming in fifteen minutes', 'en'),
    );
  });

  it('ignores a change of terminator, not just its absence', () => {
    expect(hashItemLoose('Are you coming?', 'en')).toBe(hashItemLoose('Are you coming!', 'en'));
  });

  it('keeps punctuation that carries meaning inside the sentence', () => {
    // Only the tail is normalized. An internal comma changes the sentence, so two rows
    // differing there stay two rows.
    expect(hashItemLoose('Nula je, kterym nelze delit.', 'cs')).not.toBe(
      hashItemLoose('Nula je kterym nelze delit.', 'cs'),
    );
  });

  it('still separates different sentences and different languages', () => {
    expect(hashItemLoose('Hallo', 'de')).not.toBe(hashItemLoose('Hallo', 'en'));
    expect(hashItemLoose('Ich gehe.', 'de')).not.toBe(hashItemLoose('Ich komme.', 'de'));
  });

  it('is a different keyspace from hashItem, which 27k stored rows depend on', () => {
    // Stored hashes must not move: `hash` is @unique and every imported row carries the
    // strict value. The loose hash is a second lookup key, never a replacement.
    expect(hashItemLoose('Ich gehe.', 'de')).not.toBe(hashItem('Ich gehe.', 'de'));
  });
});

describe('sameDrill', () => {
  it('treats a dropped final period as the same drill', () => {
    expect(sameDrill('Ich warte [на]{auf} den Bus.', 'Ich warte [на]{auf} den Bus')).toBe(true);
  });

  it('treats a changed terminator as the same drill', () => {
    expect(sameDrill('Kommst du [mit]{mit}?', 'Kommst du [mit]{mit}!')).toBe(true);
  });

  it('does NOT merge templates that blank different words', () => {
    // The distinction hashTemplateVariant exists to preserve: which words a student
    // supplies is the exercise, so these stay two rows.
    expect(sameDrill('Mám tam [остаться]{zůstat}?', '[Mít]{Mám} tam zůstat?')).toBe(false);
  });

  it('never reports a match when a template is missing', () => {
    // Reuse decisions run through this; a legacy bank row can arrive without a template
    // and "both unknown" must not be grounds for reusing it.
    expect(sameDrill(undefined, undefined)).toBe(false);
    expect(sameDrill(null, 'Ich warte [на]{auf} den Bus.')).toBe(false);
    expect(sameDrill('Ich warte [на]{auf} den Bus.', undefined)).toBe(false);
  });

  it('does NOT ignore punctuation inside the sentence', () => {
    expect(sameDrill('Nula je, [x]{y} delit.', 'Nula je [x]{y} delit.')).toBe(false);
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
