import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthClientService } from '../auth-client/auth-client.service';
import type { AuthContextUser } from '../shared/auth.types';

type ServiceActor = {
  type: 'service';
  serviceName: string;
  authMethod: 'internal-service-token';
};

@Injectable()
export class GatewayAuthGuard implements CanActivate {
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
    return true;
  }

  private resolveServiceName(req: Request): string {
    const raw = req.headers['x-service-name'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value?.trim() || 'internal-service';
  }
}
