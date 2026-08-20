import { HttpException } from '@nestjs/common';
import { PayoutRunsService } from './payout-runs.service';
import { IdempotencyService, requestBodyHash } from '../idempotency/idempotency.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PaymentClientService } from '../deps/payment-client.service';

/**
 * `commit` is the method that actually moves money: it calls payment-service once per
 * payout line and records what came back. It had no tests.
 *
 * The failures that matter here are not "does it pay" but what happens around the edges —
 * a concurrent commit, a dependency failing mid-run, a partially-paid run being retried.
 * Each of those, done wrong, either pays a teacher twice or strands a run reporting a
 * success that never happened.
 */

const RUN_ID = 'run-1';
const KEY = 'idem-key-1';

type Line = {
  id: string;
  legacyPortalUserId: number;
  amountMinor: number;
  currency: string;
  status: string;
  payoutRef: string | null;
  period: string | null;
  profile?: unknown;
};

type Run = {
  id: string;
  status: string;
  lockExpiresAt: Date | null;
  lines: Line[];
};

function line(over: Partial<Line> = {}): Line {
  return {
    id: 'line-1',
    legacyPortalUserId: 314082,
    amountMinor: 35000,
    currency: 'CZK',
    status: 'draft',
    payoutRef: null,
    period: '2026-07',
    profile: {},
    ...over,
  };
}

type Harness = {
  service: PayoutRunsService;
  disburse: jest.Mock;
  pollDisburse: jest.Mock;
  runUpdates: Array<Record<string, unknown>>;
  lineUpdates: Array<{ id: string; data: Record<string, unknown> }>;
  stored: Array<{ key: string; body: unknown }>;
};

function harness(run: Run | null, opts: { disburse?: jest.Mock; poll?: jest.Mock } = {}): Harness {
  const runUpdates: Array<Record<string, unknown>> = [];
  const lineUpdates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const stored: Array<{ key: string; body: unknown }> = [];
  const current: Run | null = run ? { ...run, lines: run.lines.map((l) => ({ ...l })) } : null;

  const prisma = {
    payoutRun: {
      findUnique: jest.fn(async () => (current ? { ...current, lines: current.lines } : null)),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        runUpdates.push(data);
        if (current && typeof data.status === 'string') current.status = data.status;
        return current;
      }),
    },
    payoutLine: {
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        lineUpdates.push({ id: where.id, data });
        const target = current?.lines.find((l) => l.id === where.id);
        if (target && typeof data.status === 'string') target.status = data.status;
        return target;
      }),
    },
    idempotencyRecord: {
      findUnique: jest.fn(async () => null),
      deleteMany: jest.fn(async () => ({ count: 0 })),
      upsert: jest.fn(async () => ({})),
    },
  } as unknown as PrismaService;

  const disburse =
    opts.disburse ?? jest.fn(async () => ({ payoutRef: 'pref-1', status: 'completed' as const }));
  const pollDisburse = opts.poll ?? jest.fn(async () => ({ status: 'completed' as const }));
  const payment = { disburse, pollDisburse } as unknown as PaymentClientService;

  const idempotency = new IdempotencyService(prisma);
  jest.spyOn(idempotency, 'store').mockImplementation(async (key, _r, _h, _s, body) => {
    stored.push({ key, body });
  });

  return {
    service: new PayoutRunsService(prisma, payment, idempotency),
    disburse,
    pollDisburse,
    runUpdates,
    lineUpdates,
    stored,
  };
}

function codeOf(error: unknown): string {
  const body = (error as HttpException)?.getResponse?.() as { error?: { code?: string } };
  return body?.error?.code ?? 'NO_CODE';
}

describe('PayoutRunsService.commit', () => {
  const originalFlag = process.env.SALARY_PAYOUT_FLOWS_ENABLED;

  beforeEach(() => {
    process.env.SALARY_PAYOUT_FLOWS_ENABLED = 'true';
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.SALARY_PAYOUT_FLOWS_ENABLED;
    else process.env.SALARY_PAYOUT_FLOWS_ENABLED = originalFlag;
    jest.restoreAllMocks();
  });

  it('refuses entirely when payout flows are disabled', async () => {
    delete process.env.SALARY_PAYOUT_FLOWS_ENABLED;
    const h = harness({ id: RUN_ID, status: 'draft', lockExpiresAt: null, lines: [line()] });

    await expect(h.service.commit(RUN_ID, KEY)).rejects.toBeDefined();
    expect(h.disburse).not.toHaveBeenCalled();
  });

  it('requires an Idempotency-Key before touching payment-service', async () => {
    // Without a key a retry cannot be recognised, so a second call would pay again.
    const h = harness({ id: RUN_ID, status: 'draft', lockExpiresAt: null, lines: [line()] });

    await expect(h.service.commit(RUN_ID, undefined)).rejects.toBeDefined();
    await expect(h.service.commit(RUN_ID, '   ')).rejects.toBeDefined();
    expect(h.disburse).not.toHaveBeenCalled();
  });

  it('refuses a run that is locked by a concurrent commit', async () => {
    // Two commits paying the same lines at once is the double-payment scenario.
    const locked = new Date(Date.now() + 60_000);
    const h = harness({ id: RUN_ID, status: 'processing', lockExpiresAt: locked, lines: [line()] });

    await h.service.commit(RUN_ID, KEY).then(
      () => {
        throw new Error('should have refused a locked run');
      },
      (error) => expect(codeOf(error)).toBe('SALARY_PAYOUT_LOCKED'),
    );
    expect(h.disburse).not.toHaveBeenCalled();
  });

  it('proceeds when a previous lock has EXPIRED', async () => {
    // A crashed commit must not strand the run forever.
    const stale = new Date(Date.now() - 60_000);
    const h = harness({ id: RUN_ID, status: 'processing', lockExpiresAt: stale, lines: [line()] });

    await h.service.commit(RUN_ID, KEY);
    expect(h.disburse).toHaveBeenCalledTimes(1);
  });

  it('does not re-pay a line already paid, and keeps its payoutRef', async () => {
    // The retry case. Re-disbursing a paid line sends a second real payment.
    const h = harness({
      id: RUN_ID,
      status: 'processing',
      lockExpiresAt: null,
      lines: [line({ id: 'paid-1', status: 'paid', payoutRef: 'already-paid-ref' })],
    });

    const res = (await h.service.commit(RUN_ID, KEY)) as { lines: Array<{ payoutRef?: string }> };

    expect(h.disburse).not.toHaveBeenCalled();
    expect(res.lines[0].payoutRef).toBe('already-paid-ref');
  });

  it('pays only the unpaid line in a partially-paid run', async () => {
    const h = harness({
      id: RUN_ID,
      status: 'processing',
      lockExpiresAt: null,
      lines: [
        line({ id: 'paid-1', status: 'paid', payoutRef: 'ref-a' }),
        line({ id: 'todo-1', status: 'draft' }),
      ],
    });

    await h.service.commit(RUN_ID, KEY);

    expect(h.disburse).toHaveBeenCalledTimes(1);
    expect(h.disburse.mock.calls[0][0].metadata.salaryPayoutLineId).toBe('todo-1');
  });

  it('sends a per-line idempotency key so payment-service can dedupe too', async () => {
    const h = harness({ id: RUN_ID, status: 'draft', lockExpiresAt: null, lines: [line({ id: 'line-x' })] });

    await h.service.commit(RUN_ID, KEY);

    expect(h.disburse.mock.calls[0][0].idempotencyKey).toBe('salary:line-x:disburse');
  });

  it('marks the line failed AND the run failed when payment-service throws', async () => {
    // The dangerous alternative is a run left "processing" with money half sent.
    const boom = jest.fn(async () => {
      throw new Error('payment_disburse_502');
    });
    const h = harness(
      { id: RUN_ID, status: 'draft', lockExpiresAt: null, lines: [line()] },
      { disburse: boom },
    );

    await expect(h.service.commit(RUN_ID, KEY)).rejects.toBeDefined();

    expect(h.lineUpdates.some((u) => u.data.status === 'failed')).toBe(true);
    expect(h.runUpdates.some((u) => u.status === 'failed')).toBe(true);
  });

  it('clears the lock when a run fails, so it can be retried', async () => {
    const boom = jest.fn(async () => {
      throw new Error('payment_disburse_502');
    });
    const h = harness(
      { id: RUN_ID, status: 'draft', lockExpiresAt: null, lines: [line()] },
      { disburse: boom },
    );

    await expect(h.service.commit(RUN_ID, KEY)).rejects.toBeDefined();

    const failing = h.runUpdates.find((u) => u.status === 'failed');
    expect(failing?.lockExpiresAt).toBeNull();
  });

  it('reports a dependency failure as DEPENDENCY_UNAVAILABLE, not a generic 500', async () => {
    const boom = jest.fn(async () => {
      throw new Error('payment_disburse_502');
    });
    const h = harness(
      { id: RUN_ID, status: 'draft', lockExpiresAt: null, lines: [line()] },
      { disburse: boom },
    );

    await h.service.commit(RUN_ID, KEY).then(
      () => {
        throw new Error('should have thrown');
      },
      (error) => expect(codeOf(error)).toBe('DEPENDENCY_UNAVAILABLE'),
    );
  });

  it('leaves a line processing when the poll says processing', async () => {
    const h = harness(
      { id: RUN_ID, status: 'draft', lockExpiresAt: null, lines: [line()] },
      { poll: jest.fn(async () => ({ status: 'processing' as const })) },
    );

    await h.service.commit(RUN_ID, KEY);

    expect(h.lineUpdates.some((u) => u.data.status === 'processing')).toBe(true);
  });

  it('replays a completed run without calling payment-service again', async () => {
    const h = harness({
      id: RUN_ID,
      status: 'completed',
      lockExpiresAt: null,
      lines: [line({ status: 'paid', payoutRef: 'ref-done' })],
    });

    const res = (await h.service.commit(RUN_ID, KEY)) as { status: string };

    expect(res.status).toBe('completed');
    expect(h.disburse).not.toHaveBeenCalled();
    // And it stores the response so the NEXT retry short-circuits at the idempotency layer.
    expect(h.stored).toHaveLength(1);
  });

  it('raises NotFound for a run that does not exist', async () => {
    const h = harness(null);
    await expect(h.service.commit('missing', KEY)).rejects.toBeDefined();
    expect(h.disburse).not.toHaveBeenCalled();
  });

  it('takes a lock before disbursing and releases it after', async () => {
    const h = harness({ id: RUN_ID, status: 'draft', lockExpiresAt: null, lines: [line()] });

    await h.service.commit(RUN_ID, KEY);

    const took = h.runUpdates.find((u) => u.status === 'processing');
    expect(took?.lockExpiresAt).toBeInstanceOf(Date);
    const released = h.runUpdates[h.runUpdates.length - 1];
    expect(released.lockExpiresAt).toBeNull();
  });

  it('hashes the run id, so one key cannot commit a DIFFERENT run', () => {
    expect(requestBodyHash({ payoutRunId: 'run-1' })).not.toBe(requestBodyHash({ payoutRunId: 'run-2' }));
  });
});
