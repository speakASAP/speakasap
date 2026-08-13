import { MasteryRepository } from './mastery.repository';

function prismaStub(existing: Array<Record<string, unknown>> = []) {
  const rows = [...existing];
  return {
    rows,
    upserts: [] as Array<Record<string, unknown>>,
    studentWordMastery: {
      findMany: jest.fn(async ({ where }: any) => {
        const wanted: string[] = where.normalizedAnswer?.in ?? [];
        return rows.filter(
          (r) =>
            r.studentId === where.studentId &&
            r.languageCode === where.languageCode &&
            (wanted.length === 0 || wanted.includes(r.normalizedAnswer as string)),
        );
      }),
      upsert: jest.fn(async (args: any) => {
        (prismaStubUpserts as any[]).push(args);
        return args;
      }),
    },
  };
}

let prismaStubUpserts: any[] = [];
beforeEach(() => {
  prismaStubUpserts = [];
});

describe('MasteryRepository.applyDeltas', () => {
  const now = new Date('2026-08-12T10:00:00Z');

  it('advances the streak of a clean word', async () => {
    const prisma = prismaStub([
      { studentId: 7, languageCode: 'en', normalizedAnswer: 'behind', cleanStreak: 1, totalMistakes: 4 },
    ]);
    const repo = new MasteryRepository(prisma as any);

    await repo.applyDeltas(
      7,
      'en',
      [{ normalizedAnswer: 'behind', displayAnswer: 'behind', clean: true, mistakes: 0 }],
      now,
    );

    expect(prismaStubUpserts).toHaveLength(1);
    expect(prismaStubUpserts[0].update.cleanStreak).toBe(2);
    expect(prismaStubUpserts[0].update.masteredAt).toBeNull();
  });

  it('marks a word mastered on the third clean appearance', async () => {
    const prisma = prismaStub([
      { studentId: 7, languageCode: 'en', normalizedAnswer: 'behind', cleanStreak: 2, totalMistakes: 4 },
    ]);
    const repo = new MasteryRepository(prisma as any);

    await repo.applyDeltas(
      7,
      'en',
      [{ normalizedAnswer: 'behind', displayAnswer: 'behind', clean: true, mistakes: 0 }],
      now,
    );

    expect(prismaStubUpserts[0].update.cleanStreak).toBe(3);
    expect(prismaStubUpserts[0].update.masteredAt).toEqual(now);
  });

  it('resets the streak and clears mastery when the word is missed again', async () => {
    const prisma = prismaStub([
      {
        studentId: 7,
        languageCode: 'en',
        normalizedAnswer: 'behind',
        cleanStreak: 3,
        totalMistakes: 4,
        masteredAt: new Date('2026-08-01T00:00:00Z'),
      },
    ]);
    const repo = new MasteryRepository(prisma as any);

    await repo.applyDeltas(
      7,
      'en',
      [{ normalizedAnswer: 'behind', displayAnswer: 'behind', clean: false, mistakes: 2 }],
      now,
    );

    expect(prismaStubUpserts[0].update.cleanStreak).toBe(0);
    expect(prismaStubUpserts[0].update.masteredAt).toBeNull();
    expect(prismaStubUpserts[0].update.totalMistakes).toBe(6);
  });

  it('creates a row for a word never seen before', async () => {
    const prisma = prismaStub();
    const repo = new MasteryRepository(prisma as any);

    await repo.applyDeltas(
      7,
      'en',
      [{ normalizedAnswer: 'through', displayAnswer: 'through', clean: false, mistakes: 3 }],
      now,
    );

    expect(prismaStubUpserts[0].create.cleanStreak).toBe(0);
    expect(prismaStubUpserts[0].create.totalMistakes).toBe(3);
    expect(prismaStubUpserts[0].create.masteredAt).toBeNull();
    expect(prismaStubUpserts[0].create.displayAnswer).toBe('through');
  });

  it('does nothing when there are no deltas', async () => {
    const prisma = prismaStub();
    const repo = new MasteryRepository(prisma as any);

    await repo.applyDeltas(7, 'en', [], now);

    expect(prisma.studentWordMastery.findMany).not.toHaveBeenCalled();
    expect(prismaStubUpserts).toHaveLength(0);
  });
});

describe('MasteryRepository.masteredAnswers', () => {
  it('returns only the answers already mastered', async () => {
    const prisma = prismaStub([
      { studentId: 7, languageCode: 'en', normalizedAnswer: 'behind', masteredAt: new Date() },
      { studentId: 7, languageCode: 'en', normalizedAnswer: 'through', masteredAt: null },
    ]);
    const repo = new MasteryRepository(prisma as any);

    const mastered = await repo.masteredAnswers(7, 'en', ['behind', 'through']);

    expect(mastered.has('behind')).toBe(true);
    expect(mastered.has('through')).toBe(false);
  });

  it('returns an empty set without querying when asked about nothing', async () => {
    const prisma = prismaStub();
    const repo = new MasteryRepository(prisma as any);

    const mastered = await repo.masteredAnswers(7, 'en', []);

    expect(mastered.size).toBe(0);
    expect(prisma.studentWordMastery.findMany).not.toHaveBeenCalled();
  });
});
