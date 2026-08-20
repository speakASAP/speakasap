import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { isStaffUser } from '../shared/staff-access';
import { StaffGuard } from './staff.guard';
import type { AuthContextUser } from '../shared/auth.types';

/**
 * The authorization gate on every salary endpoint.
 *
 * Everything this service exposes is payroll: what each teacher is paid, their bank and
 * PayPal details, their contracts. `isStaffUser` is the whole of the access decision and
 * had no tests. A false positive here hands one teacher another's salary; a false negative
 * locks staff out of payroll.
 */

function user(over: Partial<AuthContextUser> = {}): AuthContextUser {
  return { userType: 'student', roles: [], ...over } as AuthContextUser;
}

describe('isStaffUser', () => {
  describe('allows', () => {
    it('userType staff', () => {
      expect(isStaffUser(user({ userType: 'staff' }))).toBe(true);
    });

    it('userType admin', () => {
      expect(isStaffUser(user({ userType: 'admin' }))).toBe(true);
    });

    it('a staff/admin/manager role, case-insensitively', () => {
      for (const role of ['staff', 'admin', 'manager', 'STAFF', 'Admin', 'MANAGER']) {
        expect(isStaffUser(user({ roles: [role] }))).toBe(true);
      }
    });

    it('a staff role alongside unrelated ones', () => {
      expect(isStaffUser(user({ roles: ['student', 'teacher', 'manager'] }))).toBe(true);
    });
  });

  describe('refuses', () => {
    it('no user at all — an unauthenticated request is not staff', () => {
      expect(isStaffUser(undefined)).toBe(false);
    });

    it('a teacher, who is the SUBJECT of payroll rather than an administrator of it', () => {
      // The most important negative case in this file: a teacher must not read the payroll
      // that pays them, let alone anyone else's.
      expect(isStaffUser(user({ userType: 'teacher', roles: ['teacher'] }))).toBe(false);
    });

    it('a student', () => {
      expect(isStaffUser(user({ userType: 'student', roles: ['student'] }))).toBe(false);
    });

    it('a role that merely CONTAINS a privileged word', () => {
      // Substring matching here would promote every one of these to payroll admin.
      for (const role of ['administrator', 'staffing', 'submanager', 'not-admin', 'ex-staff']) {
        expect(isStaffUser(user({ roles: [role] }))).toBe(false);
      }
    });

    it('a userType that merely contains a privileged word', () => {
      for (const userType of ['administrator', 'staffing', 'nonstaff']) {
        expect(isStaffUser(user({ userType } as Partial<AuthContextUser>))).toBe(false);
      }
    });

    it('roles that are not strings', () => {
      // Junk in the token must not crash the guard, and must not pass it either.
      const roles = [null, 42, {}, ['staff']] as unknown as string[];
      expect(isStaffUser(user({ roles }))).toBe(false);
    });

    it('roles that are not an array', () => {
      expect(isStaffUser(user({ roles: 'staff' as unknown as string[] }))).toBe(false);
    });

    it('an empty role list', () => {
      expect(isStaffUser(user({ roles: [] }))).toBe(false);
    });
  });
});

describe('StaffGuard', () => {
  function contextFor(authUser: unknown): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ authUser }) }),
    } as unknown as ExecutionContext;
  }

  it('lets staff through', () => {
    expect(new StaffGuard().canActivate(contextFor({ userType: 'staff', roles: [] }))).toBe(true);
  });

  it('throws Forbidden for a teacher rather than returning false', () => {
    // Returning false would also deny, but the thrown message is what the caller sees.
    expect(() => new StaffGuard().canActivate(contextFor({ userType: 'teacher', roles: ['teacher'] })))
      .toThrow(ForbiddenException);
  });

  it('throws Forbidden when the request carries no authenticated user', () => {
    expect(() => new StaffGuard().canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });
});
