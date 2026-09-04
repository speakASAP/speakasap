import { LoggerService } from '@nestjs/common';
import { RequestContext } from './request-context';

type LogMeta = Record<string, unknown> | undefined;

const DEFAULT_LOGGING_API_PATH = '/api/logs';
const DEFAULT_LOGGING_TIMEOUT_MS = 3000;

export class RemoteLogger implements LoggerService {
  private readonly serviceName = process.env.SERVICE_NAME;
  private readonly loggingUrl = process.env.LOGGING_SERVICE_URL;
  private readonly loggingPath = process.env.LOGGING_SERVICE_API_PATH || DEFAULT_LOGGING_API_PATH;
  private readonly loggingTimeoutMs = Number(
    process.env.LOGGING_SERVICE_TIMEOUT || String(DEFAULT_LOGGING_TIMEOUT_MS),
  );
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
    // LogEntryDto's LogLevel enum has no 'verbose', so emitting it verbatim is a
    // 400 that emit()'s catch would swallow. Map to the nearest accepted level.
    this.emit('debug', message, context);
  }

  private emit(level: string, message: unknown, context?: string, meta?: LogMeta): void {
    if (!this.loggingUrl || !this.serviceName || Number.isNaN(this.loggingTimeoutMs)) {
      return;
    }
    try {
      const requestContext = RequestContext.get();
      // `metadata` is the field name LogEntryDto accepts; the ingest endpoint runs
      // forbidNonWhitelisted, so `context`/`meta` would be rejected with a 400.
      const payload = {
        service: this.serviceName,
        level,
        message: String(message),
        metadata: {
          ...meta,
          context,
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
        .then((r) => {
          if (!r.ok) {
            console.error(
              `OPERATIONAL_FAILURE logging-microservice ingest failed http=${r.status} path=${path}`,
            );
          }
        })
        .catch((e) => {
          console.error(
            'OPERATIONAL_FAILURE logging-microservice unreachable',
            (e as Error).message,
          );
        })
        .finally(() => clearTimeout(timeout));
    } catch {
      // Logging failures must not break the service.
    }
  }
}
