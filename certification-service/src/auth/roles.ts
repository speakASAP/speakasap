const GLOBAL_MANAGER_ROLES = new Set(['global:superadmin', 'global:platform_admin']);
const SPEAKASAP_ROLE_PREFIX = 'app:speakasap:';

function normalizeSpeakAsapUserRole(role: string): string | undefined {
  const normalized = role.toLowerCase().trim();
  if (!normalized) {
    return undefined;
  }
  if (!normalized.includes(':')) {
    return normalized;
  }
  if (GLOBAL_MANAGER_ROLES.has(normalized)) {
    return 'manager';
  }
  if (normalized.startsWith(SPEAKASAP_ROLE_PREFIX)) {
    return normalized.slice(SPEAKASAP_ROLE_PREFIX.length);
  }
  return undefined;
}

function hasNormalizedRole(roles: string[] | undefined, expected: string): boolean {
  return roles?.some((role) => normalizeSpeakAsapUserRole(role) === expected) ?? false;
}

export function hasManagerAccess(roles: string[] | undefined): boolean {
  return hasNormalizedRole(roles, 'manager');
}

export function hasTeacherAccess(roles: string[] | undefined): boolean {
  return hasNormalizedRole(roles, 'teacher') || hasManagerAccess(roles);
}

/** Matches legacy `TeacherRequired` (teacher profile only, not managers). */
export function isPortalTeacher(roles: string[] | undefined): boolean {
  return hasNormalizedRole(roles, 'teacher');
}
