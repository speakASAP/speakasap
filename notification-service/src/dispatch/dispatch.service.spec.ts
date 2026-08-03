import { DispatchService } from './dispatch.service';

/**
 * These tests exercise the render/subject decision inside `dispatchEmailSingle`, which is
 * the seam where the seeded drill rows meet the code-side renderers. Everything around it
 * — preferences, do-not-contact, idempotency — is stubbed to the permissive path so a
 * failure here can only mean the rendering decision changed.
 */

const TEMPLATE_ROW = {
  id: 'tpl-1',
  machineName: 'drill_assignment_assigned',
  title: 'Drill assigned',
  visible: false,
  bodyHtml: '<p>{{title}}</p>',
};

function makeService(templateRow: Record<string, unknown>) {
  const letters: Record<string, unknown>[] = [];
  const sent: Record<string, unknown>[] = [];

  const prisma = {
    notificationTemplate: { findFirst: jest.fn().mockResolvedValue(templateRow) },
    commonEmailSettings: { findUnique: jest.fn().mockResolvedValue(null) },
    templatePreference: { findUnique: jest.fn().mockResolvedValue(null) },
    letter: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        letters.push(data);
        return { id: `letter-${letters.length}`, ...data };
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    dispatchIdempotency: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const transport = {
    sendEmail: jest.fn(async (args: Record<string, unknown>) => {
      sent.push(args);
    }),
  };

  const userLookup = {
    resolveNotificationTarget: jest
      .fn()
      .mockResolvedValue({ email: 'anna@example.com', doNotContact: false }),
  };

  const service = new DispatchService(
    prisma as never,
    transport as never,
    userLookup as never,
  );

  return { service, letters, sent };
}

const DRILL_CONTEXT = {
  studentName: 'Anna',
  title: 'Prepositions',
  topics: [{ topic: 'Akkusativ', url: 'https://speakasap.com/de/akkusativ' }],
  dueAt: null,
  runnerUrl: 'https://speakasap.com/learner/practice/abc',
  itemCount: 10,
  materialLanguage: 'en',
};

describe('DispatchService — drill templates', () => {
  it('renders the topic list, which a bodyHtml row could not produce', async () => {
    const { service, sent } = makeService(TEMPLATE_ROW);

    await service.dispatchEmailSingle({
      templateMachineName: 'drill_assignment_assigned',
      userId: '42',
      context: DRILL_CONTEXT,
    } as never);

    const message = String(sent[0].message);
    expect(message).toContain('Akkusativ');
    expect(message).toContain('https://speakasap.com/de/akkusativ');
    expect(message).toContain('Anna');
    // Proves the row's bodyHtml was not what went out.
    expect(message).not.toBe('<p>Prepositions</p>');
  });

  it('uses the renderer subject in place of the row title', async () => {
    const { service, sent } = makeService(TEMPLATE_ROW);

    await service.dispatchEmailSingle({
      templateMachineName: 'drill_assignment_assigned',
      userId: '42',
      context: DRILL_CONTEXT,
    } as never);

    expect(sent[0].subject).toBe('New grammar practice assigned');
  });

  it('localizes the subject to the recipient material language', async () => {
    const { service, sent } = makeService(TEMPLATE_ROW);

    await service.dispatchEmailSingle({
      templateMachineName: 'drill_assignment_assigned',
      userId: '42',
      context: { ...DRILL_CONTEXT, materialLanguage: 'ru' },
    } as never);

    expect(String(sent[0].subject)).toMatch(/[а-яА-Я]/);
  });

  it('still lets an explicit caller subject win', async () => {
    const { service, sent } = makeService(TEMPLATE_ROW);

    await service.dispatchEmailSingle({
      templateMachineName: 'drill_assignment_assigned',
      userId: '42',
      subject: 'Explicit',
      context: DRILL_CONTEXT,
    } as never);

    expect(sent[0].subject).toBe('Explicit');
  });

  it('persists the code-rendered body on the letter, not the row body', async () => {
    const { service, letters } = makeService(TEMPLATE_ROW);

    await service.dispatchEmailSingle({
      templateMachineName: 'drill_assignment_assigned',
      userId: '42',
      context: DRILL_CONTEXT,
    } as never);

    expect(String(letters[0].renderedBody)).toContain('Akkusativ');
  });
});

describe('DispatchService — every other template', () => {
  it('still renders bodyHtml with placeholder substitution', async () => {
    const { service, sent } = makeService({
      ...TEMPLATE_ROW,
      machineName: 'some_other_email',
      title: 'Row title',
      bodyHtml: '<p>Hello {{name}}</p>',
    });

    await service.dispatchEmailSingle({
      templateMachineName: 'some_other_email',
      userId: '42',
      context: { name: 'Anna' },
    } as never);

    expect(sent[0].message).toBe('<p>Hello Anna</p>');
    expect(sent[0].subject).toBe('Row title');
  });
});
