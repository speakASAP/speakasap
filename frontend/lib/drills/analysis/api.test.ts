import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { remedialSentenceCount } from './api';
import type { GapCluster } from './contracts';

const cluster = (mistakeCounts: number[]): GapCluster => ({
  uuid: 'g1',
  topicSlug: 'en.prepositions-of-movement',
  topicUrl: null,
  title: 'Предлоги движения',
  explanation: 'x',
  rules: [],
  examples: [],
  materialLanguage: 'ru',
  failedAnswers: mistakeCounts.map((mistakeCount, index) => ({
    answer: `w${index}`,
    normalized: `w${index}`,
    mistakeCount,
    wrongAttempts: [],
  })),
});

describe('remedialSentenceCount', () => {
  it('sums the mistake counts', () => {
    expect(remedialSentenceCount(cluster([6, 4, 2]))).toBe(12);
  });

  it('reports the ten-sentence minimum for a small gap', () => {
    expect(remedialSentenceCount(cluster([1, 2]))).toBe(10);
  });

  it('reports the full count above the minimum', () => {
    expect(remedialSentenceCount(cluster([12]))).toBe(12);
  });

  it('reports zero for a gap with no failed answers', () => {
    expect(remedialSentenceCount(cluster([]))).toBe(0);
  });

  it('counts every failed answer, since the client cannot know which are mastered', () => {
    // The server would exclude a mastered answer before summing; this preview cannot,
    // so it is an upper bound. Deliberate — see remedialSentenceCount's doc comment.
    expect(remedialSentenceCount(cluster([6, 4]))).toBe(10);
  });
});

describe('fetchAnalysis', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects rather than returning an empty analysis when the request fails', async () => {
    const { fetchAnalysis } = await import('./api');
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ message: 'Bad Gateway' }),
    });

    await expect(fetchAnalysis('a1')).rejects.toThrow();
  });
});
