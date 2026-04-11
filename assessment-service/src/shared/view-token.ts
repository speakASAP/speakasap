import { createHmac, timingSafeEqual } from 'crypto';

const SEP = '.';

export function signViewToken(userTestId: number, secret: string): string {
  const payload = Buffer.from(String(userTestId), 'utf8').toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}${SEP}${sig}`;
}

export function verifyViewToken(viewToken: string, secret: string): number | null {
  const parts = viewToken.split(SEP);
  if (parts.length !== 2) {
    return null;
  }
  const [payload, sig] = parts;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  const id = Number(Buffer.from(payload, 'base64url').toString('utf8'));
  return Number.isFinite(id) ? id : null;
}
