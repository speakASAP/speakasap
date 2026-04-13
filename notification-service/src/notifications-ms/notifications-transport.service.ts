import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { notificationHttpException } from '../shared/notification-http.exception';
import { logOperationalFailure } from '../shared/operational-log';

export type SendEmailPayload = {
  recipient: string;
  subject?: string;
  message: string;
  attachments?: string[];
  templateData?: Record<string, unknown>;
};

@Injectable()
export class NotificationsTransportService {
  private readonly logger = new Logger(NotificationsTransportService.name);

  private baseUrl(): string {
    return (process.env.NOTIFICATIONS_MICROSERVICE_URL || '').replace(/\/$/, '');
  }

  private timeoutMs(): number {
    const n = Number(process.env.NOTIFICATION_SERVICE_TIMEOUT);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
    return 8000;
  }

  async sendEmail(payload: SendEmailPayload): Promise<void> {
    const base = this.baseUrl();
    const url = `${base}/notifications/send`;
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const apiKey = process.env.NOTIFICATIONS_MICROSERVICE_API_KEY;
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          channel: 'email',
          type: 'custom',
          recipient: payload.recipient,
          subject: payload.subject,
          message: payload.message,
          attachments: payload.attachments,
          templateData: payload.templateData,
          service: 'speakasap-notification-service',
        }),
      });
      const durationMs = Date.now() - started;
      this.logger.log(
        `${new Date().toISOString()} notifications-ms POST /notifications/send duration_ms=${durationMs} status=${res.status}`,
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        logOperationalFailure(this.logger, {
          component: 'notifications-microservice',
          operation: 'POST /notifications/send',
          duration_ms: durationMs,
          httpStatus: res.status,
          errorCode: 'NOTIFICATION_TRANSPORT_UNAVAILABLE',
          message: `Upstream HTTP ${res.status}`,
          responsePreview: text.slice(0, 800),
        });
        throw notificationHttpException(
          HttpStatus.BAD_GATEWAY,
          'NOTIFICATION_TRANSPORT_UNAVAILABLE',
          `notifications-microservice returned ${res.status}`,
          {
            upstreamStatus: res.status,
            upstreamBodyPreview: text.slice(0, 500),
          },
        );
      }
    } catch (err) {
      const durationMs = Date.now() - started;
      if ((err as Error).name === 'AbortError') {
        logOperationalFailure(this.logger, {
          component: 'notifications-microservice',
          operation: 'POST /notifications/send',
          duration_ms: durationMs,
          errorCode: 'NOTIFICATION_TRANSPORT_TIMEOUT',
          message: 'AbortError (timeout or client abort)',
        });
        this.logger.error(
          `${new Date().toISOString()} notifications-ms send timeout duration_ms=${durationMs}`,
        );
      } else if (!(err && typeof err === 'object' && 'getStatus' in err)) {
        logOperationalFailure(this.logger, {
          component: 'notifications-microservice',
          operation: 'POST /notifications/send',
          duration_ms: durationMs,
          errorCode: 'NOTIFICATION_TRANSPORT_UNAVAILABLE',
          message: (err as Error).message?.slice(0, 500) ?? 'unknown_error',
        });
        this.logger.error(
          `${new Date().toISOString()} notifications-ms send error duration_ms=${durationMs} ${(err as Error).message}`,
        );
      }
      if (err && typeof err === 'object' && 'getStatus' in err) {
        throw err;
      }
      throw notificationHttpException(
        HttpStatus.BAD_GATEWAY,
        'NOTIFICATION_TRANSPORT_UNAVAILABLE',
        'notifications-microservice unreachable or errored',
        { duration_ms: durationMs },
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
