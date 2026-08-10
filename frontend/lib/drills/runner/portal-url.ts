/**
 * Where the student's own dashboard lives.
 *
 * The learner portal is a different host from the legacy student cabinet: a student
 * arrives here from speakasap.com through the SSO handoff, finishes a drill, and then
 * has no way back — the practice page offered no link at all (reported 2026-08-10).
 *
 * Configurable because the host differs per environment, with the production portal as
 * the default so a missing variable degrades to the right place rather than to a broken
 * link. Validated against the same allowlist `safeReturnUrl` uses: an env var is not a
 * reason to send a student to an arbitrary host.
 */
const ALLOWED_HOSTS = new Set(['speakasap.com', 'speakasap.alfares.cz']);
const DEFAULT_PORTAL_URL = 'https://speakasap.com/student/';

export function studentDashboardUrl(): string {
  const configured = process.env.NEXT_PUBLIC_PORTAL_STUDENT_URL;
  if (!configured) {
    return DEFAULT_PORTAL_URL;
  }
  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
      return DEFAULT_PORTAL_URL;
    }
    return configured;
  } catch {
    return DEFAULT_PORTAL_URL;
  }
}
