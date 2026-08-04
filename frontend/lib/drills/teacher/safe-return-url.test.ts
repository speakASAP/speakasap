import { describe, expect, it } from 'vitest';

import { safeReturnUrl } from './safe-return-url';

/**
 * `returnTo` sends the teacher back to the portal lesson page they came from — a
 * different host, so this cannot use the same-origin rule the SSO handoff uses.
 *
 * An allowlist rather than a pattern: "ends with speakasap.com" also matches
 * `evil-speakasap.com` and `speakasap.com.attacker.net`.
 */
describe('safeReturnUrl', () => {
  it('allows the legacy portal', () => {
    const url = 'https://speakasap.com/teacher/students/3/lessons/abc/';
    expect(safeReturnUrl(url)).toBe(url);
  });

  it('allows the platform itself', () => {
    const url = 'https://speakasap.alfares.cz/teacher/assignments';
    expect(safeReturnUrl(url)).toBe(url);
  });

  it('refuses an unknown host', () => {
    expect(safeReturnUrl('https://evil.example/x')).toBeNull();
  });

  it('refuses a lookalike host a suffix check would allow', () => {
    expect(safeReturnUrl('https://evil-speakasap.com/x')).toBeNull();
    expect(safeReturnUrl('https://speakasap.com.attacker.net/x')).toBeNull();
  });

  it('refuses a non-https scheme', () => {
    expect(safeReturnUrl('http://speakasap.com/x')).toBeNull();
    expect(safeReturnUrl('javascript:alert(1)')).toBeNull();
  });

  it('refuses nothing at all', () => {
    expect(safeReturnUrl(null)).toBeNull();
    expect(safeReturnUrl('')).toBeNull();
    expect(safeReturnUrl('not a url')).toBeNull();
  });
});
