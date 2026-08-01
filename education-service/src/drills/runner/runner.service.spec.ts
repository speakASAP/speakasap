import { RunnerService } from './runner.service';

/**
 * A single mutable fixture rebuilt per test. `counts` is what the repository's
 * countBlanks reports, which is the ONLY thing completion may be decided from —
 * never the client's view, never a local tally.
 */
function harness() {
  const assignment: any = {
    uuid: 'a-1',
    studentId: 42,
    status: 'IN_PROGRESS',
    languageCode: 'de',
    items: [{ uuid: 'i-1' }, { uuid: 'i-2' }],
    createdAt: new Date(),
    dueAt: null,
    assignedAt: new Date(),
    completedAt: null,
    generationProgress: null,
    resourceLinks: [],
  };

  const items: Record<string, any> = {
    'i-1': {
      uuid: 'i-1',
      assignmentUuid: 'a-1',
      order: 0,
      template: 'Ich warte [на]{auf} den Bus.',
      blanks: [{ index: 0, prompt: 'на', answer: 'auf', alternatives: ['aufs'] }],
      hint: null,
    },
    'i-2': {
      uuid: 'i-2',
      assignmentUuid: 'a-1',
      order: 1,
      template: 'Er geht [в]{in} die Schule.',
      blanks: [{ index: 0, prompt: 'в', answer: 'in', alternatives: [] }],
      hint: null,
    },
  };

  const counts = { blanksCorrect: 0, blanksTotal: 2 };
  let attemptRows: any[] = [];

  const prisma: any = {
    drillAssignment: {
      findUnique: jest.fn(async () => assignment),
      update: jest.fn(async ({ data }: any) => Object.assign(assignment, data)),
    },
    drillAssignmentItem: {
      findUnique: jest.fn(async ({ where }: any) => items[where.uuid] ?? null),
      findMany: jest.fn(async () => Object.values(items)),
    },
    drillAttempt: {
      create: jest.fn(async ({ data }: any) => {
        attemptRows.push(data);
        return data;
      }),
      count: jest.fn(async () => attemptRows.length),
      findMany: jest.fn(async () => attemptRows),
      findFirst: jest.fn(async ({ where }: any) =>
        attemptRows.find(
          (a) =>
            a.itemUuid === where.itemUuid &&
            a.blankIndex === where.blankIndex &&
            (a.isCorrect === true || a.revealed === true),
        ) ?? null,
      ),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };

  const repo: any = {
    countBlanks: jest.fn(async () => ({ ...counts })),
    findOutstanding: jest.fn(async () => null),
  };

  const svc = new RunnerService(prisma, repo);
  return { svc, prisma, repo, assignment, counts, items, attempts: () => attemptRows };
}

describe('RunnerService.check', () => {
  let h: ReturnType<typeof harness>;
  let svc: RunnerService;
  let prisma: any;
  let assignment: any;
  let counts: any;

  beforeEach(() => {
    h = harness();
    ({ svc, prisma, assignment, counts } = h as any);
  });

  it('grades server-side and returns the accepted text', async () => {
    const r = await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'auf' });
    expect(r.correct).toBe(true);
    expect(r.acceptedText).toBe('auf');
  });

  it('returns no accepted text on a wrong answer', async () => {
    const r = await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'bei' });
    expect(r).toMatchObject({ correct: false, acceptedText: null });
  });

  it('records every attempt with an incrementing attemptNo', async () => {
    await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'bei' });
    await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'auf' });
    expect(prisma.drillAttempt.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ attemptNo: 2 }) }),
    );
  });

  it('moves ASSIGNED to IN_PROGRESS on the first attempt', async () => {
    assignment.status = 'ASSIGNED';
    await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'x' });
    expect(prisma.drillAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'IN_PROGRESS' }) }),
    );
  });

  it('completes the assignment only when the server counts every blank correct', async () => {
    counts.blanksCorrect = 9;
    counts.blanksTotal = 10;
    let r = await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'wrong' });
    expect(r.assignmentCompleted).toBe(false);

    counts.blanksCorrect = 10;
    r = await svc.check('a-1', 42, { itemUuid: 'i-2', blankIndex: 0, value: 'in' });
    expect(r.assignmentCompleted).toBe(true);
  });

  // Isolates the property the test above only half-covers: a CORRECT answer must
  // still not complete the assignment while the server's own count is short.
  // Without this, replacing the count check with `grade.correct` passes.
  it('does not complete on a correct answer while the server count is still short', async () => {
    counts.blanksCorrect = 1;
    counts.blanksTotal = 2;
    const r = await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'auf' });
    expect(r.correct).toBe(true);
    expect(r.assignmentCompleted).toBe(false);
    expect(prisma.drillAssignment.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
    );
  });

  it('refuses a check against another student assignment', async () => {
    await expect(
      svc.check('a-1', 999, { itemUuid: 'i-1', blankIndex: 0, value: 'auf' }),
    ).rejects.toThrow(/forbidden|not found/i);
  });

  it('refuses a check on a COMPLETED assignment', async () => {
    assignment.status = 'COMPLETED';
    await expect(
      svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'auf' }),
    ).rejects.toThrow();
  });

  it('refuses a blankIndex that does not exist on the item', async () => {
    await expect(
      svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 99, value: 'x' }),
    ).rejects.toThrow(/blankIndex/i);
  });

  it('is idempotent on an already-solved blank — no duplicate completion', async () => {
    await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'auf' });
    const r = await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'auf' });
    expect(r.correct).toBe(true);
    expect(prisma.drillAssignment.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
    );
  });

  // Track B handoff note 1: canTransition('ASSIGNED','COMPLETED') is deliberately
  // false, so a single-blank assignment must make two hops in one request or a
  // student who answered correctly gets a 409.
  it('handles a single-blank assignment: ASSIGNED to IN_PROGRESS to COMPLETED in one request', async () => {
    assignment.status = 'ASSIGNED';
    counts.blanksCorrect = 1;
    counts.blanksTotal = 1;
    const r = await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'auf' });
    expect(r.assignmentCompleted).toBe(true);
    const statuses = prisma.drillAssignment.update.mock.calls.map((c: any) => c[0].data.status);
    expect(statuses).toEqual(['IN_PROGRESS', 'COMPLETED']);
  });

  it('never returns an answer field in the check response', async () => {
    const r = await svc.check('a-1', 42, { itemUuid: 'i-1', blankIndex: 0, value: 'bei' });
    const json = JSON.stringify(r);
    expect(json).not.toContain('auf');
    expect(json).not.toContain('alternatives');
  });
});
