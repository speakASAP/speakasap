import { Module } from '@nestjs/common';
import { AuthClientModule } from '../auth-client/auth-client.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentsRepository } from './assignments.repository';
import { DrillsController, DRILL_IDENTITY_RESOLVER } from './drills.controller';
import { InternalDrillsController } from './internal-drills.controller';
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
  imports: [PrismaModule, AuthClientModule],
  controllers: [DrillsController, InternalDrillsController],
  providers: [
    AssignmentsRepository,
    RunnerService,
    DrillAssignmentsService,

    // Track D — upstream clients, adapters and the orchestration pipeline.
    ContentClient,
    AiClient,
    RegenerationService,
    DrillSetsClientAdapter,
    StudentProgressClientAdapter,
    DrillIdentityResolverAdapter,
    GenerationJobRepositoryAdapter,

    { provide: DRILL_IDENTITY_RESOLVER, useExisting: DrillIdentityResolverAdapter },

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
  ],
  exports: [AssignmentsRepository, DrillAssignmentsService, JobRunner, RegenerationService],
})
export class DrillsModule {}
