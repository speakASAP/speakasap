import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

import HandoffPage from './page';
import { safeNextPath } from './safe-next-path';

function mockExchange(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: async () => body }));
}

function setUrl(search: string) {
  window.history.replaceState({}, '', `/auth/handoff${search}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('safeNextPath', () => {
  it('keeps a same-origin path', () => {
    expect(safeNextPath('/learner/practice/a-1')).toBe('/learner/practice/a-1');
  });

  it('rejects an absolute URL to another host', () => {
    expect(safeNextPath('https://evil.example/x')).toBe('/');
  });

  it('rejects a protocol-relative URL, which a naive startsWith("/") check accepts', () => {
    expect(safeNextPath('//evil.example/x')).toBe('/');
  });

  it('rejects a backslash-prefixed path, which some browsers normalise to //', () => {
    expect(safeNextPath('/\\evil.example')).toBe('/');
  });

  it('rejects a javascript: URL', () => {
    expect(safeNextPath('javascript:alert(1)')).toBe('/');
  });

  it('falls back to / for a missing value', () => {
    expect(safeNextPath(null)).toBe('/');
  });
});

describe('/auth/handoff', () => {
  it('stores the session and redirects to nextPath on success', async () => {
    mockExchange({ authUserId: 'u-1', accessToken: 'tok-1' });
    setUrl('?sso=t&next=/learner/practice/a-1');

    render(<HandoffPage />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/learner/practice/a-1'));
    expect(window.localStorage.getItem('speakasap.auth.tokens')).toContain('tok-1');
  });

  it('does NOT redirect when the exchange returns no session', async () => {
    // The exchange fails closed rather than returning a bare authUserId, but the page
    // must not redirect on a malformed success either: landing a student on a page that
    // looks signed in and is not is worse than an honest error.
    mockExchange({ authUserId: 'u-1' });
    setUrl('?sso=t&next=/learner/practice/a-1');

    render(<HandoffPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(replaceMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('speakasap.auth.tokens')).toBeNull();
  });

  it('rejects an absolute nextPath to another host', async () => {
    mockExchange({ authUserId: 'u-1', accessToken: 'tok-1' });
    setUrl('?sso=t&next=https://evil.example/x');

    render(<HandoffPage />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'));
  });

  it('shows a retryable message on IDENTITY_UNRESOLVED and does not sign in', async () => {
    mockExchange({ error: 'IDENTITY_UNRESOLVED' }, false);
    setUrl('?sso=t&next=/');

    render(<HandoffPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/try again/i));
    expect(replaceMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('speakasap.auth.tokens')).toBeNull();
  });

  it('shows a distinct message for an expired link', async () => {
    mockExchange({ error: 'EXPIRED' }, false);
    setUrl('?sso=t&next=/');

    render(<HandoffPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/expired/i));
  });

  it('never puts the token in the URL after handling it', async () => {
    mockExchange({ authUserId: 'u-1', accessToken: 'tok-1' });
    setUrl('?sso=secret-token&next=/');

    render(<HandoffPage />);

    await waitFor(() => expect(window.location.search).not.toContain('secret-token'));
  });

  it('posts the token in a body, never as a query parameter', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ authUserId: 'u-1', accessToken: 'tok-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    setUrl('?sso=secret-token&next=/');

    render(<HandoffPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain('secret-token');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ token: 'secret-token' });
  });

  it('shows an error when the link carries no token at all', async () => {
    setUrl('?next=/');

    render(<HandoffPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
