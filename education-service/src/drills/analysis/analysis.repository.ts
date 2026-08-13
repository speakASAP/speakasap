import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AnalysisRunRecord,
  AnalysisRunStatus,
  ClusterPatch,
  GapClusterRecord,
  PersistableCluster,
} from './contracts';

/**
 * Persistence for `DrillAnalysisRun` and `DrillGapAnalysis`.
 *
 * The run row exists so a failed analysis is a state rather than an absence. Without it,
 * "no clusters" would mean both "the student made no mistakes" and "the analyzer died" —
 * and the second would render as the first, which is exactly the silent failure this
 * feature must not have.
 */
@Injectable()
export class AnalysisRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The run for one assignment, created if it does not exist.
   *
   * Idempotent because completion can be reached more than once in practice — a retried
   * request, a re-delivered job — and a second run row would orphan the first's clusters.
   */
  async createRun(sourceAssignmentUuid: string, studentId: number): Promise<string> {
    const existing: any = await (this.prisma as any).drillAnalysisRun.findUnique({
      where: { sourceAssignmentUuid },
    });
    if (existing) {
      return existing.uuid as string;
    }

    const uuid = randomUUID();
    await (this.prisma as any).drillAnalysisRun.create({
      data: {
        uuid,
        sourceAssignmentUuid,
        studentId,
        status: 'PENDING' as AnalysisRunStatus,
        attemptCount: 0,
      },
    });
    return uuid;
  }

  /** RUNNING, and one more attempt on the clock. */
  async markRunning(runUuid: string): Promise<void> {
    await (this.prisma as any).drillAnalysisRun.update({
      where: { uuid: runUuid },
      data: {
        status: 'RUNNING' as AnalysisRunStatus,
        startedAt: new Date(),
        finishedAt: null,
        attemptCount: { increment: 1 },
      },
    });
  }

  async markReady(runUuid: string): Promise<void> {
    await this.finish(runUuid, 'READY', null);
  }

  async markNoErrors(runUuid: string): Promise<void> {
    await this.finish(runUuid, 'NO_ERRORS', null);
  }

  async markFailed(runUuid: string, message: string): Promise<void> {
    await this.finish(runUuid, 'FAILED', message);
  }

  /**
   * Writes this run's clusters, replacing any from a previous attempt.
   *
   * Delete-then-create rather than upsert: a retry may produce a different clustering
   * entirely, and leaving the old rows behind would show the student two contradictory
   * explanations of the same mistakes.
   */
  async replaceClusters(
    runUuid: string,
    sourceAssignmentUuid: string,
    studentId: number,
    languageCode: string,
    materialLanguage: string,
    clusters: PersistableCluster[],
  ): Promise<void> {
    await (this.prisma as any).$transaction(async (tx: any) => {
      await tx.drillGapAnalysis.deleteMany({ where: { runUuid } });

      for (const cluster of clusters) {
        await tx.drillGapAnalysis.create({
          data: {
            uuid: randomUUID(),
            runUuid,
            sourceAssignmentUuid,
            studentId,
            topicSlug: cluster.topicSlug,
            languageCode,
            materialLanguage,
            title: cluster.title,
            explanation: cluster.explanation,
            rules: cluster.rules,
            examples: cluster.examples,
            failedAnswers: cluster.failedAnswers,
          },
        });
      }
    });
  }

  /** The run and its clusters, or null when the assignment has never been analyzed. */
  async getRunWithClusters(sourceAssignmentUuid: string): Promise<AnalysisRunRecord | null> {
    const row: any = await (this.prisma as any).drillAnalysisRun.findUnique({
      where: { sourceAssignmentUuid },
      include: { clusters: { orderBy: { topicSlug: 'asc' } } },
    });
    if (!row) {
      return null;
    }

    return {
      uuid: row.uuid,
      sourceAssignmentUuid: row.sourceAssignmentUuid,
      studentId: row.studentId,
      status: row.status as AnalysisRunStatus,
      errorMessage: row.errorMessage ?? null,
      attemptCount: row.attemptCount ?? 0,
      startedAt: row.startedAt ?? null,
      finishedAt: row.finishedAt ?? null,
      clusters: (row.clusters ?? []).map(toClusterRecord),
    };
  }

  async getCluster(uuid: string): Promise<GapClusterRecord | null> {
    const row: any = await (this.prisma as any).drillGapAnalysis.findUnique({ where: { uuid } });
    return row ? toClusterRecord(row) : null;
  }

  /** A teacher's edit. Only the named fields change; the rest keep the model's version. */
  async updateCluster(
    uuid: string,
    patch: ClusterPatch,
    teacherId: number,
  ): Promise<GapClusterRecord> {
    const data: Record<string, unknown> = {
      editedByTeacherId: teacherId,
      editedAt: new Date(),
    };
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.explanation !== undefined) data.explanation = patch.explanation;
    if (patch.rules !== undefined) data.rules = patch.rules;
    if (patch.examples !== undefined) data.examples = patch.examples;

    const row: any = await (this.prisma as any).drillGapAnalysis.update({
      where: { uuid },
      data,
    });
    if (!row) {
      throw new NotFoundException('Gap analysis not found');
    }
    return toClusterRecord(row);
  }

  private async finish(
    runUuid: string,
    status: AnalysisRunStatus,
    errorMessage: string | null,
  ): Promise<void> {
    await (this.prisma as any).drillAnalysisRun.update({
      where: { uuid: runUuid },
      data: { status, errorMessage, finishedAt: new Date() },
    });
  }
}

function toClusterRecord(row: any): GapClusterRecord {
  return {
    uuid: row.uuid,
    runUuid: row.runUuid,
    sourceAssignmentUuid: row.sourceAssignmentUuid,
    studentId: row.studentId,
    topicSlug: row.topicSlug,
    languageCode: row.languageCode,
    materialLanguage: row.materialLanguage,
    title: row.title,
    explanation: row.explanation,
    rules: Array.isArray(row.rules) ? row.rules : [],
    examples: Array.isArray(row.examples) ? row.examples : [],
    failedAnswers: Array.isArray(row.failedAnswers) ? row.failedAnswers : [],
    editedByTeacherId: row.editedByTeacherId ?? null,
    editedAt: row.editedAt ?? null,
    createdAt: row.createdAt,
  };
}
