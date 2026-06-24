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
    const sent = req.header('x-internal-token');
    const expected = process.env.INTERNAL_API_TOKEN;
    if (!sent || !expected || sent !== expected) {
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
