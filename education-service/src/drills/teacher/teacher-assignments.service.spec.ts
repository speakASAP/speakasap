import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TeacherAssignmentsService } from './teacher-assignments.service';

const APPROVED_SET = {
  uuid: 's-1',
  title: 'Prepositions A2',
  languageCode: 'de',
  materialLanguage: 'ru',
  reviewState: 'APPROVED',
  resourceLinks: [{ topic: 'prepositions', url: 'https://speakasap.com/de/prepositions' }],
  items: [
    {
      order: 0,
      item: {
        id: 11,
        template: 'Ich warte [на]{auf} den Bus.',
        blanks: [{ index: 0, prompt: 'на', answer: 'auf', alternatives: [] }],
        hint: null,
        topicSlug: 'prepositions',
      },
    },
  ],
};

const GENERATE_REQUEST = {
  studentIds: [7, 8],
  languageCode: 'de',
  materialLanguage: 'ru',
  topicSlugs: ['prepositions'],
  instructions: 'focus on dative',
  count: 50,
};

function harness(overrides: Record<string, unknown> = {}) {
  const rows: Record<string, unknown>[] = [];

  const tx = {
    drillAssignmentBatch: { create: jest.fn(async () => ({})) },
    drillAssignment: {
      createMany: jest.fn(async ({ data }: { data: Record<string, unknown>[] }) => {
        rows.push(...data);
        return { count: data.length };
      }),
    },
  };

  const prisma: any = {
    $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    drillAssignment: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        rows.push(data);
        return { ...data, items: [] };
      }),
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data })),
    },
  };

  const assignments: any = {
    countBlanks: jest.fn(async () => ({ blanksCorrect: 0, blanksTotal: 0 })),
    countBlanksFor: jest.fn(async () => new Map()),
  };

  const content: any = {
    resolveLanguageId: jest.fn(async () => 3),
    getSet: jest.fn(async () => APPROVED_SET),
  };

  const jobs: any = { enqueue: jest.fn() };

  const progress: any = {
    getStudentProgress: jest.fn(async (studentId: number) => ({
      courseKey: 'seven:german:ru',
      lessonOrder: studentId === 7 ? 5 : 9,
    })),
  };

  const notifications: any = { onAssigned: jest.fn(async () => undefined) };

  Object.assign({ prisma, content, jobs, progress, notifications }, overrides);

  return {
    service: new TeacherAssignmentsService(
      prisma,
      assignments,
      content,
      jobs,
      progress,
      notifications,
    ),
    prisma,
    tx,
    content,
    jobs,
    progress,
    notifications,
    rows,
  };
}

describe('TeacherAssignmentsService.generate', () => {
  it('creates one GENERATING assignment per student', async () => {
    const h = harness();
    const result = await h.service.generate(99, GENERATE_REQUEST as never, 'tok');

    expect(result.assignmentUuids).toHaveLength(2);
    expect(h.tx.drillAssignment.createMany).toHaveBeenCalled();
    const created = h.tx.drillAssignment.createMany.mock.calls[0][0].data;
    expect(created.map((r: any) => r.status)).toEqual(['GENERATING', 'GENERATING']);
    expect(created.map((r: any) => r.studentId)).toEqual([7, 8]);
    expect(created.every((r: any) => r.origin === 'TEACHER')).toBe(true);
    expect(created.every((r: any) => r.teacherId === 99)).toBe(true);
  });

  it('queues the pipeline with the same set uuid the rows carry', async () => {
    const h = harness();
    const result = await h.service.generate(99, GENERATE_REQUEST as never, 'tok');

    expect(h.jobs.enqueue).toHaveBeenCalledWith(
      result.assignmentUuids,
      expect.objectContaining({ setUuid: result.setUuid, itemCount: 50 }),
    );
    const created = h.tx.drillAssignment.createMany.mock.calls[0][0].data;
    expect(created.every((r: any) => r.setUuid === result.setUuid)).toBe(true);
  });

  it('forwards the caller token to the pipeline', async () => {
    const h = harness();
    await h.service.generate(99, GENERATE_REQUEST as never, 'tok');
    expect(h.jobs.enqueue.mock.calls[0][1].token).toBe('tok');
  });

  it('resolves the language id before writing anything', async () => {
    const h = harness();
    await h.service.generate(99, GENERATE_REQUEST as never, 'tok');
    expect(h.content.resolveLanguageId).toHaveBeenCalledWith('de', 'tok');
    expect(h.jobs.enqueue.mock.calls[0][1].languageId).toBe(3);
  });

  it('does not create rows when the language cannot be resolved', async () => {
    const h = harness();
    h.content.resolveLanguageId.mockRejectedValue(new Error('unknown language'));
    await expect(h.service.generate(99, GENERATE_REQUEST as never, 'tok')).rejects.toThrow(
      /unknown language/,
    );
    expect(h.tx.drillAssignment.createMany).not.toHaveBeenCalled();
    expect(h.jobs.enqueue).not.toHaveBeenCalled();
  });

  // The set is shared by the whole batch, so the furthest-behind student sets the
  // ceiling. Taking the max would show them a later lesson's vocabulary.
  it('takes the LOWEST lesson ceiling across the batch', async () => {
    const h = harness();
    await h.service.generate(99, GENERATE_REQUEST as never, 'tok');
    expect(h.jobs.enqueue.mock.calls[0][1].maxLessonOrder).toBe(5);
  });

  it('sends a null ceiling when no student has progress', async () => {
    const h = harness();
    h.progress.getStudentProgress.mockResolvedValue({ courseKey: null, lessonOrder: null });
    await h.service.generate(99, GENERATE_REQUEST as never, 'tok');
    expect(h.jobs.enqueue.mock.calls[0][1].maxLessonOrder).toBeNull();
  });

  it('records the batch so the request is reconstructable', async () => {
    const h = harness();
    const result = await h.service.generate(99, GENERATE_REQUEST as never, 'tok');
    expect(h.tx.drillAssignmentBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ uuid: result.batchUuid, teacherId: 99 }),
      }),
    );
  });

  it('seeds a renderable progress object rather than leaving it empty', async () => {
    const h = harness();
    await h.service.generate(99, GENERATE_REQUEST as never, 'tok');
    const created = h.tx.drillAssignment.createMany.mock.calls[0][0].data;
    expect(created[0].generationProgress).toMatchObject({ phase: 'RESOLVING', total: 50 });
  });

  // Generation notifies nobody: the set has no items and no teacher has approved it, so
  // "your teacher assigned you work" would be a link to nothing.
  it('sends no notification', async () => {
    const h = harness();
    await h.service.generate(99, GENERATE_REQUEST as never, 'tok');
    expect(h.notifications.onAssigned).not.toHaveBeenCalled();
  });

  describe('validation', () => {
    it('rejects an empty student list', async () => {
      const h = harness();
      await expect(
        h.service.generate(99, { ...GENERATE_REQUEST, studentIds: [] } as never, 'tok'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    // Two rows for one student against one set is homework the student sees twice with
    // no way to tell which counts.
    it('rejects a repeated student id', async () => {
      const h = harness();
      await expect(
        h.service.generate(99, { ...GENERATE_REQUEST, studentIds: [7, 7] } as never, 'tok'),
      ).rejects.toThrow(/must not repeat/);
    });

    it.each([0, -1, 201, 1.5, Number.NaN])('rejects count %s', async (count) => {
      const h = harness();
      await expect(
        h.service.generate(99, { ...GENERATE_REQUEST, count } as never, 'tok'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts the bounds 1 and 200', async () => {
      for (const count of [1, 200]) {
        const h = harness();
        await expect(
          h.service.generate(99, { ...GENERATE_REQUEST, count } as never, 'tok'),
        ).resolves.toBeDefined();
      }
    });

    it('rejects a request with neither a topic nor instructions', async () => {
      const h = harness();
      await expect(
        h.service.generate(
          99,
          { ...GENERATE_REQUEST, topicSlugs: [], instructions: '   ' } as never,
          'tok',
        ),
      ).rejects.toThrow(/at least one topic or non-empty instructions/);
    });

    it('accepts instructions alone, with no topic', async () => {
      const h = harness();
      await expect(
        h.service.generate(
          99,
          { ...GENERATE_REQUEST, topicSlugs: [], instructions: 'her essay mistakes' } as never,
          'tok',
        ),
      ).resolves.toBeDefined();
    });
  });
});

describe('TeacherAssignmentsService.assignFromSet', () => {
  const request = { setUuid: 's-1', studentIds: [7] };

  it('creates ASSIGNED rows with the set items copied in', async () => {
    const h = harness();
    await h.service.assignFromSet(99, request as never, 'tok');

    const data = h.prisma.drillAssignment.create.mock.calls[0][0].data;
    expect(data.status).toBe('ASSIGNED');
    expect(data.assignedAt).toBeInstanceOf(Date);
    expect(data.origin).toBe('TEACHER');
    expect(data.items.create).toHaveLength(1);
    expect(data.items.create[0].template).toBe('Ich warte [на]{auf} den Bus.');
    expect(data.items.create[0].sourceItemId).toBe(11);
  });

  // Track G left onAssigned with no call site. This is it: without the call, a student
  // is never told they have work.
  it('notifies each student that work was assigned', async () => {
    const h = harness();
    await h.service.assignFromSet(99, { setUuid: 's-1', studentIds: [7, 8] } as never, 'tok');
    expect(h.notifications.onAssigned).toHaveBeenCalledTimes(2);
  });

  it('notifies only after the row is committed', async () => {
    const h = harness();
    const order: string[] = [];
    h.prisma.drillAssignment.create.mockImplementation(async ({ data }: any) => {
      order.push('create');
      return { ...data, items: [] };
    });
    h.notifications.onAssigned.mockImplementation(async () => {
      order.push('notify');
    });

    await h.service.assignFromSet(99, request as never, 'tok');
    expect(order).toEqual(['create', 'notify']);
  });

  // The review gate is the only thing between a model's output and a student. Reaching
  // a student through this route instead would make it decorative.
  it('refuses a set that is not APPROVED', async () => {
    const h = harness();
    h.content.getSet.mockResolvedValue({ ...APPROVED_SET, reviewState: 'PENDING_REVIEW' });
    await expect(h.service.assignFromSet(99, request as never, 'tok')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(h.prisma.drillAssignment.create).not.toHaveBeenCalled();
  });

  it('reports SET_NOT_APPROVED as the contract code', async () => {
    const h = harness();
    h.content.getSet.mockResolvedValue({ ...APPROVED_SET, reviewState: 'GENERATING' });
    const error = await h.service
      .assignFromSet(99, request as never, 'tok')
      .catch((e: unknown) => e);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: 'SET_NOT_APPROVED',
    });
  });

  it('404s on a set that does not exist', async () => {
    const h = harness();
    h.content.getSet.mockResolvedValue(null);
    await expect(h.service.assignFromSet(99, request as never, 'tok')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects a missing setUuid', async () => {
    const h = harness();
    await expect(
      h.service.assignFromSet(99, { studentIds: [7] } as never, 'tok'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('TeacherAssignmentsService.getForTeacher', () => {
  const row = {
    uuid: 'a-1',
    setUuid: 's-1',
    studentId: 7,
    teacherId: 99,
    origin: 'TEACHER',
    lessonUuid: null,
    title: 'T',
    languageCode: 'de',
    materialLanguage: 'ru',
    status: 'GENERATING',
    dueAt: null,
    resourceLinks: [],
    generationProgress: { phase: 'GENERATING', generated: 3, total: 50 },
    createdAt: new Date('2026-08-03T00:00:00Z'),
    assignedAt: null,
    completedAt: null,
    items: [],
  };

  it('returns the assignment with its generation progress', async () => {
    const h = harness();
    h.prisma.drillAssignment.findUnique.mockResolvedValue(row);
    const dto = await h.service.getForTeacher('a-1', 99);
    expect(dto.uuid).toBe('a-1');
    expect(dto.generationProgress).toMatchObject({ phase: 'GENERATING', generated: 3 });
  });

  it('is readable while GENERATING, with no items yet', async () => {
    const h = harness();
    h.prisma.drillAssignment.findUnique.mockResolvedValue(row);
    await expect(h.service.getForTeacher('a-1', 99)).resolves.toMatchObject({ itemCount: 0 });
  });

  it('404s for another teacher, not 403 — a 403 confirms the assignment exists', async () => {
    const h = harness();
    h.prisma.drillAssignment.findUnique.mockResolvedValue(row);
    await expect(h.service.getForTeacher('a-1', 1234)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s when the assignment is missing', async () => {
    const h = harness();
    h.prisma.drillAssignment.findUnique.mockResolvedValue(null);
    await expect(h.service.getForTeacher('a-1', 99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never exposes firstTryAccuracy', async () => {
    const h = harness();
    h.prisma.drillAssignment.findUnique.mockResolvedValue({ ...row, firstTryAccuracy: 0.62 });
    const dto = await h.service.getForTeacher('a-1', 99);
    expect(JSON.stringify(dto)).not.toContain('0.62');
    expect(dto).not.toHaveProperty('firstTryAccuracy');
  });

  /**
   * An assignment is attributed to the lesson's Teacher profile pk (182), while the
   * caller's JWT resolves to their legacy user id (3). Both identify the same person, and
   * this service cannot map between them — `employees_teacher` lives in the portal's
   * database. So ownership accepts either id rather than 404ing the teacher out of their
   * own review screen.
   */
  describe('ownership across both teacher id spaces', () => {
    it('accepts the Teacher profile pk', async () => {
      const h = harness();
      h.prisma.drillAssignment.findUnique.mockResolvedValue({
        uuid: 'a-1', teacherId: 182, studentId: 3, items: [], status: 'PENDING_REVIEW',
        resourceLinks: [], generationProgress: null, createdAt: new Date(),
      });

      await expect(h.service.getForTeacher('a-1', [182, 3])).resolves.toMatchObject({
        uuid: 'a-1',
      });
    });

    it('accepts the legacy user id for the same person', async () => {
      const h = harness();
      h.prisma.drillAssignment.findUnique.mockResolvedValue({
        uuid: 'a-1', teacherId: 3, studentId: 3, items: [], status: 'PENDING_REVIEW',
        resourceLinks: [], generationProgress: null, createdAt: new Date(),
      });

      await expect(h.service.getForTeacher('a-1', [182, 3])).resolves.toMatchObject({
        uuid: 'a-1',
      });
    });

    it('still refuses another teacher\'s assignment', async () => {
      const h = harness();
      h.prisma.drillAssignment.findUnique.mockResolvedValue({
        uuid: 'a-1', teacherId: 999, studentId: 3, items: [], status: 'PENDING_REVIEW',
        resourceLinks: [], generationProgress: null,
      });

      await expect(h.service.getForTeacher('a-1', [182, 3])).rejects.toThrow(NotFoundException);
    });
  });

  /**
   * Approving a set left the assignments it came from in PENDING_REVIEW with **zero
   * items** — the sentences live on the set, and nothing ever copied them onto the
   * assignment. The teacher approved, saw success, and the student never received the
   * drill. `assignFromSet` copies items but only while creating *new* rows, which is a
   * different flow.
   */
  describe('assignApprovedSet', () => {
    function setWithItems(count: number) {
      return {
        uuid: 's-1', title: 'Present perfect', languageCode: 'de', materialLanguage: 'ru',
        items: Array.from({ length: count }, (_, i) => ({
          order: i, template: `Ich habe [x]{y} ${i}.`, blanks: [], hint: null, topicSlug: null,
        })),
      };
    }

    it('copies the set items onto every pending assignment and assigns it', async () => {
      const h = harness();
      h.content.getSet.mockResolvedValue(setWithItems(3));
      h.prisma.drillAssignment.findMany.mockResolvedValue([
        { uuid: 'a-1', studentId: 3, status: 'PENDING_REVIEW' },
      ]);

      await h.service.assignApprovedSet('s-1', 182, 'tok');

      const update = h.prisma.drillAssignment.update.mock.calls[0][0];
      expect(update.where).toEqual({ uuid: 'a-1' });
      expect(update.data.status).toBe('ASSIGNED');
      expect(update.data.assignedAt).toBeInstanceOf(Date);
      expect(update.data.items.create).toHaveLength(3);
    });

    it('does not touch assignments that are already assigned', async () => {
      // Re-approving must not re-deliver a drill a student has begun.
      const h = harness();
      h.content.getSet.mockResolvedValue(setWithItems(3));
      h.prisma.drillAssignment.findMany.mockResolvedValue([]);

      await h.service.assignApprovedSet('s-1', 182, 'tok');

      expect(h.prisma.drillAssignment.update).not.toHaveBeenCalled();
    });

    it('refuses to assign a set with no items', async () => {
      // An empty assignment is indistinguishable from a finished one in the runner.
      const h = harness();
      h.content.getSet.mockResolvedValue(setWithItems(0));
      h.prisma.drillAssignment.findMany.mockResolvedValue([
        { uuid: 'a-1', studentId: 3, status: 'PENDING_REVIEW' },
      ]);

      await expect(h.service.assignApprovedSet('s-1', 182, 'tok')).rejects.toThrow(/no items/i);
      expect(h.prisma.drillAssignment.update).not.toHaveBeenCalled();
    });

    it('only assigns rows belonging to this set', async () => {
      const h = harness();
      h.content.getSet.mockResolvedValue(setWithItems(2));
      h.prisma.drillAssignment.findMany.mockResolvedValue([]);

      await h.service.assignApprovedSet('s-1', 182, 'tok');

      expect(h.prisma.drillAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ setUuid: 's-1', status: 'PENDING_REVIEW' }),
        }),
      );
    });
  });

  /**
   * Revoke — a teacher assigned the wrong drill, or wants it back before the student
   * starts. The state machine already allows `-> CANCELLED` from every non-terminal
   * state; this is the first caller of that edge outside the generation sweeper.
   */
  describe('revokeAssignment', () => {
    it('cancels an assigned drill', async () => {
      const h = harness();
      h.prisma.drillAssignment.findUnique.mockResolvedValue({
        uuid: 'a-1', teacherId: 182, status: 'ASSIGNED',
      });

      await h.service.revokeAssignment('a-1', [182]);

      const update = h.prisma.drillAssignment.update.mock.calls[0][0];
      expect(update.where).toEqual({ uuid: 'a-1' });
      expect(update.data.status).toBe('CANCELLED');
    });

    it('cancels one still awaiting review', async () => {
      const h = harness();
      h.prisma.drillAssignment.findUnique.mockResolvedValue({
        uuid: 'a-1', teacherId: 182, status: 'PENDING_REVIEW',
      });

      await h.service.revokeAssignment('a-1', [182]);

      expect(h.prisma.drillAssignment.update).toHaveBeenCalled();
    });

    it('refuses to revoke a completed drill', async () => {
      // The student already did the work; erasing it is not a teacher's to undo here.
      const h = harness();
      h.prisma.drillAssignment.findUnique.mockResolvedValue({
        uuid: 'a-1', teacherId: 182, status: 'COMPLETED',
      });

      await expect(h.service.revokeAssignment('a-1', [182])).rejects.toThrow();
      expect(h.prisma.drillAssignment.update).not.toHaveBeenCalled();
    });

    it("refuses another teacher's assignment", async () => {
      const h = harness();
      h.prisma.drillAssignment.findUnique.mockResolvedValue({
        uuid: 'a-1', teacherId: 999, status: 'ASSIGNED',
      });

      await expect(h.service.revokeAssignment('a-1', [182])).rejects.toThrow(NotFoundException);
      expect(h.prisma.drillAssignment.update).not.toHaveBeenCalled();
    });

    it('404s on an assignment that does not exist', async () => {
      const h = harness();
      h.prisma.drillAssignment.findUnique.mockResolvedValue(null);

      await expect(h.service.revokeAssignment('missing', [182])).rejects.toThrow(NotFoundException);
    });
  });

  /**
   * The teacher's view of one assignment: what the student solved, what they got wrong,
   * and what they actually typed. A teacher asked "what is finished and what are the
   * errors there" — counts alone cannot answer that, and the runner payload is
   * deliberately answer-free, so it cannot either.
   *
   * This is teacher-only and DOES carry answers: seeing that a student typed "gegangen"
   * where "gegangen" was expected is the entire point.
   */
  describe('progressForTeacher', () => {
    function withAttempts(attempts: any[]) {
      const h = harness();
      h.prisma.drillAssignment.findUnique.mockResolvedValue({
        uuid: 'a-1', teacherId: 182, studentId: 3, status: 'IN_PROGRESS',
        title: 'Present perfect', createdAt: new Date(),
        items: [
          { uuid: 'i-1', order: 0, template: 'Ich [have]{habe} [done]{gemacht}.',
            blanks: [{ index: 0, answer: 'habe', prompt: 'have' },
                     { index: 1, answer: 'gemacht', prompt: 'done' }], hint: null },
        ],
      });
      h.prisma.drillAttempt = { findMany: jest.fn(async () => attempts) };
      return h;
    }

    it('reports each blank with its answer and whether it is solved', async () => {
      const h = withAttempts([
        { itemUuid: 'i-1', blankIndex: 0, submittedValue: 'habe', isCorrect: true, attemptNo: 1, revealed: false },
      ]);

      const result = await h.service.progressForTeacher('a-1', [182]);

      const blanks = result.items[0].blanks;
      expect(blanks[0]).toMatchObject({ answer: 'habe', solved: true });
      expect(blanks[1]).toMatchObject({ answer: 'gemacht', solved: false });
    });

    it('lists the wrong answers a student actually typed', async () => {
      const h = withAttempts([
        { itemUuid: 'i-1', blankIndex: 1, submittedValue: 'gemachen', isCorrect: false, attemptNo: 1, revealed: false },
        { itemUuid: 'i-1', blankIndex: 1, submittedValue: 'gemacht', isCorrect: true, attemptNo: 2, revealed: false },
      ]);

      const result = await h.service.progressForTeacher('a-1', [182]);

      const blank = result.items[0].blanks[1];
      expect(blank.solved).toBe(true);
      expect(blank.wrongAttempts).toEqual(['gemachen']);
      expect(blank.attemptCount).toBe(2);
    });

    it('marks a revealed blank as revealed, not as solved by the student', async () => {
      // A revealed answer is not knowledge. Counting it as solved would tell the teacher
      // the student knew something they were shown.
      const h = withAttempts([
        { itemUuid: 'i-1', blankIndex: 0, submittedValue: '', isCorrect: false, attemptNo: 1, revealed: true },
      ]);

      const result = await h.service.progressForTeacher('a-1', [182]);

      expect(result.items[0].blanks[0]).toMatchObject({ revealed: true, solved: false });
    });

    it("refuses another teacher's assignment", async () => {
      const h = withAttempts([]);
      h.prisma.drillAssignment.findUnique.mockResolvedValue({
        uuid: 'a-1', teacherId: 999, items: [],
      });

      await expect(h.service.progressForTeacher('a-1', [182])).rejects.toThrow(NotFoundException);
    });
  });
});
