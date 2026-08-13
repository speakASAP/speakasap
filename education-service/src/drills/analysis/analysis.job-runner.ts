import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalysisService } from './analysis.service';
import { computeMasteryDeltas } from './mastery';
import { MasteryRepository } from './mastery.repository';

/**
 * Fire-and-forget runner for the analysis pipeline.
 *
 * `enqueue` returns immediately: it is called from the student's last answer request, and
 * a model call there would hold that request open for a minute.
 *
 * Nothing awaits the detached promise, so it must never reject — an unhandled rejection
 * takes the process down. `AnalysisService.run` already swallows its own failures onto the
 * run row; the catch here is the second belt, for anything thrown before that.
 */
@Injectable()
export class AnalysisJobRunner {
  private readonly logger = new Logger(AnalysisJobRunner.name);

  constructor(private readonly analysis: AnalysisService) {}

  enqueue(sourceAssignmentUuid: string): void {
    const correlationId = randomUUID();
    void this.analysis.run(sourceAssignmentUuid, correlationId).catch((error) => {
      this.logger.error(
        `Analysis job rejected: assignment=${sourceAssignmentUuid} correlationId=${correlationId} — ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }
}

/**
 * What `RunnerService` calls when an assignment completes.
 *
 * Two things happen, in this order and deliberately not merged:
 *
 * 1. **Mastery, synchronously.** The streak is a fact about what the student did, and it
 *    must be recorded whether or not any model is reachable. Doing it inside the analysis
 *    job would make a correct answer's credit depend on ai-microservice being up.
 * 2. **Analysis, fire-and-forget.** A model call the student's request must not wait for.
 */
@Injectable()
export class CompletionAnalysisAdapter {
  private readonly logger = new Logger(CompletionAnalysisAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryRepository,
    private readonly jobs: AnalysisJobRunner,
  ) {}

  async onCompleted(assignmentUuid: string): Promise<void> {
    const assignment: any = await (this.prisma as any).drillAssignment.findUnique({
      where: { uuid: assignmentUuid },
      include: { items: { orderBy: { order: 'asc' } } },
    });

    if (!assignment) {
      throw new Error(`Assignment ${assignmentUuid} vanished before completion analysis`);
    }

    const attempts: any[] = await (this.prisma as any).drillAttempt.findMany({
      where: { assignmentUuid },
      orderBy: { attemptNo: 'asc' },
    });

    const deltas = computeMasteryDeltas(
      assignment.items ?? [],
      attempts,
      assignment.languageCode,
    );
    await this.mastery.applyDeltas(
      assignment.studentId,
      assignment.languageCode,
      deltas,
      new Date(),
    );

    this.jobs.enqueue(assignmentUuid);
  }
}
