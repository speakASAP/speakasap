import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SetsService } from './sets.service';

/**
 * Teacher edits to a set's sentences: patch, delete, append.
 *
 * These are the writes behind the review screen's Edit / Delete / Add controls. They
 * differ from `replaceSetItems` — which swaps in generated replacements at fixed
 * positions — in that the teacher supplies the template themselves, so the template is
 * validated here rather than trusted.
 */

const makePrisma = () => {
  const prisma: any = {
    drillSet: { findUnique: jest.fn(), update: jest.fn() },
    drillSetItem: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
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
  materialLanguage: 'ru',
  level: 'A1',
  courseKey: 'de-a1',
  lessonOrder: 3,
  reviewState: 'PENDING_REVIEW',
  language: { code: 'de' },
  items: [
    { id: 10, order: 0, itemId: 100, item: { id: 100, template: 'old A', blanks: [], hint: null } },
    { id: 11, order: 1, itemId: 101, item: { id: 101, template: 'old B', blanks: [], hint: null } },
  ],
});

const GOOD = 'Ich warte [на]{auf} den Bus.';

describe('SetsService.updateSetItem', () => {
  let prisma: any;
  let svc: SetsService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.drillSet.findUnique.mockResolvedValue(existingSet());
    prisma.drillItem.findUnique.mockResolvedValue(null);
    prisma.drillItem.create.mockImplementation(async ({ data }: any) => ({ id: 500, ...data }));
    svc = new SetsService(prisma);
  });

  it('recomputes blanks from the template rather than trusting the caller', async () => {
    // blanks drives the student's completion gate; a template saved without matching
    // blanks would leave the assignment uncompletable.
    await svc.updateSetItem('s-1', 10, { template: GOOD });

    const created = prisma.drillItem.create.mock.calls[0][0].data;
    expect(created.blanks).toEqual([
      { index: 0, prompt: 'на', answer: 'auf', alternatives: [] },
    ]);
  });

  it('marks a teacher-written sentence as TEACHER-sourced, not AI', async () => {
    await svc.updateSetItem('s-1', 10, { template: GOOD });
    expect(prisma.drillItem.create.mock.calls[0][0].data.sourceType).toBe('TEACHER');
  });

  it('keeps the outgoing sentence in the revision history', async () => {
    await svc.updateSetItem('s-1', 10, { template: GOOD });
    expect(prisma.drillItemRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ itemId: 100, template: 'old A' }),
      }),
    );
  });

  it('passes a teacher-edited sentence rather than leaving it PENDING', async () => {
    // A teacher who just wrote the sentence is the reviewer; sending it back to PENDING
    // would block their own approve button on an item they authored.
    await svc.updateSetItem('s-1', 10, { template: GOOD });
    expect(prisma.drillSetItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ validationState: 'PASS', validationIssues: [] }),
      }),
    );
  });

  it('rejects a sentence with no blank and writes nothing', async () => {
    await expect(svc.updateSetItem('s-1', 10, { template: 'Ich warte den Bus.' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.drillItem.create).not.toHaveBeenCalled();
    expect(prisma.drillSetItem.update).not.toHaveBeenCalled();
  });

  it('rejects a blank with an empty answer', async () => {
    await expect(svc.updateSetItem('s-1', 10, { template: 'Ich warte [на]{} den Bus.' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('reports every validation problem, not only the first', async () => {
    await expect(svc.updateSetItem('s-1', 10, { template: '[]{}' })).rejects.toMatchObject({
      response: expect.objectContaining({
        validationIssues: expect.arrayContaining([
          expect.objectContaining({ code: expect.any(String) }),
        ]),
      }),
    });
  });

  it('404s for an item that is not in this set', async () => {
    await expect(svc.updateSetItem('s-1', 999, { template: GOOD })).rejects.toThrow(NotFoundException);
  });

  it('updates the hint alone without touching the template', async () => {
    await svc.updateSetItem('s-1', 10, { hint: 'watch the case' });
    expect(prisma.drillItem.create).not.toHaveBeenCalled();
    expect(prisma.drillItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 100 }, data: { hint: 'watch the case' } }),
    );
  });

  it('records an override without revalidating the template', async () => {
    await svc.updateSetItem('s-1', 10, { validationState: 'OVERRIDDEN' });
    expect(prisma.drillSetItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ validationState: 'OVERRIDDEN' }),
      }),
    );
  });
});

describe('SetsService.deleteSetItem', () => {
  let prisma: any;
  let svc: SetsService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.drillSet.findUnique.mockResolvedValue(existingSet());
    svc = new SetsService(prisma);
  });

  it('removes the row and closes the gap in ordering', async () => {
    // `@@unique([setId, order])` plus a renderer that numbers "Sentence N" by position:
    // leaving a hole makes the screen skip a number.
    await svc.deleteSetItem('s-1', 10);
    expect(prisma.drillSetItem.delete).toHaveBeenCalledWith({ where: { id: 10 } });
    expect(prisma.drillSetItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 11 }, data: { order: 0 } }),
    );
  });

  it('refuses to delete the last remaining sentence', async () => {
    // An empty set cannot be approved and cannot be drilled; deleting to zero would
    // produce a set no screen can act on.
    prisma.drillSet.findUnique.mockResolvedValue({
      ...existingSet(),
      items: [{ id: 10, order: 0, itemId: 100, item: { id: 100, template: 'only', blanks: [], hint: null } }],
    });
    await expect(svc.deleteSetItem('s-1', 10)).rejects.toThrow(BadRequestException);
    expect(prisma.drillSetItem.delete).not.toHaveBeenCalled();
  });

  it('404s for an item that is not in this set', async () => {
    await expect(svc.deleteSetItem('s-1', 999)).rejects.toThrow(NotFoundException);
  });
});

describe('SetsService.addSetItem', () => {
  let prisma: any;
  let svc: SetsService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.drillSet.findUnique.mockResolvedValue(existingSet());
    prisma.drillItem.findUnique.mockResolvedValue(null);
    prisma.drillItem.create.mockImplementation(async ({ data }: any) => ({ id: 500, ...data }));
    svc = new SetsService(prisma);
  });

  it('appends after the last existing sentence', async () => {
    await svc.addSetItem('s-1', { template: GOOD, hint: null });
    expect(prisma.drillSetItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ order: 2, itemId: 500 }) }),
    );
  });

  it('appends at position 0 when the set is empty', async () => {
    prisma.drillSet.findUnique.mockResolvedValue({ ...existingSet(), items: [] });
    await svc.addSetItem('s-1', { template: GOOD, hint: null });
    expect(prisma.drillSetItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ order: 0 }) }),
    );
  });

  it('rejects a sentence with no blank', async () => {
    await expect(svc.addSetItem('s-1', { template: 'no blank here.', hint: null })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.drillSetItem.create).not.toHaveBeenCalled();
  });

  it('reuses an identical sentence already in the bank instead of colliding on hash', async () => {
    // DrillItem.hash is @unique. A teacher retyping a sentence the bank already holds
    // must reuse that row, not fail the save with a constraint error.
    prisma.drillItem.findUnique.mockResolvedValue({ id: 321 });
    await svc.addSetItem('s-1', { template: GOOD, hint: null });
    expect(prisma.drillItem.create).not.toHaveBeenCalled();
    expect(prisma.drillSetItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ itemId: 321 }) }),
    );
  });
});
