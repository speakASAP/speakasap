import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { RequestContext } from '../shared/request-context';
import type { JwtUser } from './jwt-user';

type JwtPayload = {
  sub?: string;
  roles?: string[];
  email?: string;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice('Bearer '.length).trim();
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      this.logger.error('JWT_SECRET is not configured');
      throw new UnauthorizedException();
    }
    try {
      const payload = jwt.verify(token, secret) as JwtPayload;
      if (!payload.sub) {
        throw new UnauthorizedException('Invalid token subject');
      }
      const user: JwtUser = {
        sub: payload.sub,
        roles: Array.isArray(payload.roles) ? payload.roles : [],
        email: typeof payload.email === 'string' ? payload.email : undefined,
      };
      req.user = user;
      RequestContext.setUserId(user.sub);
      return true;
    } catch (error) {
      this.logger.warn(`JWT verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
