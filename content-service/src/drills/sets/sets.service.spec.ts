import { ConflictException } from '@nestjs/common';
import { SetsService } from './sets.service';

const prisma = {
  drillSet: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  drillSetItem: { findMany: jest.fn() },
  drillSetRating: { upsert: jest.fn(), groupBy: jest.fn() },
  $transaction: jest.fn(async (fn: any) => fn(prisma)),
} as any;

describe('SetsService.approveSet', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.drillSetRating.groupBy.mockResolvedValue([]);
  });

  it('refuses approval while any item is FAIL', async () => {
    prisma.drillSet.findUnique.mockResolvedValue({
      uuid: 's-1',
      reviewState: 'PENDING_REVIEW',
      items: [
        { id: 1, validationState: 'PASS' },
        { id: 2, validationState: 'FAIL' },
      ],
    });
    const svc = new SetsService(prisma);
    await expect(svc.approveSet('s-1', 7)).rejects.toThrow(ConflictException);
  });

  it('allows approval when the only issues are WARN', async () => {
    prisma.drillSet.findUnique.mockResolvedValue({
      uuid: 's-1',
      reviewState: 'PENDING_REVIEW',
      items: [{ id: 1, validationState: 'WARN' }, { id: 2, validationState: 'PASS' }],
    });
    prisma.drillSet.update.mockResolvedValue({ uuid: 's-1', reviewState: 'APPROVED' });
    const svc = new SetsService(prisma);
    await expect(svc.approveSet('s-1', 7)).resolves.toBeDefined();
  });

  it('allows approval when a FAIL has been explicitly overridden', async () => {
    prisma.drillSet.findUnique.mockResolvedValue({
      uuid: 's-1',
      reviewState: 'PENDING_REVIEW',
      items: [{ id: 1, validationState: 'OVERRIDDEN' }],
    });
    prisma.drillSet.update.mockResolvedValue({ uuid: 's-1', reviewState: 'APPROVED' });
    const svc = new SetsService(prisma);
    await expect(svc.approveSet('s-1', 7)).resolves.toBeDefined();
  });

  it('recomputes popularity on approval so the unapproved penalty lifts', async () => {
    prisma.drillSet.findUnique.mockResolvedValue({
      uuid: 's-1',
      reviewState: 'PENDING_REVIEW',
      items: [],
      teacherUpvotes: 1,
      studentUpvotes: 0,
      timesAssigned: 0,
      timesSelfSelected: 0,
    });
    prisma.drillSet.update.mockResolvedValue({ uuid: 's-1', reviewState: 'APPROVED' });
    const svc = new SetsService(prisma);
    await svc.approveSet('s-1', 7);
    expect(prisma.drillSet.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ popularityScore: 3 }) }),
    );
  });

  it('is idempotent — approving an approved set does not throw', async () => {
    prisma.drillSet.findUnique.mockResolvedValue({
      uuid: 's-1',
      reviewState: 'APPROVED',
      items: [],
      teacherUpvotes: 0,
      studentUpvotes: 0,
      timesAssigned: 0,
      timesSelfSelected: 0,
    });
    prisma.drillSet.update.mockResolvedValue({ uuid: 's-1', reviewState: 'APPROVED' });
    const svc = new SetsService(prisma);
    await expect(svc.approveSet('s-1', 7)).resolves.toBeDefined();
  });
});

describe('SetsService.recordRating', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
  });

  it('upserts on (set, raterType, raterId) so a rater can change their vote', async () => {
    prisma.drillSetRating.upsert.mockResolvedValue({});
    prisma.drillSetRating.groupBy.mockResolvedValue([]);
    prisma.drillSet.findUnique.mockResolvedValue({
      uuid: 's-1',
      reviewState: 'APPROVED',
      items: [],
      teacherUpvotes: 0,
      studentUpvotes: 0,
      timesAssigned: 0,
      timesSelfSelected: 0,
    });
    prisma.drillSet.update.mockResolvedValue({});
    const svc = new SetsService(prisma);
    await svc.recordRating('s-1', 'TEACHER', 7, 1);
    expect(prisma.drillSetRating.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { setUuid_raterType_raterId: { setUuid: 's-1', raterType: 'TEACHER', raterId: 7 } },
      }),
    );
  });

  it('rejects a rating value other than +1 or -1', async () => {
    const svc = new SetsService(prisma);
    await expect(svc.recordRating('s-1', 'STUDENT', 42, 5 as any)).rejects.toThrow(/value/i);
  });
});
