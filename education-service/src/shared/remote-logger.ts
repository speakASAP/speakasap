import { LoggerService } from '@nestjs/common';
import { RequestContext } from './request-context';

type LogMeta = Record<string, unknown> | undefined;

export class RemoteLogger implements LoggerService {
  private readonly serviceName = process.env.SERVICE_NAME;
  private readonly loggingUrl = process.env.LOGGING_SERVICE_URL;
  private readonly loggingPath = process.env.LOGGING_SERVICE_API_PATH;
  private readonly loggingTimeoutMs = Number(process.env.LOGGING_SERVICE_TIMEOUT);
  private readonly loggingToken =
    process.env.LOGGING_SERVICE_TOKEN || process.env.JWT_TOKEN;

  log(message: unknown, context?: string): void {
    this.emit('info', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.emit('error', message, context, { trace });
  }

  warn(message: unknown, context?: string): void {
    this.emit('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.emit('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.emit('verbose', message, context);
  }

  private emit(level: string, message: unknown, context?: string, meta?: LogMeta): void {
    if (!this.loggingUrl || !this.loggingPath || !this.serviceName || !this.loggingTimeoutMs) {
      return;
    }
    try {
      const requestContext = RequestContext.get();
      const payload = {
        service: this.serviceName,
        level,
        message: String(message),
        context,
        meta: {
          ...meta,
          requestId: requestContext?.requestId,
          method: requestContext?.method,
          path: requestContext?.path,
          ip: requestContext?.ip,
          userId: requestContext?.userId,
        },
        timestamp: new Date().toISOString(),
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.loggingTimeoutMs);
      const base = this.loggingUrl.endsWith('/') ? this.loggingUrl.slice(0, -1) : this.loggingUrl;
      const path = this.loggingPath.startsWith('/') ? this.loggingPath : `/${this.loggingPath}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.loggingToken) {
        headers.Authorization = `Bearer ${this.loggingToken}`;
      }
      fetch(`${base}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
        .catch(() => undefined)
        .finally(() => clearTimeout(timeout));
    } catch {
      // Logging failures must not break the service.
    }
  }
}
