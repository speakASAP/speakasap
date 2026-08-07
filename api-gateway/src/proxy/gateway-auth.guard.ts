import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthClientService } from '../auth-client/auth-client.service';
import type { AuthContextUser } from '../shared/auth.types';
import { hasAnyRole, normalizeRoleNames, resolveRolePolicy } from './route-roles';

type ServiceActor = {
  type: 'service';
  serviceName: string;
  authMethod: 'internal-service-token';
};

/**
 * Role enforcement is staged, because this gateway fronts a platform with live
 * students and teachers mid-lesson and a wrong policy row logs real people out
 * of a class in progress.
 *
 *   unset / 'shadow' — evaluate the policy and log what WOULD have been denied,
 *                      but let every request through. Safe to deploy at any
 *                      time; produces the evidence needed to trust step two.
 *   'enforce'        — deny on an unsatisfied role requirement. Undeclared
 *                      routes still pass (see below).
 *   'strict'         — additionally deny routes with no declared policy.
 *
 * The default is shadow ON PURPOSE. Defaulting to enforce would mean this
 * commit changes production behaviour the moment it deploys, which is exactly
 * the risk this rollout is designed to avoid.
 */
type EnforcementMode = 'shadow' | 'enforce' | 'strict';

function enforcementMode(): EnforcementMode {
  const raw = (process.env.GATEWAY_ROLE_ENFORCEMENT || '').trim().toLowerCase();
  if (raw === 'enforce' || raw === 'strict') {
    return raw;
  }
  return 'shadow';
}

@Injectable()
export class GatewayAuthGuard implements CanActivate {
  private readonly logger = new Logger(GatewayAuthGuard.name);

  constructor(private readonly auth: AuthClientService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const url = req.originalUrl || '';
    const pathname = url.split('?')[0];

    if (pathname.startsWith('/api/v1/webhooks/payments') && req.method === 'POST') {
      return true;
    }

    if (/^\/api\/v1\/lessons\/[^/]+\/record\/download$/.test(pathname) && req.method === 'GET') {
      return true;
    }

    if ((pathname === '/api/v1/seven' || pathname.startsWith('/api/v1/seven/')) && req.method === 'GET') {
      return true;
    }

    if (pathname.startsWith('/api/v1/internal')) {
      const expected = process.env.GATEWAY_INTERNAL_API_TOKEN;
      const raw = req.headers['x-internal-token'];
      const token = Array.isArray(raw) ? raw[0] : raw;
      if (!expected || token !== expected) {
        throw new ForbiddenException({
          code: 'FORBIDDEN_INTERNAL_ROUTE',
          message: 'Internal routes are not allowed',
          details: {},
        });
      }
      (req as Request & { serviceActor?: ServiceActor }).serviceActor = {
        type: 'service',
        serviceName: this.resolveServiceName(req),
        authMethod: 'internal-service-token',
      };
      return true;
    }

    const authz = req.headers.authorization;
    if (!authz?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Missing bearer token',
        details: {},
      });
    }
    const bearer = authz.slice(7);
    const user = await this.auth.validateAccessToken(bearer);
    this.auth.attachRequestContext(user);
    (req as Request & { authUser?: AuthContextUser }).authUser = user;

    // Role check runs only after the token is proven valid, and only for
    // token-bearing callers. Every bypass above (payment webhooks, lesson
    // record download, public /seven GETs, internal-token routes) returns
    // before reaching here and is deliberately unaffected.
    this.enforceRolePolicy(req, pathname, user);
    return true;
  }

  /**
   * Second layer of defence, NOT a replacement for downstream ownership checks.
   * A role says "may this kind of user reach this route"; only the owning
   * service can say "is this row yours" — the gateway cannot see the data.
   */
  private enforceRolePolicy(req: Request, pathname: string, user: AuthContextUser): void {
    const policy = resolveRolePolicy(pathname);
    const mode = enforcementMode();

    if (policy.kind === 'allow-any-authenticated') {
      return;
    }

    if (policy.kind === 'undeclared') {
      // A route nobody classified. Loud in every mode, because this is the
      // exact condition that let routes ship unprotected, but only fatal under
      // 'strict' — a new upstream route appearing mid-rollout must not 403
      // real users before anyone has reviewed it.
      this.logger.warn(
        `${new Date().toISOString()} role-policy undeclared route method=${req.method} path=${pathname} mode=${mode}`,
      );
      if (mode === 'strict') {
        throw new ForbiddenException({
          code: 'FORBIDDEN_UNDECLARED_ROUTE',
          message: 'Route has no declared role policy',
          details: {},
        });
      }
      return;
    }

    if (hasAnyRole(user.roles, policy.anyOf)) {
      return;
    }

    // Log the normalized roles, never the raw token or the user's email —
    // this line goes to the shared log pipeline.
    this.logger.warn(
      `${new Date().toISOString()} role-policy denied method=${req.method} path=${pathname} ` +
        `userId=${user.id} held=[${normalizeRoleNames(user.roles).join(',')}] ` +
        `required=[${policy.anyOf.join(',')}] mode=${mode}`,
    );

    if (mode === 'shadow') {
      // Shadow mode: we have recorded what would have been denied, but the
      // request proceeds. This is what makes the first deploy non-breaking.
      return;
    }

    throw new ForbiddenException({
      code: 'FORBIDDEN_ROLE',
      message: 'Insufficient role for this route',
      details: {},
    });
  }

  private resolveServiceName(req: Request): string {
    const raw = req.headers['x-service-name'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value?.trim() || 'internal-service';
  }
}
