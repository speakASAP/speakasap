import { ConflictException } from '@nestjs/common';
import { canTransition, assertTransition, TERMINAL_STATUSES } from './state-machine';
import { DrillAssignmentStatus } from './contracts';

describe('canTransition', () => {
  it('allows the teacher-review path', () => {
    expect(canTransition('GENERATING', 'PENDING_REVIEW')).toBe(true);
    expect(canTransition('PENDING_REVIEW', 'ASSIGNED')).toBe(true);
    expect(canTransition('ASSIGNED', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });

  it('allows skipping review when the set is already approved', () => {
    expect(canTransition('GENERATING', 'ASSIGNED')).toBe(true);
  });

  it('allows cancelling from any non-terminal state', () => {
    expect(canTransition('GENERATING', 'CANCELLED')).toBe(true);
    expect(canTransition('PENDING_REVIEW', 'CANCELLED')).toBe(true);
    expect(canTransition('ASSIGNED', 'CANCELLED')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'CANCELLED')).toBe(true);
  });

  it('forbids leaving a terminal state', () => {
    expect(canTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
    expect(canTransition('CANCELLED', 'ASSIGNED')).toBe(false);
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
  });

  it('forbids skipping straight to completed', () => {
    expect(canTransition('ASSIGNED', 'COMPLETED')).toBe(false);
    expect(canTransition('GENERATING', 'COMPLETED')).toBe(false);
  });

  it('forbids going backwards', () => {
    expect(canTransition('IN_PROGRESS', 'ASSIGNED')).toBe(false);
    expect(canTransition('ASSIGNED', 'PENDING_REVIEW')).toBe(false);
  });

  it('forbids a no-op transition', () => {
    expect(canTransition('ASSIGNED', 'ASSIGNED')).toBe(false);
  });

  it('returns false for a status outside the union instead of throwing', () => {
    expect(canTransition('BOGUS' as DrillAssignmentStatus, 'ASSIGNED')).toBe(false);
  });

  // status is VarChar(16), not an enum: every one of these strings fits the
  // column and every one resolves to an inherited, non-array, non-undefined
  // value on the ALLOWED object literal. Optional chaining does not stop them.
  it.each(['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty'])(
    'returns false for the prototype key %p instead of throwing',
    (key) => {
      expect(canTransition(key as DrillAssignmentStatus, 'ASSIGNED')).toBe(false);
    },
  );

  it('returns false when a prototype key is the transition target', () => {
    expect(canTransition('ASSIGNED', 'constructor' as DrillAssignmentStatus)).toBe(false);
  });
});

describe('assertTransition', () => {
  it('throws with both states named', () => {
    expect(() => assertTransition('COMPLETED', 'IN_PROGRESS'))
      .toThrow(/COMPLETED.*IN_PROGRESS/);
  });

  it('does not throw on a legal transition', () => {
    expect(() => assertTransition('ASSIGNED', 'IN_PROGRESS')).not.toThrow();
  });

  it('throws a ConflictException rather than a TypeError for a prototype key', () => {
    expect(() => assertTransition('__proto__' as DrillAssignmentStatus, 'ASSIGNED'))
      .toThrow(ConflictException);
  });
});

describe('TERMINAL_STATUSES', () => {
  it('contains exactly COMPLETED and CANCELLED', () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(['CANCELLED', 'COMPLETED']);
  });
});
