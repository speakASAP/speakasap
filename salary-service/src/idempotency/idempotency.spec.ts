import { IdempotencyService, requestBodyHash } from './idempotency.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * What stops a retried payout from paying a teacher twice.
 *
 * `commit` looks up this record before disbursing: a replay returns the FIRST response
 * instead of calling payment-service again. If lookup wrongly reported "no record", a
 * network retry would send a second real disbursement.
 */

type Row = {
  idempotencyKey: string;
  route: string;
  requestHash: string;
  statusCode: number;
  responseBody: unknown;
  createdAt: Date;
};

function serviceWith(rows: Row[]) {
  const store = new Map(rows.map((r) => [r.idempotencyKey, r]));
  const deleted: Date[] = [];
  const prisma = {
    idempotencyRecord: {
      findUnique: jest.fn(async ({ where }: { where: { idempotencyKey: string } }) =>
        store.get(where.idempotencyKey) ?? null,
      ),
      deleteMany: jest.fn(async ({ where }: { where: { createdAt: { lt: Date } } }) => {
        deleted.push(where.createdAt.lt);
        for (const [k, v] of store) {
          if (v.createdAt < where.createdAt.lt) store.delete(k);
        }
        return { count: 0 };
      }),
      upsert: jest.fn(async ({ where, create }: { where: { idempotencyKey: string }; create: Row }) => {
        store.set(where.idempotencyKey, { ...create, createdAt: new Date() });
        return create;
      }),
    },
  } as unknown as PrismaService;
  return { service: new IdempotencyService(prisma), prisma, store, deleted };
}

function row(over: Partial<Row> = {}): Row {
  return {
    idempotencyKey: 'key-1',
    route: 'POST /api/v1/payout-runs/r1/commit',
    requestHash: requestBodyHash({ payoutRunId: 'r1' }),
    statusCode: 200,
    responseBody: { payoutRunId: 'r1', status: 'completed' },
    createdAt: new Date(),
    ...over,
  };
}

describe('requestBodyHash', () => {
  it('is stable for the same body', () => {
    expect(requestBodyHash({ a: 1 })).toBe(requestBodyHash({ a: 1 }));
  });

  it('differs for a different body — this is what detects key reuse', () => {
    expect(requestBodyHash({ payoutRunId: 'r1' })).not.toBe(requestBodyHash({ payoutRunId: 'r2' }));
  });

  it('treats undefined and an empty object alike, deliberately', () => {
    expect(requestBodyHash(undefined)).toBe(requestBodyHash({}));
  });

  it('is sensitive to a changed amount anywhere in the body', () => {
    expect(requestBodyHash({ lines: [{ amount: '10.00' }] }))
      .not.toBe(requestBodyHash({ lines: [{ amount: '10.01' }] }));
  });
});

describe('IdempotencyService.lookupReplay', () => {
  const ROUTE = 'POST /api/v1/payout-runs/r1/commit';
  const HASH = requestBodyHash({ payoutRunId: 'r1' });

  it('returns null for an unseen key, so the caller proceeds', async () => {
    const { service } = serviceWith([]);
    expect(await service.lookupReplay('never-seen', ROUTE, HASH)).toBeNull();
  });

  it('replays the stored response for the same key, route and body', async () => {
    // The whole point: a retry gets the first answer, and payment-service is NOT called
    // a second time.
    const { service } = serviceWith([row()]);
    const res = await service.lookupReplay('key-1', ROUTE, HASH);

    expect(res).toEqual({
      match: true,
      statusCode: 200,
      body: { payoutRunId: 'r1', status: 'completed' },
    });
  });

  it('reports a conflict when the same key is reused with a DIFFERENT body', async () => {
    // Reusing a key for a different payout must never replay the old response — that
    // would report success for a payout that never happened.
    const { service } = serviceWith([row()]);
    const res = await service.lookupReplay('key-1', ROUTE, requestBodyHash({ payoutRunId: 'r2' }));

    expect(res).toEqual({ match: false, conflict: true });
  });

  it('reports a conflict when the same key is reused on a DIFFERENT route', async () => {
    const { service } = serviceWith([row()]);
    const res = await service.lookupReplay('key-1', 'POST /api/v1/payout-runs', HASH);

    expect(res).toEqual({ match: false, conflict: true });
  });

  it('prunes expired records before looking up', async () => {
    const { service, deleted } = serviceWith([]);
    await service.lookupReplay('key-1', ROUTE, HASH);

    expect(deleted).toHaveLength(1);
    // 24h TTL: the cutoff must be in the past, never in the future — a future cutoff
    // would delete live records and re-open the door to a double payment.
    expect(deleted[0].getTime()).toBeLessThan(Date.now());
  });

  it('does not replay a record older than the TTL', async () => {
    const stale = row({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });
    const { service } = serviceWith([stale]);

    expect(await service.lookupReplay('key-1', ROUTE, HASH)).toBeNull();
  });

  it('still replays a record just inside the TTL', async () => {
    const fresh = row({ createdAt: new Date(Date.now() - 23 * 60 * 60 * 1000) });
    const { service } = serviceWith([fresh]);
    const res = await service.lookupReplay('key-1', ROUTE, HASH);

    expect(res).toMatchObject({ match: true });
  });
});

describe('IdempotencyService.store', () => {
  it('makes a subsequent lookup replay', async () => {
    const ROUTE = 'POST /api/v1/payout-runs/r9/commit';
    const HASH = requestBodyHash({ payoutRunId: 'r9' });
    const { service } = serviceWith([]);

    expect(await service.lookupReplay('key-9', ROUTE, HASH)).toBeNull();
    await service.store('key-9', ROUTE, HASH, 200, { payoutRunId: 'r9', status: 'completed' });
    const res = await service.lookupReplay('key-9', ROUTE, HASH);

    expect(res).toMatchObject({ match: true, statusCode: 200 });
  });
});
