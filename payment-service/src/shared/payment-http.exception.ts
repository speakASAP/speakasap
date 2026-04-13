import { HttpException, HttpStatus } from '@nestjs/common';

export type PaymentErrorBody = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export function paymentHttpException(
  status: HttpStatus,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): HttpException {
  return new HttpException(
    {
      code,
      message,
      details: details ?? {},
    } satisfies PaymentErrorBody,
    status,
  );
}
