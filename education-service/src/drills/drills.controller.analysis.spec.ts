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

describe('POST :uuid/analysis/retry', () => {
  it('re-enqueues the analysis for a staff caller', async () => {
    const { controller, jobs } = build();

    await controller.retryAnalysis('a1', teacherReq);

    expect(jobs.enqueue).toHaveBeenCalledWith('a1');
  });

  it('refuses a student', async () => {
    const { controller, jobs } = build();

    await expect(controller.retryAnalysis('a1', studentReq)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(jobs.enqueue).not.toHaveBeenCalled();
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
});
