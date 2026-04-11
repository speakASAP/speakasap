export function buildLanguageTestLandingUrl(testId: number): string {
  const base = process.env.LANGUAGE_TEST_LANDING_BASE_URL?.replace(/\/$/, '') || '';
  return `${base}/language_tests/${testId}`;
}

export function buildResultPublicUrl(viewToken: string): string {
  const base = process.env.ASSESSMENT_SERVICE_PUBLIC_BASE_URL?.replace(/\/$/, '') || '';
  return `${base}/api/v1/language-user-tests/results/${encodeURIComponent(viewToken)}`;
}
