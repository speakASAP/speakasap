const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 30;

export type ListMeta = {
  nextCursor: string | null;
  limit: number;
};

export type ListEnvelope<T> = {
  data: T[];
  meta: ListMeta;
};

export function parseListLimit(raw?: string): number {
  const n = raw !== undefined && raw !== '' ? Number(raw) : DEFAULT_LIMIT;
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(n), MAX_LIMIT);
}

export type CursorPayload = { t: string; id: string };

export function decodeCursor(raw?: string): CursorPayload | null {
  if (!raw) {
    return null;
  }
  try {
    const j = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as CursorPayload;
    if (j && typeof j.id === 'string' && typeof j.t === 'string') {
      return j;
    }
  } catch {
    return null;
  }
  return null;
}

export function encodeCursor(p: CursorPayload): string {
  return Buffer.from(JSON.stringify(p), 'utf8').toString('base64url');
}
