import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DrillsController } from './drills.controller';

function build(overrides: Record<string, any> = {}) {
  const analysis = {
    getRunWithClusters: jest.fn(async () => ({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      studentId: 7,
      status: 'READY',
      errorMessage: null,
      attemptCount: 1,
      startedAt: new Date(),
      finishedAt: new Date(),
      clusters: [],
    })),
    getCluster: jest.fn(async () => ({ uuid: 'g1', sourceAssignmentUuid: 'a1', studentId: 7 })),
    updateCluster: jest.fn(async () => ({ uuid: 'g1', explanation: 'edited' })),
    ...overrides.analysis,
  };

  const jobs = { enqueue: jest.fn(), ...overrides.jobs };
  const remedial = {
    createForGap: jest.fn(async () => ({ assignmentUuids: ['r1'], setUuid: 's1', reused: false })),
    ...overrides.remedial,
  };

  const teacherAssignments = {
    lessonUuidFor: jest.fn(async () => null),
    progressForTeacher: jest.fn(async () => ({})),
    // Ownership check used by getAnalysis/updateGap/createRemedial's staff branch.
    // Defaults to "owned" so tests that aren't about ownership don't need to know about
    // it; ownership-specific tests below override this to reject.
    getForTeacher: jest.fn(async () => ({ uuid: 'a1' })),
    ...overrides.teacherAssignments,
  };

  const identity = { resolveStudentId: jest.fn(async () => overrides.userId ?? 7) };

  const roster = {
    listForLesson: jest.fn(async () => ({ teacherId: null })),
    ...overrides.roster,
  };

  // Real DrillsController constructor order:
  // (runner, selfDrill, assignments, identity, teacherAssignments, roster, sets,
  //  analysis, analysisJobs, remedial)
  const controller = new DrillsController(
    {} as any,
    {} as any,
    {} as any,
    identity as any,
    teacherAssignments as any,
    roster as any,
    {} as any,
    analysis as any,
    jobs as any,
    remedial as any,
  );

  return { controller, analysis, jobs, remedial, identity, teacherAssignments, roster };
}

const studentReq = { authUser: { id: 'auth-uuid', roles: ['student'] } } as any;
// isStaffUser only recognizes staff/admin/manager/superadmin — 'teacher' is not a
// staff role in this codebase, matching drills.controller.spec.ts's own `staff()` fixture.
const teacherReq = { authUser: { id: 'auth-uuid', userType: 'staff' } } as any;

describe('GET :uuid/analysis', () => {
  it('returns the run for the student who owns the assignment', async () => {
    const { controller, analysis } = build();

    const result: any = await controller.getAnalysis('a1', studentReq);

    expect(result.status).toBe('READY');
    expect(analysis.getRunWithClusters).toHaveBeenCalledWith('a1');
  });

  it('404s a student asking about another student\'s assignment', async () => {
    const { controller } = build({
      analysis: {
        getRunWithClusters: jest.fn(async () => ({
          uuid: 'run-1',
          sourceAssignmentUuid: 'a1',
          studentId: 999,
          status: 'READY',
          errorMessage: null,
          attemptCount: 1,
          startedAt: null,
          finishedAt: null,
          clusters: [],
        })),
      },
    });

    await expect(controller.getAnalysis('a1', studentReq)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reports NOT_ANALYZED rather than 404 when no run exists yet', async () => {
    const { controller } = build({
      analysis: { getRunWithClusters: jest.fn(async () => null) },
    });

    const result: any = await controller.getAnalysis('a1', studentReq);

    expect(result.status).toBe('NOT_ANALYZED');
    expect(result.clusters).toEqual([]);
  });

  it('keeps FAILED distinguishable from NO_ERRORS in the response', async () => {
    const { controller } = build({
      analysis: {
        getRunWithClusters: jest.fn(async () => ({
          uuid: 'run-1',
          sourceAssignmentUuid: 'a1',
          studentId: 7,
          status: 'FAILED',
          errorMessage: 'upstream 502',
          attemptCount: 2,
          startedAt: new Date(),
          finishedAt: new Date(),
          clusters: [],
        })),
      },
    });

    const result: any = await controller.getAnalysis('a1', studentReq);

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toBe('upstream 502');
  });
});

describe('GET gaps/:gapUuid', () => {
  it('returns the gap to the student it belongs to', async () => {
    const { controller } = build();

    const result: any = await controller.getGap('g1', studentReq);

    expect(result.uuid).toBe('g1');
  });

  it("404s a student asking for another student's gap", async () => {
    const { controller } = build({
      analysis: { getCluster: jest.fn(async () => ({ uuid: 'g1', studentId: 999 })) },
    });

    await expect(controller.getGap('g1', studentReq)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s a gap that does not exist', async () => {
    const { controller } = build({ analysis: { getCluster: jest.fn(async () => null) } });

    await expect(controller.getGap('g1', studentReq)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a staff caller who owns the gap\'s source assignment reads it successfully', async () => {
    const { controller, teacherAssignments } = build();

    const result: any = await controller.getGap('g1', teacherReq);

    // Ownership was actually checked against the gap's sourceAssignmentUuid, not skipped.
    expect(teacherAssignments.getForTeacher).toHaveBeenCalledWith('a1', [7]);
    expect(result.uuid).toBe('g1');
  });

  it('a staff caller who does NOT own the gap\'s assignment gets NotFoundException, not Forbidden', async () => {
    const { controller, teacherAssignments } = build({
      teacherAssignments: {
        getForTeacher: jest.fn(async () => {
          // Real TeacherAssignmentsService.getForTeacher throws exactly this when the
          // caller's ids don't include the assignment's teacherId.
          throw new NotFoundException('Drill assignment not found');
        }),
      },
    });

    await expect(controller.getGap('g1', teacherReq)).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.getGap('g1', teacherReq)).rejects.not.toBeInstanceOf(
      ForbiddenException,
    );
    expect(teacherAssignments.getForTeacher).toHaveBeenCalled();
  });
});

describe('POST :uuid/analysis/retry', () => {
  it('re-enqueues the analysis for a staff caller who owns the assignment', async () => {
    const { controller, jobs, teacherAssignments } = build();

    await controller.retryAnalysis('a1', teacherReq);

    // Ownership was actually checked against the assignment, not skipped.
    expect(teacherAssignments.getForTeacher).toHaveBeenCalledWith('a1', [7]);
    expect(jobs.enqueue).toHaveBeenCalledWith('a1');
  });

  it('refuses a student', async () => {
    const { controller, jobs } = build();

    await expect(controller.retryAnalysis('a1', studentReq)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it('a staff caller who does NOT own the assignment gets NotFoundException, not Forbidden, and spends no model call', async () => {
    const { controller, jobs, teacherAssignments } = build({
      teacherAssignments: {
        getForTeacher: jest.fn(async () => {
          // Real TeacherAssignmentsService.getForTeacher throws exactly this when the
          // caller's ids don't include the assignment's teacherId.
          throw new NotFoundException('Drill assignment not found');
        }),
      },
    });

    await expect(controller.retryAnalysis('a1', teacherReq)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(controller.retryAnalysis('a1', teacherReq)).rejects.not.toBeInstanceOf(
      ForbiddenException,
    );
    // The part that proves no model call is spent: enqueue must never run for an
    // assignment this staff account does not own.
    expect(jobs.enqueue).not.toHaveBeenCalled();
    expect(teacherAssignments.getForTeacher).toHaveBeenCalled();
  });
});

describe('PATCH teacher/gaps/:gapUuid', () => {
  it('applies a teacher edit', async () => {
    const { controller, analysis } = build();

    await controller.updateGap('g1', { explanation: 'edited' }, teacherReq);

    expect(analysis.updateCluster).toHaveBeenCalledWith('g1', { explanation: 'edited' }, 7);
  });

  it('refuses a student', async () => {
    const { controller, analysis } = build();

    await expect(
      controller.updateGap('g1', { explanation: 'edited' }, studentReq),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(analysis.updateCluster).not.toHaveBeenCalled();
  });

  it('rejects an empty explanation rather than blanking the student\'s theory', async () => {
    const { controller } = build();

    await expect(
      controller.updateGap('g1', { explanation: '   ' }, teacherReq),
    ).rejects.toThrow(/explanation/i);
  });

  it('a teacher who owns the gap\'s source assignment succeeds', async () => {
    const { controller, analysis, teacherAssignments } = build();

    await controller.updateGap('g1', { explanation: 'edited' }, teacherReq);

    // Ownership was actually checked against the gap's sourceAssignmentUuid, not skipped.
    expect(teacherAssignments.getForTeacher).toHaveBeenCalledWith('a1', [7]);
    expect(analysis.updateCluster).toHaveBeenCalledWith('g1', { explanation: 'edited' }, 7);
  });

  it('a staff user who does NOT own the gap\'s assignment gets NotFoundException, not Forbidden', async () => {
    const { controller, analysis, teacherAssignments } = build({
      teacherAssignments: {
        getForTeacher: jest.fn(async () => {
          // Real TeacherAssignmentsService.getForTeacher throws exactly this when the
          // caller's ids don't include the assignment's teacherId.
          throw new NotFoundException('Drill assignment not found');
        }),
      },
    });

    await expect(
      controller.updateGap('g1', { explanation: 'edited' }, teacherReq),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      controller.updateGap('g1', { explanation: 'edited' }, teacherReq),
    ).rejects.not.toBeInstanceOf(ForbiddenException);
    expect(analysis.updateCluster).not.toHaveBeenCalled();
    expect(teacherAssignments.getForTeacher).toHaveBeenCalled();
  });

  it('a gap that does not exist at all gets NotFoundException', async () => {
    const { controller, analysis } = build({
      analysis: { getCluster: jest.fn(async () => null) },
    });

    await expect(
      controller.updateGap('missing-gap', { explanation: 'edited' }, teacherReq),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(analysis.updateCluster).not.toHaveBeenCalled();
  });
});

describe('POST teacher/gaps/:gapUuid/remedial', () => {
  it('creates the remedial drill', async () => {
    const { controller, remedial } = build();

    const result: any = await controller.createRemedial('g1', teacherReq);

    expect(result.assignmentUuids).toEqual(['r1']);
    expect(remedial.createForGap).toHaveBeenCalledWith('g1', 7, expect.any(String));
  });

  it('refuses a student', async () => {
    const { controller, remedial } = build();

    await expect(controller.createRemedial('g1', studentReq)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(remedial.createForGap).not.toHaveBeenCalled();
  });

  it('a teacher who owns the gap\'s source assignment succeeds', async () => {
    const { controller, remedial, teacherAssignments } = build();

    const result: any = await controller.createRemedial('g1', teacherReq);

    expect(teacherAssignments.getForTeacher).toHaveBeenCalledWith('a1', [7]);
    expect(result.assignmentUuids).toEqual(['r1']);
    expect(remedial.createForGap).toHaveBeenCalledWith('g1', 7, expect.any(String));
  });

  it('a staff user who does NOT own the gap\'s assignment gets NotFoundException, not Forbidden', async () => {
    const { controller, remedial, teacherAssignments } = build({
      teacherAssignments: {
        getForTeacher: jest.fn(async () => {
          throw new NotFoundException('Drill assignment not found');
        }),
      },
    });

    await expect(controller.createRemedial('g1', teacherReq)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(controller.createRemedial('g1', teacherReq)).rejects.not.toBeInstanceOf(
      ForbiddenException,
    );
    expect(remedial.createForGap).not.toHaveBeenCalled();
    expect(teacherAssignments.getForTeacher).toHaveBeenCalled();
  });

  it('a gap that does not exist at all gets NotFoundException', async () => {
    const { controller, remedial } = build({
      analysis: { getCluster: jest.fn(async () => null) },
    });

    await expect(controller.createRemedial('missing-gap', teacherReq)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(remedial.createForGap).not.toHaveBeenCalled();
  });
});
