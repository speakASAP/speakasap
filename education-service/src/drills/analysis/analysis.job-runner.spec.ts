import { AnalysisJobRunner, CompletionAnalysisAdapter } from './analysis.job-runner';

describe('AnalysisJobRunner.enqueue', () => {
  it('returns before the analysis finishes', async () => {
    let resolveRun: () => void = () => undefined;
    const analysis = {
      run: jest.fn(() => new Promise<void>((resolve) => { resolveRun = resolve; })),
    };
    const runner = new AnalysisJobRunner(analysis as any);

    runner.enqueue('a1');

    expect(analysis.run).toHaveBeenCalled();
    resolveRun();
  });

  it('does not reject when the analysis throws — an unhandled rejection kills the process', async () => {
    const analysis = { run: jest.fn(async () => { throw new Error('boom'); }) };
    const runner = new AnalysisJobRunner(analysis as any);

    const unhandled = jest.fn();
    process.once('unhandledRejection', unhandled);

    runner.enqueue('a1');
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(unhandled).not.toHaveBeenCalled();
    process.removeListener('unhandledRejection', unhandled);
  });

  it('passes a correlation id through to the analysis', () => {
    const analysis = { run: jest.fn(async () => undefined) };
    new AnalysisJobRunner(analysis as any).enqueue('a1');

    expect(analysis.run).toHaveBeenCalledWith('a1', expect.any(String));
  });
});

describe('CompletionAnalysisAdapter.onCompleted', () => {
  const assignment = {
    uuid: 'a1',
    studentId: 7,
    languageCode: 'en',
    items: [{ uuid: 'i1', order: 0, template: 'x {{0}}', blanks: [{ index: 0, answer: 'behind' }] }],
  };

  function deps() {
    return {
      prisma: {
        drillAssignment: { findUnique: jest.fn(async () => assignment) },
        drillAttempt: {
          findMany: jest.fn(async () => [
            { itemUuid: 'i1', blankIndex: 0, submittedValue: 'behind', isCorrect: true, revealed: false, attemptNo: 1 },
          ]),
        },
      } as any,
      mastery: { applyDeltas: jest.fn(async () => undefined) },
      jobs: { enqueue: jest.fn() },
    };
  }

  it('records mastery before enqueueing the analysis', async () => {
    const d = deps();
    const order: string[] = [];
    d.mastery.applyDeltas = jest.fn(async () => { order.push('mastery'); return undefined; });
    d.jobs.enqueue = jest.fn(() => { order.push('enqueue'); });

    await new CompletionAnalysisAdapter(d.prisma, d.mastery as any, d.jobs as any).onCompleted('a1');

    expect(order).toEqual(['mastery', 'enqueue']);
  });

  it('passes the clean delta through to the mastery repository', async () => {
    const d = deps();

    await new CompletionAnalysisAdapter(d.prisma, d.mastery as any, d.jobs as any).onCompleted('a1');

    expect(d.mastery.applyDeltas).toHaveBeenCalledWith(
      7,
      'en',
      [{ normalizedAnswer: 'behind', displayAnswer: 'behind', clean: true, mistakes: 0 }],
      expect.any(Date),
    );
  });

  it('raises when the assignment is gone rather than silently doing nothing', async () => {
    const d = deps();
    d.prisma.drillAssignment.findUnique = jest.fn(async () => null);

    await expect(
      new CompletionAnalysisAdapter(d.prisma, d.mastery as any, d.jobs as any).onCompleted('a1'),
    ).rejects.toThrow(/vanished/);
  });
});
