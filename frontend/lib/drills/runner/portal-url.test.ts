import { afterEach, describe, expect, it } from 'vitest';

import { studentDashboardUrl } from './portal-url';

const ORIGINAL = process.env.NEXT_PUBLIC_PORTAL_STUDENT_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_PORTAL_STUDENT_URL = ORIGINAL;
});

describe('studentDashboardUrl', () => {
  it('defaults to the production portal when nothing is configured', () => {
    delete process.env.NEXT_PUBLIC_PORTAL_STUDENT_URL;
    expect(studentDashboardUrl()).toBe('https://speakasap.com/student/');
  });

  it('uses a configured portal on an allowed host', () => {
    process.env.NEXT_PUBLIC_PORTAL_STUDENT_URL = 'https://speakasap.alfares.cz/student/';
    expect(studentDashboardUrl()).toBe('https://speakasap.alfares.cz/student/');
  });

  /**
   * An env var is not a reason to send a student to an arbitrary host. Same allowlist as
   * safeReturnUrl, and for the same reason: a suffix match would accept
   * `evil-speakasap.com`.
   */
  it('refuses a host outside the allowlist and falls back', () => {
    process.env.NEXT_PUBLIC_PORTAL_STUDENT_URL = 'https://evil-speakasap.com/student/';
    expect(studentDashboardUrl()).toBe('https://speakasap.com/student/');
  });

  it('refuses plain http', () => {
    process.env.NEXT_PUBLIC_PORTAL_STUDENT_URL = 'http://speakasap.com/student/';
    expect(studentDashboardUrl()).toBe('https://speakasap.com/student/');
  });

  it('falls back on an unparseable value rather than throwing', () => {
    process.env.NEXT_PUBLIC_PORTAL_STUDENT_URL = 'not a url';
    expect(studentDashboardUrl()).toBe('https://speakasap.com/student/');
  });
});
