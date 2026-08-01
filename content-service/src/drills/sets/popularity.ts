import { DrillSetReviewState } from '../contracts';

export interface PopularityInput {
  teacherUpvotes: number;
  studentUpvotes: number;
  timesAssigned: number;
  timesSelfSelected: number;
  reviewState: DrillSetReviewState;
}

/**
 * Spec 8.2:
 *   3·teacherUpvotes + 1·studentUpvotes
 *   + 0.5·min(timesAssigned + timesSelfSelected, 20)
 *   − 5·(reviewState != APPROVED)
 *
 * The usage cap stops a heavily-assigned mediocre set from outranking a
 * well-reviewed new one. No time decay in v1: a good drill does not go stale.
 * `avgFirstTryAccuracy` deliberately does not appear here — a hard set is not
 * a bad set.
 */
export function computePopularityScore(input: PopularityInput): number {
  const usage = Math.min(input.timesAssigned + input.timesSelfSelected, 20);
  const unapprovedPenalty = input.reviewState === 'APPROVED' ? 0 : 5;
  return 3 * input.teacherUpvotes + 1 * input.studentUpvotes + 0.5 * usage - unapprovedPenalty;
}
