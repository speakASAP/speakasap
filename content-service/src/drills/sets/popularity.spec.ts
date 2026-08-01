import { computePopularityScore } from './popularity';

const base = {
  teacherUpvotes: 0,
  studentUpvotes: 0,
  timesAssigned: 0,
  timesSelfSelected: 0,
  reviewState: 'APPROVED' as const,
};

describe('computePopularityScore', () => {
  it('weights a teacher vote three times a student vote', () => {
    const teacher = computePopularityScore({ ...base, teacherUpvotes: 1 });
    const student = computePopularityScore({ ...base, studentUpvotes: 1 });
    expect(teacher).toBe(3);
    expect(student).toBe(1);
  });

  it('counts usage at half a point, capped at 20 uses', () => {
    expect(computePopularityScore({ ...base, timesAssigned: 10 })).toBe(5);
    expect(computePopularityScore({ ...base, timesAssigned: 100 })).toBe(10);
    expect(computePopularityScore({ ...base, timesAssigned: 15, timesSelfSelected: 15 })).toBe(10);
  });

  it('subtracts five while the set is not approved', () => {
    expect(computePopularityScore({ ...base, teacherUpvotes: 1, reviewState: 'PENDING_REVIEW' })).toBe(-2);
  });

  it('lets downvotes push a score negative', () => {
    expect(computePopularityScore({ ...base, teacherUpvotes: -2 })).toBe(-6);
  });

  it('ranks an approved zero-vote set above an unapproved well-voted one', () => {
    const approved = computePopularityScore(base);
    const pending = computePopularityScore({
      ...base,
      teacherUpvotes: 1,
      reviewState: 'PENDING_REVIEW',
    });
    expect(approved).toBeGreaterThan(pending);
  });
});
