import { extractFailedBlanks } from './failed-blanks';

const item = (uuid: string, template: string, blanks: unknown[]) => ({
  uuid,
  order: 0,
  template,
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

describe('extractFailedBlanks', () => {
  it('returns nothing when every blank was right on the first try', () => {
    const items = [item('i1', 'Never leave children alone {{0}} a car.', [
      { index: 0, answer: 'inside', prompt: 'в, внутри' },
    ])];
    const attempts = [attempt('i1', 0, 'inside', true, 1)];

    expect(extractFailedBlanks(items, attempts)).toEqual([]);
  });

  it('counts wrong non-revealed attempts as the mistake count', () => {
    const items = [item('i1', 'We will have to walk {{0}} this market.', [
      { index: 0, answer: 'through', prompt: 'через' },
    ])];
    const attempts = [
      attempt('i1', 0, 'acros', false, 1),
      attempt('i1', 0, 'across', false, 2),
      attempt('i1', 0, 'to across', false, 3),
    ];

    const failed = extractFailedBlanks(items, attempts);

    expect(failed).toHaveLength(1);
    expect(failed[0].answer).toBe('through');
    expect(failed[0].mistakeCount).toBe(3);
    expect(failed[0].wrongAttempts).toEqual(['acros', 'across', 'to across']);
    expect(failed[0].sentence).toBe('We will have to walk {{0}} this market.');
    expect(failed[0].prompt).toBe('через');
  });

  it('counts a blank revealed with no typed attempt as one mistake', () => {
    const items = [item('i1', 'Get {{0}} your car immediately!', [
      { index: 0, answer: 'out of', prompt: 'из' },
    ])];
    const attempts = [attempt('i1', 0, '', false, 1, true)];

    const failed = extractFailedBlanks(items, attempts);

    expect(failed).toHaveLength(1);
    expect(failed[0].revealed).toBe(true);
    expect(failed[0].mistakeCount).toBe(1);
    expect(failed[0].wrongAttempts).toEqual([]);
  });

  it('counts typed attempts before a reveal, not the reveal itself', () => {
    const items = [item('i1', 'Get {{0}} your car immediately!', [
      { index: 0, answer: 'out of', prompt: 'из' },
    ])];
    const attempts = [
      attempt('i1', 0, 'out', false, 1),
      attempt('i1', 0, 'out', false, 2),
      attempt('i1', 0, 'out', false, 3),
      attempt('i1', 0, '', false, 4, true),
    ];

    const failed = extractFailedBlanks(items, attempts);

    expect(failed[0].mistakeCount).toBe(3);
    expect(failed[0].revealed).toBe(true);
    expect(failed[0].wrongAttempts).toEqual(['out', 'out', 'out']);
  });

  it('reports a blank eventually solved after wrong tries', () => {
    const items = [item('i1', 'I heard some strange sound {{0}} my back.', [
      { index: 0, answer: 'behind', prompt: 'за' },
    ])];
    const attempts = [
      attempt('i1', 0, 'on', false, 1),
      attempt('i1', 0, 'behind', true, 2),
    ];

    const failed = extractFailedBlanks(items, attempts);

    expect(failed).toHaveLength(1);
    expect(failed[0].mistakeCount).toBe(1);
  });

  it('ignores a blank with no attempts at all — unanswered is not a mistake', () => {
    const items = [item('i1', 'Never leave children alone {{0}} a car.', [
      { index: 0, answer: 'inside', prompt: 'в, внутри' },
    ])];

    expect(extractFailedBlanks(items, [])).toEqual([]);
  });

  it('handles several blanks in one sentence independently', () => {
    const items = [item('i1', 'Walk {{0}} the park and sit {{1}} the bench.', [
      { index: 0, answer: 'through', prompt: 'через' },
      { index: 1, answer: 'on', prompt: 'на' },
    ])];
    const attempts = [
      attempt('i1', 0, 'across', false, 1),
      attempt('i1', 1, 'on', true, 1),
    ];

    const failed = extractFailedBlanks(items, attempts);

    expect(failed).toHaveLength(1);
    expect(failed[0].blankIndex).toBe(0);
  });

  it('falls back to positional index when a blank carries no index field', () => {
    const items = [item('i1', 'Walk {{0}} the park.', [{ answer: 'through', prompt: 'через' }])];
    const attempts = [attempt('i1', 0, 'across', false, 1)];

    const failed = extractFailedBlanks(items, attempts);

    expect(failed).toHaveLength(1);
    expect(failed[0].answer).toBe('through');
  });

  it('skips attempts pointing at a blank the item does not have', () => {
    const items = [item('i1', 'Walk {{0}} the park.', [{ index: 0, answer: 'through' }])];
    const attempts = [attempt('i1', 7, 'nonsense', false, 1)];

    expect(extractFailedBlanks(items, attempts)).toEqual([]);
  });

  it('orders results by item order then blank index', () => {
    const items = [
      { uuid: 'i2', order: 1, template: 'B {{0}}', blanks: [{ index: 0, answer: 'b' }] },
      { uuid: 'i1', order: 0, template: 'A {{0}}', blanks: [{ index: 0, answer: 'a' }] },
    ];
    const attempts = [
      attempt('i2', 0, 'x', false, 1),
      attempt('i1', 0, 'y', false, 1),
    ];

    const failed = extractFailedBlanks(items, attempts);

    expect(failed.map((f) => f.answer)).toEqual(['a', 'b']);
  });
});
