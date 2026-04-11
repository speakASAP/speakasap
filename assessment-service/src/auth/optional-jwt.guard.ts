import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthClientService } from './auth-client.service';
import { extractBearer } from './jwt-auth.guard';
import { RequestContext } from '../shared/request-context';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly authClient: AuthClientService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = extractBearer(req.headers.authorization);
    if (!token) {
      return true;
    }
    try {
      const user = await this.authClient.validateToken(token);
      req.user = user;
      RequestContext.patch({ userId: user.id });
    } catch {
      // Public read: ignore invalid optional auth
    }
    return true;
  }
}
