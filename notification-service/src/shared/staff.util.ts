import type { AuthContextUser } from './auth.types';

export function isStaffUser(user: AuthContextUser): boolean {
  const t = (user.userType || '').toLowerCase();
  if (t === 'admin' || t === 'staff') {
    return true;
  }
  const roles = user.roles;
  if (Array.isArray(roles)) {
    return roles.some((r) => {
      if (typeof r === 'string') {
        const s = r.toLowerCase();
        return s === 'admin' || s === 'staff';
      }
      if (r && typeof r === 'object' && 'name' in (r as object)) {
        const n = String((r as { name?: string }).name || '').toLowerCase();
        return n === 'admin' || n === 'staff';
      }
      return false;
    });
  }
  return false;
}
