/**
 * Re-stamp `x-internal-token` for the second hop of an internal call.
 *
 * ## Why this exists
 *
 * `/api/v1/internal/*` passes through two guards that read the **same header** against
 * **different** expected values:
 *
 * - the gateway's own `GatewayAuthGuard` checks `GATEWAY_INTERNAL_API_TOKEN`;
 * - the upstream service's guard checks its `INTERNAL_API_TOKEN`.
 *
 * `buildForwardHeaders` copies request headers verbatim, so before this existed a caller
 * could only ever satisfy one of the two. Setting both to the same value would "work",
 * but then any caller allowed through the gateway holds a credential that also opens the
 * upstream services directly.
 *
 * Re-stamping keeps the two credentials separate: the caller proves itself to the
 * gateway, and the gateway proves itself to the upstream.
 */
const INTERNAL_PREFIX = '/api/v1/internal/';

export function applyInternalHopToken(headers: Headers, pathname: string): void {
  // Prefix match with the trailing slash, so `/api/v1/internal-notes` is not treated as
  // an internal route.
  if (!pathname.startsWith(INTERNAL_PREFIX) && pathname !== '/api/v1/internal') {
    return;
  }

  const upstreamToken = process.env.INTERNAL_API_TOKEN;
  if (!upstreamToken) {
    // Fail closed. Forwarding the caller's value is the exact confusion this function
    // prevents, and an upstream rejects a missing header anyway — a 401 from the
    // upstream is a clearer signal than a token that half-works.
    headers.delete('x-internal-token');
    return;
  }

  headers.set('x-internal-token', upstreamToken);
}
