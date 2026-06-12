import type { AuthContextUser } from './auth.types';

/** MVP: staff/manager access for education management list APIs. Align with auth-microservice role payloads. */
export function isStaffUser(user: AuthContextUser | undefined): boolean {
  if (!user) {
    return false;
  }
  if (user.userType === 'staff' || user.userType === 'admin') {
    return true;
  }
  const roles = user.roles;
  if (Array.isArray(roles)) {
    return roles.some((r) => {
      if (typeof r !== 'string') {
        return false;
      }
      const role = r.toLowerCase();
      const roleName = role.includes(':') ? role.split(':').pop() : role;
      return ['staff', 'admin', 'manager', 'superadmin'].includes(role) || ['staff', 'admin', 'manager', 'superadmin'].includes(roleName || '');
    });
  }
  return false;
}
