import type { AuthRole, ValidatedUser } from './auth.types';

/** Auth-microservice returns scope-prefixed role strings (e.g. `global:superadmin`). */
function stripAuthScopePrefix(role: string): string {
  const x = role.toLowerCase().trim();
  const idx = x.indexOf(':');
  if (idx <= 0) {
    return x;
  }
  return x.slice(idx + 1);
}

export function normalizeRoleNames(user: ValidatedUser | undefined): string[] {
  const raw = user?.roles;
  if (!raw || raw.length === 0) {
    return [];
  }
  if (typeof raw[0] === 'string') {
    return (raw as string[])
      .map((r) => stripAuthScopePrefix(r))
      .filter(Boolean);
  }
  return (raw as AuthRole[])
    .map((r) => stripAuthScopePrefix(r?.name || ''))
    .filter(Boolean);
}
