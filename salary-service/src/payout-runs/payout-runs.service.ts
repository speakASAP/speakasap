import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
  CalculationRunStatus,
  PayoutLineStatus,
  PayoutRunStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentClientService } from '../deps/payment-client.service';
import {
  decodeCursor,
  encodeCursor,
  ListEnvelope,
  parseListLimit,
} from '../shared/list-response';
import { idempotencyReplayException, salaryHttpException } from '../shared/salary-http.exception';
import { IdempotencyService, requestBodyHash } from '../idempotency/idempotency.service';

function minorFromDecimal(amount: string, _currency: string): number {
  return Math.round(Number(amount) * 100);
}

function mergeCursor(
  base: Prisma.PayoutRunWhereInput,
  cur: { t: string; id: string } | null,
): Prisma.PayoutRunWhereInput {
  if (!cur) {
    return base;
  }
  const c: Prisma.PayoutRunWhereInput = {
    OR: [
      { createdAt: { lt: new Date(cur.t) } },
      { AND: [{ createdAt: { equals: new Date(cur.t) } }, { id: { lt: cur.id } }] },
    ],
  };
  return Object.keys(base).length ? { AND: [base, c] } : c;
}

@Injectable()
export class PayoutRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payment: PaymentClientService,
    private readonly idempotency: IdempotencyService,
  ) {}

  lockTtlMs(): number {
    const v = Number(process.env.SALARY_PAYOUT_LOCK_TTL_MS);
    return Number.isFinite(v) && v > 0 ? v : 120_000;
  }

  async create(body: { calculationRunId: string }, idempotencyKey?: string) {
    const route = 'POST /api/v1/payout-runs';
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

    const calc = await this.prisma.calculationRun.findUnique({
      where: { id: body.calculationRunId },
      include: { lines: { include: { profile: true } } },
    });
    if (!calc) {
      throw new NotFoundException('Calculation run not found');
    }
    if (calc.status !== CalculationRunStatus.finalized) {
      throw salaryHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CALCULATION_INVALID',
        'Calculation run must be finalized',
      );
    }
    const run = await this.prisma.payoutRun.create({
      data: {
        status: PayoutRunStatus.draft,
        calculationRunId: calc.id,
        lines: {
          create: calc.lines.map((line) => ({
            profileId: line.profileId,
            legacyPortalUserId: line.legacyPortalUserId,
            calculationLineId: line.id,
            amountMinor: minorFromDecimal(line.amount.toString(), line.currency),
            currency: line.currency,
            status: PayoutLineStatus.draft,
            period: calc.period,
            metadata: {},
          })),
        },
      },
      include: { lines: true },
    });
    const response = { payoutRunId: run.id, status: run.status, lineCount: run.lines.length };
    if (idempotencyKey) {
      await this.idempotency.store(idempotencyKey, route, hash, 201, response);
    }
    return response;
  }

  async getOne(payoutRunId: string) {
    const run = await this.prisma.payoutRun.findUnique({
      where: { id: payoutRunId },
      include: { lines: true },
    });
    if (!run) {
      throw new NotFoundException('Payout run not found');
    }
    return {
      id: run.id,
      status: run.status,
      calculationRunId: run.calculationRunId,
      lines: run.lines.map((l) => ({
        id: l.id,
        legacyPortalUserId: l.legacyPortalUserId,
        amountMinor: l.amountMinor,
        currency: l.currency,
        status: l.status,
        payoutRef: l.payoutRef ?? undefined,
        paymentServiceRef: l.paymentServiceRef ?? undefined,
      })),
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };
  }

  async list(params: { limit?: string; cursor?: string }): Promise<
    ListEnvelope<{
      id: string;
      status: string;
      lineCount: number;
      createdAt: string;
    }>
  > {
    const limit = parseListLimit(params.limit);
    const cur = decodeCursor(params.cursor);
    const where = mergeCursor({}, cur);
    const rows = await this.prisma.payoutRun.findMany({
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
        status: r.status,
        lineCount: r._count.lines,
        createdAt: r.createdAt.toISOString(),
      })),
      meta: { nextCursor, limit },
    };
  }

  async commit(payoutRunId: string, idempotencyKey: string | undefined) {
    if (!idempotencyKey?.trim()) {
      throw salaryHttpException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Idempotency-Key header is required',
      );
    }
    const key = idempotencyKey.trim();
    const route = `POST /api/v1/payout-runs/${payoutRunId}/commit`;
    const hash = requestBodyHash({ payoutRunId });
    const replay = await this.idempotency.lookupReplay(key, route, hash);
    if (replay && !replay.match) {
      throw salaryHttpException(HttpStatus.CONFLICT, 'CONFLICT', 'Idempotency-Key reuse with different body');
    }
    if (replay?.match) {
      throw idempotencyReplayException(replay.body);
    }

    const ttl = this.lockTtlMs();
    const now = new Date();
    const lockUntil = new Date(now.getTime() + ttl);

    const run = await this.prisma.payoutRun.findUnique({
      where: { id: payoutRunId },
      include: { lines: { include: { profile: true } } },
    });
    if (!run) {
      throw new NotFoundException('Payout run not found');
    }
    if (run.lockExpiresAt && run.lockExpiresAt > now) {
      throw salaryHttpException(HttpStatus.CONFLICT, 'SALARY_PAYOUT_LOCKED', 'Payout run is locked');
    }
    if (run.status === PayoutRunStatus.completed) {
      const body = { payoutRunId, status: run.status, lines: run.lines.map((l) => ({ id: l.id, status: l.status })) };
      await this.idempotency.store(key, route, hash, 200, body);
      return body;
    }

    await this.prisma.payoutRun.update({
      where: { id: payoutRunId },
      data: { status: PayoutRunStatus.processing, lockExpiresAt: lockUntil },
    });

    const lineResults: { id: string; status: string; payoutRef?: string }[] = [];
    try {
      for (const line of run.lines) {
        if (line.status === PayoutLineStatus.paid && line.payoutRef) {
          lineResults.push({ id: line.id, status: line.status, payoutRef: line.payoutRef });
          continue;
        }
        const payKey = `salary:${line.id}:disburse`;
        try {
          const res = await this.payment.disburse(
            {
              idempotencyKey: payKey,
              legacyPortalUserId: line.legacyPortalUserId,
              amountMinor: line.amountMinor,
              currency: line.currency,
              metadata: {
                salaryPayoutLineId: line.id,
                period: line.period ?? '',
              },
            },
            key,
          );
          const polled = await this.payment.pollDisburse(res.payoutRef);
          const terminal = polled.status === 'failed' ? PayoutLineStatus.failed : PayoutLineStatus.paid;
          await this.prisma.payoutLine.update({
            where: { id: line.id },
            data: {
              payoutRef: res.payoutRef,
              paymentServiceRef: res.payoutRef,
              status: polled.status === 'processing' ? PayoutLineStatus.processing : terminal,
            },
          });
          lineResults.push({
            id: line.id,
            status: polled.status === 'processing' ? 'processing' : terminal,
            payoutRef: res.payoutRef,
          });
        } catch (e) {
          await this.prisma.payoutLine.update({
            where: { id: line.id },
            data: { status: PayoutLineStatus.failed },
          });
          lineResults.push({ id: line.id, status: 'failed' });
          throw e;
        }
      }
    } catch (e) {
      await this.prisma.payoutRun.update({
        where: { id: payoutRunId },
        data: {
          status: PayoutRunStatus.failed,
          lockExpiresAt: null,
        },
      });
      throw salaryHttpException(
        HttpStatus.BAD_GATEWAY,
        'DEPENDENCY_UNAVAILABLE',
        (e as Error).message || 'payment-service unavailable',
      );
    }

    const refreshed = await this.prisma.payoutRun.findUnique({
      where: { id: payoutRunId },
      include: { lines: true },
    });
    const anyFailed = refreshed?.lines.some((l) => l.status === PayoutLineStatus.failed) ?? false;
    const anyProcessing =
      refreshed?.lines.some((l) => l.status === PayoutLineStatus.processing) ?? false;
    const nextStatus = anyFailed
      ? PayoutRunStatus.failed
      : anyProcessing
        ? PayoutRunStatus.processing
        : PayoutRunStatus.completed;
    await this.prisma.payoutRun.update({
      where: { id: payoutRunId },
      data: { status: nextStatus, lockExpiresAt: null },
    });
    const body = {
      payoutRunId,
      status: nextStatus,
      lines: lineResults,
    };
    await this.idempotency.store(key, route, hash, 200, body);
    return body;
  }
}
