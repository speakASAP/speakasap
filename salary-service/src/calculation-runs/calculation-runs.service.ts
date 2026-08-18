import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CalculationRunStatus, Prisma, SalaryExpenseKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EducationClientService, PeriodAggregateResult } from '../deps/education-client.service';
import {
  decodeCursor,
  encodeCursor,
  ListEnvelope,
  parseListLimit,
} from '../shared/list-response';
import { idempotencyReplayException, salaryHttpException } from '../shared/salary-http.exception';
import { IdempotencyService, requestBodyHash } from '../idempotency/idempotency.service';

const PERIOD_RE = /^\d{4}-\d{2}$/;
const CALCULATION_RUNS_ENABLED_ENV = 'SALARY_CALCULATION_RUNS_ENABLED';

type ImportedLessonSalaryTotal = {
  legacyPortalUserId: number;
  lessonExpenseCount: number;
  qtyHours: number;
  lessonUuids: Set<string>;
};

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
    if (process.env[CALCULATION_RUNS_ENABLED_ENV] !== 'true') {
      throw salaryHttpException(
        HttpStatus.PRECONDITION_FAILED,
        'SALARY_CALCULATION_RUNS_DISABLED',
        `${CALCULATION_RUNS_ENABLED_ENV}=true is required after salary parity blockers are isolated`,
      );
    }
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
    let aggregateResult: PeriodAggregateResult;
    try {
      aggregateResult = await this.education.fetchPeriodAggregates(
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
    const importedLessonSalaryTotals = await this.loadImportedLessonSalaryTotals(
      body.period,
      profiles.map((p) => p.legacyPortalUserId),
    );
    assertSalaryAggregateReady(aggregateResult, importedLessonSalaryTotals);
    const agg = aggregateResult.items;

    const run = await this.prisma.calculationRun.create({
      data: {
        period: body.period,
        rulesVersion: body.rulesVersion,
        status: 'draft',
        profileIds: body.profileIds === undefined ? undefined : body.profileIds,
        lines: {
          create: profiles.map((p) => {
            const a = agg.get(p.legacyPortalUserId);
            const importedLessonSalary = importedLessonSalaryTotals.get(p.legacyPortalUserId);
            const aggregateHours = a ? a.totalMinutes / 60 : 0;
            const hours = importedLessonSalary?.qtyHours ?? aggregateHours;
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
                paidLessonCount: a?.paidLessonCount ?? 0,
                demoLessonCount: a?.demoLessonCount ?? 0,
                demoUnpaidLessonCount: a?.demoUnpaidLessonCount ?? 0,
                demoPayableLessonCount: a?.demoPayableLessonCount ?? 0,
                scheduledMinutes: a?.scheduledMinutes ?? 0,
                payableMinutes: a?.payableMinutes ?? 0,
                totalMinutes: a?.totalMinutes ?? 0,
                recordedMinutes: a?.recordedMinutes ?? 0,
                recordUnavailableCount: a?.recordUnavailableCount ?? 0,
                missingRecordCount: a?.missingRecordCount ?? 0,
                missingDurationCount: a?.missingDurationCount ?? 0,
                implausibleRecordCount: a?.implausibleRecordCount ?? 0,
                fallbackPaidLessonCount: a?.fallbackPaidLessonCount ?? 0,
                aggregateWarnings: a?.warnings ?? [],
                lessonSalaryHoursSource: importedLessonSalary
                  ? 'imported_legacy_lesson_salary_expenses'
                  : 'education_recording_aggregate',
                importedLessonSalaryExpenseCount: importedLessonSalary?.lessonExpenseCount ?? 0,
                importedLessonSalaryQtyHours: importedLessonSalary?.qtyHours ?? null,
                aggregateLessonSalaryQtyHours: aggregateHours,
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

  private async loadImportedLessonSalaryTotals(
    period: string,
    legacyPortalUserIds: number[],
  ): Promise<Map<number, ImportedLessonSalaryTotal>> {
    if (!legacyPortalUserIds.length) {
      return new Map();
    }
    const { start, end } = periodBounds(period);
    const rows = await this.prisma.salaryExpense.findMany({
      where: {
        legacyPortalUserId: { in: legacyPortalUserIds },
        kind: SalaryExpenseKind.lesson,
        date: { gte: start, lt: end },
      },
      select: {
        legacyPortalUserId: true,
        lessonUuid: true,
        qty: true,
      },
    });
    const totals = new Map<number, ImportedLessonSalaryTotal>();
    for (const row of rows) {
      let total = totals.get(row.legacyPortalUserId);
      if (!total) {
        total = {
          legacyPortalUserId: row.legacyPortalUserId,
          lessonExpenseCount: 0,
          qtyHours: 0,
          lessonUuids: new Set<string>(),
        };
        totals.set(row.legacyPortalUserId, total);
      }
      total.lessonExpenseCount += 1;
      total.qtyHours += Number(row.qty.toString());
      if (row.lessonUuid) {
        total.lessonUuids.add(row.lessonUuid);
      }
    }
    return totals;
  }
}

export function assertSalaryAggregateReady(
  result: PeriodAggregateResult,
  importedLessonSalaryTotals: Map<number, ImportedLessonSalaryTotal>,
): void {
  const readiness = result.readiness;
  const missingDurationCount = readiness.missingDurationCount ?? 0;
  // education-service renamed this in salary-duration-v4: a recording shorter than the
  // slot is the legacy 95% rule working, not a blocker, so only an IMPLAUSIBLY short one
  // is flagged. Defaulting a missing field to 0 here would silently open the payout gate,
  // so an aggregate that carries neither field is refused outright below.
  const implausibleRecordCount = readiness.implausibleRecordCount ?? 0;
  const teacherMappingMissingCount = readiness.teacherMappingMissingCount ?? 0;
  if (
    readiness.implausibleRecordCount === undefined &&
    readiness.shortRecordCount === undefined
  ) {
    throw salaryHttpException(
      HttpStatus.PRECONDITION_FAILED,
      'SALARY_AGGREGATE_CONTRACT_UNKNOWN',
      'education-service returned no short/implausible record count; refusing to run payroll against an aggregate whose contract is not understood',
      { readiness },
    );
  }
  const dependencyWarnings = result.warnings.length;
  const importedCoveredBlockers = result.blockerSamples.filter(
    (sample) =>
      (sample.reason === 'record_too_short_to_be_a_lesson' ||
      sample.reason === 'short_record_duration' ||
      sample.reason === 'lesson_record_duration_seconds_missing') &&
      sample.legacyPortalUserId !== null &&
      sample.legacyPortalUserId !== undefined &&
      Boolean(
        sample.lessonUuid &&
          importedLessonSalaryTotals
            .get(sample.legacyPortalUserId)
            ?.lessonUuids.has(sample.lessonUuid),
      ),
  ).length;
  const importedCoverableBlockers = result.blockerSamples.filter(
    (sample) =>
      sample.reason === 'record_too_short_to_be_a_lesson' ||
      sample.reason === 'short_record_duration' ||
      sample.reason === 'lesson_record_duration_seconds_missing',
  ).length;
  const durationBlockersCoveredByImports =
    missingDurationCount + implausibleRecordCount > 0 &&
    teacherMappingMissingCount === 0 &&
    importedCoverableBlockers === missingDurationCount + implausibleRecordCount &&
    importedCoveredBlockers === importedCoverableBlockers;
  if (
    (readiness.salaryCalculationReady === false && !durationBlockersCoveredByImports) ||
    ((missingDurationCount > 0 || implausibleRecordCount > 0) && !durationBlockersCoveredByImports) ||
    teacherMappingMissingCount > 0 ||
    dependencyWarnings > 0
  ) {
    throw salaryHttpException(
      HttpStatus.PRECONDITION_FAILED,
      'SALARY_PARITY_BLOCKERS_PRESENT',
      'Salary calculation runs are blocked until missing-duration, implausible-record, and teacher-mapping rows are isolated and reconciled',
      {
        readiness,
        blockerSamples: result.blockerSamples.slice(0, 50),
        importedLessonSalaryCoverage: {
          importedCoverableBlockers,
          importedCoveredBlockers,
          durationBlockersCoveredByImports,
        },
        warnings: result.warnings,
      },
    );
  }
}

function periodBounds(period: string): { start: Date; end: Date } {
  const [yearRaw, monthRaw] = period.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 1, 0, 0, 0)),
  };
}
