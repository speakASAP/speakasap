import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthClientService } from '../auth-client/auth-client.service';
import { InternalTokenGuard } from './internal-token.guard';

/**
 * Accepts either a user JWT or the shared internal service token.
 *
 * Dispatch has two legitimate kinds of caller. The gateway exposes
 * `/api/v1/dispatch/email*` to user-facing traffic carrying a real JWT, while
 * education-service sends drill mail from a background hook that has no user in
 * scope and can only present `INTERNAL_API_TOKEN`. Requiring the JWT alone 401s
 * the latter; replacing it with the internal token alone would silently drop
 * authentication for the former.
 *
 * Presence of `x-internal-token` selects the service path — an explicit choice by
 * the caller, so a user request with a bad JWT can never fall through to the
 * weaker check.
 *
 * The JWT branch validates the token here rather than delegating to `JwtAuthGuard`.
 * That guard short-circuits to `true` on `@Public()`, and the dispatch controller
 * carries `@Public()` to get past the global `APP_GUARD` — delegating would hand
 * every unauthenticated request a free pass onto a route that sends email.
 */
@Injectable()
export class JwtOrInternalGuard implements CanActivate {
  private readonly internal = new InternalTokenGuard();

  constructor(private readonly authClient: AuthClientService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (typeof req.headers['x-internal-token'] === 'string') {
      return this.internal.canActivate(context);
    }

    const header = req.headers.authorization;
    if (!header?.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const user = await this.authClient.validateAccessToken(token);
    req.authUser = user;
    this.authClient.attachRequestContext(user);
    return true;
  }
}
