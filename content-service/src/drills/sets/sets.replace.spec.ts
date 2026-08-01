import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SetsService } from './sets.service';

const makePrisma = () => {
  const prisma: any = {
    drillSet: { findUnique: jest.fn(), update: jest.fn() },
    drillSetItem: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    drillItem: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    drillItemRevision: { create: jest.fn() },
    drillTopic: { findFirst: jest.fn().mockResolvedValue({ id: 9 }) },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  return prisma;
};

const existingSet = () => ({
  uuid: 's-1',
  languageId: 1,
  languageCode: 'de',
  materialLanguage: 'ru',
  level: 'A1',
  courseKey: 'de-a1',
  lessonOrder: 3,
  reviewState: 'APPROVED',
  language: { code: 'de' },
  items: [
    { id: 10, order: 0, itemId: 100, item: { id: 100, template: 'old A', blanks: [], hint: null } },
    { id: 11, order: 1, itemId: 101, item: { id: 101, template: 'old B', blanks: [], hint: null } },
  ],
});

const replacement = (answer = 'auf') => ({
  template: `Ich warte [на]{${answer}} den Bus.`,
  blanks: [{ index: 0, prompt: 'на', answer, alternatives: [] }],
  hint: null,
  topicSlug: 'prepositions',
});

describe('SetsService.replaceSetItems', () => {
  let prisma: any;
  let svc: SetsService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.drillSet.findUnique.mockResolvedValue(existingSet());
    prisma.drillItem.findUnique.mockResolvedValue(null);
    prisma.drillItem.create.mockImplementation(async ({ data }: any) => ({ id: 500, ...data }));
    svc = new SetsService(prisma);
  });

  // The whole point of the revision table: a teacher must be able to see what the
  // sentence used to say after a regeneration replaced it.
  it('writes the outgoing item to DrillItemRevision before overwriting', async () => {
    await svc.replaceSetItems('s-1', [0], [replacement()], { recordRevisionReason: 'REGENERATED' });

    expect(prisma.drillItemRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ itemId: 100, template: 'old A', reason: 'REGENERATED' }),
      }),
    );
  });

  it('repoints the set position at the new item, keeping its order', async () => {
    await svc.replaceSetItems('s-1', [0], [replacement()], { recordRevisionReason: 'REGENERATED' });

    expect(prisma.drillSetItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ itemId: 500, validationState: 'PENDING' }),
      }),
    );
  });

  // DrillItem.hash is @unique. A regenerated sentence that happens to match one already
  // in the bank would violate the constraint on a blind create, failing the whole
  // regeneration for a reason the teacher cannot act on.
  it('reuses an existing bank item when the replacement hashes to one', async () => {
    prisma.drillItem.findUnique.mockResolvedValue({ id: 777 });

    await svc.replaceSetItems('s-1', [0], [replacement()], { recordRevisionReason: 'REGENERATED' });

    expect(prisma.drillItem.create).not.toHaveBeenCalled();
    expect(prisma.drillSetItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ itemId: 777 }) }),
    );
  });

  it('stores the parsed plain text and hash on a newly created item', async () => {
    await svc.replaceSetItems('s-1', [0], [replacement()], { recordRevisionReason: 'REGENERATED' });

    const data = prisma.drillItem.create.mock.calls[0][0].data;
    expect(data.plainText).toBe('Ich warte auf den Bus.');
    expect(data.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.sourceType).toBe('AI');
  });

  it('rejects a position that is not in the set', async () => {
    await expect(
      svc.replaceSetItems('s-1', [99], [replacement()], { recordRevisionReason: 'REGENERATED' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a count mismatch between positions and replacements', async () => {
    await expect(
      svc.replaceSetItems('s-1', [0, 1], [replacement()], { recordRevisionReason: 'REGENERATED' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('404s for an unknown set', async () => {
    prisma.drillSet.findUnique.mockResolvedValue(null);

    await expect(
      svc.replaceSetItems('nope', [0], [replacement()], { recordRevisionReason: 'REGENERATED' }),
    ).rejects.toThrow(NotFoundException);
  });

  // One transaction: a revision written without the swap, or a swap without the
  // revision, is worse than neither.
  it('does the whole replacement in one transaction', async () => {
    await svc.replaceSetItems('s-1', [0], [replacement()], { recordRevisionReason: 'REGENERATED' });

    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

describe('SetsService.updateSet', () => {
  let prisma: any;
  let svc: SetsService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.drillSet.findUnique.mockResolvedValue(existingSet());
    prisma.drillSet.update.mockResolvedValue({ ...existingSet(), reviewState: 'PENDING_REVIEW' });
    svc = new SetsService(prisma);
  });

  it('returns an approved set to PENDING_REVIEW', async () => {
    await svc.updateSet('s-1', { reviewState: 'PENDING_REVIEW' });

    expect(prisma.drillSet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { uuid: 's-1' },
        data: expect.objectContaining({ reviewState: 'PENDING_REVIEW', approvedAt: null }),
      }),
    );
  });

  // APPROVED is what makes a set student-visible. Granting it through a generic patch
  // route would bypass approveSet's check that no item is still FAIL.
  it('refuses to grant APPROVED — that is approveSet\'s decision', async () => {
    await expect(svc.updateSet('s-1', { reviewState: 'APPROVED' } as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.drillSet.update).not.toHaveBeenCalled();
  });

  it('404s for an unknown set', async () => {
    prisma.drillSet.findUnique.mockResolvedValue(null);

    await expect(svc.updateSet('nope', { reviewState: 'PENDING_REVIEW' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects an unknown review state', async () => {
    await expect(svc.updateSet('s-1', { reviewState: 'NONSENSE' } as any)).rejects.toThrow(
      BadRequestException,
    );
  });
});
