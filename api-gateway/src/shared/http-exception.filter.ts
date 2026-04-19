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

    const body = exception instanceof HttpException ? exception.getResponse() : null;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: Record<string, unknown> = {};

    if (typeof body === 'string') {
      message = body;
    } else if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      if ('code' in b && b.code !== undefined) {
        code = String(b.code);
      }
      if ('message' in b && b.message !== undefined) {
        message = String(b.message);
      }
      if ('details' in b && b.details && typeof b.details === 'object') {
        details = b.details as Record<string, unknown>;
      }
    }

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        `${new Date().toISOString()} ${request.method} ${request.originalUrl} unhandled`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

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
