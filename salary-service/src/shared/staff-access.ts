import type { AuthContextUser } from './auth.types';

/** Staff salary admin — parity with legacy Django salary admin permissions (MVP: staff/admin/manager). */
export function isStaffUser(user: AuthContextUser | undefined): boolean {
  if (!user) {
    return false;
  }
  if (user.userType === 'staff' || user.userType === 'admin') {
    return true;
  }
  const roles = user.roles;
  if (Array.isArray(roles)) {
    return roles.some((r) => typeof r === 'string' && ['staff', 'admin', 'manager'].includes(r.toLowerCase()));
  }
  return false;
}
