import { buildWrongAnswerHint } from './wrong-answer-hint';

/**
 * What a student sees after getting a blank wrong.
 *
 * The hint escalates with the attempt number so a near-miss is not immediately handed
 * the answer, and it is derived on the SERVER: `CheckBlankResponse.acceptedText` is
 * contractually null on a wrong attempt, so anything the client could compute would
 * require shipping the answer to a student who has not earned it.
 */
describe('buildWrongAnswerHint', () => {
  it('gives the length on the first wrong attempt', () => {
    const hint = buildWrongAnswerHint('hat', 1);

    expect(hint).toMatch(/3/);
    expect(hint).not.toContain('hat');
  });

  it('gives the first letter on the second', () => {
    const hint = buildWrongAnswerHint('hat', 2);

    expect(hint).toContain('h');
    // Still not the answer itself.
    expect(hint).not.toContain('hat');
  });

  it('offers to reveal from the third onward', () => {
    expect(buildWrongAnswerHint('hat', 3)).toMatch(/показать|reveal/i);
    expect(buildWrongAnswerHint('hat', 7)).toMatch(/показать|reveal/i);
  });

  it('never contains the answer at any attempt number', () => {
    // The one property that matters: no escalation step may leak it.
    for (const attempt of [1, 2, 3, 4, 10]) {
      expect(buildWrongAnswerHint('gesprochen', attempt)).not.toContain('gesprochen');
    }
  });

  it('does not leak a one-letter answer through the first-letter hint', () => {
    // "Starts with e" IS the answer when the answer is "e" — a real case here, since
    // suffix drills use single-letter blanks: "Ich heiß[]{e} Peter."
    const hint = buildWrongAnswerHint('e', 2);

    expect(hint).not.toMatch(/«e»|"e"/);
  });

  it('counts letters, not spaces, for a multi-word answer', () => {
    const hint = buildWrongAnswerHint('sind gekommen', 1);

    expect(hint).toMatch(/12/);
  });

  it('says nothing for a missing answer rather than inventing a hint', () => {
    expect(buildWrongAnswerHint('', 1)).toBeNull();
    expect(buildWrongAnswerHint(null as any, 1)).toBeNull();
  });
});
