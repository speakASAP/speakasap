import { RemedialService } from './remedial.service';

const gap = {
  uuid: 'g1',
  runUuid: 'run-1',
  sourceAssignmentUuid: 'a1',
  studentId: 7,
  topicSlug: 'en.prepositions-of-movement',
  languageCode: 'en',
  materialLanguage: 'ru',
  title: 'Предлоги движения',
  explanation: 'through — сквозь',
  rules: ['through — внутри и наружу'],
  examples: [],
  failedAnswers: [
    { answer: 'through', normalized: 'through', mistakeCount: 3, wrongAttempts: ['across'] },
    { answer: 'out of', normalized: 'out of', mistakeCount: 2, wrongAttempts: ['out'] },
  ],
  editedByTeacherId: null,
  editedAt: null,
  createdAt: new Date(),
};

const sourceAssignment = {
  uuid: 'a1',
  studentId: 7,
  lessonUuid: 'lesson-1',
  languageCode: 'en',
  materialLanguage: 'ru',
  level: 'A2',
  studentCourseUuid: null,
};

function deps(overrides: Record<string, any> = {}) {
  const created: any[] = [];
  return {
    created,
    analysis: {
      getCluster: jest.fn(async () => overrides.gap ?? gap),
      ...overrides.analysis,
    },
    mastery: {
      masteredAnswers: jest.fn(async () => overrides.mastered ?? new Set<string>()),
    },
    content: {
      resolveLanguageId: jest.fn(async () => 1),
    },
    jobs: { enqueue: jest.fn() },
    progress: { getStudentProgress: jest.fn(async () => ({ lessonOrder: 12, courseKey: 'en-a2' })) },
    prisma: {
      drillAssignment: {
        findUnique: jest.fn(async () => overrides.sourceAssignment ?? sourceAssignment),
        findMany: jest.fn(async () => overrides.existing ?? []),
        createMany: jest.fn(async ({ data }: any) => {
          created.push(...data);
          return { count: data.length };
        }),
      },
      drillAssignmentBatch: { create: jest.fn(async () => undefined) },
      $transaction: jest.fn(async function (this: any, fn: any) {
        return fn(this);
      }),
    } as any,
  };
}

function build(d: ReturnType<typeof deps>) {
  d.prisma.$transaction = jest.fn(async (fn: any) => fn(d.prisma));
  return new RemedialService(
    d.prisma,
    d.analysis as any,
    d.mastery as any,
    d.content as any,
    d.jobs as any,
    d.progress as any,
  );
}

describe('RemedialService.createForGap', () => {
  it('creates one assignment for a gap that fits in twenty sentences', async () => {
    const d = deps();

    const result = await build(d).createForGap('g1', 182, 'token');

    expect(result.assignmentUuids).toHaveLength(1);
    expect(d.created).toHaveLength(1);
    expect(d.created[0].origin).toBe('REMEDIAL');
    expect(d.created[0].sourceAnalysisUuid).toBe('g1');
    expect(d.created[0].status).toBe('GENERATING');
    expect(d.created[0].remedialPart).toBeNull();
    expect(d.created[0].title).not.toContain('часть');
  });

  it('inherits the lesson and the student from the source assignment', async () => {
    const d = deps();

    await build(d).createForGap('g1', 182, 'token');

    expect(d.created[0].lessonUuid).toBe('lesson-1');
    expect(d.created[0].studentId).toBe(7);
    expect(d.created[0].teacherId).toBe(182);
  });

  it('titles the assignment after the gap', async () => {
    const d = deps();

    await build(d).createForGap('g1', 182, 'token');

    expect(d.created[0].title).toContain('Работа над ошибками');
    expect(d.created[0].title).toContain('Предлоги движения');
  });

  it('numbers the parts in the title when a gap splits', async () => {
    const d = deps({
      gap: {
        ...gap,
        failedAnswers: [
          { answer: 'through', normalized: 'through', mistakeCount: 20, wrongAttempts: [] },
          { answer: 'out of', normalized: 'out of', mistakeCount: 10, wrongAttempts: [] },
        ],
      },
    });

    const result = await build(d).createForGap('g1', 182, 'token');

    expect(result.assignmentUuids).toHaveLength(2);
    expect(d.created[0].title).toContain('часть 1');
    expect(d.created[1].title).toContain('часть 2');
    expect(d.created[0].remedialPart).toBe(1);
    expect(d.created[1].remedialPart).toBe(2);
  });

  it('queues one generation job per part, carrying the required answers', async () => {
    const d = deps();

    await build(d).createForGap('g1', 182, 'token');

    expect(d.jobs.enqueue).toHaveBeenCalledTimes(1);
    const job = d.jobs.enqueue.mock.calls[0][1];
    expect(job.itemCount).toBe(10);
    expect(job.topicSlugs).toEqual(['en.prepositions-of-movement']);
    expect(job.instructions).toContain('through');
    expect(job.instructions).toContain('out of');
  });

  it('asks for one sentence per mistake, not per word', async () => {
    const d = deps();

    await build(d).createForGap('g1', 182, 'token');

    const job = d.jobs.enqueue.mock.calls[0][1];
    // through ×3 + out of ×2 = 5 required, padded to the 10-sentence minimum.
    expect(job.instructions).toMatch(/through.*3/s);
    expect(job.instructions).toMatch(/out of.*2/s);
  });

  it('excludes a mastered word from the drill', async () => {
    const d = deps({ mastered: new Set(['through']) });

    await build(d).createForGap('g1', 182, 'token');

    const job = d.jobs.enqueue.mock.calls[0][1];
    expect(job.instructions).not.toMatch(/"through"/);
    expect(job.instructions).toContain('out of');
  });

  it('refuses when every word in the gap is already mastered', async () => {
    const d = deps({ mastered: new Set(['through', 'out of']) });

    await expect(build(d).createForGap('g1', 182, 'token')).rejects.toThrow(
      /already mastered/i,
    );
    expect(d.created).toHaveLength(0);
  });

  it('returns the existing assignments instead of creating a second set', async () => {
    const d = deps({ existing: [{ uuid: 'existing-1', status: 'PENDING_REVIEW' }] });

    const result = await build(d).createForGap('g1', 182, 'token');

    expect(result.reused).toBe(true);
    expect(result.assignmentUuids).toEqual(['existing-1']);
    expect(d.created).toHaveLength(0);
    expect(d.jobs.enqueue).not.toHaveBeenCalled();
  });

  it('creates a new set when the previous one was revoked', async () => {
    const d = deps({ existing: [] });

    const result = await build(d).createForGap('g1', 182, 'token');

    expect(result.reused).toBe(false);
    expect(d.created).toHaveLength(1);
  });

  it('raises when the gap does not exist', async () => {
    const d = deps();
    d.analysis.getCluster = jest.fn(async () => null);

    await expect(build(d).createForGap('g1', 182, 'token')).rejects.toThrow(/not found/i);
  });

  it('caps the lesson ceiling at the student progress reader\'s value', async () => {
    const d = deps();

    await build(d).createForGap('g1', 182, 'token');

    expect(d.jobs.enqueue.mock.calls[0][1].maxLessonOrder).toBe(12);
  });
});
