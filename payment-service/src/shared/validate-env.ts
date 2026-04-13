const REQUIRED_ENV = [
  'PAYMENT_SERVICE_PORT',
  'PAYMENT_DATABASE_URL',
  'PAYMENT_DB_NAME',
  'PAYMENTS_MICROSERVICE_URL',
  'LOGGING_SERVICE_URL',
  'LOGGING_SERVICE_API_PATH',
  'LOGGING_SERVICE_TIMEOUT',
  'AUTH_MICROSERVICE_URL',
];

export function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  const numericKeys = [
    'PAYMENT_SERVICE_PORT',
    'LOGGING_SERVICE_TIMEOUT',
  ];
  const invalid = numericKeys.filter((key) => Number.isNaN(Number(process.env[key])));
  if (invalid.length > 0) {
    throw new Error(`Invalid numeric env vars: ${invalid.join(', ')}`);
  }
}
