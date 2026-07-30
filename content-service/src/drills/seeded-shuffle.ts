/**
 * Deterministic Fisher-Yates shuffle. The `seed` parameter exists so callers
 * (and tests) get a reproducible order for the same input — `Math.random()`
 * must never appear anywhere in this path, or the `seed` parameter becomes a
 * lie.
 *
 * Pure: does not mutate `items`, and the same (items, seed) pair always
 * produces the same output.
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = items.slice();
  const next = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Small, fast, deterministic PRNG. Returns a function yielding floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return function random(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
