import { ConflictException } from '@nestjs/common';
import { DrillAssignmentStatus } from './contracts';

const ALLOWED: Record<DrillAssignmentStatus, DrillAssignmentStatus[]> = {
  GENERATING:     ['PENDING_REVIEW', 'ASSIGNED', 'CANCELLED'],
  PENDING_REVIEW: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED:       ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS:    ['COMPLETED', 'CANCELLED'],
  COMPLETED:      [],
  CANCELLED:      [],
};

export const TERMINAL_STATUSES: ReadonlySet<DrillAssignmentStatus> =
  new Set<DrillAssignmentStatus>(['COMPLETED', 'CANCELLED']);

/**
 * True only when `from -> to` is an edge of the assignment lifecycle.
 *
 * `DrillAssignment.status` is a free `VarChar(16)` column, not a Prisma enum, so
 * an arbitrary string is reachable through ordinary data drift (legacy row,
 * hand-run UPDATE, migration applied before the app rolled). The `Array.isArray`
 * guard — not optional chaining — is what makes that safe: `ALLOWED` is an object
 * literal, so `ALLOWED['constructor']`, `ALLOWED['__proto__']`, `ALLOWED['toString']`
 * and `ALLOWED['valueOf']` all resolve to inherited **non-array** values that are
 * never `undefined`. `?.` would sail past them straight into
 * `TypeError: ... .includes is not a function`. Every such string is 16 characters
 * or fewer, so every one of them fits the column.
 */
export function canTransition(
  from: DrillAssignmentStatus,
  to: DrillAssignmentStatus,
): boolean {
  const allowed = ALLOWED[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/**
 * Throws `ConflictException` (409) when `from -> to` is not a legal edge.
 *
 * **Callers must catch and re-wrap this.** The thrown body is Nest's default
 * `{ statusCode, error, message }`, which does NOT satisfy the `DrillErrorBody`
 * contract — that requires a `code` of type `DrillErrorCode`, and no member of
 * that union describes a generic illegal transition (`GENERATION_IN_PROGRESS` is
 * narrower: a mutation attempted while a set is still generating). Inventing a
 * new code here would be a contract change, which is out of scope for this
 * module. Any HTTP boundary that lets this escape returns a body other tracks
 * cannot parse, so wrap it at the controller/filter layer.
 */
export function assertTransition(
  from: DrillAssignmentStatus,
  to: DrillAssignmentStatus,
): void {
  if (!canTransition(from, to)) {
    throw new ConflictException(`Illegal drill assignment transition: ${from} -> ${to}`);
  }
}
