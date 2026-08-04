import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DrillsController } from './drills.controller';
import { InternalDrillsController } from './internal-drills.controller';

const student = (id: string) => ({ id, email: null, firstName: null, lastName: null, phone: null, userType: 'student' });
const staff = () => ({ id: 't-1', email: null, firstName: null, lastName: null, phone: null, userType: 'staff' });

const req = (user: any) => ({ authUser: user }) as any;

function harness() {
  const runner: any = { check: jest.fn(async () => ({ correct: true, acceptedText: 'auf', attemptNo: 1, blanksCorrect: 1, blanksTotal: 2, assignmentCompleted: false })) };
  const selfDrill: any = { startSelfDrill: jest.fn(async () => ({ uuid: 'a-new' })) };
  const assignments: any = {
    getRunner: jest.fn(async () => ({
      assignment: { uuid: 'a-1', studentId: 42 },
      items: [{ uuid: 'i-1', order: 0, segments: [], blanks: [{ index: 0, prompt: 'на', maxLength: 9, solved: false, solvedText: null }], hint: null }],
    })),
    listForStudent: jest.fn(async () => ({ outstanding: [], completedRecent: [], selfDrillingAllowed: true })),
    listForTeacher: jest.fn(async () => ({ awaitingReview: 0, assigned: 0, completedThisWeek: 0, reviewQueue: [] })),
    listForLesson: jest.fn(async () => ({ assignments: [] })),
  };
  const identity: any = { resolveStudentId: jest.fn(async () => 42) };
  const teacherAssignments: any = {
    generate: jest.fn(async () => ({ assignmentUuids: ['a-1'], setUuid: 's-1', batchUuid: 'b-1' })),
    assignFromSet: jest.fn(async () => ({ assignments: [] })),
    getForTeacher: jest.fn(async () => ({ uuid: 'a-1' })),
    lessonUuidFor: jest.fn(async () => null),
  };
  const roster: any = {
    listForTeacher: jest.fn(async () => ({ students: [], groups: [] })),
    listForLesson: jest.fn(async () => ({ students: [], groups: [], total: 0, hasMore: false, teacherId: 182 })),
  };
  const sets: any = {
    getSet: jest.fn(async () => ({ uuid: 's-1', title: 'Present perfect', items: [] })),
    approveSet: jest.fn(async () => ({ uuid: 's-1', reviewState: 'APPROVED' })),
  };

  return {
    controller: new DrillsController(
      runner,
      selfDrill,
      assignments,
      identity,
      teacherAssignments,
      roster,
      sets,
    ),
    internal: new InternalDrillsController(assignments),
    runner,
    selfDrill,
    assignments,
    identity,
    teacherAssignments,
    roster,
    sets,
  };
}

describe('DrillsController', () => {
  let h: ReturnType<typeof harness>;

  beforeEach(() => {
    h = harness();
  });

  describe('GET runner', () => {
    it('is reachable by the owning student', async () => {
      const res = await h.controller.getRunner('a-1', req(student('u-42')));
      expect(res.items).toHaveLength(1);
    });

    it('is NOT reachable by another student', async () => {
      h.identity.resolveStudentId.mockResolvedValue(999);
      h.assignments.getRunner.mockRejectedValue(new NotFoundException('Drill assignment not found'));
      await expect(h.controller.getRunner('a-1', req(student('u-999')))).rejects.toThrow(NotFoundException);
    });

    // Repeated at the HTTP layer on purpose: the projection tests prove the
    // projection is clean, not that the controller did not add fields back.
    it('returns no answer anywhere in the response', async () => {
      const res = await h.controller.getRunner('a-1', req(student('u-42')));
      const json = JSON.stringify(res);
      expect(json).not.toContain('"answer"');
      expect(json).not.toContain('alternatives');
    });
  });

  describe('POST self', () => {
    it('surfaces the C7 409 body including blockingAssignmentUuid', async () => {
      const err: any = new Error('conflict');
      err.response = {
        statusCode: 409,
        code: 'ASSIGNMENT_OUTSTANDING',
        message: 'Finish the drilling your teacher assigned before starting your own',
        blockingAssignmentUuid: 'blocking-1',
      };
      h.selfDrill.startSelfDrill.mockRejectedValue(err);
      await expect(h.controller.startSelfDrill({ setUuid: 's-1' }, req(student('u-42')))).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'ASSIGNMENT_OUTSTANDING',
          blockingAssignmentUuid: 'blocking-1',
        }),
      });
    });
  });

  describe('teacher-only routes', () => {
    it('reject a student-role token', async () => {
      await expect(h.controller.teacherSummary(req(student('u-42')))).rejects.toThrow(ForbiddenException);
    });

    it('allow a staff token', async () => {
      await expect(h.controller.teacherSummary(req(staff()))).resolves.toBeDefined();
    });
  });
});

describe('InternalDrillsController', () => {
  let h: ReturnType<typeof harness>;

  beforeEach(() => {
    h = harness();
  });

  it('is declared behind InternalTokenGuard', () => {
    const guards = Reflect.getMetadata('__guards__', InternalDrillsController) ?? [];
    const names = guards.map((g: any) => g.name ?? g.constructor?.name);
    expect(names).toContain('InternalTokenGuard');
  });

  // Track J renders the legacy dashboard from this flag. If it disagrees with
  // the gate, the portal offers a button that 409s.
  it('reports selfDrillingAllowed false when an assignment is outstanding', async () => {
    h.assignments.listForStudent.mockResolvedValue({
      outstanding: [{ uuid: 'a-1', status: 'ASSIGNED' }],
      completedRecent: [],
      selfDrillingAllowed: false,
    });
    const res = await h.internal.byStudent('42');
    expect(res.selfDrillingAllowed).toBe(false);
    expect(res.outstanding).toHaveLength(1);
  });

  it('reports selfDrillingAllowed true when nothing is outstanding', async () => {
    const res = await h.internal.byStudent('42');
    expect(res.selfDrillingAllowed).toBe(true);
  });

  it('rejects a non-numeric studentId', async () => {
    await expect(h.internal.byStudent('abc')).rejects.toThrow(/studentId/i);
  });
});

describe('DrillsController — teacher write routes', () => {
  let h: ReturnType<typeof harness>;

  beforeEach(() => {
    h = harness();
  });

  const withToken = (user: any) =>
    ({ authUser: user, headers: { authorization: 'Bearer tok-123' } }) as any;

  describe('POST generate', () => {
    it('queues generation for a staff caller', async () => {
      const res = await h.controller.generate({ count: 50 } as any, withToken(staff()));
      expect(res.assignmentUuids).toEqual(['a-1']);
      expect(h.teacherAssignments.generate).toHaveBeenCalledWith(42, { count: 50 }, 'tok-123');
    });

    // A student token reaching this route creates teacher-origin homework for anyone.
    it('is refused for a student', async () => {
      await expect(
        h.controller.generate({ count: 50 } as any, withToken(student('u-42'))),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(h.teacherAssignments.generate).not.toHaveBeenCalled();
    });

    it('forwards an empty token rather than the literal header when it is absent', async () => {
      await h.controller.generate({ count: 50 } as any, { authUser: staff(), headers: {} } as any);
      expect(h.teacherAssignments.generate.mock.calls[0][2]).toBe('');
    });

    it('does not treat a non-Bearer scheme as a token', async () => {
      await h.controller.generate(
        { count: 50 } as any,
        { authUser: staff(), headers: { authorization: 'Basic abc' } } as any,
      );
      expect(h.teacherAssignments.generate.mock.calls[0][2]).toBe('');
    });
  });

  describe('POST assign', () => {
    it('assigns for a staff caller', async () => {
      await h.controller.assign({ setUuid: 's-1', studentIds: [7] } as any, withToken(staff()));
      expect(h.teacherAssignments.assignFromSet).toHaveBeenCalledWith(
        42,
        { setUuid: 's-1', studentIds: [7] },
        'tok-123',
      );
    });

    it('is refused for a student', async () => {
      await expect(
        h.controller.assign({ setUuid: 's-1' } as any, withToken(student('u-42'))),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(h.teacherAssignments.assignFromSet).not.toHaveBeenCalled();
    });
  });

  describe('GET :uuid', () => {
    it('returns the assignment for its teacher', async () => {
      const res = await h.controller.getOne('a-1', withToken(staff()));
      expect(res).toMatchObject({ uuid: 'a-1' });
      // An array now: ownership accepts the legacy user id and the lesson's Teacher pk.
    expect(h.teacherAssignments.getForTeacher).toHaveBeenCalledWith('a-1', [42]);
    });

    it('is refused for a student', async () => {
      await expect(
        h.controller.getOne('a-1', withToken(student('u-42'))),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('GET teacher/students', () => {
    it('returns the roster for a staff caller', async () => {
      await expect(h.controller.teacherStudents(withToken(staff()))).resolves.toEqual({
        students: [],
        groups: [],
      });
    });

    it('is refused for a student', async () => {
      await expect(
        h.controller.teacherStudents(withToken(student('u-42'))),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // `:uuid` matches any single segment, so route declaration order is what keeps
  // `teacher/summary` and `teacher/students` from being read as assignment uuids.
  it('declares the static teacher routes before the :uuid catch-all', () => {
    const proto = Object.getPrototypeOf(h.controller);
    const names = Object.getOwnPropertyNames(proto);
    expect(names.indexOf('teacherStudents')).toBeLessThan(names.indexOf('getOne'));
    expect(names.indexOf('teacherSummary')).toBeLessThan(names.indexOf('getOne'));
    expect(names.indexOf('generate')).toBeLessThan(names.indexOf('getOne'));
  });

  /**
   * The review screen needs a set WITH answers — that is what reviewing is. Those live on
   * content-service behind `internal/drill-sets/:uuid`, which the gateway gates on
   * `x-internal-token`, a credential no browser may hold. So the teacher screen 404'd.
   *
   * It cannot simply be made public on content-service: that service has no auth guard
   * and the gateway validates a token without checking any role, so a public prefix there
   * would let any authenticated student harvest the answer bank. Proxying through this
   * controller adds the staff check the other path lacks.
   */
  describe('teacherSet', () => {
    it('returns the set with its answers for a staff caller', async () => {
      const h = harness();

      const result = await h.controller.teacherSet('s-1', req(staff()));

      expect(h.sets.getSet).toHaveBeenCalledWith('s-1', expect.anything());
      expect(result).toMatchObject({ uuid: 's-1' });
    });

    it('refuses a student, who must never read the answer bank', async () => {
      const h = harness();

      await expect(h.controller.teacherSet('s-1', req(student('u-42')))).rejects.toThrow(
        ForbiddenException,
      );
      expect(h.sets.getSet).not.toHaveBeenCalled();
    });
  });

  /**
   * `Lesson.teacherId` is the legacy **Teacher profile pk** (182); `resolveStudentId`
   * returns the **user id** (3). Storing the user id in `DrillAssignment.teacherId` made
   * that column mean something different from the identically-named one on Lesson — two
   * id spaces in one database, waiting to be joined by accident.
   *
   * When the request names a lesson, the teacher is taken from the lesson itself, which
   * is authoritative and needs no cross-database mapping.
   */
  describe('teacher id on the write path', () => {
    it('attributes a generated assignment to the lesson teacher, not the user id', async () => {
      const h = harness();

      await h.controller.generate(
        { studentIds: [3], lessonUuid: 'l-1', topics: [], instructions: '', count: 3 } as any,
        req(staff()),
      );

      expect(h.roster.listForLesson).toHaveBeenCalledWith('l-1');
      expect(h.teacherAssignments.generate).toHaveBeenCalledWith(
        182,
        expect.anything(),
        expect.anything(),
      );
    });

    it('falls back to the resolved user id when no lesson is named', async () => {
      // Without a lesson there is nothing authoritative to read the teacher pk from, so
      // the previous behaviour stands rather than guessing.
      const h = harness();

      await h.controller.generate(
        { studentIds: [3], lessonUuid: null, topics: [], instructions: '', count: 3 } as any,
        req(staff()),
      );

      expect(h.roster.listForLesson).not.toHaveBeenCalled();
      expect(h.teacherAssignments.generate).toHaveBeenCalledWith(
        42,
        expect.anything(),
        expect.anything(),
      );
    });

    it('falls back when the lesson has no teacher recorded', async () => {
      const h = harness();
      h.roster.listForLesson.mockResolvedValue({
        students: [], groups: [], total: 0, hasMore: false, teacherId: null,
      });

      await h.controller.generate(
        { studentIds: [3], lessonUuid: 'l-1', topics: [], instructions: '', count: 3 } as any,
        req(staff()),
      );

      expect(h.teacherAssignments.generate).toHaveBeenCalledWith(
        42,
        expect.anything(),
        expect.anything(),
      );
    });
  });

  /**
   * Approve lived at content-service's `internal/drill-sets/:uuid/approve`, gated by the
   * gateway on a token no browser holds — clicking Approve produced a bare 404 in the
   * console and nothing on screen.
   *
   * It also trusts `teacherId` from the request body outright, so that value must come
   * from the server's own resolution of the caller, never from the browser.
   */
  describe('approveSet', () => {
    it('approves for a staff caller, attributing to the resolved teacher', async () => {
      const h = harness();

      await h.controller.approveSet('s-1', req(staff()));

      expect(h.sets.approveSet).toHaveBeenCalledWith('s-1', 42, expect.anything());
    });

    it('refuses a student', async () => {
      const h = harness();

      await expect(h.controller.approveSet('s-1', req(student('u-9')))).rejects.toThrow(
        ForbiddenException,
      );
      expect(h.sets.approveSet).not.toHaveBeenCalled();
    });
  });
});
