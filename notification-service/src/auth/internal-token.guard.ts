import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

type ServiceActor = {
  type: 'service';
  serviceName: string;
  authMethod: 'internal-service-token';
};

/**
 * Service-to-service auth for routes that internal callers reach without a user.
 *
 * `JwtAuthGuard` validates a real user JWT against auth-microservice, which a
 * background job has no way to produce: education-service dispatches drill mail
 * from a fire-and-forget hook with no request user in scope. That mismatch is why
 * every drill email 401'd once the route path was corrected.
 *
 * Mirrors `user-service` and `financial-service`, which guard their `internal/`
 * routes the same way against the shared `INTERNAL_API_TOKEN`.
 */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = process.env.INTERNAL_API_TOKEN;
    if (!expected) {
      // Misconfiguration, not a bad caller: fail loudly rather than letting a
      // missing env var silently turn into "every internal request is rejected".
      throw new UnauthorizedException('Service misconfigured: INTERNAL_API_TOKEN is not set');
    }
    const sent = req.headers['x-internal-token'];
    if (typeof sent !== 'string' || !safeEqual(sent, expected)) {
      throw new UnauthorizedException('Invalid internal token');
    }
    (req as Request & { serviceActor?: ServiceActor }).serviceActor = {
      type: 'service',
      serviceName: req.header('x-service-name')?.trim() || 'internal-service',
      authMethod: 'internal-service-token',
    };
    return true;
  }
}

/** Constant-time compare so a wrong token cannot be recovered byte by byte. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
