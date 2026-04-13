const MAX_LIMIT = 30;
const DEFAULT_LIMIT = 20;

export type CursorPayload = { c: string; i: string };

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
