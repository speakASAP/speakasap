import { seededShuffle } from './seeded-shuffle';

describe('seededShuffle', () => {
  const items = Array.from({ length: 30 }, (_, i) => i);

  it('is deterministic: the same seed yields the same order every time', () => {
    const a = seededShuffle(items, 42);
    const b = seededShuffle(items, 42);
    expect(a).toEqual(b);
  });

  it('produces a different order for a different seed', () => {
    const a = seededShuffle(items, 1);
    const b = seededShuffle(items, 2);
    expect(a).not.toEqual(b);
  });

  it('never mutates the input array', () => {
    const original = [...items];
    seededShuffle(items, 7);
    expect(items).toEqual(original);
  });

  it('is a permutation: same elements, same length, none lost or duplicated', () => {
    const shuffled = seededShuffle(items, 99);
    expect(shuffled).toHaveLength(items.length);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(items);
  });

  it('does not crash on an empty array', () => {
    expect(seededShuffle([], 5)).toEqual([]);
  });

  it('does not crash on a single-element array', () => {
    expect(seededShuffle([1], 5)).toEqual([1]);
  });
});
