import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

type ContractError = {
  statusCode: number;
  error: { code: string; message: string; details: Record<string, unknown> };
};

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) {
      const raw = exception.getResponse();
      if (raw && typeof raw === 'object' && 'error' in raw) {
        const body = raw as ContractError;
        if (body.error && typeof body.error.code === 'string') {
          this.logger.error(
            `Request failed: ${request.method} ${request.originalUrl} status=${status} code=${body.error.code} message=${body.error.message}`,
            exception.stack,
          );
          response.status(status).json({
            statusCode: status,
            error: body.error,
          });
          return;
        }
      }
    }

    const message =
      exception instanceof HttpException ? exception.message : 'Internal server error';
    const code = mapStatusToCode(status);
    const details = buildErrorDetails(exception);

    this.logger.error(
      `Request failed: ${request.method} ${request.originalUrl} status=${status} code=${code} message=${message}`,
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
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'CALCULATION_INVALID';
    case HttpStatus.BAD_GATEWAY:
      return 'DEPENDENCY_UNAVAILABLE';
    default:
      return 'INTERNAL_ERROR';
  }
}
