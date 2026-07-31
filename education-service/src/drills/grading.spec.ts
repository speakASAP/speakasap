import { gradeBlank, normalizeAnswer, gradingOptionsFor } from './grading';
import { DrillBlank } from './contracts';

const blank = (answer: string, alternatives: string[] = []): DrillBlank =>
  ({ index: 0, prompt: '', answer, alternatives });

describe('normalizeAnswer', () => {
  const opts = { caseSensitive: false };

  it('trims and collapses internal whitespace', () => {
    expect(normalizeAnswer('  in   die  ', opts)).toBe('in die');
  });

  it('folds typographic apostrophes to ASCII', () => {
    expect(normalizeAnswer('l’eau', opts)).toBe("l'eau");
    expect(normalizeAnswer('l‘eau', opts)).toBe("l'eau"); // U+2018 left single quote
    expect(normalizeAnswer('lʼeau', opts)).toBe("l'eau"); // U+02BC modifier apostrophe
    expect(normalizeAnswer('l´eau', opts)).toBe("l'eau"); // U+00B4 acute accent
    expect(normalizeAnswer('l`eau', opts)).toBe("l'eau"); // U+0060 grave accent
    expect(normalizeAnswer('l′eau', opts)).toBe("l'eau"); // U+2032 prime
  });

  it('strips a single trailing sentence punctuation mark', () => {
    expect(normalizeAnswer('bigger.', opts)).toBe('bigger');
    expect(normalizeAnswer('bigger!', opts)).toBe('bigger');
    expect(normalizeAnswer('bigger?', opts)).toBe('bigger');
  });

  it('keeps mid-string punctuation', () => {
    expect(normalizeAnswer("n'est-ce pas", opts)).toBe("n'est-ce pas");
  });

  it('NFC-normalizes composed and decomposed forms to the same string', () => {
    const precomposed = '\u00e9'; // \u00e9 as a single precomposed codepoint
    const decomposed = 'e\u0301'; // e (U+0065) + combining acute accent (U+0301)
    expect(normalizeAnswer(decomposed, opts)).toBe(normalizeAnswer(precomposed, opts));
  });
});

describe('gradeBlank', () => {
  it('accepts an exact match', () => {
    expect(gradeBlank('auf', blank('auf'), { caseSensitive: false }))
      .toEqual({ correct: true, acceptedText: 'auf' });
  });

  it('accepts a listed alternative and echoes the typed form', () => {
    const r = gradeBlank('dieses', blank('dies', ['dieses']), { caseSensitive: false });
    expect(r.correct).toBe(true);
    expect(r.acceptedText).toBe('dieses');
  });

  it('rejects a wrong answer with no accepted text', () => {
    expect(gradeBlank('bei', blank('auf'), { caseSensitive: false }))
      .toEqual({ correct: false, acceptedText: null });
  });

  it('is case-insensitive by default', () => {
    expect(gradeBlank('AUF', blank('auf'), { caseSensitive: false }).correct).toBe(true);
  });

  it('respects case when the language demands it', () => {
    expect(gradeBlank('schule', blank('Schule'), { caseSensitive: true }).correct).toBe(false);
    expect(gradeBlank('Schule', blank('Schule'), { caseSensitive: true }).correct).toBe(true);
  });

  it('never strips diacritics — é is not e', () => {
    expect(gradeBlank('ete', blank('été'), { caseSensitive: false }).correct).toBe(false);
  });

  it('never strips umlauts — o is not ö', () => {
    expect(gradeBlank('schon', blank('schön'), { caseSensitive: true }).correct).toBe(false);
  });

  it('rejects an empty submission', () => {
    expect(gradeBlank('   ', blank('auf'), { caseSensitive: false }).correct).toBe(false);
  });
});

// `blanks` is an unvalidated Json column written by AI generation (Tracks C/D).
// A malformed blank must not turn a student's check request into a 500.
describe('gradeBlank on a malformed persisted blank', () => {
  const opts = { caseSensitive: false };

  it('still grades when alternatives is missing entirely', () => {
    const malformed = { index: 0, prompt: '', answer: 'auf' } as unknown as DrillBlank;
    expect(gradeBlank('auf', malformed, opts)).toEqual({ correct: true, acceptedText: 'auf' });
    expect(gradeBlank('bei', malformed, opts)).toEqual({ correct: false, acceptedText: null });
  });

  it('still grades when alternatives is a non-array', () => {
    const malformed = {
      index: 0, prompt: '', answer: 'auf', alternatives: 'dies',
    } as unknown as DrillBlank;
    expect(gradeBlank('auf', malformed, opts)).toEqual({ correct: true, acceptedText: 'auf' });
    // A bare spread of a string alternative would splat it into single characters
    // and accept each one — `[...'dies']` is `['d','i','e','s']`.
    expect(gradeBlank('d', malformed, opts)).toEqual({ correct: false, acceptedText: null });
    expect(gradeBlank('dies', malformed, opts)).toEqual({ correct: false, acceptedText: null });
  });

  it('skips non-string entries inside alternatives', () => {
    const malformed = {
      index: 0, prompt: '', answer: 'auf', alternatives: [null, 42, 'dies'],
    } as unknown as DrillBlank;
    expect(gradeBlank('dies', malformed, opts)).toEqual({ correct: true, acceptedText: 'dies' });
    expect(gradeBlank('bei', malformed, opts)).toEqual({ correct: false, acceptedText: null });
  });

  it('treats a null answer as ungradeable rather than throwing', () => {
    const malformed = {
      index: 0, prompt: '', answer: null, alternatives: [],
    } as unknown as DrillBlank;
    expect(gradeBlank('auf', malformed, opts)).toEqual({ correct: false, acceptedText: null });
  });

  it('treats a missing answer as ungradeable even when an alternative matches', () => {
    const malformed = {
      index: 0, prompt: '', alternatives: ['auf'],
    } as unknown as DrillBlank;
    expect(gradeBlank('auf', malformed, opts)).toEqual({ correct: false, acceptedText: null });
  });

  it('treats a null blank as ungradeable rather than throwing', () => {
    expect(gradeBlank('auf', null as unknown as DrillBlank, opts))
      .toEqual({ correct: false, acceptedText: null });
  });
});

describe('gradingOptionsFor', () => {
  it('is case-sensitive for German', () => {
    expect(gradingOptionsFor('de').caseSensitive).toBe(true);
  });

  it('is case-insensitive for English', () => {
    expect(gradingOptionsFor('en').caseSensitive).toBe(false);
  });

  it('defaults to case-insensitive for an unlisted language', () => {
    expect(gradingOptionsFor('xx').caseSensitive).toBe(false);
  });
});
