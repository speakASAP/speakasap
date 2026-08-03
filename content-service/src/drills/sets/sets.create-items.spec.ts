import { SetsService } from './sets.service';

/**
 * Regression tests for the defect that made every AI-generated set arrive empty.
 *
 * `createSet` used to accept only `itemIds` — references to DrillItem rows that
 * already exist. Bank items have those; AI-generated items do not, and nothing
 * created rows for them, so `GenerationService` filtered every AI candidate out
 * and sent `itemIds: []`. In production that produced a set with `origin: AI`,
 * `reviewState: PENDING_REVIEW` and zero items, while the pipeline reported
 * READY (verified 2026-08-03). The generated sentences were paid for and
 * discarded.
 */

const makePrisma = () => {
  const created: any[] = [];
  const prisma: any = {
    drillSet: {
      create: jest.fn(async (args: any) => ({ uuid: args.data.uuid, ...args.data, items: [] })),
      findUnique: jest.fn(async () => ({
        uuid: 's-1',
        languageId: 1,
        materialLanguage: 'ru',
        level: 'A1',
        courseKey: 'de-a1',
        lessonOrder: 3,
        origin: 'AI',
        reviewState: 'PENDING_REVIEW',
        topicSlugs: [],
        language: { code: 'de' },
        items: [],
        _count: { items: 0 },
      })),
      update: jest.fn(),
    },
    drillSetItem: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    drillItem: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(async (args: any) => {
        created.push(args.data);
        return { id: 500 + created.length, ...args.data };
      }),
    },
    drillTopic: { findFirst: jest.fn().mockResolvedValue({ id: 9 }) },
    language: { findUnique: jest.fn().mockResolvedValue({ code: 'de' }) },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  return { prisma, created };
};

const aiItem = (template: string, topicSlug = 'prepositions') => ({
  template,
  blanks: [{ index: 0, prompt: 'на', answer: 'auf', alternatives: [] }],
  hint: null,
  topicSlug,
});

const baseInput = () => ({
  uuid: 's-1',
  title: 'Präpositionen',
  languageId: 1,
  materialLanguage: 'ru',
  origin: 'AI' as const,
  reviewState: 'PENDING_REVIEW' as const,
  itemIds: [],
});

describe('SetsService.createSet — AI item persistence', () => {
  let prisma: any;
  let created: any[];
  let svc: SetsService;

  beforeEach(() => {
    ({ prisma, created } = makePrisma());
    svc = new SetsService(prisma);
  });

  it('creates DrillItem rows for items that do not exist yet', async () => {
    await svc.createSet({
      ...baseInput(),
      newItems: [aiItem('Ich warte [на]{auf} den Bus.'), aiItem('Ich gehe [в]{in} die Schule.')],
    } as never);

    expect(created).toHaveLength(2);
    expect(created[0].template).toBe('Ich warte [на]{auf} den Bus.');
    expect(created[1].template).toBe('Ich gehe [в]{in} die Schule.');
  });

  it('marks generated rows as AI so the bank can tell them apart', async () => {
    await svc.createSet({
      ...baseInput(),
      newItems: [aiItem('Ich warte [на]{auf} den Bus.')],
    } as never);

    expect(created[0].sourceType).toBe('AI');
  });

  it('attaches the new items to the set', async () => {
    await svc.createSet({
      ...baseInput(),
      newItems: [aiItem('Ich warte [на]{auf} den Bus.'), aiItem('Ich gehe [в]{in} die Schule.')],
    } as never);

    const setItems = prisma.drillSet.create.mock.calls[0][0].data.items.create;
    expect(setItems).toHaveLength(2);
    expect(setItems.map((i: any) => i.order)).toEqual([0, 1]);
  });

  // Bank items are already in the bank; AI items are appended after them so the
  // ordering the generator produced is preserved rather than interleaved.
  it('places bank items first, then the generated ones', async () => {
    await svc.createSet({
      ...baseInput(),
      itemIds: [11, 22],
      newItems: [aiItem('Ich warte [на]{auf} den Bus.')],
    } as never);

    const setItems = prisma.drillSet.create.mock.calls[0][0].data.items.create;
    expect(setItems.map((i: any) => i.order)).toEqual([0, 1, 2]);
    expect(setItems[0].itemId).toBe(11);
    expect(setItems[1].itemId).toBe(22);
    expect(setItems[2].itemId).toBe(501);
  });

  // The same sentence generated twice must not create two bank rows. upsertItem
  // hashes on plain text plus language for exactly this.
  it('reuses an existing row when the sentence is already in the bank', async () => {
    prisma.drillItem.findUnique.mockResolvedValue({ id: 777 });

    await svc.createSet({
      ...baseInput(),
      newItems: [aiItem('Ich warte [на]{auf} den Bus.')],
    } as never);

    expect(prisma.drillItem.create).not.toHaveBeenCalled();
    const setItems = prisma.drillSet.create.mock.calls[0][0].data.items.create;
    expect(setItems[0].itemId).toBe(777);
  });

  it('still works for a pure bank set with no generated items', async () => {
    await svc.createSet({ ...baseInput(), itemIds: [11, 22] } as never);

    expect(prisma.drillItem.create).not.toHaveBeenCalled();
    const setItems = prisma.drillSet.create.mock.calls[0][0].data.items.create;
    expect(setItems.map((i: any) => i.itemId)).toEqual([11, 22]);
  });

  it('creates the items inside the same transaction as the set', async () => {
    await svc.createSet({
      ...baseInput(),
      newItems: [aiItem('Ich warte [на]{auf} den Bus.')],
    } as never);

    // A set that exists with no items looks identical to a finished one in a
    // teacher's review queue, so the two writes must not be separable.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
