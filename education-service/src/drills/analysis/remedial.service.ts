import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { JobRunner } from '../orchestration/job-runner.service';
import { ContentClient } from '../orchestration/content.client';
import { StudentProgressReader } from '../teacher/teacher-assignments.service';
import { AnalysisRepository } from './analysis.repository';
import { GapClusterRecord } from './contracts';
import { MasteryRepository } from './mastery.repository';
import { RemedialPart, composeRemedial } from './remedial-composition';

export interface RemedialCreationResult {
  assignmentUuids: string[];
  setUuid: string;
  /** True when an earlier, still-live remedial drill was returned instead of a new one. */
  reused: boolean;
}

/** Statuses that mean a remedial drill for this gap is still in play. */
const LIVE_STATUSES = ['GENERATING', 'PENDING_REVIEW', 'ASSIGNED', 'IN_PROGRESS'];

/**
 * Creates the "работа над ошибками" drill for one grammar gap.
 *
 * Teacher-initiated by design: the analysis runs for every completed drill, but only a
 * teacher decides that a gap is worth a second assignment. Generating one automatically on
 * every completion would spend a model call per finished drill whether or not anyone acts
 * on it.
 */
@Injectable()
export class RemedialService {
  private readonly logger = new Logger(RemedialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analysis: AnalysisRepository,
    private readonly mastery: MasteryRepository,
    private readonly content: ContentClient,
    private readonly jobs: JobRunner,
    private readonly progress: StudentProgressReader,
  ) {}

  async createForGap(
    gapUuid: string,
    teacherId: number,
    token: string,
  ): Promise<RemedialCreationResult> {
    const gap = await this.analysis.getCluster(gapUuid);
    if (!gap) {
      throw new NotFoundException('Gap analysis not found');
    }

    // Idempotence: a second click must not produce a second drill. Only live statuses
    // count — a revoked or cancelled drill leaves the gap open again.
    const existing: any[] = await (this.prisma as any).drillAssignment.findMany({
      where: { sourceAnalysisUuid: gapUuid, status: { in: LIVE_STATUSES } },
      select: { uuid: true, setUuid: true },
      orderBy: { remedialPart: 'asc' },
    });
    if (existing.length > 0) {
      this.logger.log(
        `Remedial drill already live for gap ${gapUuid}: returning ${existing.length} assignment(s)`,
      );
      return {
        assignmentUuids: existing.map((row) => row.uuid),
        setUuid: existing[0].setUuid,
        reused: true,
      };
    }

    const mastered = await this.mastery.masteredAnswers(
      gap.studentId,
      gap.languageCode,
      gap.failedAnswers.map((a) => a.normalized),
    );

    const parts = composeRemedial(gap.failedAnswers, mastered);
    if (parts.length === 0) {
      // Refusing beats generating ten sentences of pure padding: there is no gap left to
      // close, and the teacher should be told so rather than handed busywork.
      throw new BadRequestException({
        statusCode: 400,
        code: 'GAP_ALREADY_MASTERED',
        message: 'Every word in this gap is already mastered — there is nothing left to drill',
      });
    }

    const source: any = await (this.prisma as any).drillAssignment.findUnique({
      where: { uuid: gap.sourceAssignmentUuid },
    });
    if (!source) {
      throw new NotFoundException('Source assignment not found');
    }

    const languageId = await this.content.resolveLanguageId(gap.languageCode, token);
    const where = await this.progress.getStudentProgress(gap.studentId);

    const setUuid = randomUUID();
    const batchUuid = randomUUID();
    const assignmentUuids = parts.map(() => randomUUID());

    await (this.prisma as any).$transaction(async (tx: any) => {
      await tx.drillAssignmentBatch.create({
        data: {
          uuid: batchUuid,
          teacherId,
          instructions: gap.explanation,
          filter: {
            topicSlugs: [gap.topicSlug],
            remedialGapUuid: gapUuid,
            sourceAssignmentUuid: gap.sourceAssignmentUuid,
          },
        },
      });

      await tx.drillAssignment.createMany({
        data: parts.map((part, index) => ({
          uuid: assignmentUuids[index],
          setUuid,
          studentId: gap.studentId,
          teacherId,
          origin: 'REMEDIAL',
          lessonUuid: source.lessonUuid ?? null,
          studentCourseUuid: source.studentCourseUuid ?? null,
          batchUuid,
          sourceAnalysisUuid: gapUuid,
          remedialPart: parts.length > 1 ? part.part : null,
          title: this.titleFor(gap, part, parts.length),
          languageCode: gap.languageCode,
          materialLanguage: gap.materialLanguage,
          status: 'GENERATING',
          resourceLinks: [],
          generationProgress: {
            phase: 'RESOLVING',
            generated: 0,
            total: part.sentenceCount,
            etaSeconds: null,
            message: 'Queued',
            stalled: false,
          },
        })),
      });
    });

    parts.forEach((part, index) => {
      this.jobs.enqueue([assignmentUuids[index]], {
        setUuid,
        assignmentUuids: [assignmentUuids[index]],
        languageCode: gap.languageCode,
        materialLanguage: gap.materialLanguage,
        languageId,
        level: source.level ?? null,
        topicSlugs: [gap.topicSlug],
        topics: [{ slug: gap.topicSlug, title: gap.title || gap.topicSlug }],
        instructions: this.instructionsFor(gap, part),
        itemCount: part.sentenceCount,
        courseKey: where?.courseKey ?? null,
        maxLessonOrder: where?.lessonOrder ?? null,
        teacherId,
        title: this.titleFor(gap, part, parts.length),
        token,
        correlationId: randomUUID(),
      });
    });

    this.logger.log(
      `Remedial drill queued: gap=${gapUuid} topic=${gap.topicSlug} student=${gap.studentId} parts=${parts.length} teacher=${teacherId}`,
    );

    return { assignmentUuids, setUuid, reused: false };
  }

  private titleFor(gap: GapClusterRecord, part: RemedialPart, totalParts: number): string {
    const topic = gap.title || gap.topicSlug;
    const base = `Работа над ошибками: ${topic}`;
    return totalParts > 1 ? `${base} (часть ${part.part})` : base;
  }

  /**
   * The generator's brief for one part.
   *
   * The required answers carry their exact occurrence counts, because that is the whole
   * composition rule: a word missed three times must appear in three DIFFERENT sentences,
   * never the same one repeated. The padding request is stated separately so the generator
   * knows those sentences must test the same rule with other vocabulary — repeating the
   * error words to fill space would teach the words rather than the rule.
   */
  private instructionsFor(gap: GapClusterRecord, part: RemedialPart): string {
    const lines: string[] = [
      `This is a corrective drill ("работа над ошибками") for one student's specific mistakes.`,
      ``,
      `Grammar gap: ${gap.title || gap.topicSlug}`,
    ];

    if (gap.explanation) {
      lines.push(`The student has been given this explanation: ${gap.explanation}`);
    }

    lines.push(
      ``,
      `Each of these answers MUST be the blank in exactly the stated number of DIFFERENT sentences:`,
    );

    for (const required of part.requiredAnswers) {
      lines.push(`- "${required.answer}" — ${required.occurrences} sentence(s)`);
    }

    if (part.paddingCount > 0) {
      lines.push(
        ``,
        `Then add ${part.paddingCount} more sentence(s) testing the SAME grammar rule with DIFFERENT vocabulary — do not reuse the words listed above as the blank.`,
      );
    }

    lines.push(
      ``,
      `Never repeat a sentence. Every sentence must be usable on its own.`,
    );

    return lines.join('\n');
  }
}
