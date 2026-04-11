import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ValidatedUser } from './auth.types';

type ValidateResponse = {
  valid?: boolean;
  user?: ValidatedUser;
};

@Injectable()
export class AuthClientService {
  private readonly logger = new Logger(AuthClientService.name);
  private readonly baseUrl = process.env.AUTH_SERVICE_URL;
  private readonly timeoutMs = Number(process.env.AUTH_SERVICE_TIMEOUT || 5000);

  async validateToken(token: string): Promise<ValidatedUser> {
    if (!this.baseUrl) {
      throw new UnauthorizedException('Auth service is not configured');
    }
    const started = Date.now();
    const url = `${this.baseUrl.replace(/\/$/, '')}/auth/validate`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        signal: controller.signal,
      });
      const durationMs = Date.now() - started;
      this.logger.log(`auth/validate duration_ms=${durationMs} status=${res.status}`);
      if (!res.ok) {
        throw new UnauthorizedException('Invalid or expired token');
      }
      const body = (await res.json()) as ValidateResponse;
      if (!body?.user?.id) {
        throw new UnauthorizedException('Invalid auth response');
      }
      return body.user;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.error(`auth/validate failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Auth service unavailable');
    } finally {
      clearTimeout(timer);
    }
  }
}
