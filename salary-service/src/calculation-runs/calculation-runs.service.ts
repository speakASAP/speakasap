import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CalculationRunStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EducationClientService } from '../deps/education-client.service';
import {
  decodeCursor,
  encodeCursor,
  ListEnvelope,
  parseListLimit,
} from '../shared/list-response';
import { idempotencyReplayException, salaryHttpException } from '../shared/salary-http.exception';
import { IdempotencyService, requestBodyHash } from '../idempotency/idempotency.service';

const PERIOD_RE = /^\d{4}-\d{2}$/;

function mergeCursor(
  base: Prisma.CalculationRunWhereInput,
  cur: { t: string; id: string } | null,
): Prisma.CalculationRunWhereInput {
  if (!cur) {
    return base;
  }
  const c: Prisma.CalculationRunWhereInput = {
    OR: [
      { createdAt: { lt: new Date(cur.t) } },
      { AND: [{ createdAt: { equals: new Date(cur.t) } }, { id: { lt: cur.id } }] },
    ],
  };
  return Object.keys(base).length ? { AND: [base, c] } : c;
}

@Injectable()
export class CalculationRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly education: EducationClientService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async create(
    body: { period: string; profileIds?: number[]; rulesVersion: string },
    idempotencyKey?: string,
  ) {
    if (!PERIOD_RE.test(body.period)) {
      throw salaryHttpException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'period must be YYYY-MM');
    }
    const route = 'POST /api/v1/calculation-runs';
    const hash = requestBodyHash(body);
    if (idempotencyKey) {
      const replay = await this.idempotency.lookupReplay(idempotencyKey, route, hash);
      if (replay && !replay.match) {
        throw salaryHttpException(HttpStatus.CONFLICT, 'CONFLICT', 'Idempotency-Key reuse with different body');
      }
      if (replay?.match) {
        throw idempotencyReplayException(replay.body);
      }
    }

    const whereProfile: Prisma.SalaryProfileWhereInput =
      body.profileIds && body.profileIds.length
        ? { legacyPortalUserId: { in: body.profileIds } }
        : {};

    const profiles = await this.prisma.salaryProfile.findMany({ where: whereProfile });
    if (!profiles.length) {
      throw salaryHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CALCULATION_INVALID',
        'No salary profiles match the request',
      );
    }

    const internal =
      process.env.EDUCATION_SERVICE_INTERNAL_TOKEN ||
      process.env.INTERNAL_API_TOKEN ||
      '';
    let agg: Map<number, import('../deps/education-client.service').PeriodAggregateItem>;
    try {
      agg = await this.education.fetchPeriodAggregates(
        body.period,
        profiles.map((p) => p.legacyPortalUserId),
        internal,
      );
    } catch {
      throw salaryHttpException(
        HttpStatus.BAD_GATEWAY,
        'DEPENDENCY_UNAVAILABLE',
        'education-service unavailable',
      );
    }

    const run = await this.prisma.calculationRun.create({
      data: {
        period: body.period,
        rulesVersion: body.rulesVersion,
        status: 'draft',
        profileIds: body.profileIds === undefined ? undefined : body.profileIds,
        lines: {
          create: profiles.map((p) => {
            const a = agg.get(p.legacyPortalUserId);
            const hours = a ? a.totalMinutes / 60 : 0;
            const fromRate = Number(p.rate.toString()) * hours;
            const fromSalary = Number(p.salary.toString());
            const amount = (fromSalary + fromRate).toFixed(2);
            return {
              profileId: p.id,
              legacyPortalUserId: p.legacyPortalUserId,
              amount,
              currency: p.currency,
              breakdown: {
                period: body.period,
                finishedLessonCount: a?.finishedLessonCount ?? 0,
                totalMinutes: a?.totalMinutes ?? 0,
                monthlySalaryComponent: fromSalary,
                hourlyComponent: fromRate,
              },
            };
          }),
        },
      },
    });

    const created = await this.prisma.calculationRun.findUniqueOrThrow({
      where: { id: run.id },
      include: { _count: { select: { lines: true } } },
    });
    const response = {
      calculationRunId: created.id,
      status: created.status,
      lineCount: created._count.lines,
    };
    if (idempotencyKey) {
      await this.idempotency.store(idempotencyKey, route, hash, 201, response);
    }
    return response;
  }

  async getOne(runId: string) {
    const run = await this.prisma.calculationRun.findUnique({
      where: { id: runId },
      include: { _count: { select: { lines: true } } },
    });
    if (!run) {
      throw new NotFoundException('Calculation run not found');
    }
    return {
      id: run.id,
      period: run.period,
      status: run.status,
      rulesVersion: run.rulesVersion,
      lineCount: run._count.lines,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };
  }

  async list(params: { limit?: string; cursor?: string }): Promise<
    ListEnvelope<{
      id: string;
      period: string;
      status: string;
      rulesVersion: string;
      lineCount: number;
      createdAt: string;
    }>
  > {
    const limit = parseListLimit(params.limit);
    const cur = decodeCursor(params.cursor);
    const where = mergeCursor({}, cur);
    const rows = await this.prisma.calculationRun.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { _count: { select: { lines: true } } },
    });
    let nextCursor: string | null = null;
    let data = rows;
    if (rows.length > limit) {
      data = rows.slice(0, limit);
      const last = data[data.length - 1];
      nextCursor = encodeCursor({ t: last.createdAt.toISOString(), id: last.id });
    }
    return {
      data: data.map((r) => ({
        id: r.id,
        period: r.period,
        status: r.status,
        rulesVersion: r.rulesVersion,
        lineCount: r._count.lines,
        createdAt: r.createdAt.toISOString(),
      })),
      meta: { nextCursor, limit },
    };
  }

  async finalize(runId: string) {
    const run = await this.prisma.calculationRun.findUnique({
      where: { id: runId },
      include: { lines: true },
    });
    if (!run) {
      throw new NotFoundException('Calculation run not found');
    }
    if (run.status !== 'draft') {
      throw salaryHttpException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'Run is not in draft state',
      );
    }
    if (!run.lines.length) {
      throw salaryHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CALCULATION_INVALID',
        'Cannot finalize run without lines',
      );
    }
    await this.prisma.calculationRun.update({
      where: { id: runId },
      data: { status: CalculationRunStatus.finalized },
    });
    return { calculationRunId: runId, status: 'finalized' as const };
  }
}
