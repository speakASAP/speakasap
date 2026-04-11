import type { ValidatedUser } from './auth.types';
import { normalizeRoleNames } from './normalize-roles';

function roleSetFromEnv(value: string | undefined, fallback: string): Set<string> {
  const src = (value && value.trim().length > 0 ? value : fallback)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(src);
}

export function userHasAnyRole(
  user: ValidatedUser | undefined,
  envCsv: string | undefined,
  fallbackCsv: string,
): boolean {
  if (!user) {
    return false;
  }
  const allowed = roleSetFromEnv(envCsv, fallbackCsv);
  const roles = normalizeRoleNames(user);
  return roles.some((r) => allowed.has(r));
}
