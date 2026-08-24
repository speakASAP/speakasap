import { isStaffUser, isTeacherUser } from './staff-access';
import type { AuthContextUser } from './auth.types';

function user(overrides: Partial<AuthContextUser>): AuthContextUser {
  return {
    id: 'a3a4b6d0-0000-0000-0000-000000000001',
    email: null,
    firstName: null,
    lastName: null,
    phone: null,
    userType: 'end_user',
    ...overrides,
  };
}

describe('isStaffUser', () => {
  it('accepts staff and admin user types', () => {
    expect(isStaffUser(user({ userType: 'staff' }))).toBe(true);
    expect(isStaffUser(user({ userType: 'admin' }))).toBe(true);
  });

  it('accepts app-scoped admin and global superadmin roles', () => {
    expect(isStaffUser(user({ roles: ['app:speakasap:admin'] }))).toBe(true);
    expect(isStaffUser(user({ roles: ['global:superadmin'] }))).toBe(true);
  });

  // The whole point of the split: the teacher role must NOT widen into salary,
  // manager and admin list APIs, which are the other callers of isStaffUser.
  it('rejects the teacher role', () => {
    expect(isStaffUser(user({ roles: ['app:speakasap:teacher'] }))).toBe(false);
  });

  it('rejects a plain speakasap user, which is what every student holds', () => {
    expect(isStaffUser(user({ roles: ['app:speakasap:user'] }))).toBe(false);
  });

  it('rejects an undefined user', () => {
    expect(isStaffUser(undefined)).toBe(false);
  });
});

describe('isTeacherUser', () => {
  it('accepts the app-scoped teacher role', () => {
    expect(isTeacherUser(user({ roles: ['app:speakasap:teacher'] }))).toBe(true);
  });

  // A teacher is routinely also a student, so the roles arrive together and the
  // check has to be "holds any of", never "the role equals".
  it('accepts a teacher who also holds the student role', () => {
    expect(
      isTeacherUser(user({ roles: ['app:speakasap:user', 'app:speakasap:teacher'] })),
    ).toBe(true);
  });

  it('accepts staff, so an admin never gets 403 on a teacher route', () => {
    expect(isTeacherUser(user({ userType: 'admin' }))).toBe(true);
    expect(isTeacherUser(user({ roles: ['global:superadmin'] }))).toBe(true);
  });

  it('rejects a plain speakasap user', () => {
    expect(isTeacherUser(user({ roles: ['app:speakasap:user'] }))).toBe(false);
  });

  // `internal:` scopes identify machine callers. Granting them a user-facing
  // teacher route would let any service token read a roster.
  it('rejects an internal-scoped teacher role', () => {
    expect(isTeacherUser(user({ roles: ['internal:speakasap:teacher'] }))).toBe(false);
  });

  it('rejects another application teacher role', () => {
    expect(isTeacherUser(user({ roles: ['app:marathon:teacher'] }))).toBe(false);
  });

  it('rejects an undefined user', () => {
    expect(isTeacherUser(undefined)).toBe(false);
  });
});
