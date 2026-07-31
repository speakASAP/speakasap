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

export function canTransition(
  from: DrillAssignmentStatus,
  to: DrillAssignmentStatus,
): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: DrillAssignmentStatus,
  to: DrillAssignmentStatus,
): void {
  if (!canTransition(from, to)) {
    throw new ConflictException(`Illegal drill assignment transition: ${from} -> ${to}`);
  }
}
