import { timingSafeEqual } from 'crypto';
import type { AuthContextUser } from './auth.types';

function userRoles(u: AuthContextUser): string[] {
  if (!u.roles) {
    return [];
  }
  if (Array.isArray(u.roles)) {
    return u.roles.map(String);
  }
  if (typeof u.roles === 'object') {
    return Object.values(u.roles as Record<string, unknown>).map(String);
  }
  return [];
}

export function isAdmin(u: AuthContextUser): boolean {
  return u.userType === 'admin' || userRoles(u).includes('admin');
}

export function internalApiKeyMatches(headerValue: string | undefined): boolean {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected || headerValue === undefined) {
    return false;
  }
  try {
    const a = Buffer.from(headerValue, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
