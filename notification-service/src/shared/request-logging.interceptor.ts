import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const started = Date.now();
    return next.handle().pipe(
      tap({
        finalize: () => {
          const duration_ms = Date.now() - started;
          this.logger.log(
            `${new Date().toISOString()} ${req.method} ${req.originalUrl} duration_ms=${duration_ms}`,
          );
        },
      }),
    );
  }
}
