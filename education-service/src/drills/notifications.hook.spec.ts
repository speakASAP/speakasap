import { Logger } from '@nestjs/common';
import { NotificationsHook, NotificationsClient } from './notifications.hook';

/**
 * The assignment row as the hook reads it. Only the columns the hook actually
 * touches — a wider fixture would let a change to an unrelated column break
 * these tests for no reason.
 */
function makeAssignment(overrides: Record<string, any> = {}) {
  return {
    uuid: 'a-1',
    studentId: 42,
    teacherId: 7,
    origin: 'TEACHER',
    title: 'Предлоги',
    languageCode: 'de',
    materialLanguage: 'ru',
    lessonUuid: 'l-1',
    dueAt: new Date('2026-08-05T00:00:00.000Z'),
    resourceLinks: [{ topic: 'Предлоги', url: 'https://speakasap.com/de/grammar/prepositions' }],
    notifiedAssignedAt: null,
    notifiedCompletedAt: null,
    ...overrides,
  };
}

describe('NotificationsHook', () => {
  let assignment: any;
  let prisma: any;
  let client: jest.Mocked<NotificationsClient>;
  let hook: NotificationsHook;

  beforeEach(() => {
    assignment = makeAssignment();

    prisma = {
      drillAssignment: {
        findUnique: jest.fn().mockImplementation(async () => assignment),
        // The idempotence guard is a conditional update: it only matches while the
        // timestamp is still null, so a concurrent second call updates zero rows.
        updateMany: jest.fn().mockImplementation(async () => ({ count: 1 })),
      },
      drillAssignmentItem: { count: jest.fn().mockResolvedValue(50) },
      drillAttempt: { findMany: jest.fn().mockResolvedValue([]) },
    };

    client = {
      dispatch: jest.fn().mockResolvedValue(undefined),
      createInApp: jest.fn().mockResolvedValue(undefined),
    } as any;

    hook = new NotificationsHook(prisma, client);
    jest.restoreAllMocks();
  });

  it('dispatches to the student on assign', async () => {
    await hook.onAssigned('a-1');

    expect(client.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'drill_assignment_assigned', recipientId: 42 }),
    );
  });

  // Owner's rule: exactly one notification leaves this class, the student's. The
  // teacher is not emailed on completion. `createInApp` is a no-op in the real adapter,
  // so this asserts the seam is used and the email path is not.
  it('does not email the teacher on completion', async () => {
    await hook.onCompleted('a-1');

    expect(client.createInApp).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'drill_assignment_completed', recipientId: 7 }),
    );
    expect(client.dispatch).not.toHaveBeenCalled();
  });

  it('sends NOTHING to the teacher for a self-selected drill', async () => {
    assignment = makeAssignment({ origin: 'SELF', teacherId: null });

    await hook.onCompleted('a-1');

    expect(client.dispatch).not.toHaveBeenCalled();
  });

  // The case above passes on the null teacherId alone, so it does not actually pin the
  // origin rule. A SELF assignment that still carries a teacherId — the student drilled
  // on their own within a course that has a teacher — is the case that distinguishes the
  // two, and it is the one that would silently start emailing if the check were dropped.
  it('sends nothing for a self-selected drill even when a teacher is attached', async () => {
    assignment = makeAssignment({ origin: 'SELF', teacherId: 7 });

    await hook.onCompleted('a-1');

    expect(client.dispatch).not.toHaveBeenCalled();
    expect(client.createInApp).not.toHaveBeenCalled();
  });

  it('creates an in-app record alongside the email', async () => {
    await hook.onAssigned('a-1');

    expect(client.createInApp).toHaveBeenCalledTimes(1);
  });

  it('never throws when delivery fails — a failed notification must not block a transition', async () => {
    client.createInApp.mockRejectedValue(new Error('notifications down'));

    await expect(hook.onCompleted('a-1')).resolves.toBeUndefined();
  });

  it('logs the assignment uuid when delivery fails', async () => {
    client.createInApp.mockRejectedValue(new Error('notifications down'));
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await hook.onCompleted('a-1');

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('a-1'));
  });

  it('does not resend on a repeated completion event', async () => {
    // Second call: the row now carries the timestamp, so the conditional update
    // matches nothing and the hook returns before dispatching.
    prisma.drillAssignment.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await hook.onCompleted('a-1');
    await hook.onCompleted('a-1');

    expect(client.createInApp).toHaveBeenCalledTimes(1);
  });

  // The claim guard must run before dispatch, not after. Claiming afterwards leaves a
  // window where two concurrent callers both read null and both send the email.
  it('claims the send before dispatching, not after', async () => {
    const order: string[] = [];
    prisma.drillAssignment.updateMany.mockImplementation(async () => {
      order.push('claim');
      return { count: 1 };
    });
    client.dispatch.mockImplementation(async () => {
      order.push('dispatch');
    });

    await hook.onAssigned('a-1');

    expect(order).toEqual(['claim', 'dispatch']);
  });

  it('does not resend on a repeated assign event', async () => {
    prisma.drillAssignment.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await hook.onAssigned('a-1');
    await hook.onAssigned('a-1');

    expect(client.dispatch).toHaveBeenCalledTimes(1);
  });

  it('is a no-op for an assignment that no longer exists', async () => {
    prisma.drillAssignment.findUnique.mockResolvedValue(null);

    await expect(hook.onCompleted('gone')).resolves.toBeUndefined();
    expect(client.dispatch).not.toHaveBeenCalled();
  });

  // A score is excluded at the source: the payload the teacher notification is rendered
  // from carries no accuracy field, so no template change downstream can surface one.
  it('sends the teacher no numeric performance data', async () => {
    prisma.drillAttempt.findMany.mockResolvedValue([
      { itemUuid: 'i-1', blankIndex: 0, isCorrect: false },
    ]);

    await hook.onCompleted('a-1');

    const payload = JSON.stringify(client.createInApp.mock.calls[0][0]);
    expect(payload).not.toMatch(/accuracy|firstTryAccuracy|score|percent/i);
  });
});
