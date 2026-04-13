import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import type { PaymentErrorBody } from './payment-http.exception';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const custom = extractPaymentError(exception);
    const message = custom?.message
      ?? (exception instanceof HttpException ? exception.message : 'Internal server error');
    const code = custom?.code ?? mapStatusToCode(status);
    const details = custom?.details ?? buildErrorDetails(exception);

    this.logger.error(
      `${new Date().toISOString()} Request failed: ${request.method} ${request.originalUrl} status=${status} code=${code} message=${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      statusCode: status,
      error: {
        code,
        message,
        details,
      },
    });
  }
}

function extractPaymentError(exception: unknown): PaymentErrorBody | null {
  if (!(exception instanceof HttpException)) {
    return null;
  }
  const body = exception.getResponse();
  if (body && typeof body === 'object' && 'code' in body && 'message' in body) {
    const b = body as PaymentErrorBody;
    return {
      code: String(b.code),
      message: String(b.message),
      details: b.details,
    };
  }
  return null;
}

function buildErrorDetails(exception: unknown): Record<string, unknown> {
  if (!(exception instanceof HttpException)) {
    return {};
  }
  const body = exception.getResponse();
  if (typeof body === 'string') {
    return { message: body };
  }
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (Array.isArray(b.message)) {
      return { validation: b.message };
    }
    if (typeof b.message === 'string') {
      return { message: b.message };
    }
  }
  return {};
}

function mapStatusToCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_FAILED';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    default:
      return 'INTERNAL_ERROR';
  }
}
