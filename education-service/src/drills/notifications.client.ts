import { Injectable, Logger } from '@nestjs/common';
import { DrillNotification, NotificationsClient } from './notifications.hook';
import { numericEnv, requestUpstream, requiredEnv } from './orchestration/http';

const UPSTREAM = 'notification-service';

/**
 * HTTP transport for the drill notifications.
 *
 * Unlike the orchestration clients this one is called from a fire-and-forget path:
 * `NotificationsHook` catches everything, so a throw here degrades to a logged warning
 * rather than a failed transition. That is why the timeout is short — nobody is waiting
 * on the result, and a slow notification service must not hold a request open.
 */
@Injectable()
export class NotificationsClientAdapter implements NotificationsClient {
  private readonly logger = new Logger(NotificationsClientAdapter.name);

  async dispatch(notification: DrillNotification): Promise<void> {
    await this.post('/api/v1/internal/notifications/dispatch', notification);
  }

  async createInApp(notification: DrillNotification): Promise<void> {
    await this.post('/api/v1/internal/notifications/in-app', notification);
  }

  private async post(path: string, notification: DrillNotification): Promise<void> {
    await requestUpstream<unknown>({
      url: `${requiredEnv('NOTIFICATION_SERVICE_URL', UPSTREAM)}${path}`,
      method: 'POST',
      token: requiredEnv('INTERNAL_API_TOKEN', UPSTREAM),
      internalToken: requiredEnv('INTERNAL_API_TOKEN', UPSTREAM),
      body: notification,
      timeoutMs: numericEnv('DRILL_NOTIFICATION_TIMEOUT_MS', 10000),
      upstream: UPSTREAM,
    });
  }
}
