import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { RequestContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    const userId = (req.headers['x-user-id'] as string) || undefined;

    res.setHeader('x-request-id', requestId);

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
