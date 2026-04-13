import { HttpException, HttpStatus } from '@nestjs/common';

export type NotificationErrorBody = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export function notificationHttpException(
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
    } satisfies NotificationErrorBody,
    status,
  );
}
