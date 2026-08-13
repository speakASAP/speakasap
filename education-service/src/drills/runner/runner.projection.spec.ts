import { toRunnerItem, toRunnerResponse } from './runner.projection';

const item = {
  uuid: 'i-1',
  order: 0,
  template: 'Ich warte [на]{auf} den [x]{Bus}.',
  blanks: [
    { index: 0, prompt: 'на', answer: 'auf', alternatives: ['aufs'] },
    { index: 1, prompt: 'x', answer: 'Bus', alternatives: [] },
  ],
  // Deliberately does NOT repeat the answer text: the hint is student-visible by
  // design (see the hint test below), so a hint containing "auf" would make the
  // leak assertions below fire on the hint rather than on a real leak. Per the
  // plan: change the fixture, never the assertion.
  hint: '(warten + винительный падеж)',
};

describe('toRunnerItem', () => {
  it('NEVER includes an answer or an alternative anywhere in the payload', () => {
    // Safe assertion: no surviving text segment ("Ich warte ", " den ", ".") and
    // no prompt ("на", "x") contains "auf", "aufs" or "Bus". Verified before the
    // fixture was chosen. If a future template makes the collision real, change
    // the fixture — never the assertion.
    const json = JSON.stringify(toRunnerItem(item as any, []));
    expect(json).not.toContain('auf');
    expect(json).not.toContain('aufs');
    expect(json).not.toContain('Bus');
  });

  it('exposes prompt and maxLength but not the answer text', () => {
    const r = toRunnerItem(item as any, []);
    expect(r.blanks[0]).toEqual({
      index: 0,
      prompt: 'на',
      maxLength: expect.any(Number),
      solved: false,
      solvedText: null,
    });
  });

  it('derives maxLength from the answer length with headroom, not the answer itself', () => {
    const r = toRunnerItem(item as any, []);
    expect(r.blanks[0].maxLength).toBeGreaterThanOrEqual('auf'.length);
    expect(r.blanks[0].maxLength).toBeLessThanOrEqual('auf'.length + 12);
  });

  it('returns segments with positional blanks only', () => {
    const r = toRunnerItem(item as any, []);
    expect(r.segments).toEqual([
      { type: 'text', value: 'Ich warte ' },
      { type: 'blank', index: 0 },
      { type: 'text', value: ' den ' },
      { type: 'blank', index: 1 },
      { type: 'text', value: '.' },
    ]);
  });

  it('marks a previously solved blank and echoes only what the student typed', () => {
    const attempts = [{ itemUuid: 'i-1', blankIndex: 0, isCorrect: true, submittedValue: 'AUF' }];
    const r = toRunnerItem(item as any, attempts as any);
    expect(r.blanks[0].solved).toBe(true);
    expect(r.blanks[0].solvedText).toBe('AUF');
  });

  it('does not mark a blank solved from an incorrect attempt', () => {
    const attempts = [{ itemUuid: 'i-1', blankIndex: 0, isCorrect: false, submittedValue: 'bei' }];
    const r = toRunnerItem(item as any, attempts as any);
    expect(r.blanks[0].solved).toBe(false);
    expect(r.blanks[0].solvedText).toBeNull();
  });

  it('keeps the hint, which is meant to be visible', () => {
    expect(toRunnerItem(item as any, []).hint).toBe('(warten + винительный падеж)');
  });

  // Track B handoff note 7: a revealed blank is resolved, but the student never
  // typed it, so there is nothing of theirs to echo back.
  it('marks a revealed blank solved without echoing the answer', () => {
    const attempts = [
      { itemUuid: 'i-1', blankIndex: 1, isCorrect: false, revealed: true, submittedValue: null },
    ];
    const r = toRunnerItem(item as any, attempts as any);
    expect(r.blanks[1].solved).toBe(true);
    expect(JSON.stringify(r)).not.toContain('Bus');
  });
});

describe('toRunnerResponse', () => {
  it('contains no answer string across the whole response', () => {
    const res = toRunnerResponse(
      {
        uuid: 'a-1',
        title: 't',
        status: 'ASSIGNED',
        createdAt: new Date(),
        resourceLinks: [],
        generationProgress: {},
        items: [item],
      } as any,
      [item] as any,
      [],
    );
    const json = JSON.stringify(res);
    expect(json).not.toContain('"answer"');
    expect(json).not.toContain('alternatives');
  });

  it('carries the origin and the source gap so the runner can show the theory', () => {
    const res = toRunnerResponse(
      {
        uuid: 'a-1',
        title: 't',
        status: 'ASSIGNED',
        createdAt: new Date(),
        resourceLinks: [],
        generationProgress: {},
        items: [item],
        origin: 'REMEDIAL',
        sourceAnalysisUuid: 'g1',
      } as any,
      [item] as any,
      [],
    );

    expect(res.assignment.origin).toBe('REMEDIAL');
    expect(res.assignment.sourceAnalysisUuid).toBe('g1');
  });
});
