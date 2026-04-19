import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly windowMs = Number(process.env.GATEWAY_RATE_LIMIT_WINDOW_MS) || 60_000;
  private readonly max = Number(process.env.GATEWAY_RATE_LIMIT_MAX) || 200;
  private readonly buckets = new Map<string, { count: number; reset: number }>();

  use(req: Request, res: Response, next: NextFunction): void {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    let b = this.buckets.get(ip);
    if (!b || now > b.reset) {
      b = { count: 0, reset: now + this.windowMs };
      this.buckets.set(ip, b);
    }
    b.count += 1;
    if (b.count > this.max) {
      res.status(429).json({
        statusCode: 429,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
          details: {},
        },
      });
      return;
    }
    next();
  }
}
