import { ROUTE_ROLES, hasAnyRole, normalizeRoleNames, resolveRolePolicy } from './route-roles';
import { ROUTES } from './upstream-resolve';

describe('normalizeRoleNames', () => {
  it('strips the app:speakasap: scope down to the bare role name', () => {
    expect(normalizeRoleNames(['app:speakasap:teacher'])).toEqual(['teacher']);
    expect(normalizeRoleNames(['app:speakasap:user'])).toEqual(['user']);
  });

  it('maps global staff roles to their bare equivalents', () => {
    expect(normalizeRoleNames(['global:superadmin'])).toEqual(['superadmin']);
    expect(normalizeRoleNames(['global:platform_admin'])).toEqual(['admin']);
  });

  // internal:* scopes identify machine callers. Treating one as a user role
  // would let a service credential satisfy a staff-only route.
  it('drops internal service scopes, which are not user roles', () => {
    expect(normalizeRoleNames(['internal:warehouse-microservice:admin'])).toEqual([]);
  });

  // Another application's admin must not become a SpeakASAP admin.
  it('drops roles scoped to a different application', () => {
    expect(normalizeRoleNames(['app:heureka:admin'])).toEqual([]);
  });

  it('keeps legacy unscoped roles, which auth still issues', () => {
    expect(normalizeRoleNames(['teacher'])).toEqual(['teacher']);
  });

  // auth-microservice emits string[], but assessment-service defends against an
  // object shape too. If that shape ever reaches the gateway we must read it
  // rather than silently produce an empty role set.
  it('accepts the {name} object shape as well as plain strings', () => {
    expect(normalizeRoleNames([{ name: 'app:speakasap:teacher' }])).toEqual(['teacher']);
  });

  it('never throws on malformed input', () => {
    expect(normalizeRoleNames(undefined)).toEqual([]);
    expect(normalizeRoleNames(null)).toEqual([]);
    expect(normalizeRoleNames('teacher')).toEqual([]);
    expect(normalizeRoleNames([null, 42, {}, ''])).toEqual([]);
  });
});

describe('hasAnyRole', () => {
  // The same human is routinely both a teacher and a student. Enforcement must
  // be "holds any accepted role", never "role equals".
  it('grants a multi-role user via any one matching role', () => {
    const roles = ['app:speakasap:user', 'app:speakasap:teacher'];
    expect(hasAnyRole(roles, ['teacher'])).toBe(true);
  });

  it('denies when no role matches', () => {
    expect(hasAnyRole(['app:speakasap:user'], ['teacher', 'admin'])).toBe(false);
  });

  it('denies on an empty or absent role array', () => {
    expect(hasAnyRole([], ['admin'])).toBe(false);
    expect(hasAnyRole(undefined, ['admin'])).toBe(false);
  });
});

describe('resolveRolePolicy', () => {
  it('requires staff for admin surfaces', () => {
    expect(resolveRolePolicy('/api/v1/admin/language-tests')).toEqual({
      kind: 'require',
      anyOf: expect.arrayContaining(['admin', 'superadmin']),
    });
  });

  // The financial and salary services have no role guard of their own. If this
  // assertion ever fails, salary data is exposed to every authenticated user.
  it('requires staff for salary and financial surfaces', () => {
    for (const path of [
      '/api/v1/salary-profiles',
      '/api/v1/payout-runs',
      '/api/v1/revenue',
      '/api/v1/expenses',
      '/api/v1/dashboard/overview',
    ]) {
      expect(resolveRolePolicy(path)).toEqual({
        kind: 'require',
        anyOf: expect.arrayContaining(['admin']),
      });
    }
  });

  it('accepts teachers as well as staff on teacher surfaces', () => {
    const policy = resolveRolePolicy('/api/v1/teachers/7');
    expect(policy).toEqual({ kind: 'require', anyOf: expect.arrayContaining(['teacher']) });
    if (policy.kind === 'require') {
      // A student-only account must not reach a teacher route...
      expect(hasAnyRole(['app:speakasap:user'], policy.anyOf)).toBe(false);
      // ...but a teacher-and-student account must.
      expect(hasAnyRole(['app:speakasap:user', 'app:speakasap:teacher'], policy.anyOf)).toBe(true);
    }
  });

  // Student-owned routes stay open to any authenticated user: ownership is
  // enforced downstream from the token subject, and a role check here would
  // break every live student.
  it('leaves owner-scoped student routes open to any authenticated user', () => {
    expect(resolveRolePolicy('/api/v1/drill-assignments/mine')).toEqual({
      kind: 'allow-any-authenticated',
    });
    expect(resolveRolePolicy('/api/v1/lessons/42')).toEqual({ kind: 'allow-any-authenticated' });
  });

  it('reports an unlisted path as undeclared rather than allowed', () => {
    expect(resolveRolePolicy('/api/v1/something-brand-new')).toEqual({ kind: 'undeclared' });
  });

  // Segment-aware matching, same rule as resolveUpstreamBaseUrl. A plain
  // startsWith would let '/api/v1/adminx' inherit the admin policy — or worse,
  // miss it.
  it('matches on path segments, not raw string prefixes', () => {
    expect(resolveRolePolicy('/api/v1/adminx')).toEqual({ kind: 'undeclared' });
  });
});

describe('ROUTE_ROLES coverage invariant', () => {
  // The gateway's whole weakness was that a route could be added with no role
  // decision made about it. This test is the backstop: every proxied public
  // prefix must appear in ROUTE_ROLES, even if the answer is "open to all".
  // Adding a route to ROUTES without a policy fails here, at build time,
  // instead of silently shipping an unprotected endpoint.
  it('declares a policy for every non-internal proxied route', () => {
    const undeclared = ROUTES.filter((r) => !r.prefix.startsWith('/api/v1/internal'))
      .map((r) => r.prefix)
      .filter((prefix) => resolveRolePolicy(prefix).kind === 'undeclared');

    expect(undeclared).toEqual([]);
  });

  // Same first-match-wins hazard as ROUTES: a broad prefix placed above a
  // narrow one silently swallows it, which here would mean a staff-only rule
  // being shadowed by an allow-any rule above it.
  it('never places a broader prefix above a narrower one it would shadow', () => {
    const violations: string[] = [];
    for (let i = 0; i < ROUTE_ROLES.length; i += 1) {
      for (let j = i + 1; j < ROUTE_ROLES.length; j += 1) {
        const earlier = ROUTE_ROLES[i];
        const later = ROUTE_ROLES[j];
        if (later.prefix !== earlier.prefix && later.prefix.startsWith(`${earlier.prefix}/`)) {
          violations.push(`ROUTE_ROLES[${i}] "${earlier.prefix}" shadows ROUTE_ROLES[${j}] "${later.prefix}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
