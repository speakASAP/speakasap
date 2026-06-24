import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { JwtUser } from '../auth/jwt-user';

@Injectable()
export class AuthClientService {
  private readonly logger = new Logger(AuthClientService.name);

  async validateAccessToken(token: string): Promise<JwtUser> {
    const base = process.env.AUTH_SERVICE_URL!.replace(/\/$/, '');
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
      if (!body.valid || !u || typeof u !== 'object' || typeof u.id !== 'string') {
        throw new UnauthorizedException('Invalid token');
      }

      this.logger.log(`auth/validate ok duration_ms=${durationMs}`);
      return {
        sub: u.id,
        roles: this.normalizeRoles(u.roles),
        email: typeof u.email === 'string' ? u.email : undefined,
      };
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

  private normalizeRoles(roles: unknown): string[] {
    if (!Array.isArray(roles)) {
      return [];
    }

    return roles.flatMap((role) => {
      if (typeof role === 'string') {
        return [role];
      }
      if (role && typeof role === 'object' && typeof (role as { name?: unknown }).name === 'string') {
        return [(role as { name: string }).name];
      }
      return [];
    });
  }
}
