import {
  MAX_REMEDIAL_SENTENCES,
  MIN_REMEDIAL_SENTENCES,
  composeRemedial,
} from './remedial-composition';

const answer = (text: string, mistakeCount: number) => ({
  answer: text,
  normalized: text,
  mistakeCount,
  wrongAttempts: [],
});

const totalOccurrences = (parts: ReturnType<typeof composeRemedial>, normalized: string) =>
  parts.reduce(
    (sum, part) =>
      sum + (part.requiredAnswers.find((a) => a.normalized === normalized)?.occurrences ?? 0),
    0,
  );

describe('composeRemedial — repetitions', () => {
  it('gives a word wrong once exactly one sentence', () => {
    const [part] = composeRemedial([answer('behind', 1)], new Set());

    expect(totalOccurrences([part], 'behind')).toBe(1);
  });

  it('gives a word wrong three times exactly three sentences', () => {
    const [part] = composeRemedial([answer('through', 3)], new Set());

    expect(totalOccurrences([part], 'through')).toBe(3);
  });

  it('applies no floor — a single mistake is not padded up to two', () => {
    const [part] = composeRemedial([answer('behind', 1)], new Set());

    expect(part.requiredAnswers.find((a) => a.normalized === 'behind')!.occurrences).toBe(1);
  });

  it('applies no cap — a word wrong six times gets six sentences', () => {
    const [part] = composeRemedial([answer('through', 6)], new Set());

    expect(totalOccurrences([part], 'through')).toBe(6);
  });
});

describe('composeRemedial — the ten-sentence minimum', () => {
  it('pads a short gap up to ten sentences without repeating the error words', () => {
    const [part] = composeRemedial([answer('behind', 1), answer('through', 2)], new Set());

    expect(part.sentenceCount).toBe(MIN_REMEDIAL_SENTENCES);
    expect(part.paddingCount).toBe(7);
    expect(totalOccurrences([part], 'behind')).toBe(1);
    expect(totalOccurrences([part], 'through')).toBe(2);
  });

  it('adds no padding when the errors already fill ten sentences', () => {
    const [part] = composeRemedial([answer('through', 6), answer('behind', 4)], new Set());

    expect(part.sentenceCount).toBe(10);
    expect(part.paddingCount).toBe(0);
  });

  it('adds no padding above the minimum', () => {
    const [part] = composeRemedial([answer('through', 12)], new Set());

    expect(part.sentenceCount).toBe(12);
    expect(part.paddingCount).toBe(0);
  });
});

describe('composeRemedial — splitting', () => {
  it('keeps a gap of twenty in one assignment', () => {
    const parts = composeRemedial([answer('through', 20)], new Set());

    expect(parts).toHaveLength(1);
    expect(parts[0].sentenceCount).toBe(MAX_REMEDIAL_SENTENCES);
    expect(parts[0].totalParts).toBe(1);
  });

  it('splits twenty-five into two parts', () => {
    const parts = composeRemedial([answer('through', 25)], new Set());

    expect(parts).toHaveLength(2);
    expect(parts.every((p) => p.sentenceCount <= MAX_REMEDIAL_SENTENCES)).toBe(true);
    expect(totalOccurrences(parts, 'through')).toBe(25);
  });

  it('numbers the parts from one and reports the total on each', () => {
    const parts = composeRemedial([answer('through', 25)], new Set());

    expect(parts.map((p) => p.part)).toEqual([1, 2]);
    expect(parts.every((p) => p.totalParts === 2)).toBe(true);
  });

  it('spreads one answer across parts rather than concentrating it', () => {
    const parts = composeRemedial(
      [answer('through', 15), answer('behind', 15)],
      new Set(),
    );

    expect(parts).toHaveLength(2);
    for (const part of parts) {
      expect(part.requiredAnswers.length).toBeGreaterThan(1);
    }
  });

  it('never leaves a part below the minimum by splitting badly', () => {
    const parts = composeRemedial([answer('through', 21)], new Set());

    for (const part of parts) {
      expect(part.sentenceCount).toBeGreaterThanOrEqual(MIN_REMEDIAL_SENTENCES);
    }
    expect(totalOccurrences(parts, 'through')).toBe(21);
  });

  it('preserves every occurrence across a three-part split', () => {
    const parts = composeRemedial(
      [answer('a', 20), answer('b', 20), answer('c', 15)],
      new Set(),
    );

    expect(totalOccurrences(parts, 'a')).toBe(20);
    expect(totalOccurrences(parts, 'b')).toBe(20);
    expect(totalOccurrences(parts, 'c')).toBe(15);
    expect(parts.every((p) => p.sentenceCount <= MAX_REMEDIAL_SENTENCES)).toBe(true);
  });
});

describe('composeRemedial — mastered words', () => {
  it('excludes a word the student has already mastered', () => {
    const parts = composeRemedial(
      [answer('behind', 2), answer('through', 3)],
      new Set(['behind']),
    );

    expect(totalOccurrences(parts, 'behind')).toBe(0);
    expect(totalOccurrences(parts, 'through')).toBe(3);
  });

  it('returns nothing when every word in the gap is mastered', () => {
    const parts = composeRemedial(
      [answer('behind', 2), answer('through', 3)],
      new Set(['behind', 'through']),
    );

    expect(parts).toEqual([]);
  });

  it('returns nothing for an empty answer list', () => {
    expect(composeRemedial([], new Set())).toEqual([]);
  });
});

describe('composeRemedial — sanity', () => {
  it('never emits a sentence count below the required occurrences in that part', () => {
    const parts = composeRemedial([answer('a', 7), answer('b', 9)], new Set());

    for (const part of parts) {
      const required = part.requiredAnswers.reduce((sum, a) => sum + a.occurrences, 0);
      expect(part.sentenceCount).toBeGreaterThanOrEqual(required);
      expect(part.sentenceCount).toBe(required + part.paddingCount);
    }
  });

  it('ignores an answer whose mistake count is zero', () => {
    const parts = composeRemedial([answer('behind', 0), answer('through', 2)], new Set());

    expect(totalOccurrences(parts, 'behind')).toBe(0);
  });
});
