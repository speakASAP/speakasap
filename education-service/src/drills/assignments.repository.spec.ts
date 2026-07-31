import { AssignmentsRepository } from './assignments.repository';
import { PrismaService } from '../prisma/prisma.service';

interface AttemptFixture {
  assignmentUuid: string;
  itemUuid: string;
  blankIndex: number;
  isCorrect: boolean;
  revealed: boolean;
}

interface ItemFixture {
  assignmentUuid: string;
  blanks: unknown;
}

function makePrismaMock() {
  return {
    drillAssignment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    drillAssignmentItem: {
      findMany: jest.fn(),
    },
    drillAttempt: {
      findMany: jest.fn(),
    },
  };
}

type PrismaMock = ReturnType<typeof makePrismaMock>;

/**
 * Seed the two count queries with fixtures that the mock actually FILTERS, the way
 * Postgres would. A mock that returns a fixed array regardless of `where` cannot
 * observe a change to the filter, so every "counts a revealed blank" assertion
 * would pass even against an `isCorrect: true`-only query. This applies the real
 * predicate so those tests can fail.
 */
function seedCounts(prisma: PrismaMock, items: ItemFixture[], attempts: AttemptFixture[]) {
  const inList = (where: any): string[] => where.assignmentUuid.in;

  prisma.drillAssignmentItem.findMany.mockImplementation(({ where }: any) =>
    Promise.resolve(items.filter((i) => inList(where).includes(i.assignmentUuid))),
  );

  prisma.drillAttempt.findMany.mockImplementation(({ where }: any) =>
    Promise.resolve(
      attempts.filter((a) => {
        if (!inList(where).includes(a.assignmentUuid)) return false;
        if (Array.isArray(where.OR)) {
          return where.OR.some((clause: any) =>
            Object.entries(clause).every(([k, v]) => (a as any)[k] === v),
          );
        }
        if (where.isCorrect !== undefined) return a.isCorrect === where.isCorrect;
        if (where.revealed !== undefined) return a.revealed === where.revealed;
        return true;
      }),
    ),
  );
}

function makeRepo(prisma: PrismaMock) {
  return new AssignmentsRepository(prisma as unknown as PrismaService);
}

const correct = (itemUuid: string, blankIndex: number, assignmentUuid = 'a-1'): AttemptFixture =>
  ({ assignmentUuid, itemUuid, blankIndex, isCorrect: true, revealed: false });

// What the reveal endpoint (spec §9.6, built by a later track) writes.
const revealed = (itemUuid: string, blankIndex: number, assignmentUuid = 'a-1'): AttemptFixture =>
  ({ assignmentUuid, itemUuid, blankIndex, isCorrect: false, revealed: true });

const wrong = (itemUuid: string, blankIndex: number, assignmentUuid = 'a-1'): AttemptFixture =>
  ({ assignmentUuid, itemUuid, blankIndex, isCorrect: false, revealed: false });

const item = (blankCount: number, assignmentUuid = 'a-1'): ItemFixture =>
  ({ assignmentUuid, blanks: Array.from({ length: blankCount }, (_, index) => ({ index })) });

describe('AssignmentsRepository.countBlanks', () => {
  it('counts a blank solved twice as one, not two', async () => {
    const prisma = makePrismaMock();
    // The same (itemUuid, blankIndex) pair appears twice — e.g. the student
    // got it wrong once, corrected it, and both correct attempts are stored.
    seedCounts(prisma, [item(2)], [correct('i-1', 0), correct('i-1', 0)]);

    const result = await makeRepo(prisma).countBlanks('a-1');

    expect(result.blanksCorrect).toBe(1);
    expect(result.blanksTotal).toBe(2);
  });

  it('sums blanksTotal across all items on the assignment', async () => {
    const prisma = makePrismaMock();
    seedCounts(prisma, [item(2), item(1)], []);

    const result = await makeRepo(prisma).countBlanks('a-1');

    expect(result.blanksTotal).toBe(3);
    expect(result.blanksCorrect).toBe(0);
  });

  it('ignores an attempt that is neither correct nor revealed', async () => {
    const prisma = makePrismaMock();
    seedCounts(prisma, [item(2)], [wrong('i-1', 0), wrong('i-1', 1)]);

    const result = await makeRepo(prisma).countBlanks('a-1');

    expect(result.blanksCorrect).toBe(0);
  });

  it('ignores attempts belonging to a different assignment', async () => {
    const prisma = makePrismaMock();
    seedCounts(prisma, [item(2)], [correct('i-9', 0, 'a-2'), correct('i-9', 1, 'a-2')]);

    const result = await makeRepo(prisma).countBlanks('a-1');

    expect(result.blanksCorrect).toBe(0);
  });

  it('tolerates a non-array blanks blob instead of throwing', async () => {
    const prisma = makePrismaMock();
    seedCounts(prisma, [{ assignmentUuid: 'a-1', blanks: null }, item(1)], []);

    const result = await makeRepo(prisma).countBlanks('a-1');

    expect(result.blanksTotal).toBe(1);
  });

  // Human ruling 2026-07-31: a revealed blank counts as RESOLVED. Without this a
  // revealed blank could never be solved, its assignment would sit in IN_PROGRESS
  // forever, and findOutstanding would block self-drilling permanently.
  it('counts a position that is revealed but never correct', async () => {
    const prisma = makePrismaMock();
    seedCounts(prisma, [item(2)], [revealed('i-1', 0)]);

    const result = await makeRepo(prisma).countBlanks('a-1');

    expect(result.blanksCorrect).toBe(1);
    expect(result.blanksTotal).toBe(2);
  });

  it('counts a position that is both revealed and later correct only once', async () => {
    const prisma = makePrismaMock();
    seedCounts(prisma, [item(1)], [revealed('i-1', 0), correct('i-1', 0)]);

    const result = await makeRepo(prisma).countBlanks('a-1');

    expect(result.blanksCorrect).toBe(1);
    expect(result.blanksTotal).toBe(1);
  });

  it('a student who reveals every blank still reaches full completion', async () => {
    const prisma = makePrismaMock();
    seedCounts(prisma, [item(2)], [revealed('i-1', 0), revealed('i-1', 1)]);

    const result = await makeRepo(prisma).countBlanks('a-1');

    expect(result.blanksCorrect).toBe(2);
    expect(result.blanksCorrect).toBe(result.blanksTotal);
  });

  it('queries resolved attempts — correct OR revealed — for the given assignment', async () => {
    const prisma = makePrismaMock();
    seedCounts(prisma, [], []);

    await makeRepo(prisma).countBlanks('a-1');

    expect(prisma.drillAttempt.findMany).toHaveBeenCalledWith({
      where: {
        assignmentUuid: { in: ['a-1'] },
        OR: [{ isCorrect: true }, { revealed: true }],
      },
      select: { assignmentUuid: true, itemUuid: true, blankIndex: true },
    });
  });
});

describe('AssignmentsRepository.countBlanksFor', () => {
  it('returns counts per assignment from a single pair of queries', async () => {
    const prisma = makePrismaMock();
    seedCounts(
      prisma,
      [item(2, 'a-1'), item(1, 'a-2')],
      [correct('i-1', 0, 'a-1'), correct('i-1', 0, 'a-1'), revealed('i-9', 0, 'a-2')],
    );

    const result = await makeRepo(prisma).countBlanksFor(['a-1', 'a-2']);

    expect(result.get('a-1')).toEqual({ blanksCorrect: 1, blanksTotal: 2 });
    expect(result.get('a-2')).toEqual({ blanksCorrect: 1, blanksTotal: 1 });
    expect(prisma.drillAssignmentItem.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.drillAttempt.findMany).toHaveBeenCalledTimes(1);
  });

  it('includes an assignment with no attempts at all, with zeros rather than absent', async () => {
    const prisma = makePrismaMock();
    seedCounts(prisma, [item(1, 'a-1')], [correct('i-1', 0, 'a-1')]);

    const result = await makeRepo(prisma).countBlanksFor(['a-1', 'a-2']);

    expect(result.has('a-2')).toBe(true);
    expect(result.get('a-2')).toEqual({ blanksCorrect: 0, blanksTotal: 0 });
    expect(result.get('a-1')).toEqual({ blanksCorrect: 1, blanksTotal: 1 });
  });

  it('does not attribute one assignment\'s attempts to another', async () => {
    const prisma = makePrismaMock();
    seedCounts(
      prisma,
      [item(2, 'a-1'), item(2, 'a-2')],
      [correct('i-1', 0, 'a-1'), correct('i-2', 0, 'a-2'), correct('i-2', 1, 'a-2')],
    );

    const result = await makeRepo(prisma).countBlanksFor(['a-1', 'a-2']);

    expect(result.get('a-1')?.blanksCorrect).toBe(1);
    expect(result.get('a-2')?.blanksCorrect).toBe(2);
  });

  it('scopes both queries to the requested uuids and applies resolved semantics', async () => {
    const prisma = makePrismaMock();
    seedCounts(prisma, [], []);

    await makeRepo(prisma).countBlanksFor(['a-1', 'a-2']);

    expect(prisma.drillAssignmentItem.findMany).toHaveBeenCalledWith({
      where: { assignmentUuid: { in: ['a-1', 'a-2'] } },
      select: { assignmentUuid: true, blanks: true },
    });
    expect(prisma.drillAttempt.findMany).toHaveBeenCalledWith({
      where: {
        assignmentUuid: { in: ['a-1', 'a-2'] },
        OR: [{ isCorrect: true }, { revealed: true }],
      },
      select: { assignmentUuid: true, itemUuid: true, blankIndex: true },
    });
  });

  it('deduplicates repeated uuids in the input', async () => {
    const prisma = makePrismaMock();
    seedCounts(prisma, [item(1, 'a-1')], []);

    const result = await makeRepo(prisma).countBlanksFor(['a-1', 'a-1']);

    expect(result.size).toBe(1);
    expect(result.get('a-1')).toEqual({ blanksCorrect: 0, blanksTotal: 1 });
  });

  it('issues no queries for an empty input list', async () => {
    const prisma = makePrismaMock();
    seedCounts(prisma, [], []);

    const result = await makeRepo(prisma).countBlanksFor([]);

    expect(result.size).toBe(0);
    expect(prisma.drillAssignmentItem.findMany).not.toHaveBeenCalled();
    expect(prisma.drillAttempt.findMany).not.toHaveBeenCalled();
  });

  it('renders a list of 11 assignments in two queries, not 2N', async () => {
    const prisma = makePrismaMock();
    const uuids = Array.from({ length: 11 }, (_, i) => `a-${i}`);
    seedCounts(prisma, uuids.map((u) => item(2, u)), uuids.map((u) => correct('i-0', 0, u)));

    const result = await makeRepo(prisma).countBlanksFor(uuids);

    expect(result.size).toBe(11);
    for (const uuid of uuids) {
      expect(result.get(uuid)).toEqual({ blanksCorrect: 1, blanksTotal: 2 });
    }
    expect(prisma.drillAssignmentItem.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.drillAttempt.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('AssignmentsRepository.findOutstanding', () => {
  it('queries for ASSIGNED or IN_PROGRESS, ordered by createdAt, and returns the first match', async () => {
    const prisma = makePrismaMock();
    const row = { uuid: 'a-1', status: 'ASSIGNED' };
    prisma.drillAssignment.findFirst.mockResolvedValue(row);

    const result = await makeRepo(prisma).findOutstanding(42);

    expect(prisma.drillAssignment.findFirst).toHaveBeenCalledWith({
      where: { studentId: 42, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
      include: { items: { select: { uuid: true } } },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toBe(row);
  });

  it('returns null when the student has nothing outstanding', async () => {
    const prisma = makePrismaMock();
    prisma.drillAssignment.findFirst.mockResolvedValue(null);

    const result = await makeRepo(prisma).findOutstanding(42);

    expect(result).toBeNull();
  });
});

describe('AssignmentsRepository.findForStudent', () => {
  it('returns active and completed as separate buckets, not one flat array', async () => {
    const prisma = makePrismaMock();
    const active = [{ uuid: 'a-1', status: 'ASSIGNED' }];
    const completed = [{ uuid: 'a-2', status: 'COMPLETED' }];
    prisma.drillAssignment.findMany
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(completed);

    const result = await makeRepo(prisma).findForStudent(42);

    expect(Array.isArray(result)).toBe(false);
    expect(result).toEqual({ active, completed });
  });

  it('pins the exact active query, including desc ordering and answer-free items', async () => {
    const prisma = makePrismaMock();
    prisma.drillAssignment.findMany.mockResolvedValue([]);

    await makeRepo(prisma).findForStudent(42);

    expect(prisma.drillAssignment.findMany).toHaveBeenNthCalledWith(1, {
      where: { studentId: 42, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      include: { items: { select: { uuid: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('pins the exact completed query — 10 most recent, desc, answer-free items', async () => {
    const prisma = makePrismaMock();
    prisma.drillAssignment.findMany.mockResolvedValue([]);

    await makeRepo(prisma).findForStudent(42);

    expect(prisma.drillAssignment.findMany).toHaveBeenNthCalledWith(2, {
      where: { studentId: 42, status: 'COMPLETED' },
      include: { items: { select: { uuid: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  });

  it('keeps GENERATING in the active bucket — the student sees generation progress', async () => {
    const prisma = makePrismaMock();
    const active = [
      { uuid: 'a-1', status: 'GENERATING' },
      { uuid: 'a-2', status: 'PENDING_REVIEW' },
    ];
    prisma.drillAssignment.findMany.mockResolvedValueOnce(active).mockResolvedValueOnce([]);

    const result = await makeRepo(prisma).findForStudent(42);

    expect(result.active.map((a) => a.status)).toEqual(['GENERATING', 'PENDING_REVIEW']);
  });

  // active is NOT "outstanding": selfDrillingAllowed must come from findOutstanding,
  // which filters to ASSIGNED | IN_PROGRESS. A consumer equating them would block a
  // student on a PENDING_REVIEW assignment they cannot act on.
  it('does not conflate the active bucket with the self-drilling gate', async () => {
    const prisma = makePrismaMock();
    prisma.drillAssignment.findMany
      .mockResolvedValueOnce([{ uuid: 'a-1', status: 'PENDING_REVIEW' }])
      .mockResolvedValueOnce([]);
    prisma.drillAssignment.findFirst.mockResolvedValue(null);
    const repo = makeRepo(prisma);

    const list = await repo.findForStudent(42);
    const outstanding = await repo.findOutstanding(42);

    expect(list.active).toHaveLength(1);
    expect(outstanding).toBeNull();
  });
});
