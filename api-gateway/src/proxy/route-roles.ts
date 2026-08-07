/**
 * Gateway-level role policy.
 *
 * WHY THIS EXISTS
 * ---------------
 * `GatewayAuthGuard` historically proved only that a bearer token was valid.
 * Any authenticated user — a student included — passed the gateway for every
 * proxied route, whatever role that route actually required. Nothing was
 * exploitable through the drilling feature, because education-service derives
 * studentId/teacherId from the token and filters by owner
 * (`assignments.service.ts` throws NotFound when `assignment.studentId !==
 * studentId`). But that is defence by remembering: protection lived entirely in
 * each downstream service, and a single route that forgets its ownership check
 * is open to the whole authenticated userbase with no backstop above it.
 *
 * Only two of the eleven SpeakASAP services enforce roles at all today
 * (certification-service's `roles.guard.ts`, assessment-service's
 * `staff-roles.guard.ts`). This table is the backstop for the other nine —
 * a second, independent layer, NOT a replacement for downstream ownership
 * checks. Roles answer "may this kind of user reach this route at all";
 * only the owning service can answer "is this specific row yours". A gateway
 * can never make that second call, because it does not know the data.
 *
 * WHY A TABLE AND NOT A DECORATOR
 * -------------------------------
 * The gateway proxies through one catch-all handler
 * (`GatewayProxyController.handle` is `@All('*')`). There is no per-route
 * handler to hang `@Roles()` metadata on, so policy has to be keyed on the
 * request path, exactly like `ROUTES` in `upstream-resolve.ts`. This file
 * deliberately mirrors that file's first-match-wins convention so the two
 * tables can be read side by side.
 *
 * ROLE VOCABULARY
 * ---------------
 * auth-microservice's `/auth/validate` returns `roles` as a flat `string[]`
 * built by `RolesService.getUserRoles` in one of three shapes:
 *   `global:<name>`         e.g. global:superadmin
 *   `app:<appname>:<name>`  e.g. app:speakasap:teacher
 *   `internal:<appname>:<name>`
 * We normalize to the bare role name and deliberately DROP `internal:` scopes —
 * those identify machine callers, not users, and must never satisfy a
 * user-facing role requirement. This matches assessment-service's
 * `normalize-roles.ts`, which is the established convention in this codebase.
 *
 * A person can hold many roles at once — the same human is routinely both a
 * teacher and a student. Every check is therefore "does the user hold ANY of
 * the accepted roles", never "is the user's role equal to".
 */

/** Global roles that stand in for platform staff, mapped to bare names. */
const GLOBAL_ROLE_MAP: Record<string, string> = {
  'global:superadmin': 'superadmin',
  'global:platform_admin': 'admin',
};

const SPEAKASAP_ROLE_PREFIX = 'app:speakasap:';

/**
 * Reduce one raw role string to a bare, comparable role name.
 * Returns undefined for anything that is not a SpeakASAP *user* role, which is
 * how `internal:*` scopes and other apps' roles get dropped rather than
 * silently granting access here.
 */
function normalizeRole(role: string): string | undefined {
  const normalized = role.toLowerCase().trim();
  if (!normalized) {
    return undefined;
  }
  // Legacy unscoped roles predate the scoping scheme and are still issued.
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

/**
 * `roles` arrives from the auth client typed as `unknown` because the gateway
 * does not own that contract. auth-microservice currently emits `string[]`, but
 * assessment-service already defends against an `Array<{name}>` shape, so we
 * accept both rather than crash — or worse, silently produce an empty role set,
 * which under a fail-closed default would lock out every real user at once.
 */
export function normalizeRoleNames(roles: unknown): string[] {
  if (!Array.isArray(roles)) {
    return [];
  }
  const out: string[] = [];
  for (const entry of roles) {
    let raw: string | undefined;
    if (typeof entry === 'string') {
      raw = entry;
    } else if (entry && typeof entry === 'object' && typeof (entry as { name?: unknown }).name === 'string') {
      raw = (entry as { name: string }).name;
    }
    if (!raw) {
      continue;
    }
    const normalized = normalizeRole(raw);
    if (normalized) {
      out.push(normalized);
    }
  }
  return out;
}

/**
 * Role sets, expressed as bare normalized names.
 *
 * `superadmin` and `admin` are appended to every staff-facing set: a superadmin
 * that gets 403 on an admin route is a support incident, and there is no case
 * in this platform where we want to lock a platform admin out of a staff route.
 */
const STAFF = ['admin', 'superadmin', 'manager'];
const TEACHER = ['teacher', ...STAFF];

/**
 * First-match-wins, most-specific-first — same discipline as `ROUTES`.
 * `anyOf: null` marks a route as "any authenticated user", which is the
 * historical gateway behaviour preserved explicitly rather than by omission.
 */
export const ROUTE_ROLES: { prefix: string; anyOf: string[] | null }[] = [
  // --- Staff-only administrative surfaces -------------------------------
  // These are the routes where a missing downstream check would be worst:
  // they read and write across all users rather than the caller's own rows.
  { prefix: '/api/v1/admin', anyOf: STAFF },
  { prefix: '/api/v1/manager', anyOf: STAFF },
  { prefix: '/api/v1/employee-profiles', anyOf: STAFF },
  { prefix: '/api/v1/managers', anyOf: STAFF },

  // Salary and financial data is staff-only in its entirety. salary-service and
  // financial-service have no role guard of their own today, so this table is
  // currently the ONLY thing standing in front of them.
  { prefix: '/api/v1/salary-profiles', anyOf: STAFF },
  { prefix: '/api/v1/salary-expenses', anyOf: STAFF },
  { prefix: '/api/v1/calculation-runs', anyOf: STAFF },
  { prefix: '/api/v1/payout-runs', anyOf: STAFF },
  { prefix: '/api/v1/contracts', anyOf: STAFF },
  { prefix: '/api/v1/dashboard/overview', anyOf: STAFF },
  { prefix: '/api/v1/revenue', anyOf: STAFF },
  { prefix: '/api/v1/expenses', anyOf: STAFF },

  // --- Teacher-facing surfaces ------------------------------------------
  // A teacher and a student are frequently the same person, so these accept
  // the teacher role in addition to staff — never "teacher and not student".
  { prefix: '/api/v1/teachers', anyOf: TEACHER },

  // --- Explicitly open to any authenticated user -------------------------
  // Listed rather than omitted so that adding a route without thinking about
  // its role is a test failure (see `route-roles.spec.ts`) instead of a silent
  // grant. Each of these is owner-scoped downstream by the token subject.
  { prefix: '/api/v1/students', anyOf: null },
  { prefix: '/api/v1/student-courses', anyOf: null },
  { prefix: '/api/v1/homeworks', anyOf: null },
  { prefix: '/api/v1/lessons', anyOf: null },
  { prefix: '/api/v1/groups', anyOf: null },
  { prefix: '/api/v1/drill-assignments', anyOf: null },
  { prefix: '/api/v1/user-questionnaires', anyOf: null },
  { prefix: '/api/v1/questionnaires', anyOf: null },
  { prefix: '/api/v1/quests', anyOf: null },
  { prefix: '/api/v1/education-certificates', anyOf: null },
  { prefix: '/api/v1/course-certificates', anyOf: null },
  { prefix: '/api/v1/language-user-tests', anyOf: null },
  { prefix: '/api/v1/asset-user-tests', anyOf: null },
  { prefix: '/api/v1/part-payment-collections', anyOf: null },
  { prefix: '/api/v1/offers', anyOf: null },
  { prefix: '/api/v1/products', anyOf: null },
  { prefix: '/api/v1/categories', anyOf: null },
  { prefix: '/api/v1/seven', anyOf: null },
  { prefix: '/api/v1/dictionary', anyOf: null },
  { prefix: '/api/v1/songs', anyOf: null },
  { prefix: '/api/v1/phonetics', anyOf: null },
  { prefix: '/api/v1/grammar', anyOf: null },
  { prefix: '/api/v1/languages', anyOf: null },
  { prefix: '/api/v1/drill-sets', anyOf: null },
  { prefix: '/api/v1/drill-topics', anyOf: null },
  { prefix: '/api/v1/drill-languages', anyOf: null },
  { prefix: '/api/v1/webhooks/payments', anyOf: null },
  { prefix: '/api/v1/discounts', anyOf: null },
  { prefix: '/api/v1/invoices', anyOf: null },
  { prefix: '/api/v1/subscriptions', anyOf: null },
  { prefix: '/api/v1/orders', anyOf: null },
  { prefix: '/api/v1/notification-groups', anyOf: null },
  { prefix: '/api/v1/preferences/me', anyOf: null },
  { prefix: '/api/v1/dispatch', anyOf: null },
  { prefix: '/api/v1/in-app', anyOf: null },
  { prefix: '/api/v1/letters', anyOf: null },
  { prefix: '/api/v1/templates', anyOf: null },
];

export type RolePolicy =
  | { kind: 'allow-any-authenticated' }
  | { kind: 'require'; anyOf: string[] }
  | { kind: 'undeclared' };

/**
 * Resolve the role policy for a path.
 *
 * `undeclared` is returned for paths with no entry — deliberately distinct from
 * `allow-any-authenticated` so the caller decides what to do about it. See
 * `GatewayAuthGuard` for why that currently warns rather than blocks, and
 * `ROUTE_ROLES_ENFORCE` for how it becomes a block.
 */
export function resolveRolePolicy(pathname: string): RolePolicy {
  for (const { prefix, anyOf } of ROUTE_ROLES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return anyOf === null ? { kind: 'allow-any-authenticated' } : { kind: 'require', anyOf };
    }
  }
  return { kind: 'undeclared' };
}

/** True when the user holds at least one of the accepted roles. */
export function hasAnyRole(roles: unknown, anyOf: string[]): boolean {
  const held = new Set(normalizeRoleNames(roles));
  return anyOf.some((r) => held.has(r));
}
