const REQUIRED_ENV = [
  'PORT',
  'SERVICE_NAME',
  'DATABASE_URL',
  'LOGGING_SERVICE_URL',
  'LOGGING_SERVICE_API_PATH',
  'LOGGING_SERVICE_TIMEOUT',
  'AUTH_SERVICE_URL',
  'AUTH_SERVICE_TIMEOUT',
  'LANGUAGE_TEST_LANDING_BASE_URL',
  'ASSESSMENT_SERVICE_PUBLIC_BASE_URL',
  'ASSESSMENT_VIEW_TOKEN_SECRET',
  'USER_TEST_ASSETS_DIR',
];

export function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  const numericKeys = ['PORT', 'LOGGING_SERVICE_TIMEOUT', 'AUTH_SERVICE_TIMEOUT'];
  const invalid = numericKeys.filter((key) => Number.isNaN(Number(process.env[key])));
  if (invalid.length > 0) {
    throw new Error(`Invalid numeric env vars: ${invalid.join(', ')}`);
  }
}
