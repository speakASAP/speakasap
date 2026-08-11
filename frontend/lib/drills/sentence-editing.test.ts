import { describe, expect, it } from 'vitest';
import {
  buildTemplate,
  parseToWords,
  splitSentences,
  validateSentence,
  type EditableWord,
} from './sentence-editing';

const plain = (text: string): EditableWord => ({ text, isBlank: false, prompt: '' });
const blank = (text: string, prompt: string): EditableWord => ({ text, isBlank: true, prompt });

describe('buildTemplate', () => {
  it('emits [prompt]{answer} for marked words and leaves the rest alone', () => {
    expect(
      buildTemplate([plain('I'), plain('live'), blank('outside', 'за пределами'), plain('Moscow.')]),
    ).toBe('I live [за пределами]{outside} Moscow.');
  });

  it('keeps an empty prompt, which is the suffix-drill form', () => {
    // DrillBlank.prompt is documented as legally empty ("Ich heiß[]{e}"). A rule that
    // required a prompt would reject a shape the bank already contains.
    expect(buildTemplate([plain('Ich'), blank('heiße', '')])).toBe('Ich []{heiße}');
  });

  it('marks several words in one sentence', () => {
    expect(
      buildTemplate([
        plain('This'),
        plain('doctor'),
        plain('receives'),
        blank('over', 'свыше'),
        plain('fifty'),
        plain('patients'),
        blank('on', 'по'),
        plain('Mondays.'),
      ]),
    ).toBe('This doctor receives [свыше]{over} fifty patients [по]{on} Mondays.');
  });
});

describe('parseToWords', () => {
  it('round-trips a template through words and back', () => {
    const template = 'This doctor receives [свыше]{over} fifty patients [по]{on} Mondays.';
    expect(buildTemplate(parseToWords(template))).toBe(template);
  });

  it('marks exactly the blank words', () => {
    const words = parseToWords('I live [за пределами]{outside} Moscow.');
    expect(words.filter((w) => w.isBlank)).toEqual([
      { text: 'outside', isBlank: true, prompt: 'за пределами' },
    ]);
  });

  it('treats a template with no markup as all plain words', () => {
    const words = parseToWords('I live outside Moscow.');
    expect(words.every((w) => !w.isBlank)).toBe(true);
    expect(words).toHaveLength(4);
  });

  it('keeps a multi-word answer as one blank rather than splitting it', () => {
    // "out of" is one blank. Splitting on whitespace inside the answer would produce two
    // blanks, and the student would be asked to fill a fragment.
    const words = parseToWords('This young man fell [из]{out of} the window.');
    expect(words.filter((w) => w.isBlank)).toEqual([
      { text: 'out of', isBlank: true, prompt: 'из' },
    ]);
  });
});

describe('validateSentence', () => {
  it('accepts a sentence with one well-formed blank', () => {
    expect(validateSentence('I live [за пределами]{outside} Moscow.')).toEqual([]);
  });

  it('rejects a sentence with no blank at all', () => {
    // The whole point of the exercise: with nothing to fill in there is no drill.
    const issues = validateSentence('I live outside Moscow.');
    expect(issues.map((i) => i.code)).toContain('BLANK_COUNT_MISMATCH');
  });

  it('rejects a blank whose answer is empty', () => {
    const issues = validateSentence('I live [за пределами]{} Moscow.');
    expect(issues.map((i) => i.code)).toContain('EMPTY_ANSWER');
  });

  it('rejects a blank whose answer is only whitespace', () => {
    const issues = validateSentence('I live [за пределами]{   } Moscow.');
    expect(issues.map((i) => i.code)).toContain('EMPTY_ANSWER');
  });

  it('accepts an empty prompt, the suffix-drill form', () => {
    expect(validateSentence('Ich heiß[]{e}')).toEqual([]);
  });

  it('rejects leftover markup characters outside a well-formed blank', () => {
    // A teacher pasting text containing brackets can produce something that parses as one
    // blank while the stray bracket reaches the student verbatim.
    const issues = validateSentence('I live [за пределами]{outside} Moscow [oops.');
    expect(issues.map((i) => i.code)).toContain('RESIDUAL_MARKUP');
  });

  it('rejects a sentence that is nothing but a blank', () => {
    // No surrounding words means no context to reason from; the student is guessing.
    const issues = validateSentence('[за пределами]{outside}');
    expect(issues.map((i) => i.code)).toContain('MARKUP_UNPARSEABLE');
  });

  it('rejects an empty sentence', () => {
    expect(validateSentence('   ').length).toBeGreaterThan(0);
  });

  it('reports every problem at once rather than stopping at the first', () => {
    // A teacher fixing one error at a time through repeated save attempts is the failure
    // mode this avoids.
    const issues = validateSentence('[]{}');
    expect(issues.length).toBeGreaterThan(1);
  });
});

describe('splitSentences', () => {
  it('splits pasted prose into one entry per sentence', () => {
    expect(splitSentences('I live outside Moscow. She can do this work without my help.')).toEqual([
      'I live outside Moscow.',
      'She can do this work without my help.',
    ]);
  });

  it('splits on newlines even without terminal punctuation', () => {
    expect(splitSentences('первая строка\nвторая строка')).toEqual([
      'первая строка',
      'вторая строка',
    ]);
  });

  it('drops blank lines and surrounding whitespace', () => {
    expect(splitSentences('  one.  \n\n\n  two.  ')).toEqual(['one.', 'two.']);
  });

  it('returns nothing for empty input', () => {
    expect(splitSentences('   \n  ')).toEqual([]);
  });
});
