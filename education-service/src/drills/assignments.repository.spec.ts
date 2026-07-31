import { AssignmentsRepository } from './assignments.repository';
import { PrismaService } from '../prisma/prisma.service';

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

describe('AssignmentsRepository.countBlanks', () => {
  it('counts a blank solved twice as one, not two', async () => {
    const prisma = makePrismaMock();
    prisma.drillAssignmentItem.findMany.mockResolvedValue([
      { blanks: [{ index: 0 }, { index: 1 }] },
    ]);
    // The same (itemUuid, blankIndex) pair appears twice — e.g. the student
    // got it wrong once, corrected it, and both correct attempts are stored.
    prisma.drillAttempt.findMany.mockResolvedValue([
      { itemUuid: 'i-1', blankIndex: 0 },
      { itemUuid: 'i-1', blankIndex: 0 },
    ]);
    const repo = new AssignmentsRepository(prisma as unknown as PrismaService);

    const result = await repo.countBlanks('a-1');

    expect(result.blanksCorrect).toBe(1);
    expect(result.blanksTotal).toBe(2);
  });

  it('only queries correct attempts for the given assignment', async () => {
    const prisma = makePrismaMock();
    prisma.drillAssignmentItem.findMany.mockResolvedValue([]);
    prisma.drillAttempt.findMany.mockResolvedValue([]);
    const repo = new AssignmentsRepository(prisma as unknown as PrismaService);

    await repo.countBlanks('a-1');

    expect(prisma.drillAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assignmentUuid: 'a-1', isCorrect: true },
      }),
    );
  });

  it('sums blanksTotal across all items on the assignment', async () => {
    const prisma = makePrismaMock();
    prisma.drillAssignmentItem.findMany.mockResolvedValue([
      { blanks: [{ index: 0 }, { index: 1 }] },
      { blanks: [{ index: 0 }] },
    ]);
    prisma.drillAttempt.findMany.mockResolvedValue([]);
    const repo = new AssignmentsRepository(prisma as unknown as PrismaService);

    const result = await repo.countBlanks('a-1');

    expect(result.blanksTotal).toBe(3);
    expect(result.blanksCorrect).toBe(0);
  });
});

describe('AssignmentsRepository.findOutstanding', () => {
  it('queries for ASSIGNED or IN_PROGRESS, ordered by createdAt, and returns the first match', async () => {
    const prisma = makePrismaMock();
    const row = { uuid: 'a-1', status: 'ASSIGNED' };
    prisma.drillAssignment.findFirst.mockResolvedValue(row);
    const repo = new AssignmentsRepository(prisma as unknown as PrismaService);

    const result = await repo.findOutstanding(42);

    expect(prisma.drillAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: 42, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
        orderBy: { createdAt: 'asc' },
      }),
    );
    expect(result).toBe(row);
  });

  it('returns null when the student has nothing outstanding', async () => {
    const prisma = makePrismaMock();
    prisma.drillAssignment.findFirst.mockResolvedValue(null);
    const repo = new AssignmentsRepository(prisma as unknown as PrismaService);

    const result = await repo.findOutstanding(42);

    expect(result).toBeNull();
  });
});

describe('AssignmentsRepository.findForStudent', () => {
  it('combines non-terminal assignments with the 10 most recent COMPLETED', async () => {
    const prisma = makePrismaMock();
    const active = [{ uuid: 'a-1', status: 'ASSIGNED' }];
    const completed = [{ uuid: 'a-2', status: 'COMPLETED' }];
    prisma.drillAssignment.findMany
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(completed);
    const repo = new AssignmentsRepository(prisma as unknown as PrismaService);

    const result = await repo.findForStudent(42);

    expect(prisma.drillAssignment.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { studentId: 42, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      }),
    );
    expect(prisma.drillAssignment.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { studentId: 42, status: 'COMPLETED' },
        take: 10,
      }),
    );
    expect(result).toEqual([...active, ...completed]);
  });
});
