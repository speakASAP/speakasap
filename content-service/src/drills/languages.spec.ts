import { DrillsService } from './drills.service';

const prisma = {
  language: { findMany: jest.fn() },
} as any;
const vocabulary = { getBaseline: jest.fn() } as any;

describe('DrillsService.listLanguages', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns the id every upstream caller needs alongside the code it works in', async () => {
    prisma.language.findMany.mockResolvedValue([
      { id: 3, code: 'de', name: 'Немецкий' },
      { id: 1, code: 'en', name: 'Английский' },
    ]);
    const svc = new DrillsService(prisma, vocabulary);

    await expect(svc.listLanguages()).resolves.toEqual([
      { id: 3, code: 'de', name: 'Немецкий' },
      { id: 1, code: 'en', name: 'Английский' },
    ]);
  });

  it('orders by the site-wide order column so a picker matches the rest of the site', async () => {
    prisma.language.findMany.mockResolvedValue([]);
    const svc = new DrillsService(prisma, vocabulary);
    await svc.listLanguages();

    expect(prisma.language.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ order: 'asc' }, { code: 'asc' }] }),
    );
  });

  // The row carries iconPath, machineName and speaker too. Selecting explicitly keeps
  // them out of a response that other services parse.
  it('selects only the three fields it publishes', async () => {
    prisma.language.findMany.mockResolvedValue([]);
    const svc = new DrillsService(prisma, vocabulary);
    await svc.listLanguages();

    expect(prisma.language.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true, code: true, name: true } }),
    );
  });

  it('returns an empty list rather than throwing when there are no languages', async () => {
    prisma.language.findMany.mockResolvedValue([]);
    const svc = new DrillsService(prisma, vocabulary);
    await expect(svc.listLanguages()).resolves.toEqual([]);
  });
});
