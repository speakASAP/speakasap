import { HttpException, HttpStatus } from '@nestjs/common';

type ErrorBody = {
  statusCode: number;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
};

export function salaryHttpException(
  status: HttpStatus,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): HttpException {
  const body: ErrorBody = {
    statusCode: status,
    error: { code, message, details },
  };
  return new HttpException(body, status);
}

/** Same Idempotency-Key + same body as a prior completed request; first response in details. */
export function idempotencyReplayException(originalResult: unknown): HttpException {
  return salaryHttpException(
    HttpStatus.CONFLICT,
    'IDEMPOTENCY_REPLAY',
    'Duplicate request with the same Idempotency-Key and body; see details.originalResult for the first response.',
    { originalResult },
  );
}
