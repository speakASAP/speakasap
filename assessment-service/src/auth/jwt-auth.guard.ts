import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthClientService } from './auth-client.service';
import { RequestContext } from '../shared/request-context';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authClient: AuthClientService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = extractBearer(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const user = await this.authClient.validateToken(token);
    req.user = user;
    RequestContext.patch({ userId: user.id });
    return true;
  }
}

export function extractBearer(authorization?: string): string | undefined {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return undefined;
  }
  return authorization.slice(7).trim();
}
