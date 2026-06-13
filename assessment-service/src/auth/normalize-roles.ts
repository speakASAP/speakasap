import type { AuthRole, ValidatedUser } from './auth.types';

const GLOBAL_STAFF_ROLE_MAP: Record<string, string> = {
  'global:superadmin': 'superadmin',
  'global:platform_admin': 'admin',
};

const SPEAKASAP_ROLE_PREFIX = 'app:speakasap:';

function isRoleName(role: string | undefined): role is string {
  return Boolean(role);
}

/**
 * Keep legacy unscoped local roles, but only map Auth scoped roles that are
 * explicitly valid for SpeakASAP. Internal-service scopes are not user roles.
 */
function normalizeAuthRole(role: string): string | undefined {
  const normalized = role.toLowerCase().trim();
  if (!normalized) {
    return undefined;
  }
  if (!normalized.includes(':')) {
    return normalized;
  }
  if (GLOBAL_STAFF_ROLE_MAP[normalized]) {
    return GLOBAL_STAFF_ROLE_MAP[normalized];
  }
  if (normalized.startsWith(SPEAKASAP_ROLE_PREFIX)) {
    return normalized.slice(SPEAKASAP_ROLE_PREFIX.length);
  }
  return undefined;
}

export function normalizeRoleNames(user: ValidatedUser | undefined): string[] {
  const raw = user?.roles;
  if (!raw || raw.length === 0) {
    return [];
  }
  if (typeof raw[0] === 'string') {
    return (raw as string[])
      .map((r) => normalizeAuthRole(r))
      .filter(isRoleName);
  }
  return (raw as AuthRole[])
    .map((r) => normalizeAuthRole(r?.name || ''))
    .filter(isRoleName);
}
