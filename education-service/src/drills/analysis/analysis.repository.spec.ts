import { NotFoundException } from '@nestjs/common';
import { AnalysisRepository } from './analysis.repository';

function prismaStub(overrides: Record<string, any> = {}) {
  const state = {
    runs: [] as any[],
    clusters: [] as any[],
  };

  const prisma: any = {
    state,
    drillAnalysisRun: {
      findUnique: jest.fn(async ({ where, include }: any) => {
        const run = state.runs.find((r) => r.sourceAssignmentUuid === where.sourceAssignmentUuid);
        if (!run) return null;
        return include?.clusters
          ? { ...run, clusters: state.clusters.filter((c) => c.runUuid === run.uuid) }
          : run;
      }),
      create: jest.fn(async ({ data }: any) => {
        state.runs.push({ ...data });
        return data;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const run = state.runs.find((r) => r.uuid === where.uuid);
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in (value as any)) {
            run[key] = (run[key] ?? 0) + (value as any).increment;
          } else {
            run[key] = value;
          }
        }
        return run;
      }),
      ...overrides.drillAnalysisRun,
    },
    drillGapAnalysis: {
      deleteMany: jest.fn(async ({ where }: any) => {
        state.clusters = state.clusters.filter((c) => c.runUuid !== where.runUuid);
        return { count: 0 };
      }),
      create: jest.fn(async ({ data }: any) => {
        state.clusters.push({ ...data });
        return data;
      }),
      findUnique: jest.fn(async ({ where }: any) =>
        state.clusters.find((c) => c.uuid === where.uuid) ?? null,
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const cluster = state.clusters.find((c) => c.uuid === where.uuid);
        if (!cluster) {
          throw Object.assign(new Error('Record to update not found'), { code: 'P2025' });
        }
        Object.assign(cluster, data);
        return cluster;
      }),
      ...overrides.drillGapAnalysis,
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };

  return prisma;
}

describe('AnalysisRepository.createRun', () => {
  it('creates a PENDING run', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);

    const uuid = await repo.createRun('a1', 7);

    expect(typeof uuid).toBe('string');
    expect(prisma.state.runs[0].status).toBe('PENDING');
    expect(prisma.state.runs[0].studentId).toBe(7);
  });

  it('returns the existing run rather than creating a second for one assignment', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);

    const first = await repo.createRun('a1', 7);
    const second = await repo.createRun('a1', 7);

    expect(second).toBe(first);
    expect(prisma.state.runs).toHaveLength(1);
  });
});

describe('AnalysisRepository run states', () => {
  it('records a failure with its message', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);

    await repo.markFailed(uuid, 'upstream 502');

    const run = prisma.state.runs[0];
    expect(run.status).toBe('FAILED');
    expect(run.errorMessage).toBe('upstream 502');
    expect(run.finishedAt).toBeInstanceOf(Date);
  });

  it('keeps NO_ERRORS distinct from READY and from FAILED', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);

    await repo.markNoErrors(uuid);

    expect(prisma.state.runs[0].status).toBe('NO_ERRORS');
    expect(prisma.state.runs[0].errorMessage).toBeNull();
  });

  it('clears a previous error message when a retry succeeds', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);
    await repo.markFailed(uuid, 'upstream 502');

    await repo.markReady(uuid);

    expect(prisma.state.runs[0].status).toBe('READY');
    expect(prisma.state.runs[0].errorMessage).toBeNull();
  });

  it('counts attempts when a run starts', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);

    await repo.markRunning(uuid);
    await repo.markRunning(uuid);

    expect(prisma.state.runs[0].attemptCount).toBe(2);
    expect(prisma.state.runs[0].status).toBe('RUNNING');
  });
});

describe('AnalysisRepository.replaceClusters', () => {
  const cluster = {
    topicSlug: 'en.prepositions-of-movement',
    title: 'Предлоги движения',
    explanation: 'through — сквозь',
    rules: ['through — внутри и наружу'],
    examples: [{ text: 'Walk through the park.', gloss: 'Пройди через парк.' }],
    failedAnswers: [
      { answer: 'through', normalized: 'through', mistakeCount: 3, wrongAttempts: ['across'] },
    ],
  };

  it('writes one row per cluster', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);

    await repo.replaceClusters(uuid, 'a1', 7, 'en', 'ru', [cluster]);

    expect(prisma.state.clusters).toHaveLength(1);
    expect(prisma.state.clusters[0].topicSlug).toBe('en.prepositions-of-movement');
    expect(prisma.state.clusters[0].failedAnswers[0].mistakeCount).toBe(3);
  });

  it('replaces previous clusters so a retry does not duplicate them', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);

    await repo.replaceClusters(uuid, 'a1', 7, 'en', 'ru', [cluster]);
    await repo.replaceClusters(uuid, 'a1', 7, 'en', 'ru', [cluster]);

    expect(prisma.state.clusters).toHaveLength(1);
  });
});

describe('AnalysisRepository.updateCluster', () => {
  it('stamps the editing teacher', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);
    await repo.replaceClusters(uuid, 'a1', 7, 'en', 'ru', [
      {
        topicSlug: 'en.other',
        title: 't',
        explanation: 'e',
        rules: [],
        examples: [],
        failedAnswers: [],
      },
    ]);
    const clusterUuid = prisma.state.clusters[0].uuid;

    await repo.updateCluster(clusterUuid, { explanation: 'better' }, 182);

    expect(prisma.state.clusters[0].explanation).toBe('better');
    expect(prisma.state.clusters[0].editedByTeacherId).toBe(182);
    expect(prisma.state.clusters[0].editedAt).toBeInstanceOf(Date);
  });

  it('leaves fields the patch does not mention untouched', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);
    await repo.replaceClusters(uuid, 'a1', 7, 'en', 'ru', [
      {
        topicSlug: 'en.other',
        title: 'original',
        explanation: 'e',
        rules: ['r'],
        examples: [],
        failedAnswers: [],
      },
    ]);
    const clusterUuid = prisma.state.clusters[0].uuid;

    await repo.updateCluster(clusterUuid, { explanation: 'better' }, 182);

    expect(prisma.state.clusters[0].title).toBe('original');
    expect(prisma.state.clusters[0].rules).toEqual(['r']);
  });

  it('raises NotFoundException when the cluster does not exist', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);

    await expect(repo.updateCluster('missing-uuid', { title: 'x' }, 182)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('AnalysisRepository.getRunWithClusters', () => {
  it('returns null for an assignment that was never analyzed', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);

    const result = await repo.getRunWithClusters('never-analyzed');

    expect(result).toBeNull();
  });

  it('returns the run with its clusters populated', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);
    await repo.replaceClusters(uuid, 'a1', 7, 'en', 'ru', [
      {
        topicSlug: 'en.prepositions-of-movement',
        title: 'Предлоги движения',
        explanation: 'through — сквозь',
        rules: ['through — внутри и наружу'],
        examples: [{ text: 'Walk through the park.', gloss: 'Пройди через парк.' }],
        failedAnswers: [
          { answer: 'through', normalized: 'through', mistakeCount: 3, wrongAttempts: ['across'] },
        ],
      },
    ]);
    await repo.markReady(uuid);

    const result = await repo.getRunWithClusters('a1');

    expect(result).not.toBeNull();
    expect(result!.uuid).toBe(uuid);
    expect(result!.sourceAssignmentUuid).toBe('a1');
    expect(result!.studentId).toBe(7);
    expect(result!.status).toBe('READY');
    expect(result!.clusters).toHaveLength(1);
    expect(result!.clusters[0].topicSlug).toBe('en.prepositions-of-movement');
    expect(result!.clusters[0].title).toBe('Предлоги движения');
    expect(result!.clusters[0].failedAnswers[0].mistakeCount).toBe(3);
  });
});

describe('AnalysisRepository.getCluster', () => {
  it('returns null for an unknown uuid', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);

    const result = await repo.getCluster('unknown-uuid');

    expect(result).toBeNull();
  });

  it('returns the record for a known uuid', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);
    await repo.replaceClusters(uuid, 'a1', 7, 'en', 'ru', [
      {
        topicSlug: 'en.other',
        title: 'A title',
        explanation: 'An explanation',
        rules: ['r1'],
        examples: [{ text: 't', gloss: 'g' }],
        failedAnswers: [],
      },
    ]);
    const clusterUuid = prisma.state.clusters[0].uuid;

    const result = await repo.getCluster(clusterUuid);

    expect(result).not.toBeNull();
    expect(result!.uuid).toBe(clusterUuid);
    expect(result!.topicSlug).toBe('en.other');
    expect(result!.title).toBe('A title');
    expect(result!.explanation).toBe('An explanation');
    expect(result!.rules).toEqual(['r1']);
  });
});
