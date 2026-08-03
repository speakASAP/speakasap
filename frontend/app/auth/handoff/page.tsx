'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { saveAuthSession } from '@/lib/auth-session';

import { safeNextPath } from './safe-next-path';

type HandoffState = 'working' | 'failed';

const MESSAGES: Record<string, string> = {
  EXPIRED: 'This link has expired. Open the drill from the portal again to get a fresh one.',
  WRONG_AUDIENCE: 'This link is not valid for this site. Open the drill from the portal again.',
  INVALID_TOKEN: 'This link is not valid. Open the drill from the portal again.',
  IDENTITY_UNRESOLVED:
    'We could not sign you in just now. This is temporary — please try again in a moment.',
  NO_SESSION: 'We could not sign you in just now. This is temporary — please try again in a moment.',
};

/**
 * Lands a student arriving from a drill link on the legacy portal.
 *
 * Two things this page is careful about. The token goes to the server in a POST body and
 * is stripped from the address bar immediately, so it does not survive in history or in a
 * referrer. And `next` is reduced to a same-origin path before any redirect — an
 * attacker-supplied `next` must not turn this into an open redirect.
 *
 * Every failure is shown, never guessed past. A student who cannot be identified sees a
 * message rather than a session belonging to someone else.
 */
export default function HandoffPage() {
  const router = useRouter();
  const [state, setState] = useState<HandoffState>('working');
  const [message, setMessage] = useState('');
  const started = useRef(false);

  useEffect(() => {
    // React 18+ mounts effects twice in development; the exchange must not run twice.
    if (started.current) {
      return;
    }
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('sso');
    const next = safeNextPath(params.get('next'));

    // Strip the token from the address bar before anything can read it — including a
    // referrer header on the redirect that follows.
    window.history.replaceState({}, '', window.location.pathname);

    if (!token) {
      setState('failed');
      setMessage(MESSAGES.INVALID_TOKEN);
      return;
    }

    let active = true;

    fetch('/auth/handoff/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as
          | { authUserId?: string; accessToken?: string; error?: string }
          | null;

        if (!active) {
          return;
        }

        if (!response.ok || !body || body.error) {
          setState('failed');
          setMessage(MESSAGES[body?.error ?? 'INVALID_TOKEN'] ?? MESSAGES.INVALID_TOKEN);
          return;
        }

        if (!body.accessToken) {
          // Resolution worked but no session was issued. Redirecting would land the
          // student on a page that looks signed in and is not.
          setState('failed');
          setMessage(MESSAGES.NO_SESSION);
          return;
        }

        saveAuthSession({ accessToken: body.accessToken, authMethod: 'portal-sso' });
        router.replace(next);
      })
      .catch(() => {
        if (active) {
          setState('failed');
          setMessage(MESSAGES.IDENTITY_UNRESOLVED);
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="min-h-full bg-zinc-50 px-4 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:px-6">
      <div className="mx-auto w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold">Signing you in</h1>

        {state === 'working' ? (
          <p className="mt-3 text-slate-600">One moment…</p>
        ) : (
          <>
            <p role="alert" className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-red-800">
              {message}
            </p>
            <a href="/" className="mt-4 inline-block text-sky-700 underline">
              Go to the home page
            </a>
          </>
        )}
      </div>
    </main>
  );
}
