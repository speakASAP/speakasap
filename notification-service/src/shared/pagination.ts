const MAX_LIMIT = 30;
const DEFAULT_LIMIT = 20;

/** Payload encoded in opaque list cursors (createdAt tie-break + stable string id). */
export type CursorPayload = { c: string; i: string };

export type PaginatedMeta = { nextCursor: string | null; limit: number };

export type PaginatedResult<T> = { data: T[]; meta: PaginatedMeta };

export function clampLimit(raw: string | undefined): number {
  const n = raw === undefined || raw === '' ? DEFAULT_LIMIT : Number(raw);
  if (Number.isNaN(n) || n < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(n), MAX_LIMIT);
}

export function encodeCursor(createdAt: Date, id: string): string {
  const payload: CursorPayload = { c: createdAt.toISOString(), i: id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | undefined): CursorPayload | null {
  if (!raw) {
    return null;
  }
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const v = JSON.parse(json) as CursorPayload;
    if (v && typeof v.c === 'string' && typeof v.i === 'string') {
      return v;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * After `findMany` with `take: limit + 1` ordered by `createdAt` desc then id desc,
 * slice to `limit` rows and build `nextCursor` from the last row.
 */
export function toPaginatedResult<T extends { createdAt: Date }>(
  rows: T[],
  limit: number,
  idOf: (row: T) => string,
): PaginatedResult<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.createdAt, idOf(last)) : null;
  return { data, meta: { nextCursor, limit } };
}
