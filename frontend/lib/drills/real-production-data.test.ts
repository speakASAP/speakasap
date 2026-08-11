import { describe, expect, it } from 'vitest';
import { parseToWords, validateSentence } from '@/lib/drills/sentence-editing';

// Verbatim from production: assignment a1748629-…, education DB.
const REAL = [
  'I will call you before and after the [совещания]{meeting}.',
  'They are not at [дома]{home}; [сейчас]{now} they are at [работе]{work}.',
  'My [девушка]{girlfriend} likes the [запах]{smell} of [свежих]{fresh} [цветов]{flowers} in the office.',
];

describe('the real production assignment', () => {
  it('every stored sentence passes the new validation', () => {
    for (const t of REAL) expect(validateSentence(t)).toEqual([]);
  });

  it('renders the full sentence, answer before translation', () => {
    const words = parseToWords(REAL[1]);
    const rendered = words
      .map((w) => (w.isBlank ? `${w.text} [${w.prompt}]` : w.text) + (w.suffix ?? ''))
      .join(' ');
    expect(rendered).toBe('They are not at home [дома]; now [сейчас] they are at work [работе].');
  });

  it('blank order matches the stored blanks array, which the badges index by', () => {
    const blanks = parseToWords(REAL[2]).filter((w) => w.isBlank).map((w) => w.text);
    expect(blanks).toEqual(['girlfriend', 'smell', 'fresh', 'flowers']);
  });
});
