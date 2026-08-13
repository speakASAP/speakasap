import {
  MASTERY_STREAK_TARGET,
  computeMasteryDeltas,
  masteredAtFor,
  nextStreak,
} from './mastery';

const item = (uuid: string, blanks: unknown[]) => ({
  uuid,
  order: 0,
  template: 'x {{0}} y',
  blanks,
});

const attempt = (
  itemUuid: string,
  blankIndex: number,
  submittedValue: string,
  isCorrect: boolean,
  attemptNo: number,
  revealed = false,
) => ({ itemUuid, blankIndex, submittedValue, isCorrect, attemptNo, revealed });

describe('nextStreak', () => {
  it('advances on a clean appearance', () => {
    expect(nextStreak(1, true)).toBe(2);
  });

  it('resets to zero on anything else', () => {
    expect(nextStreak(2, false)).toBe(0);
  });
});

describe('masteredAtFor', () => {
  const now = new Date('2026-08-12T10:00:00Z');

  it('marks a word mastered at three clean appearances', () => {
    expect(masteredAtFor(MASTERY_STREAK_TARGET, now)).toEqual(now);
  });

  it('leaves a word unmastered below the target', () => {
    expect(masteredAtFor(MASTERY_STREAK_TARGET - 1, now)).toBeNull();
  });

  it('keeps a word mastered above the target', () => {
    expect(masteredAtFor(MASTERY_STREAK_TARGET + 2, now)).toEqual(now);
  });
});

describe('computeMasteryDeltas', () => {
  it('marks a first-try correct answer clean', () => {
    const items = [item('i1', [{ index: 0, answer: 'behind' }])];
    const attempts = [attempt('i1', 0, 'behind', true, 1)];

    expect(computeMasteryDeltas(items, attempts, 'en')).toEqual([
      { normalizedAnswer: 'behind', displayAnswer: 'behind', clean: true, mistakes: 0 },
    ]);
  });

  it('does not mark a fourth-attempt correct answer clean', () => {
    const items = [item('i1', [{ index: 0, answer: 'through' }])];
    const attempts = [
      attempt('i1', 0, 'across', false, 1),
      attempt('i1', 0, 'acros', false, 2),
      attempt('i1', 0, 'to across', false, 3),
      attempt('i1', 0, 'through', true, 4),
    ];

    expect(computeMasteryDeltas(items, attempts, 'en')).toEqual([
      { normalizedAnswer: 'through', displayAnswer: 'through', clean: false, mistakes: 3 },
    ]);
  });

  it('does not mark a revealed blank clean even when nothing was typed wrong', () => {
    const items = [item('i1', [{ index: 0, answer: 'out of' }])];
    const attempts = [attempt('i1', 0, '', false, 1, true)];

    expect(computeMasteryDeltas(items, attempts, 'en')).toEqual([
      { normalizedAnswer: 'out of', displayAnswer: 'out of', clean: false, mistakes: 1 },
    ]);
  });

  it('does not mark a revealed blank clean even when the attempt is recorded correct', () => {
    const items = [item('i1', [{ index: 0, answer: 'out of' }])];
    const attempts = [attempt('i1', 0, 'out of', true, 1, true)];

    expect(computeMasteryDeltas(items, attempts, 'en')).toEqual([
      { normalizedAnswer: 'out of', displayAnswer: 'out of', clean: false, mistakes: 1 },
    ]);
  });

  it('keeps a multi-word answer as one key', () => {
    const items = [item('i1', [{ index: 0, answer: 'out of' }])];
    const attempts = [attempt('i1', 0, 'out of', true, 1)];

    const deltas = computeMasteryDeltas(items, attempts, 'en');

    expect(deltas).toHaveLength(1);
    expect(deltas[0].normalizedAnswer).toBe('out of');
  });

  it('normalizes case so one word is one record', () => {
    const items = [
      item('i1', [{ index: 0, answer: 'Behind' }]),
      { uuid: 'i2', order: 1, template: 'x {{0}}', blanks: [{ index: 0, answer: 'behind' }] },
    ];
    const attempts = [
      attempt('i1', 0, 'Behind', true, 1),
      attempt('i2', 0, 'behind', true, 1),
    ];

    const deltas = computeMasteryDeltas(items, attempts, 'en');

    expect(deltas).toHaveLength(1);
    expect(deltas[0].clean).toBe(true);
  });

  it('lets one dirty appearance spoil a word that was clean elsewhere', () => {
    const items = [
      item('i1', [{ index: 0, answer: 'behind' }]),
      { uuid: 'i2', order: 1, template: 'x {{0}}', blanks: [{ index: 0, answer: 'behind' }] },
    ];
    const attempts = [
      attempt('i1', 0, 'behind', true, 1),
      attempt('i2', 0, 'on', false, 1),
      attempt('i2', 0, 'behind', true, 2),
    ];

    const deltas = computeMasteryDeltas(items, attempts, 'en');

    expect(deltas).toEqual([
      { normalizedAnswer: 'behind', displayAnswer: 'behind', clean: false, mistakes: 1 },
    ]);
  });

  it('ignores blanks the student never attempted', () => {
    const items = [item('i1', [{ index: 0, answer: 'behind' }])];

    expect(computeMasteryDeltas(items, [], 'en')).toEqual([]);
  });

  it('reports one delta per distinct answer', () => {
    const items = [
      item('i1', [{ index: 0, answer: 'behind' }]),
      { uuid: 'i2', order: 1, template: 'x {{0}}', blanks: [{ index: 0, answer: 'through' }] },
    ];
    const attempts = [
      attempt('i1', 0, 'behind', true, 1),
      attempt('i2', 0, 'across', false, 1),
    ];

    const deltas = computeMasteryDeltas(items, attempts, 'en');

    expect(deltas.map((d) => d.normalizedAnswer).sort()).toEqual(['behind', 'through']);
  });
});
