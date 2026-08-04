import { applyInternalHopToken } from './internal-hop';

/**
 * The gateway and the services behind `/api/v1/internal` both read the SAME header,
 * `x-internal-token`, but against different expected values. Since the proxy forwards
 * headers verbatim, a caller-supplied token that satisfies the gateway would then be
 * rejected by the upstream.
 *
 * `applyInternalHopToken` closes that by re-stamping the header for the second hop, so
 * the caller never needs — and never holds — the upstream's own credential.
 */
describe('applyInternalHopToken', () => {
  const ORIGINAL = process.env.INTERNAL_API_TOKEN;

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.INTERNAL_API_TOKEN;
    } else {
      process.env.INTERNAL_API_TOKEN = ORIGINAL;
    }
  });

  function headersWith(token?: string): Headers {
    const h = new Headers();
    if (token !== undefined) {
      h.set('x-internal-token', token);
    }
    return h;
  }

  it('replaces the caller token with the upstream token on an internal path', () => {
    process.env.INTERNAL_API_TOKEN = 'upstream-token';
    const headers = headersWith('gateway-token');

    applyInternalHopToken(headers, '/api/v1/internal/drill-assignments/by-student/42');

    expect(headers.get('x-internal-token')).toBe('upstream-token');
  });

  it('never forwards the caller-supplied value onward', () => {
    process.env.INTERNAL_API_TOKEN = 'upstream-token';
    const headers = headersWith('gateway-token');

    applyInternalHopToken(headers, '/api/v1/internal/drill-assignments/by-teacher/10');

    expect(headers.get('x-internal-token')).not.toBe('gateway-token');
  });

  it('leaves non-internal paths untouched', () => {
    process.env.INTERNAL_API_TOKEN = 'upstream-token';
    const headers = headersWith('something');

    applyInternalHopToken(headers, '/api/v1/drill-assignments/a-1/runner');

    expect(headers.get('x-internal-token')).toBe('something');
  });

  it('strips the header rather than forwarding the caller value when no upstream token is configured', () => {
    // Failing closed: forwarding the caller's value here is exactly the confusion this
    // function exists to prevent, and the upstream will reject a missing header anyway.
    delete process.env.INTERNAL_API_TOKEN;
    const headers = headersWith('gateway-token');

    applyInternalHopToken(headers, '/api/v1/internal/drill-assignments/by-student/42');

    expect(headers.get('x-internal-token')).toBeNull();
  });

  it('stamps the token even when the caller sent none, since the guard already passed', () => {
    process.env.INTERNAL_API_TOKEN = 'upstream-token';
    const headers = headersWith();

    applyInternalHopToken(headers, '/api/v1/internal/drill-sets/available-for-me');

    expect(headers.get('x-internal-token')).toBe('upstream-token');
  });

  it('matches the internal prefix exactly, not a lookalike path', () => {
    process.env.INTERNAL_API_TOKEN = 'upstream-token';
    const headers = headersWith('caller');

    applyInternalHopToken(headers, '/api/v1/internal-notes/1');

    expect(headers.get('x-internal-token')).toBe('caller');
  });
});
