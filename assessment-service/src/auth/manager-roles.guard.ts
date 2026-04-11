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
export class ManagerRolesGuard implements CanActivate {
  private readonly managers = parseRoleCsv(
    process.env.ASSESSMENT_MANAGER_ROLE_NAMES,
    'manager,admin,super_admin',
  );

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Manager access required');
    }
    const roles = normalizeRoleNames(user);
    const ok = roles.some((r) => this.managers.has(r));
    if (!ok) {
      throw new ForbiddenException('Manager access required');
    }
    return true;
  }
}
