import { Test } from '@nestjs/testing';
import { DrillsModule } from './drills.module';
import { PrismaService } from '../prisma/prisma.service';
import { DrillsController, DRILL_IDENTITY_RESOLVER } from './drills.controller';
import { SelfDrillService } from './runner/self-drill.service';
import { JobRunner } from './orchestration/job-runner.service';
import { RegenerationService } from './orchestration/regeneration.service';
import { TeacherAssignmentsService } from './teacher/teacher-assignments.service';
import { TeacherRosterService } from './teacher/roster.service';

/**
 * Track B2 shipped DrillsModule with three cross-service providers deliberately
 * unbound, so that compiling the module threw and education-service would not start
 * ("Will not boot yet — REQUIRED handoff to Track D"). Track D binds them.
 *
 * This is the test for that handoff. If it fails, the service does not boot — which is
 * exactly the failure B2 engineered, and exactly what Track D exists to clear.
 */
describe('DrillsModule', () => {
  const compile = () =>
    Test.createTestingModule({ imports: [DrillsModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

  it('compiles with every cross-service provider bound', async () => {
    await expect(compile()).resolves.toBeDefined();
  });

  it('resolves the controller whose identity resolver Track B2 left unbound', async () => {
    const moduleRef = await compile();
    expect(moduleRef.get(DrillsController)).toBeInstanceOf(DrillsController);
    expect(moduleRef.get(DRILL_IDENTITY_RESOLVER)).toBeDefined();
  });

  it('resolves SelfDrillService with both of its clients supplied', async () => {
    const moduleRef = await compile();
    const svc = moduleRef.get(SelfDrillService);

    expect(svc).toBeInstanceOf(SelfDrillService);
    expect((svc as any).sets).toBeDefined();
    expect((svc as any).progress).toBeDefined();
  });

  it('resolves the job runner with the pipeline wired to it as the progress sink', async () => {
    const moduleRef = await compile();
    const runner = moduleRef.get(JobRunner);

    expect(runner).toBeInstanceOf(JobRunner);

    // The pipeline must report progress back through THIS runner. Asserting only that
    // some update function exists passes against a sink wired to nowhere, which is a
    // generation job that runs but never updates the assignment row — so drive a write
    // through the sink and check it arrives at the runner's repository.
    const seen: any[] = [];
    (runner as any).repo.updateProgress = async (uuid: string, progress: any) => {
      seen.push({ uuid, progress });
    };
    await (runner as any).generation.progress.update(['a-1'], { phase: 'BANK' });

    expect(seen).toEqual([{ uuid: 'a-1', progress: { phase: 'BANK' } }]);
  });

  it('resolves the regeneration service', async () => {
    const moduleRef = await compile();
    expect(moduleRef.get(RegenerationService)).toBeInstanceOf(RegenerationService);
  });
});

/**
 * Track F's backend. `TeacherAssignmentsService` takes `StudentProgressReader` as a
 * plain interface, which erases at runtime and so carries no DI token — the same shape
 * that made SelfDrillService need an explicit factory. If that factory is ever replaced
 * with plain class registration, the container resolves `undefined` for it and every
 * generate call fails at the first progress lookup rather than at startup.
 */
describe('DrillsModule — teacher write path', () => {
  const compile = () =>
    Test.createTestingModule({ imports: [DrillsModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

  it('resolves TeacherAssignmentsService with all six dependencies supplied', async () => {
    const moduleRef = await compile();
    const svc = moduleRef.get(TeacherAssignmentsService);

    expect(svc).toBeInstanceOf(TeacherAssignmentsService);
    expect((svc as any).content).toBeDefined();
    expect((svc as any).jobs).toBeDefined();
    expect((svc as any).progress).toBeDefined();
    expect((svc as any).notifications).toBeDefined();
    expect((svc as any).assignments).toBeDefined();
  });

  it('resolves TeacherRosterService', async () => {
    const moduleRef = await compile();
    expect(moduleRef.get(TeacherRosterService)).toBeInstanceOf(TeacherRosterService);
  });

  it('gives the controller both teacher collaborators', async () => {
    const moduleRef = await compile();
    const controller = moduleRef.get(DrillsController);
    expect((controller as any).teacherAssignments).toBeInstanceOf(TeacherAssignmentsService);
    expect((controller as any).roster).toBeInstanceOf(TeacherRosterService);
  });
});
