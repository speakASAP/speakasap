import { Logger } from '@nestjs/common';
import { AnalysisService } from './analysis.service';

const assignment = {
  uuid: 'a1',
  studentId: 7,
  languageCode: 'en',
  materialLanguage: 'ru',
  items: [
    {
      uuid: 'i1',
      order: 0,
      template: 'We will have to walk {{0}} this market.',
      blanks: [{ index: 0, answer: 'through', prompt: 'через' }],
    },
    {
      uuid: 'i2',
      order: 1,
      template: 'Get {{0}} your car immediately!',
      blanks: [{ index: 0, answer: 'out of', prompt: 'из' }],
    },
  ],
};

const attempts = [
  { itemUuid: 'i1', blankIndex: 0, submittedValue: 'across', isCorrect: false, revealed: false, attemptNo: 1 },
  { itemUuid: 'i2', blankIndex: 0, submittedValue: 'out', isCorrect: false, revealed: false, attemptNo: 1 },
];

function deps(overrides: Record<string, any> = {}) {
  const repo = {
    createRun: jest.fn(async () => 'run-1'),
    markRunning: jest.fn(async () => undefined),
    markReady: jest.fn(async () => undefined),
    markNoErrors: jest.fn(async () => undefined),
    markFailed: jest.fn(async () => undefined),
    replaceClusters: jest.fn(async () => undefined),
    ...overrides.repo,
  };

  const client = {
    analyze: jest.fn(async () => ({
      clusters: [
        {
          topicSlug: 'en.prepositions-of-movement',
          title: 'Предлоги движения',
          explanation: 'through — сквозь',
          rules: [],
          examples: [],
          answers: ['through', 'out of'],
        },
      ],
    })),
    ...overrides.client,
  };

  const taxonomy = {
    slugsFor: jest.fn(async () => ['en.prepositions-of-movement', 'en.other']),
    fallbackSlug: (lang: string) => `${lang}.other`,
    coerceSlug: (candidate: string, allowed: string[], lang: string) =>
      allowed.includes(candidate)
        ? { slug: candidate, coerced: false }
        : { slug: `${lang}.other`, coerced: true },
    ...overrides.taxonomy,
  };

  const prisma: any = {
    drillAssignment: {
      findUnique: jest.fn(async () => overrides.assignment ?? assignment),
    },
    drillAttempt: {
      findMany: jest.fn(async () => overrides.attempts ?? attempts),
    },
  };

  return { repo, client, taxonomy, prisma };
}

describe('AnalysisService.run', () => {
  it('marks the run NO_ERRORS and never calls the model when nothing was wrong', async () => {
    const d = deps({ attempts: [
      { itemUuid: 'i1', blankIndex: 0, submittedValue: 'through', isCorrect: true, revealed: false, attemptNo: 1 },
    ] });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    expect(d.repo.markNoErrors).toHaveBeenCalledWith('run-1');
    expect(d.client.analyze).not.toHaveBeenCalled();
    expect(d.repo.markFailed).not.toHaveBeenCalled();
  });

  it('sends every failed blank to the analyzer with the allowed slugs', async () => {
    const d = deps();
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    const sent = d.client.analyze.mock.calls[0][0];
    expect(sent.failures).toHaveLength(2);
    expect(sent.allowedTopicSlugs).toEqual(['en.prepositions-of-movement', 'en.other']);
    expect(sent.materialLanguage).toBe('ru');
    expect(sent.correlationId).toBe('cid-1');
  });

  it('persists the clusters and marks the run READY', async () => {
    const d = deps();
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    expect(d.repo.replaceClusters).toHaveBeenCalled();
    const clusters = d.repo.replaceClusters.mock.calls[0][5];
    expect(clusters).toHaveLength(1);
    expect(clusters[0].failedAnswers.map((a: any) => a.answer).sort()).toEqual(['out of', 'through']);
    expect(d.repo.markReady).toHaveBeenCalledWith('run-1');
  });

  it('coerces an out-of-taxonomy slug to the language fallback', async () => {
    const d = deps({
      client: {
        analyze: jest.fn(async () => ({
          clusters: [
            { topicSlug: 'en.invented', title: 't', explanation: 'e', rules: [], examples: [], answers: ['through', 'out of'] },
          ],
        })),
      },
    });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    expect(d.repo.replaceClusters.mock.calls[0][5][0].topicSlug).toBe('en.other');
  });

  it('files an answer no cluster claimed under the fallback rather than dropping it', async () => {
    const d = deps({
      client: {
        analyze: jest.fn(async () => ({
          clusters: [
            { topicSlug: 'en.prepositions-of-movement', title: 't', explanation: 'e', rules: [], examples: [], answers: ['through'] },
          ],
        })),
      },
    });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    const clusters = d.repo.replaceClusters.mock.calls[0][5];
    const answers = clusters.flatMap((c: any) => c.failedAnswers.map((a: any) => a.answer));
    expect(answers.sort()).toEqual(['out of', 'through']);
    expect(clusters.some((c: any) => c.topicSlug === 'en.other')).toBe(true);
  });

  it('never puts one answer in two clusters', async () => {
    const d = deps({
      client: {
        analyze: jest.fn(async () => ({
          clusters: [
            { topicSlug: 'en.prepositions-of-movement', title: 't', explanation: 'e', rules: [], examples: [], answers: ['through', 'out of'] },
            { topicSlug: 'en.other', title: 't2', explanation: 'e2', rules: [], examples: [], answers: ['through'] },
          ],
        })),
      },
    });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    const clusters = d.repo.replaceClusters.mock.calls[0][5];
    const answers = clusters.flatMap((c: any) => c.failedAnswers.map((a: any) => a.answer));
    expect(answers).toHaveLength(new Set(answers).size);
  });

  it('drops a cluster left with no answers after attribution', async () => {
    const d = deps({
      client: {
        analyze: jest.fn(async () => ({
          clusters: [
            { topicSlug: 'en.prepositions-of-movement', title: 't', explanation: 'e', rules: [], examples: [], answers: ['through', 'out of'] },
            { topicSlug: 'en.other', title: 'empty', explanation: 'e', rules: [], examples: [], answers: ['not-a-real-answer'] },
          ],
        })),
      },
    });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    const clusters = d.repo.replaceClusters.mock.calls[0][5];
    expect(clusters.every((c: any) => c.failedAnswers.length > 0)).toBe(true);
  });

  it('marks the run FAILED when the analyzer throws, and does not throw itself', async () => {
    const d = deps({ client: { analyze: jest.fn(async () => { throw new Error('502 Bad Gateway'); }) } });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await expect(service.run('a1', 'cid-1')).resolves.toBeUndefined();

    expect(d.repo.markFailed).toHaveBeenCalledWith('run-1', expect.stringContaining('502'));
    expect(d.repo.markReady).not.toHaveBeenCalled();
  });

  it('marks the run FAILED when the taxonomy is missing for the language', async () => {
    const d = deps({
      taxonomy: { slugsFor: jest.fn(async () => { throw new Error('No grammar taxonomy seeded for language "fr"'); }) },
    });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    expect(d.repo.markFailed).toHaveBeenCalledWith('run-1', expect.stringContaining('taxonomy'));
  });

  // No run row can exist for an assignment that is gone: createRun needs its studentId,
  // and DrillAnalysisRun.studentId is a required column. The failure is visible in the
  // error log rather than on a row — this is the one path with nothing to mark.
  it('logs and gives up when the assignment has vanished, without creating a run row', async () => {
    const d = deps();
    d.prisma.drillAssignment.findUnique = jest.fn(async () => null);
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await expect(service.run('a1', 'cid-1')).resolves.toBeUndefined();

    expect(d.repo.createRun).not.toHaveBeenCalled();
    expect(d.repo.markFailed).not.toHaveBeenCalled();
    expect(d.client.analyze).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('a1'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('cid-1'));
  });

  it('marks RUNNING before calling the analyzer', async () => {
    const d = deps();
    const order: string[] = [];
    d.repo.markRunning = jest.fn(async () => { order.push('running'); });
    d.client.analyze = jest.fn(async () => { order.push('analyze'); return { clusters: [] }; });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    expect(order).toEqual(['running', 'analyze']);
  });
});
