import { buildHostedAuthLoginUrl, clearAuthSession } from '@/lib/auth-session';

/**
 * What to do when the gateway says the caller is not authenticated.
 *
 * Both drill API clients — the teacher one and the runner one — used to surface a 401 as
 * an ordinary failed request, so an expired token rendered as a red "Invalid token" box
 * with no way forward: the page could not load, and nothing on it offered a way to sign in
 * again. The token is dead, the browser is holding it, and only the user can fix that by
 * logging in, so the page sends them to do exactly that.
 *
 * The stale session is cleared FIRST. Leaving it in localStorage means the login flow
 * returns to a page that immediately reads the same dead token back out and bounces again.
 *
 * A 403 is deliberately NOT handled here. That is an authenticated user without the right
 * role — a student opening a teacher URL — and logging them out to log them back in as the
 * same person changes nothing while destroying a working session.
 */
export function redirectToLogin(): void {
  if (typeof window === 'undefined') {
    return;
  }
  clearAuthSession();
  // The path the user was trying to reach, so login returns them to it rather than to the
  // portal root. Hash is dropped: `consumeHostedAuthFragment` reads the token out of the
  // fragment on the way back, so carrying one through would be overwritten anyway.
  const returnPath = `${window.location.pathname}${window.location.search}`;
  window.location.assign(buildHostedAuthLoginUrl(returnPath));
}

/**
 * Whether a rejection has already been answered by a redirect to login.
 *
 * `redirectToLogin` starts a navigation but does not stop the JavaScript that called it —
 * the promise still rejects, and every caller still runs its `catch`. Without this check,
 * each one paints its own error box ("Invalid token", "Не удалось загрузить упражнение")
 * over a page that is already leaving, which is exactly the stacked pair of red boxes this
 * fix removes. Callers check this and render nothing.
 *
 * Structural rather than an `instanceof`: both drill clients throw their own error class
 * (`DrillApiError`, `DrillRunnerError`), and this module must not depend on either — they
 * both already depend on it.
 */
export function isRedirectingToLogin(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { redirectingToLogin?: unknown }).redirectingToLogin === true
  );
}
