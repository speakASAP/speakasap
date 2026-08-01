import { Injectable, Logger } from '@nestjs/common';
import { GenerationPhase, GenerationProgress } from '../contracts';
import { GenerationJob, GenerationService, ProgressSink } from './generation.service';

/**
 * The persistence this runner needs. Declared here as a port rather than taken from
 * AssignmentsRepository, which is Track B's file and carries none of these methods —
 * Track D does not edit it. Bound in DrillsModule against a Track-D-owned adapter.
 */
export interface GenerationJobRepository {
  updateProgress(assignmentUuid: string, progress: GenerationProgress): Promise<void>;
  cancel(assignmentUuid: string, reason: string): Promise<void>;
  /** GENERATING rows whose createdAt is older than `olderThanSeconds`. */
  findStaleGenerating(olderThanSeconds: number): Promise<{ uuid: string }[]>;
}

/** What the runner knows about a job in flight, for the stalled calculation. */
export interface JobProgressState {
  startedAt: number;
  etaSeconds: number | null;
  /** Timestamp of the last phase change or item batch. */
  lastProgressAt: number;
  phase: GenerationPhase;
  generated: number;
  total: number;
}

const DEFAULT_TIMEOUT_SECONDS = 900;
/** How far past the estimate a job must go, with no progress, before it reads stalled. */
const STALL_GRACE_MULTIPLIER = 2;

/**
 * Fire-and-forget runner for the generation pipeline, spec §10.3.
 *
 * `enqueue` returns immediately: a teacher's request must not block on a model call
 * that takes minutes. Nothing awaits the detached promise, so it must never reject —
 * an unhandled rejection here takes the process down.
 */
@Injectable()
export class JobRunner implements ProgressSink {
  private readonly logger = new Logger(JobRunner.name);

  constructor(
    private readonly generation: GenerationService,
    private readonly repo: GenerationJobRepository,
  ) {}

  /** ProgressSink — the pipeline reports every phase boundary through here. */
  async update(assignmentUuids: string[], progress: GenerationProgress): Promise<void> {
    await this.persist(assignmentUuids, progress);
  }

  enqueue(assignmentUuids: string[], job: GenerationJob): void {
    void this.generation.run(job).catch(async (error) => {
      const message = (error as Error).message || 'Generation failed';
      this.logger.error(`Generation job rejected: set=${job.setUuid} — ${message}`);
      await this.persist(assignmentUuids, {
        phase: 'FAILED',
        generated: 0,
        total: job.itemCount,
        etaSeconds: null,
        message,
        stalled: false,
      });
    });
  }

  /**
   * Spec §10.3's "never count down to zero and lie".
   *
   * Elapsed time alone does not mean stalled — a slow but advancing job is working.
   * Only a job that has passed its estimate AND has not progressed since is stalled,
   * because that is the only case where telling the teacher to intervene is right.
   */
  progressFor(_assignmentUuid: string, state: JobProgressState): GenerationProgress {
    const now = Date.now();
    const terminal = state.phase === 'READY' || state.phase === 'FAILED';
    const etaSeconds = state.etaSeconds;

    const budgetMs = (etaSeconds ?? DEFAULT_TIMEOUT_SECONDS) * 1000 * STALL_GRACE_MULTIPLIER;
    const sinceProgress = now - state.lastProgressAt;
    const stalled = !terminal && etaSeconds !== null && sinceProgress > budgetMs;

    return {
      phase: state.phase,
      generated: state.generated,
      total: state.total,
      etaSeconds,
      message: stalled ? 'Generation appears to have stalled' : '',
      stalled,
    };
  }

  /**
   * Cancels GENERATING rows that have outlived the timeout.
   *
   * Invoked lazily from the assignment read endpoints, not by a scheduler — this
   * service has none and adding one is out of scope. A sweep failure is logged and
   * swallowed: it must not take down the read it is riding on.
   */
  async sweepStale(): Promise<number> {
    const timeoutSeconds = Number(process.env.DRILL_GENERATION_TIMEOUT_SECONDS) || DEFAULT_TIMEOUT_SECONDS;
    try {
      const stale = await this.repo.findStaleGenerating(timeoutSeconds);
      for (const row of stale) {
        await this.repo.cancel(row.uuid, `Generation timed out after ${timeoutSeconds}s`);
      }
      if (stale.length > 0) {
        this.logger.warn(`Swept ${stale.length} stale generation job(s) to CANCELLED`);
      }
      return stale.length;
    } catch (error) {
      this.logger.error(`Stale generation sweep failed: ${(error as Error).message}`);
      return 0;
    }
  }

  /** Every assignment in the batch is updated; one bad row must not skip the rest. */
  private async persist(assignmentUuids: string[], progress: GenerationProgress): Promise<void> {
    for (const uuid of assignmentUuids) {
      try {
        await this.repo.updateProgress(uuid, progress);
      } catch (error) {
        this.logger.error(
          `Failed to record progress for assignment ${uuid}: ${(error as Error).message}`,
        );
      }
    }
  }
}
