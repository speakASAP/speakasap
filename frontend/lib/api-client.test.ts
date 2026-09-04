import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callGateway } from './api-client';

/**
 * `window.location.assign` is the redirect the 401 path performs. jsdom refuses to navigate
 * and logs "Not implemented", so it is replaced with a spy that records where the client
 * tried to send the browser.
 */
const assign = vi.fn();

function respondWith(status: number, body: unknown) {
  const f = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal('fetch', f);
  return f;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  assign.mockClear();
  localStorage.clear();
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://speakasap.alfares.cz');
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      origin: 'https://speakasap.alfares.cz',
      pathname: '/learner/lessons/l-1/record',
      search: '',
      assign,
    },
  });
});

describe('callGateway 401 handling', () => {
  it('clears the stale session and sends the browser to login', async () => {
    localStorage.setItem(
      'speakasap.auth.tokens',
      JSON.stringify({ accessToken: 'expired.jwt.value', storedAt: Date.now() }),
    );
    respondWith(401, { error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });

    const response = await callGateway({ path: '/api/v1/lessons/l-1/record' });

    expect(response).toMatchObject({ ok: false, status: 401, redirectingToLogin: true });
    // The dead token must not survive the redirect: the login flow returns to this same
    // page, which would read it straight back out and bounce again.
    expect(localStorage.getItem('speakasap.auth.tokens')).toBeNull();

    const target = new URL(String(assign.mock.calls[0][0]));
    expect(target.pathname).toBe('/login');
    // The return path travels in localStorage under the state key, not in the URL — hosted
    // auth is told only to come back to /auth/callback, which reads it out again.
    const state = target.searchParams.get('state');
    expect(localStorage.getItem(`speakasap.auth.return.${state}`)).toBe(
      '/learner/lessons/l-1/record',
    );
  });

  /**
   * The diagnostic consoles (`/admin`, the lesson-record workspace) exist to display what a
   * gateway route answered. Navigating away on 401 would destroy the very answer the
   * operator opened the page to read.
   */
  it('keeps the 401 as an ordinary result when the caller opts out', async () => {
    respondWith(401, { error: { message: 'Invalid token' } });

    const response = await callGateway({
      path: '/api/v1/admin/language-tests',
      keepUnauthorized: true,
    });

    expect(response).toMatchObject({ ok: false, status: 401 });
    expect(response.redirectingToLogin).toBeUndefined();
    expect(assign).not.toHaveBeenCalled();
    // The body still reaches the caller — that is the whole point of the console.
    expect(response.data).toMatchObject({ error: { message: 'Invalid token' } });
  });

  /**
   * 403 is an authenticated user without the right role. Logging them out to log them back
   * in as the same person changes nothing while destroying a working session.
   */
  it('leaves a 403 alone', async () => {
    respondWith(403, { error: { message: 'Forbidden' } });

    const response = await callGateway({ path: '/api/v1/orders' });

    expect(response).toMatchObject({ ok: false, status: 403 });
    expect(assign).not.toHaveBeenCalled();
  });

  it('still returns a successful body unchanged', async () => {
    respondWith(200, { items: [1, 2] });

    const response = await callGateway({ path: '/api/v1/orders' });

    expect(response).toMatchObject({ ok: true, status: 200, data: { items: [1, 2] } });
    expect(assign).not.toHaveBeenCalled();
  });
});
