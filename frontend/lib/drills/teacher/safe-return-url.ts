/**
 * Reduce a caller-supplied `returnTo` to a URL we are willing to send a teacher to.
 *
 * Unlike the SSO handoff's `next`, this is deliberately cross-host: the teacher arrives
 * from the legacy portal and expects to land back on the student's lesson card. So the
 * same-origin rule cannot apply, and an allowlist takes its place.
 *
 * An allowlist, not a suffix match: `endsWith('speakasap.com')` also accepts
 * `evil-speakasap.com` and `speakasap.com.attacker.net`.
 */
const ALLOWED_HOSTS = new Set(['speakasap.com', 'speakasap.alfares.cz']);

export function safeReturnUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') {
      return null;
    }
    return ALLOWED_HOSTS.has(parsed.hostname) ? value : null;
  } catch {
    return null;
  }
}
