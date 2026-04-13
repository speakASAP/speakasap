import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { RequestContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestContextMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    const userId = (req.headers['x-user-id'] as string) || undefined;
    res.setHeader('x-request-id', requestId);

    const started = Date.now();
    const ts = () => new Date().toISOString();
    this.logger.log(`${ts()} ${req.method} ${req.originalUrl} request_id=${requestId} start`);
    res.on('finish', () => {
      const durationMs = Date.now() - started;
      this.logger.log(
        `${ts()} ${req.method} ${req.originalUrl} request_id=${requestId} status=${res.statusCode} duration_ms=${durationMs}`,
      );
    });

    RequestContext.run(
      {
        requestId,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        userId,
      },
      () => next(),
    );
  }
}
