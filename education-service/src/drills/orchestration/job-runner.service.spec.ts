import { JobRunner, GenerationJobRepository } from './job-runner.service';
import { GenerationJob } from './generation.service';

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('JobRunner', () => {
  let generation: any;
  let repo: jest.Mocked<GenerationJobRepository>;
  let runner: JobRunner;

  const job = (over: Partial<GenerationJob> = {}): GenerationJob => ({
    setUuid: 'set-1',
    assignmentUuids: ['a-1'],
    languageCode: 'de',
    materialLanguage: 'ru',
    languageId: 1,
    level: 'A1',
    topicSlugs: ['prepositions'],
    topics: [{ slug: 'prepositions', title: 'Prepositions' }],
    instructions: 'Practise',
    itemCount: 10,
    courseKey: 'de-a1',
    maxLessonOrder: 3,
    teacherId: 7,
    title: 'Prepositions practice',
    token: 'tok',
    correlationId: 'corr-1',
    ...over,
  });

  beforeEach(() => {
    generation = { run: jest.fn().mockResolvedValue(undefined) };
    repo = {
      updateProgress: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
      findStaleGenerating: jest.fn().mockResolvedValue([]),
    } as any;
    runner = new JobRunner(generation, repo);
    delete process.env.DRILL_GENERATION_TIMEOUT_SECONDS;
  });

  it('returns immediately without awaiting the pipeline', async () => {
    generation.run.mockImplementation(() => new Promise(() => {}));

    const t0 = Date.now();
    runner.enqueue(['a-1'], job());

    expect(Date.now() - t0).toBeLessThan(50);
  });

  it('records FAILED progress when the pipeline rejects, and never rethrows', async () => {
    generation.run.mockRejectedValue(new Error('boom'));

    expect(() => runner.enqueue(['a-1'], job())).not.toThrow();
    await flushPromises();

    expect(repo.updateProgress).toHaveBeenCalledWith(
      'a-1',
      expect.objectContaining({ phase: 'FAILED' }),
    );
  });

  // "Never count down to zero and lie", spec §10.3. Elapsed time alone does not mean
  // stalled; lack of PROGRESS does. A slow-but-advancing job that reported stalled
  // would push a teacher to cancel work that was about to finish.
  it('marks a job stalled once it passes its estimate without progressing', () => {
    const p = runner.progressFor('a-1', {
      startedAt: Date.now() - 200_000,
      etaSeconds: 60,
      lastProgressAt: Date.now() - 200_000,
      phase: 'GENERATING',
      generated: 3,
      total: 50,
    });

    expect(p.stalled).toBe(true);
  });

  it('does not report stalled while items are still arriving', () => {
    const p = runner.progressFor('a-1', {
      startedAt: Date.now() - 200_000,
      etaSeconds: 60,
      lastProgressAt: Date.now() - 1_000,
      phase: 'GENERATING',
      generated: 30,
      total: 50,
    });

    expect(p.stalled).toBe(false);
  });

  it('never reports stalled for a finished job', () => {
    const p = runner.progressFor('a-1', {
      startedAt: Date.now() - 900_000,
      etaSeconds: 60,
      lastProgressAt: Date.now() - 900_000,
      phase: 'READY',
      generated: 50,
      total: 50,
    });

    expect(p.stalled).toBe(false);
  });

  it('sweeps GENERATING rows older than the timeout to CANCELLED', async () => {
    process.env.DRILL_GENERATION_TIMEOUT_SECONDS = '600';
    repo.findStaleGenerating.mockResolvedValue([{ uuid: 'a-old' }]);

    const n = await runner.sweepStale();

    expect(n).toBe(1);
    expect(repo.cancel).toHaveBeenCalledWith('a-old', expect.stringMatching(/timed out/i));
  });

  it('sweeps nothing when no row is stale', async () => {
    const n = await runner.sweepStale();

    expect(n).toBe(0);
    expect(repo.cancel).not.toHaveBeenCalled();
  });

  // The sweep runs lazily off read endpoints. A failure there must not take down the
  // read: a teacher opening their list should still see it when the sweep hiccups.
  it('does not propagate a sweep failure to the caller', async () => {
    repo.findStaleGenerating.mockRejectedValue(new Error('db down'));

    await expect(runner.sweepStale()).resolves.toBe(0);
  });

  it('reports progress for every assignment in the batch, not only the first', async () => {
    generation.run.mockRejectedValue(new Error('boom'));

    runner.enqueue(['a-1', 'a-2'], job({ assignmentUuids: ['a-1', 'a-2'] }));
    await flushPromises();

    expect(repo.updateProgress).toHaveBeenCalledWith('a-1', expect.objectContaining({ phase: 'FAILED' }));
    expect(repo.updateProgress).toHaveBeenCalledWith('a-2', expect.objectContaining({ phase: 'FAILED' }));
  });

  // A second failure while recording the first must not produce an unhandled rejection
  // that takes the process down — this runs detached, with nobody awaiting it.
  it('swallows a repository failure while recording a failure', async () => {
    generation.run.mockRejectedValue(new Error('boom'));
    repo.updateProgress.mockRejectedValue(new Error('db down'));

    expect(() => runner.enqueue(['a-1'], job())).not.toThrow();
    await flushPromises();
    await flushPromises();
  });
});
