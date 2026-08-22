import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SetsService } from './sets.service';
import { hashItem, parseTemplate } from '../template';

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
    drillItem: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    },
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

/**
 * Seeds the bank with one row, looked up the way the service looks it up — by hash, not
 * by "whatever findUnique was asked for". A blanket mock cannot tell a plain-text hit from
 * a markup-variant miss, which is exactly the distinction under test here.
 */
const bankHolding = (prisma: any, rows: { id: number; template: string }[]): void => {
  const stored = rows.map((row) => {
    const plainText = parseTemplate(row.template).plainText;
    return { ...row, plainText, hash: hashItem(plainText, 'de') };
  });
  const byHash = new Map(stored.map((row) => [row.hash, row]));

  prisma.drillItem.findUnique.mockImplementation(
    async ({ where }: any) => byHash.get(where.hash) ?? null,
  );
  // The punctuation-tolerant lookup reads the bank by plainText prefix, the way it must
  // in order to reach the 27k legacy rows that carry only the strict hash.
  prisma.drillItem.findMany.mockImplementation(async ({ where }: any) => {
    const prefix = where?.plainText?.startsWith ?? '';
    return stored.filter((row) => row.plainText.startsWith(prefix));
  });
};

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

  it('keeps a re-blanked sentence instead of reusing the bank row it was cut from', async () => {
    // The bank dedups on plain text with the answers substituted in, so re-marking which
    // words are blank — the review screen's main edit — leaves the hash unchanged and used
    // to hand back the *unedited* row. The teacher saw "saved" and their markup was gone.
    // Same words, different blank: hashes identical, exercises different.
    bankHolding(prisma, [{ id: 321, template: 'Ich warte [на]{auf} den [автобус]{Bus}.' }]);

    await svc.updateSetItem('s-1', 10, { template: GOOD });

    expect(prisma.drillItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ template: GOOD }) }),
    );
    expect(prisma.drillSetItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 10 }, data: expect.objectContaining({ itemId: 500 }) }),
    );
  });

  it('still reuses the bank row when the template is character-identical', async () => {
    // Dedup is only wrong when it discards an edit. An unchanged template must not mint a
    // second row on every save, or a teacher clicking Save twice forks the bank.
    bankHolding(prisma, [{ id: 321, template: GOOD }]);

    await svc.updateSetItem('s-1', 10, { template: GOOD });

    expect(prisma.drillItem.create).not.toHaveBeenCalled();
    expect(prisma.drillSetItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 10 }, data: expect.objectContaining({ itemId: 321 }) }),
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

describe('SetsService.updateSetItem — punctuation and bank reuse', () => {
  let prisma: any;
  let svc: SetsService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.drillSet.findUnique.mockResolvedValue(existingSet());
    prisma.drillItem.findUnique.mockResolvedValue(null);
    prisma.drillItem.create.mockImplementation(async ({ data }: any) => ({ id: 500, ...data }));
    svc = new SetsService(prisma);
  });

  it('reuses the bank row when a re-blanked sentence lost its final period', () => {
    // The cause of the duplicates in production set 3c9a3b78. A teacher re-blanking a
    // sentence retyped it without the closing '.', the exact-hash lookup missed, and a
    // second bank row was created for what is the same sentence. The set then showed it
    // twice. The loose key has to catch this before anything is created.
    const banked = 'Ich warte [на]{auf} den Bus.';
    bankHolding(prisma, [{ id: 777, template: banked }]);

    // Same sentence, same blanks, no trailing period.
    return svc.updateSetItem('s-1', 10, { template: 'Ich warte [на]{auf} den Bus' }).then(() => {
      expect(prisma.drillItem.create).not.toHaveBeenCalled();
      const patch = prisma.drillSetItem.update.mock.calls[0][0].data;
      expect(patch.itemId).toBe(777);
    });
  });

  it('still creates a row for a sentence that differs by more than its terminator', () => {
    bankHolding(prisma, [{ id: 777, template: 'Ich warte [на]{auf} den Bus.' }]);
    return svc
      .updateSetItem('s-1', 10, { template: 'Ich warte [на]{auf} den Zug.' })
      .then(() => {
        expect(prisma.drillItem.create).toHaveBeenCalled();
      });
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

  it('renumbers survivors low-to-high so the unique (setUuid, order) never collides', async () => {
    // `@@unique([setUuid, order])` is enforced per statement, not at commit. Shifting a
    // row down onto an order still occupied by its neighbour aborts the transaction, so
    // the whole delete fails and the teacher is told nothing was removed. The renumber
    // must therefore run in ascending order of the survivors, closing each gap before
    // the next row moves into it.
    //
    // Production set 3c9a3b78 hit exactly this: 18 sentences, deletes rejected.
    prisma.drillSet.findUnique.mockResolvedValue({
      ...existingSet(),
      // Deliberately not sorted: Prisma returns relation rows in no guaranteed order,
      // and the previous implementation renumbered in whatever order it received.
      items: [
        { id: 13, order: 3, itemId: 103, item: { id: 103, template: 'D', blanks: [], hint: null } },
        { id: 11, order: 1, itemId: 101, item: { id: 101, template: 'B', blanks: [], hint: null } },
        { id: 12, order: 2, itemId: 102, item: { id: 102, template: 'C', blanks: [], hint: null } },
        { id: 10, order: 0, itemId: 100, item: { id: 100, template: 'A', blanks: [], hint: null } },
      ],
    });

    await svc.deleteSetItem('s-1', 10);

    const moves = prisma.drillSetItem.update.mock.calls.map((call: any[]) => ({
      id: call[0].where.id,
      order: call[0].data.order,
    }));
    expect(moves).toEqual([
      { id: 11, order: 0 },
      { id: 12, order: 1 },
      { id: 13, order: 2 },
    ]);
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

  it('links the new row by setUuid — DrillSetItem has no setId field', async () => {
    // The relation is `setUuid -> DrillSet.uuid`; `drill_set` has no id column at all.
    // Writing `setId` makes Prisma reject the create with "Unknown argument `setId`",
    // so Add sentence failed outright. The other assertions here use objectContaining,
    // which cannot see a surplus key, which is how this shipped.
    await svc.addSetItem('s-1', { template: GOOD, hint: null });

    const data = prisma.drillSetItem.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('setId');
    expect(data.setUuid).toBe('s-1');
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
    bankHolding(prisma, [{ id: 321, template: GOOD }]);
    await svc.addSetItem('s-1', { template: GOOD, hint: null });
    expect(prisma.drillItem.create).not.toHaveBeenCalled();
    expect(prisma.drillSetItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ itemId: 321 }) }),
    );
  });
});
