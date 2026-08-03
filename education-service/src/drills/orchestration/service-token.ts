import { createHmac } from 'crypto';

/**
 * Mints the service JWT ai-microservice's `ServiceAuthGuard` requires.
 *
 * WHY THIS EXISTS
 *
 * `AiClient` used to forward `GenerationJob.token` — the teacher's own bearer
 * token, taken from the incoming request. ai-microservice does not accept that:
 * `TeacherAssistantController` sits behind `ServiceAuthGuard`, which verifies an
 * HS256 token signed with `JWT_SECRET` and issued by `ai-microservice`. A
 * teacher's token fails that check, so every drill generation died with
 * `401 Malformed token` at the first model call (observed in production
 * 2026-08-03).
 *
 * This is deliberately a *different* credential from the one sent to
 * content-service. There, the teacher's token carries the identity and
 * `x-internal-token` authorizes the internal route. ai-microservice has no
 * per-user concept at all — it is a pure service-to-service dependency — so what
 * it wants is proof of *which service* is calling, not which teacher.
 *
 * CONTRACT (ai-microservice/src/service-identity/jwt.util.ts)
 *
 * The shape below must match `JwtUtil.verify` exactly: HS256 over
 * `base64url(header).base64url(payload)`, base64url with no padding, and an
 * `iss` of `ai-microservice`. `service-token.spec.ts` re-implements that
 * verification independently and asserts against it, so a drift in either
 * direction fails a test rather than production.
 *
 * The token is minted per request rather than cached. It costs one HMAC — far
 * cheaper than the model call it precedes — and a short-lived token that is
 * never stored has nothing to invalidate if the secret is ever rotated.
 */

/**
 * ai-microservice's `JwtUtil.ISSUER`. Its verify rejects any other value, so
 * this is its constant, not ours — do not "correct" it to education-service.
 */
export const SERVICE_TOKEN_ISSUER = 'ai-microservice';

const DEFAULT_LIFETIME_SECONDS = 300;

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function mintServiceToken(
  serviceId: string,
  secret: string,
  lifetimeSeconds: number = DEFAULT_LIFETIME_SECONDS,
): string {
  // An empty secret would still produce a syntactically valid token, which
  // ai-microservice rejects as "Invalid signature" — a message that points at
  // the wrong problem. Fail here, where the cause is visible.
  if (!secret) {
    throw new Error('Cannot mint a service token without a secret');
  }

  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({
      serviceId,
      iss: SERVICE_TOKEN_ISSUER,
      iat: now,
      exp: now + lifetimeSeconds,
    }),
  );
  const signature = base64url(
    createHmac('sha256', secret).update(`${header}.${payload}`).digest(),
  );

  return `${header}.${payload}.${signature}`;
}
