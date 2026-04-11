export function hasManagerAccess(roles: string[] | undefined): boolean {
  if (!roles?.length) {
    return false;
  }
  return roles.some((r) => /(^|:)manager$/i.test(r) || /^global:admin$/i.test(r));
}

export function hasTeacherAccess(roles: string[] | undefined): boolean {
  if (!roles?.length) {
    return false;
  }
  return roles.some((r) => /(^|:)teacher$/i.test(r)) || hasManagerAccess(roles);
}

/** Matches legacy `TeacherRequired` (teacher profile only, not managers). */
export function isPortalTeacher(roles: string[] | undefined): boolean {
  if (!roles?.length) {
    return false;
  }
  return roles.some((r) => /(^|:)teacher$/i.test(r));
}
