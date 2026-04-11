import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { normalizeRoleNames } from './normalize-roles';

function parseRoleCsv(raw: string | undefined, fallback: string): Set<string> {
  const src = (raw && raw.trim().length > 0 ? raw : fallback)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(src);
}

@Injectable()
export class StaffRolesGuard implements CanActivate {
  private readonly allowed = parseRoleCsv(
    process.env.ASSESSMENT_STAFF_ROLE_NAMES,
    'admin,super_admin,staff',
  );

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Staff access required');
    }
    const roles = normalizeRoleNames(user);
    const ok = roles.some((r) => this.allowed.has(r));
    if (!ok) {
      throw new ForbiddenException('Staff access required');
    }
    return true;
  }
}
