import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

type ServiceActor = {
  type: 'service';
  serviceName: string;
  authMethod: 'internal-service-token';
};

@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = process.env.FINANCIAL_INTERNAL_API_TOKEN;
    if (!expected) {
      throw new UnauthorizedException('Service misconfigured');
    }
    const token = req.headers['x-internal-token'];
    if (typeof token !== 'string' || token !== expected) {
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
