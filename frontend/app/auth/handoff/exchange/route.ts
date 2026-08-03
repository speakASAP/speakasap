import { NextResponse } from 'next/server';

import { resolveSsoToken } from '@/lib/drills/sso/resolve';

/**
 * Exchanges a portal SSO token for a platform session.
 *
 * This runs on the server because `resolveSsoToken` needs the platform JWT secret and
 * auth's internal service token; the browser holds neither. The token arrives in the
 * request body rather than the URL so it stays out of access logs and referrers.
 *
 * ## Session minting is not wired up yet — see `status/track-i.md`
 *
 * Track H's `resolve-or-provision-legacy` returns `{ authUserId, provisioned }` and
 * stops there. auth-microservice exposes no internal route that mints an access token
 * for an already-resolved user id: `generateTokens` is private, and
 * `internal/magic-link/token` is keyed on email and returns a `verifyUrl` to redirect
 * to, not a token — and it would create a user by email, bypassing the legacy mapping
 * this whole flow exists to honour.
 *
 * Adding that route belongs to auth-microservice, outside this track's ownership. Until
 * it lands, resolution is exercised end to end and the response carries the resolved
 * `authUserId`, but `accessToken` is absent and the page reports the handoff as
 * unavailable rather than pretending a student is signed in.
 */
export async function POST(request: Request) {
  let token: string | undefined;
  try {
    const body = (await request.json()) as { token?: string };
    token = body?.token;
  } catch {
    return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 400 });
  }

  const result = await resolveSsoToken(token);

  if ('error' in result) {
    // 503 for the retryable case, so a proxy or a monitor can tell it apart from a
    // token the student can do nothing about.
    const status = result.error === 'IDENTITY_UNRESOLVED' ? 503 : 401;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ authUserId: result.authUserId });
}
