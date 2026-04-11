import type { AuthRole, ValidatedUser } from './auth.types';

export function normalizeRoleNames(user: ValidatedUser | undefined): string[] {
  const raw = user?.roles;
  if (!raw || raw.length === 0) {
    return [];
  }
  if (typeof raw[0] === 'string') {
    return (raw as string[]).map((r) => r.toLowerCase()).filter(Boolean);
  }
  return (raw as AuthRole[])
    .map((r) => (r?.name || '').toLowerCase())
    .filter(Boolean);
}
