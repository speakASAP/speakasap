import type { AuthContextUser } from './auth.types';

/**
 * Role vocabulary, mirroring api-gateway's `route-roles.ts`.
 *
 * auth-microservice's `RolesService.getUserRoles` emits one of three shapes:
 *   `global:<name>` · `app:<appname>:<name>` · `internal:<appname>:<name>`
 * plus legacy unscoped names that predate the scheme and are still issued.
 */
const SPEAKASAP_ROLE_PREFIX = 'app:speakasap:';

/** Roles that stand in for platform staff, mapped to bare names. */
const GLOBAL_ROLE_MAP: Record<string, string> = {
  'global:superadmin': 'superadmin',
  'global:platform_admin': 'admin',
};

/** Staff-equivalent bare role names. Deliberately excludes `teacher`. */
const STAFF_ROLES = ['staff', 'admin', 'manager', 'superadmin'];

/**
 * Reduce one raw role string to a bare, comparable name, or undefined when it is
 * not a SpeakASAP *user* role.
 *
 * `internal:*` scopes are dropped rather than normalized: they identify machine
 * callers, and a service token must never satisfy a user-facing role check. Roles
 * scoped to another application are dropped for the same reason — `app:marathon:teacher`
 * is not a SpeakASAP teacher.
 */
function normalizeRole(role: unknown): string | undefined {
  if (typeof role !== 'string') {
    return undefined;
  }
  const normalized = role.toLowerCase().trim();
  if (!normalized) {
    return undefined;
  }
  if (!normalized.includes(':')) {
    return normalized;
  }
  if (GLOBAL_ROLE_MAP[normalized]) {
    return GLOBAL_ROLE_MAP[normalized];
  }
  if (normalized.startsWith(SPEAKASAP_ROLE_PREFIX)) {
    return normalized.slice(SPEAKASAP_ROLE_PREFIX.length);
  }
  return undefined;
}

function bareRoles(user: AuthContextUser | undefined): string[] {
  if (!user || !Array.isArray(user.roles)) {
    return [];
  }
  const out: string[] = [];
  for (const raw of user.roles) {
    const normalized = normalizeRole(raw);
    if (normalized) {
      out.push(normalized);
    }
  }
  return out;
}

/** Staff/manager access for education management list APIs. */
export function isStaffUser(user: AuthContextUser | undefined): boolean {
  if (!user) {
    return false;
  }
  if (user.userType === 'staff' || user.userType === 'admin') {
    return true;
  }
  const held = new Set(bareRoles(user));
  return STAFF_ROLES.some((role) => held.has(role));
}

/**
 * Teacher-facing access: the `app:speakasap:teacher` role, or staff.
 *
 * WHY THIS IS SEPARATE FROM `isStaffUser`
 * ---------------------------------------
 * Until 2026-08-24 the drilling wizard's teacher routes gated on `isStaffUser`,
 * and auth-microservice had no `teacher` role at all — every real teacher holds
 * `app:speakasap:user`, exactly like a student. So every teacher got a flat 403
 * from `GET /drill-assignments/teacher/students` and the wizard rendered
 * "Request failed with status 403" above an empty roster. Only admins could ever
 * use the feature.
 *
 * Folding `teacher` into `isStaffUser` would have been the smaller change and the
 * wrong one: the same predicate guards salary, manager and cross-user admin list
 * APIs elsewhere in this service, and 378 teachers must not reach those.
 *
 * SCOPE THIS DOES NOT CHECK
 * -------------------------
 * This answers "is the caller a teacher at all", never "is this specific lesson
 * or set theirs". A teacher who holds the role can reach any lesson's roster
 * through these routes. `lesson-records.service.ts#assertDomainAccess` shows the
 * per-row alternative (match `getTeacherId(bearer)` against `lesson.teacherId`);
 * drills does not apply it, so ownership scoping remains open work.
 */
export function isTeacherUser(user: AuthContextUser | undefined): boolean {
  if (isStaffUser(user)) {
    return true;
  }
  return bareRoles(user).includes('teacher');
}
