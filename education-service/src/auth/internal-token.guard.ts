import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = process.env.EDUCATION_SERVICE_INTERNAL_TOKEN || process.env.INTERNAL_API_TOKEN;
    const sent = req.header('x-internal-token');
    if (!expected || !sent || sent !== expected) {
      throw new UnauthorizedException('Invalid internal token');
    }
    return true;
  }
}
