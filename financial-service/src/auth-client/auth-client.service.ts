import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { AuthContextUser } from '../shared/auth.types';
import { RequestContext } from '../shared/request-context';

@Injectable()
export class AuthClientService {
  private readonly logger = new Logger(AuthClientService.name);

  async validateAccessToken(token: string): Promise<AuthContextUser> {
    const baseRaw = process.env.AUTH_SERVICE_URL || process.env.AUTH_MICROSERVICE_URL;
    if (!baseRaw) {
      throw new UnauthorizedException('Auth service URL not configured');
    }
    const base = baseRaw.replace(/\/$/, '');
    const url = `${base}/auth/validate`;
    const timeoutMs = Number(process.env.AUTH_SERVICE_TIMEOUT);
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
        this.logger.warn(`auth/validate failed status=${res.status} duration_ms=${durationMs}`);
        throw new UnauthorizedException('Invalid token');
      }
      const body = (await res.json()) as { valid?: boolean; user?: Record<string, unknown> };
      const u = body.user;
      if (!u || typeof u !== 'object' || typeof u.id !== 'string') {
        throw new UnauthorizedException('Invalid token');
      }
      this.logger.log(`auth/validate ok duration_ms=${durationMs}`);
      const user: AuthContextUser = {
        id: u.id,
        email: (u.email as string) ?? null,
        firstName: (u.firstName as string) ?? null,
        lastName: (u.lastName as string) ?? null,
        phone: (u.phone as string) ?? null,
        userType: String(u.userType || 'end_user'),
        roles: u.roles,
      };
      const ctx = RequestContext.get();
      if (ctx) {
        ctx.userId = user.id;
      }
      return user;
    } catch (err) {
      const durationMs = Date.now() - started;
      if ((err as Error).name === 'AbortError') {
        this.logger.error(`auth/validate timeout duration_ms=${durationMs}`);
      }
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.error(`auth/validate error duration_ms=${durationMs} ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid token');
    } finally {
      clearTimeout(timer);
    }
  }
}
