import { Module } from '@nestjs/common';
import { AuthClientModule } from '../auth-client/auth-client.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentsRepository } from './assignments.repository';
import { DrillsController, DRILL_IDENTITY_RESOLVER } from './drills.controller';
import { InternalDrillsController } from './internal-drills.controller';
import { NotificationsClientAdapter } from './notifications.client';
import { NotificationsHook } from './notifications.hook';
import {
  DrillIdentityResolverAdapter,
  DrillSetsClientAdapter,
  GenerationJobRepositoryAdapter,
  StudentProgressClientAdapter,
} from './orchestration/adapters';
import { AiClient } from './orchestration/ai.client';
import { ContentClient } from './orchestration/content.client';
import { GenerationService } from './orchestration/generation.service';
import { JobRunner } from './orchestration/job-runner.service';
import { RegenerationService } from './orchestration/regeneration.service';
import { DrillAssignmentsService } from './runner/assignments.service';
import { RunnerService } from './runner/runner.service';
import { SelfDrillService } from './runner/self-drill.service';
import { TeacherAssignmentsService } from './teacher/teacher-assignments.service';
import { TeacherRosterService } from './teacher/roster.service';
import { LessonClientModule } from '../lesson-client/lesson-client.module';
import { LessonClientService } from '../lesson-client/lesson-client.service';
import { AnalysisClient } from './analysis/analysis.client';
import { AnalysisRepository } from './analysis/analysis.repository';
import { AnalysisService } from './analysis/analysis.service';
import { AnalysisJobRunner, CompletionAnalysisAdapter } from './analysis/analysis.job-runner';
import { MasteryRepository } from './analysis/mastery.repository';
import { RemedialService } from './analysis/remedial.service';
import { TaxonomyService } from './analysis/taxonomy';

/**
 * Track B shipped `AssignmentsRepository` with no module, so it was unreachable at
 * runtime (Track B handoff note 4). Track B2 wired it, the runner and the controllers,
 * but deliberately left three cross-service boundaries unbound so the module would fail
 * at startup rather than run against stubs ("Will not boot yet"). Track D binds them.
 *
 * `SelfDrillService` takes two of those boundaries as plain TypeScript interfaces, which
 * erase at runtime and so carry no DI token. It is constructed through `useFactory`
 * below rather than editing Track B2's file to add `@Inject(...)`. `DrillsController`
 * could not be handled that way — Nest instantiates controllers itself — so it received
 * the single `@Inject(DRILL_IDENTITY_RESOLVER)` annotation it needed.
 */
@Module({
  imports: [PrismaModule, AuthClientModule, LessonClientModule],
  controllers: [DrillsController, InternalDrillsController],
  providers: [
    AssignmentsRepository,
    DrillAssignmentsService,

    // RunnerService takes the notifier and the analyzer as optional third/fourth
    // arguments, which Nest cannot supply by reflection — an optional parameter typed
    // as an interface has no token to resolve. Constructed explicitly so completion
    // actually notifies AND actually starts analysis. Without the fourth argument here,
    // `RunnerService.analyzer` stays undefined and every earlier analysis task's code is
    // unreachable — completion would notify but never trigger a single analysis run.
    {
      provide: RunnerService,
      useFactory: (
        prisma: PrismaService,
        assignments: AssignmentsRepository,
        notifications: NotificationsHook,
        analyzer: CompletionAnalysisAdapter,
      ) => new RunnerService(prisma, assignments, notifications, analyzer),
      inject: [PrismaService, AssignmentsRepository, NotificationsHook, CompletionAnalysisAdapter],
    },

    // Track D — upstream clients, adapters and the orchestration pipeline.
    ContentClient,
    AiClient,
    RegenerationService,
    DrillSetsClientAdapter,
    // Explicit factory, not a bare class: its one constructor argument is the
    // `StudentProgressSource` interface, which erases at runtime and so carries no DI
    // token for Nest to resolve by type. Same treatment as the services below.
    {
      provide: StudentProgressClientAdapter,
      useFactory: (lessons: LessonClientService) => new StudentProgressClientAdapter(lessons),
      inject: [LessonClientService],
    },
    DrillIdentityResolverAdapter,
    GenerationJobRepositoryAdapter,

    { provide: DRILL_IDENTITY_RESOLVER, useExisting: DrillIdentityResolverAdapter },

    // Track G. `NotificationsClient` is an interface and erases at runtime, so the hook
    // is constructed explicitly rather than annotated — the same treatment
    // SelfDrillService gets below, and for the same reason.
    NotificationsClientAdapter,
    {
      provide: NotificationsHook,
      useFactory: (prisma: PrismaService, client: NotificationsClientAdapter) =>
        new NotificationsHook(prisma, client),
      inject: [PrismaService, NotificationsClientAdapter],
    },

    // JobRunner is the pipeline's ProgressSink and the pipeline is the runner's job, so
    // the two reference each other. The cycle is broken with a sink that forwards to the
    // runner once it exists, rather than with forwardRef() — one factory is easier to
    // follow than a lazy reference in two places.
    {
      provide: JobRunner,
      useFactory: (content: ContentClient, ai: AiClient, repo: GenerationJobRepositoryAdapter) => {
        let runner: JobRunner;
        const sink = {
          update: (uuids: string[], progress: any) => runner.update(uuids, progress),
        };
        const generation = new GenerationService(content, ai, sink);
        runner = new JobRunner(generation, repo);
        return runner;
      },
      inject: [ContentClient, AiClient, GenerationJobRepositoryAdapter],
    },

    // Track F backend. `StudentProgressReader` is an interface and erases at runtime, so
    // this follows the same explicit-factory treatment as SelfDrillService below.
    TeacherRosterService,
    {
      provide: TeacherAssignmentsService,
      useFactory: (
        prisma: PrismaService,
        assignments: AssignmentsRepository,
        content: ContentClient,
        jobs: JobRunner,
        progress: StudentProgressClientAdapter,
        lessons: LessonClientService,
        notifications: NotificationsHook,
      ) =>
        new TeacherAssignmentsService(
          prisma,
          assignments,
          content,
          jobs,
          progress,
          lessons,
          notifications,
        ),
      inject: [
        PrismaService,
        AssignmentsRepository,
        ContentClient,
        JobRunner,
        StudentProgressClientAdapter,
        LessonClientService,
        NotificationsHook,
      ],
    },

    {
      provide: SelfDrillService,
      useFactory: (
        prisma: PrismaService,
        assignments: AssignmentsRepository,
        sets: DrillSetsClientAdapter,
        progress: StudentProgressClientAdapter,
      ) => new SelfDrillService(prisma, assignments, sets, progress),
      inject: [
        PrismaService,
        AssignmentsRepository,
        DrillSetsClientAdapter,
        StudentProgressClientAdapter,
      ],
    },

    // Error analysis and remedial drilling (Tasks 1-12). `AnalysisJobRunner` is the
    // fire-and-forget entry point, `CompletionAnalysisAdapter` is the port RunnerService
    // calls on completion (bound above, in RunnerService's factory) — without that bind
    // these providers exist but nothing ever calls them.
    AnalysisClient,
    AnalysisRepository,
    AnalysisService,
    AnalysisJobRunner,
    CompletionAnalysisAdapter,
    MasteryRepository,
    TaxonomyService,

    // RemedialService takes `StudentProgressReader` as its sixth argument, a plain
    // TypeScript interface that erases at runtime and so carries no DI token — the same
    // situation SelfDrillService and TeacherAssignmentsService are in above, given the
    // same explicit-factory treatment.
    {
      provide: RemedialService,
      useFactory: (
        prisma: PrismaService,
        analysis: AnalysisRepository,
        mastery: MasteryRepository,
        content: ContentClient,
        jobs: JobRunner,
        progress: StudentProgressClientAdapter,
      ) => new RemedialService(prisma, analysis, mastery, content, jobs, progress),
      inject: [
        PrismaService,
        AnalysisRepository,
        MasteryRepository,
        ContentClient,
        JobRunner,
        StudentProgressClientAdapter,
      ],
    },
  ],
  exports: [
    AssignmentsRepository,
    DrillAssignmentsService,
    JobRunner,
    RegenerationService,
    NotificationsHook,
  ],
})
export class DrillsModule {}
