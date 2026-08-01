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

  return {
    controller: new DrillsController(runner, selfDrill, assignments, identity),
    internal: new InternalDrillsController(assignments),
    runner,
    selfDrill,
    assignments,
    identity,
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
