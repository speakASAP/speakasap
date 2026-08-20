import { HttpException } from '@nestjs/common';
import { CalculationRunsService } from './calculation-runs.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { EducationClientService } from '../deps/education-client.service';

/**
 * The guards `create` runs BEFORE it builds a single payout line.
 *
 * Everything downstream — the arithmetic in calculation-line-amount.spec.ts, the money
 * conversion in payout-money.spec.ts — is only safe if these refuse first. A run built on
 * a stale aggregate, an unknown period, or a silently-empty profile set produces
 * well-formed lines carrying wrong amounts, which is the failure mode this whole workstream
 * has been chasing.
 */

const PERIOD = '2026-07';

function codeOf(error: unknown): string {
  const body = (error as HttpException)?.getResponse?.() as { error?: { code?: string } };
  return body?.error?.code ?? 'NO_CODE';
}

type Profile = {
  id: string;
  legacyPortalUserId: number;
  rate: string;
  salary: string;
  currency: string;
};

function profile(over: Partial<Profile> = {}): Profile {
  return { id: 'p1', legacyPortalUserId: 3, rate: '350', salary: '0', currency: 'CZK', ...over };
}

function harness(opts: {
  profiles?: Profile[];
  aggregate?: unknown;
  aggregateThrows?: boolean;
  expenses?: Array<Record<string, unknown>>;
} = {}) {
  const created: Array<Record<string, unknown>> = [];
  const prisma = {
    salaryProfile: {
      findMany: jest.fn(async () =>
        (opts.profiles ?? [profile()]).map((p) => ({
          ...p,
          rate: { toString: () => p.rate },
          salary: { toString: () => p.salary },
        })),
      ),
    },
    salaryExpense: { findMany: jest.fn(async () => opts.expenses ?? []) },
    calculationRun: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: 'run-new' };
      }),
      findUniqueOrThrow: jest.fn(async () => ({
        id: 'run-new',
        status: 'draft',
        _count: { lines: 1 },
      })),
    },
    idempotencyRecord: {
      findUnique: jest.fn(async () => null),
      deleteMany: jest.fn(async () => ({ count: 0 })),
      upsert: jest.fn(async () => ({})),
    },
  } as unknown as PrismaService;

  const fetchPeriodAggregates = jest.fn(async () => {
    if (opts.aggregateThrows) throw new Error('education down');
    return (
      opts.aggregate ?? {
        items: new Map([[3, { totalMinutes: 600, finishedLessonCount: 10 }]]),
        readiness: {
          salaryCalculationReady: true,
          missingDurationCount: 0,
          implausibleRecordCount: 0,
          teacherMappingMissingCount: 0,
        },
        blockerSamples: [],
        warnings: [],
      }
    );
  });
  const education = { fetchPeriodAggregates } as unknown as EducationClientService;
  const idempotency = new IdempotencyService(prisma);
  jest.spyOn(idempotency, 'store').mockResolvedValue(undefined);

  return {
    service: new CalculationRunsService(prisma, education, idempotency),
    created,
    fetchPeriodAggregates,
    prisma,
  };
}

describe('CalculationRunsService.create', () => {
  const original = process.env.SALARY_CALCULATION_RUNS_ENABLED;

  beforeEach(() => {
    process.env.SALARY_CALCULATION_RUNS_ENABLED = 'true';
  });

  afterEach(() => {
    if (original === undefined) delete process.env.SALARY_CALCULATION_RUNS_ENABLED;
    else process.env.SALARY_CALCULATION_RUNS_ENABLED = original;
    jest.restoreAllMocks();
  });

  it('refuses entirely when calculation runs are disabled', async () => {
    delete process.env.SALARY_CALCULATION_RUNS_ENABLED;
    const h = harness();

    await h.service.create({ period: PERIOD, rulesVersion: 'v4' }).then(
      () => {
        throw new Error('should have refused');
      },
      (e) => expect(codeOf(e)).toBe('SALARY_CALCULATION_RUNS_DISABLED'),
    );
    expect(h.fetchPeriodAggregates).not.toHaveBeenCalled();
  });

  it('accepts only a YYYY-MM period', async () => {
    const h = harness();
    for (const period of ['2026-7', '26-07', '2026/07', 'July', '', '2026-07-01']) {
      await h.service.create({ period, rulesVersion: 'v4' }).then(
        () => {
          throw new Error(`should have rejected ${period}`);
        },
        (e) => expect(codeOf(e)).toBe('VALIDATION_FAILED'),
      );
    }
    expect(h.fetchPeriodAggregates).not.toHaveBeenCalled();
  });

  it('refuses when no salary profile matches, rather than creating an empty run', async () => {
    // An empty run reads as "nobody is owed anything", which is indistinguishable from a
    // filter that matched nothing by mistake.
    const h = harness({ profiles: [] });

    await h.service.create({ period: PERIOD, rulesVersion: 'v4' }).then(
      () => {
        throw new Error('should have refused');
      },
      (e) => expect(codeOf(e)).toBe('CALCULATION_INVALID'),
    );
  });

  it('reports education-service being down as DEPENDENCY_UNAVAILABLE', async () => {
    // Not as a run with zero hours for everyone.
    const h = harness({ aggregateThrows: true });

    await h.service.create({ period: PERIOD, rulesVersion: 'v4' }).then(
      () => {
        throw new Error('should have refused');
      },
      (e) => expect(codeOf(e)).toBe('DEPENDENCY_UNAVAILABLE'),
    );
  });

  it('refuses a run whose aggregate is not ready', async () => {
    const h = harness({
      aggregate: {
        items: new Map(),
        readiness: {
          salaryCalculationReady: false,
          missingDurationCount: 3,
          implausibleRecordCount: 0,
          teacherMappingMissingCount: 0,
        },
        blockerSamples: [],
        warnings: [],
      },
    });

    await h.service.create({ period: PERIOD, rulesVersion: 'v4' }).then(
      () => {
        throw new Error('should have refused');
      },
      (e) => expect(codeOf(e)).toBe('SALARY_PARITY_BLOCKERS_PRESENT'),
    );
  });

  it('refuses when imported hours are staler than the aggregate', async () => {
    // The June case: imported 19h against 58 computed. Paying from the import underpays.
    const h = harness({
      expenses: [
        { legacyPortalUserId: 3, lessonUuid: 'l1', qty: { toString: () => '19' } },
      ],
      aggregate: {
        items: new Map([[3, { totalMinutes: 58 * 60, finishedLessonCount: 58 }]]),
        readiness: {
          salaryCalculationReady: true,
          missingDurationCount: 0,
          implausibleRecordCount: 0,
          teacherMappingMissingCount: 0,
        },
        blockerSamples: [],
        warnings: [],
      },
    });

    await h.service.create({ period: PERIOD, rulesVersion: 'v4' }).then(
      () => {
        throw new Error('should have refused');
      },
      (e) => expect(codeOf(e)).toBe('SALARY_IMPORTED_HOURS_STALE'),
    );
  });

  it('creates a draft run with one line per profile when everything passes', async () => {
    const h = harness();
    const res = (await h.service.create({ period: PERIOD, rulesVersion: 'v4' })) as {
      status: string;
      lineCount: number;
    };

    expect(res.status).toBe('draft');
    expect(res.lineCount).toBe(1);
    // Never `finalized` straight away: finalizing is the separate, deliberate step that
    // makes a run payable.
    expect(h.created[0].status).toBe('draft');
  });

  it('computes the line amount from the aggregate hours', async () => {
    // 600 minutes = 10h at rate 350 = 3500.
    const h = harness();
    await h.service.create({ period: PERIOD, rulesVersion: 'v4' });

    const lines = (h.created[0].lines as { create: Array<{ amount: string }> }).create;
    expect(lines[0].amount).toBe('3500.00');
  });

  it('records the rulesVersion it was asked for', async () => {
    // A run computed under salary-duration-v3 carries different numbers than v4 for the
    // same month; the stored version is how anyone tells them apart afterwards.
    const h = harness();
    await h.service.create({ period: PERIOD, rulesVersion: 'salary-duration-v4' });

    expect(h.created[0].rulesVersion).toBe('salary-duration-v4');
  });
});
