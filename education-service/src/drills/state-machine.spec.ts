import { canTransition, assertTransition, TERMINAL_STATUSES } from './state-machine';

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
});

describe('assertTransition', () => {
  it('throws with both states named', () => {
    expect(() => assertTransition('COMPLETED', 'IN_PROGRESS'))
      .toThrow(/COMPLETED.*IN_PROGRESS/);
  });

  it('does not throw on a legal transition', () => {
    expect(() => assertTransition('ASSIGNED', 'IN_PROGRESS')).not.toThrow();
  });
});

describe('TERMINAL_STATUSES', () => {
  it('contains exactly COMPLETED and CANCELLED', () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(['CANCELLED', 'COMPLETED']);
  });
});
