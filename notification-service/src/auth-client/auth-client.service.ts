import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { AuthContextUser } from '../shared/auth.types';
import { logOperationalFailure } from '../shared/operational-log';
import { RequestContext } from '../shared/request-context';

@Injectable()
export class AuthClientService {
  private readonly logger = new Logger(AuthClientService.name);

  private authBaseUrl(): string {
    const base = process.env.AUTH_SERVICE_URL || process.env.AUTH_MICROSERVICE_URL;
    return (base || '').replace(/\/$/, '');
  }

  private authTimeoutMs(): number {
    const n = Number(process.env.AUTH_SERVICE_TIMEOUT);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
    return 5000;
  }

  async validateAccessToken(token: string): Promise<AuthContextUser> {
    const base = this.authBaseUrl();
    const url = `${base}/auth/validate`;
    const timeoutMs = this.authTimeoutMs();
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        signal: controller.signal,
      });
      const durationMs = Date.now() - started;
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        logOperationalFailure(this.logger, {
          component: 'auth-microservice',
          operation: 'POST /auth/validate',
          duration_ms: durationMs,
          httpStatus: res.status,
          errorCode: 'UNAUTHORIZED',
          message: `auth validate failed HTTP ${res.status}`,
          responsePreview: text.slice(0, 400),
        });
        this.logger.warn(
          `${new Date().toISOString()} auth/validate failed status=${res.status} duration_ms=${durationMs}`,
        );
        throw new UnauthorizedException('Invalid token');
      }
      const body = (await res.json()) as { valid?: boolean; user?: Record<string, unknown> };
      const u = body.user;
      if (!u || typeof u !== 'object' || typeof u.id !== 'string') {
        throw new UnauthorizedException('Invalid token');
      }
      this.logger.log(`${new Date().toISOString()} auth/validate ok duration_ms=${durationMs}`);
      return {
        id: u.id,
        email: (u.email as string) ?? null,
        firstName: (u.firstName as string) ?? null,
        lastName: (u.lastName as string) ?? null,
        phone: (u.phone as string) ?? null,
        userType: String(u.userType || 'end_user'),
        roles: u.roles,
      };
    } catch (err) {
      const durationMs = Date.now() - started;
      if ((err as Error).name === 'AbortError') {
        logOperationalFailure(this.logger, {
          component: 'auth-microservice',
          operation: 'POST /auth/validate',
          duration_ms: durationMs,
          errorCode: 'AUTH_VALIDATE_TIMEOUT',
          message: 'AbortError',
        });
        this.logger.error(`${new Date().toISOString()} auth/validate timeout duration_ms=${durationMs}`);
      }
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      logOperationalFailure(this.logger, {
        component: 'auth-microservice',
        operation: 'POST /auth/validate',
        duration_ms: durationMs,
        errorCode: 'AUTH_VALIDATE_ERROR',
        message: (err as Error).message?.slice(0, 500) ?? 'unknown',
      });
      this.logger.error(
        `${new Date().toISOString()} auth/validate error duration_ms=${durationMs} ${(err as Error).message}`,
      );
      throw new UnauthorizedException('Invalid token');
    } finally {
      clearTimeout(timer);
    }
  }

  attachRequestContext(user: AuthContextUser): void {
    const store = RequestContext.get();
    if (store) {
      store.userId = user.id;
    }
  }
}
