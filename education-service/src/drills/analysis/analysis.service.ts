import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { gradingOptionsFor, normalizeAnswer } from '../grading';
import { AnalysisClient } from './analysis.client';
import { AnalysisRepository } from './analysis.repository';
import {
  AnalyzedGapCluster,
  FailedBlank,
  PersistableCluster,
  PersistedFailedAnswer,
} from './contracts';
import { extractFailedBlanks } from './failed-blanks';
import { TaxonomyService } from './taxonomy';

/**
 * Turns one completed assignment's mistakes into grammar gap clusters.
 *
 * **Never throws.** It is called from a fire-and-forget job runner where an unhandled
 * rejection takes the process down, and where a thrown error would leave the run row
 * PENDING forever with nothing to show the student. Every failure path ends at
 * `markFailed`, which is a state the UI renders and the teacher can retry.
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: AnalysisRepository,
    private readonly client: AnalysisClient,
    private readonly taxonomy: TaxonomyService,
  ) {}

  async run(sourceAssignmentUuid: string, correlationId: string): Promise<void> {
    const started = Date.now();
    let runUuid: string | null = null;

    try {
      const assignment: any = await (this.prisma as any).drillAssignment.findUnique({
        where: { uuid: sourceAssignmentUuid },
        include: { items: { orderBy: { order: 'asc' } } },
      });

      if (!assignment) {
        throw new Error(`Assignment ${sourceAssignmentUuid} not found`);
      }

      runUuid = await this.repo.createRun(sourceAssignmentUuid, assignment.studentId);
      await this.repo.markRunning(runUuid);

      const attempts: any[] = await (this.prisma as any).drillAttempt.findMany({
        where: { assignmentUuid: sourceAssignmentUuid },
        orderBy: { attemptNo: 'asc' },
      });

      const failed = extractFailedBlanks(assignment.items ?? [], attempts);

      if (failed.length === 0) {
        await this.repo.markNoErrors(runUuid);
        this.logger.log(
          `Analysis: assignment=${sourceAssignmentUuid} no errors, no model call (correlationId=${correlationId})`,
        );
        return;
      }

      const allowed = await this.taxonomy.slugsFor(assignment.languageCode);

      const response = await this.client.analyze({
        languageCode: assignment.languageCode,
        materialLanguage: assignment.materialLanguage,
        level: assignment.level ?? null,
        allowedTopicSlugs: allowed,
        failures: failed.map((blank) => ({
          answer: blank.answer,
          sentence: blank.sentence,
          prompt: blank.prompt,
          wrongAttempts: blank.wrongAttempts,
          revealed: blank.revealed,
          mistakeCount: blank.mistakeCount,
        })),
        correlationId,
      });

      const clusters = this.attribute(
        response.clusters ?? [],
        failed,
        allowed,
        assignment.languageCode,
      );

      await this.repo.replaceClusters(
        runUuid,
        sourceAssignmentUuid,
        assignment.studentId,
        assignment.languageCode,
        assignment.materialLanguage,
        clusters,
      );
      await this.repo.markReady(runUuid);

      this.logger.log(
        `Analysis ready: assignment=${sourceAssignmentUuid} failures=${failed.length} clusters=${clusters.length} ms=${Date.now() - started} correlationId=${correlationId}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Analysis failed: assignment=${sourceAssignmentUuid} correlationId=${correlationId} — ${message}`,
      );

      if (runUuid) {
        try {
          await this.repo.markFailed(runUuid, message);
        } catch (writeError) {
          // The run row cannot even record its own failure. Nothing further can be done
          // here, but it must not be invisible: without this line the analysis simply
          // stops with the row stuck on RUNNING and no explanation anywhere.
          this.logger.error(
            `Analysis failure could not be recorded: assignment=${sourceAssignmentUuid} — ${
              writeError instanceof Error ? writeError.message : String(writeError)
            }`,
          );
        }
      }
    }
  }

  /**
   * Attaches each failed answer to exactly one cluster.
   *
   * The model is asked to cover every answer exactly once and usually does, but a
   * generated list is not a guarantee. Three rules make the result trustworthy regardless:
   * an answer claimed twice goes to the first claimant, an answer claimed by nobody goes
   * to the language fallback, and a cluster left holding nothing is dropped.
   *
   * Without the second rule a dropped answer would silently never be drilled again — the
   * exact gap this feature exists to close.
   */
  private attribute(
    raw: AnalyzedGapCluster[],
    failed: FailedBlank[],
    allowed: string[],
    languageCode: string,
  ): PersistableCluster[] {
    const options = gradingOptionsFor(languageCode);

    // Failed blanks collapsed per answer: the same word wrong in two sentences is one
    // entry whose mistakeCount is the sum, because it earns that many remedial sentences.
    const byNormalized = new Map<string, PersistedFailedAnswer>();
    for (const blank of failed) {
      const normalized = normalizeAnswer(blank.answer, options);
      const existing = byNormalized.get(normalized);
      if (existing) {
        existing.mistakeCount += blank.mistakeCount;
        existing.wrongAttempts.push(...blank.wrongAttempts);
      } else {
        byNormalized.set(normalized, {
          answer: blank.answer,
          normalized,
          mistakeCount: blank.mistakeCount,
          wrongAttempts: [...blank.wrongAttempts],
        });
      }
    }

    const unclaimed = new Set(byNormalized.keys());
    const clusters: PersistableCluster[] = [];

    for (const candidate of raw) {
      const { slug, coerced } = this.taxonomy.coerceSlug(candidate.topicSlug, allowed, languageCode);
      if (coerced) {
        this.logger.warn(
          `Analysis produced an out-of-taxonomy slug "${candidate.topicSlug}" for ${languageCode}; filed under ${slug}`,
        );
      }

      const claimed: PersistedFailedAnswer[] = [];
      for (const answer of candidate.answers ?? []) {
        const normalized = normalizeAnswer(answer, options);
        if (!unclaimed.has(normalized)) {
          continue;
        }
        unclaimed.delete(normalized);
        claimed.push(byNormalized.get(normalized)!);
      }

      if (claimed.length === 0) {
        // Nothing left for it after de-duplication. Storing it would show the student an
        // explanation with no mistakes attached.
        continue;
      }

      clusters.push({
        topicSlug: slug,
        title: candidate.title,
        explanation: candidate.explanation,
        rules: candidate.rules ?? [],
        examples: candidate.examples ?? [],
        failedAnswers: claimed,
      });
    }

    if (unclaimed.size > 0) {
      const leftovers = [...unclaimed].map((key) => byNormalized.get(key)!);
      this.logger.warn(
        `Analysis left ${leftovers.length} answer(s) unclustered; filing under the fallback topic: ${leftovers
          .map((a) => a.answer)
          .join(', ')}`,
      );

      const fallbackSlug = this.taxonomy.fallbackSlug(languageCode);
      const existing = clusters.find((c) => c.topicSlug === fallbackSlug);
      if (existing) {
        existing.failedAnswers.push(...leftovers);
      } else {
        clusters.push({
          topicSlug: fallbackSlug,
          title: '',
          explanation: '',
          rules: [],
          examples: [],
          failedAnswers: leftovers,
        });
      }
    }

    return clusters;
  }
}
