import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

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
    const message = exception instanceof HttpException
      ? exception.message
      : 'Internal server error';
    const code = mapStatusToCode(status);
    const details = exception instanceof HttpException ? exception.getResponse() : {};

    this.logger.error(
      `Request failed: ${request.method} ${request.originalUrl} status=${status} code=${code} message=${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      error: {
        code,
        message,
        details,
      },
    });
  }
}

function mapStatusToCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    default:
      return 'INTERNAL_ERROR';
  }
}
