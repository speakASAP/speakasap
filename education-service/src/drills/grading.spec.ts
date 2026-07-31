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
    expect(normalizeAnswer('é', opts)).toBe(normalizeAnswer('é', opts));
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
