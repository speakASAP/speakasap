import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.INTERNAL_API_KEY;
    if (!expected) {
      this.logger.error('INTERNAL_API_KEY is not configured');
      throw new ServiceUnavailableException('Internal API is not configured');
    }
    const req = context.switchToHttp().getRequest<Request>();
    const provided = (req.headers['x-internal-api-key'] as string | undefined)?.trim();
    if (!provided) {
      throw new UnauthorizedException('Missing internal API key');
    }
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid internal API key');
    }
    return true;
  }
}
