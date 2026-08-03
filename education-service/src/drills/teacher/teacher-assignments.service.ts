import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignmentsRepository } from '../assignments.repository';
import { toAssignmentDTO } from '../assignment.mapper';
import { NotificationsHook } from '../notifications.hook';
import { ContentClient } from '../orchestration/content.client';
import { JobRunner } from '../orchestration/job-runner.service';
import {
  AssignFromSetRequest,
  AssignFromSetResponse,
  DrillAssignmentDTO,
  GenerateAssignmentsRequest,
  GenerateAssignmentsResponse,
} from '../contracts';

/** Matches the wizard's bound and the plan's stated 1..200 range. */
const MIN_ITEM_COUNT = 1;
const MAX_ITEM_COUNT = 200;

/** Where the student is in their course, for the bank's lesson ceiling. */
export interface StudentProgressReader {
  getStudentProgress(
    studentId: number,
  ): Promise<{ courseKey: string | null; lessonOrder: number | null }>;
}

/**
 * The teacher's write path: create drilling for students.
 *
 * Two entry points, deliberately separate. `generate` mints a set uuid and hands the
 * pipeline the work of filling it — the assignments exist in GENERATING before a single
 * sentence does, so the teacher can watch progress and the student's list shows that
 * something is coming. `assignFromSet` skips all of that for a set that already exists
 * and has already been approved.
 *
 * The two differ in one way that matters: `generate` does NOT notify. The set has no
 * items and no teacher has approved it, so "your teacher assigned you work" would be a
 * lie the student could click on. The notification fires from `assignFromSet`, and from
 * the approve path once a generated set becomes real work.
 */
@Injectable()
export class TeacherAssignmentsService {
  private readonly logger = new Logger(TeacherAssignmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: AssignmentsRepository,
    private readonly content: ContentClient,
    private readonly jobs: JobRunner,
    private readonly progress: StudentProgressReader,
    private readonly notifications: NotificationsHook,
  ) {}

  /**
   * Creates one GENERATING assignment per student and queues the pipeline.
   *
   * Returns as soon as the rows exist. Generation takes tens of seconds to minutes and
   * `JobRunner.enqueue` is deliberately fire-and-forget, so blocking here would hold a
   * teacher's request open for the length of a model call.
   */
  async generate(
    teacherId: number,
    request: GenerateAssignmentsRequest,
    token: string,
  ): Promise<GenerateAssignmentsResponse> {
    const studentIds = this.validStudentIds(request.studentIds);

    if (!Number.isInteger(request.count) ||
        request.count < MIN_ITEM_COUNT ||
        request.count > MAX_ITEM_COUNT) {
      throw new BadRequestException(
        `count must be an integer between ${MIN_ITEM_COUNT} and ${MAX_ITEM_COUNT}`,
      );
    }

    const hasSubject =
      (request.topicSlugs?.length ?? 0) > 0 || (request.instructions ?? '').trim().length > 0;
    if (!hasSubject) {
      throw new BadRequestException('Provide at least one topic or non-empty instructions');
    }

    // Resolved before any row is written: a set filed under the wrong language surfaces
    // in another language's library, and failing the request is recoverable where that
    // is not.
    const languageId = await this.content.resolveLanguageId(request.languageCode, token);

    // The lesson ceiling is per student, but the set is shared. The lowest ceiling wins,
    // so no student in the batch is shown material they have not reached — the
    // alternative leaks a later lesson's vocabulary to whoever is furthest behind.
    const ceilings = await Promise.all(
      studentIds.map((studentId) => this.progress.getStudentProgress(studentId)),
    );
    const lessonOrders = ceilings
      .map((where) => where?.lessonOrder)
      .filter((order): order is number => typeof order === 'number');
    const maxLessonOrder = lessonOrders.length > 0 ? Math.min(...lessonOrders) : null;
    const courseKey = ceilings.find((where) => where?.courseKey)?.courseKey ?? null;

    const setUuid = randomUUID();
    const batchUuid = randomUUID();
    const title = this.titleFor(request);
    const correlationId = randomUUID();

    const assignmentUuids = studentIds.map(() => randomUUID());

    await this.prisma.$transaction(async (tx: any) => {
      await tx.drillAssignmentBatch.create({
        data: {
          uuid: batchUuid,
          teacherId,
          instructions: request.instructions ?? '',
          filter: {
            topicSlugs: request.topicSlugs ?? [],
            level: request.level ?? null,
            count: request.count,
            languageCode: request.languageCode,
            materialLanguage: request.materialLanguage,
          },
        },
      });

      await tx.drillAssignment.createMany({
        data: studentIds.map((studentId, index) => ({
          uuid: assignmentUuids[index],
          setUuid,
          studentId,
          teacherId,
          origin: 'TEACHER',
          lessonUuid: request.lessonUuid ?? null,
          batchUuid,
          title,
          languageCode: request.languageCode,
          materialLanguage: request.materialLanguage,
          status: 'GENERATING',
          dueAt: request.dueAt ? new Date(request.dueAt) : null,
          resourceLinks: [],
          generationProgress: {
            phase: 'RESOLVING',
            generated: 0,
            total: request.count,
            etaSeconds: null,
            message: 'Queued',
            stalled: false,
          },
        })),
      });
    });

    this.jobs.enqueue(assignmentUuids, {
      setUuid,
      assignmentUuids,
      languageCode: request.languageCode,
      materialLanguage: request.materialLanguage,
      languageId,
      level: request.level ?? null,
      topicSlugs: request.topicSlugs ?? [],
      topics: (request.topicSlugs ?? []).map((slug) => ({ slug, title: slug })),
      instructions: request.instructions ?? '',
      itemCount: request.count,
      courseKey,
      maxLessonOrder,
      teacherId,
      title,
      token,
      correlationId,
    });

    this.logger.log(
      `Drill generation queued: set=${setUuid} batch=${batchUuid} teacher=${teacherId} students=${studentIds.length} count=${request.count} correlationId=${correlationId}`,
    );

    return { assignmentUuids, setUuid, batchUuid };
  }

  /**
   * Assigns an existing set to students, skipping generation entirely.
   *
   * The set must be APPROVED. An unapproved set is one no human has read, and the whole
   * point of the review gate is that it stands between a model's output and a student —
   * reaching a student through this route instead would make the gate decorative.
   */
  async assignFromSet(
    teacherId: number,
    request: AssignFromSetRequest,
    token: string,
  ): Promise<AssignFromSetResponse> {
    const studentIds = this.validStudentIds(request.studentIds);
    if (!request.setUuid) {
      throw new BadRequestException('setUuid is required');
    }

    const set = await this.content.getSet(request.setUuid, token);
    if (!set) {
      throw new NotFoundException('Drill set not found');
    }
    if (set.reviewState !== 'APPROVED') {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'SET_NOT_APPROVED',
        message: 'This drill set has not been approved yet',
      });
    }

    const now = new Date();
    const created: string[] = [];

    for (const studentId of studentIds) {
      const assignmentUuid = randomUUID();
      await this.prisma.drillAssignment.create({
        data: {
          uuid: assignmentUuid,
          setUuid: request.setUuid,
          studentId,
          teacherId,
          origin: 'TEACHER',
          lessonUuid: request.lessonUuid ?? null,
          title: set.title,
          languageCode: set.languageCode,
          materialLanguage: set.materialLanguage,
          status: 'ASSIGNED',
          assignedAt: now,
          dueAt: request.dueAt ? new Date(request.dueAt) : null,
          resourceLinks: (set as any).resourceLinks ?? [],
          items: {
            create: (set.items ?? []).map((setItem: any, index: number) => ({
              uuid: randomUUID(),
              order: typeof setItem.order === 'number' ? setItem.order : index,
              sourceItemId: setItem.item?.id ?? setItem.id ?? null,
              template: setItem.item?.template ?? setItem.template,
              blanks: setItem.item?.blanks ?? setItem.blanks,
              hint: setItem.item?.hint ?? setItem.hint ?? null,
              topicSlug: setItem.item?.topicSlug ?? setItem.topicSlug ?? null,
            })),
          },
        },
      });
      created.push(assignmentUuid);
    }

    // After every row is committed. The hook is at-most-once per assignment and swallows
    // its own failures, so a dead notification service cannot undo work already done.
    for (const assignmentUuid of created) {
      await this.notifications.onAssigned(assignmentUuid);
    }

    this.logger.log(
      `Drill set assigned: set=${request.setUuid} teacher=${teacherId} students=${studentIds.length}`,
    );

    return { assignments: await this.toDTOs(created) };
  }

  /**
   * One assignment, for the teacher who owns it.
   *
   * This is what the wizard polls for `generationProgress`, so it must be readable while
   * the assignment is still GENERATING and has no items.
   */
  async getForTeacher(assignmentUuid: string, teacherId: number): Promise<DrillAssignmentDTO> {
    const row = await this.prisma.drillAssignment.findUnique({
      where: { uuid: assignmentUuid },
      include: { items: { select: { uuid: true } } },
    });
    // Same 404 for missing and not-yours, matching the runner: distinguishing them
    // confirms another teacher's assignment exists.
    if (!row || row.teacherId !== teacherId) {
      throw new NotFoundException('Drill assignment not found');
    }
    const counts = await this.assignments.countBlanks(assignmentUuid);
    return toAssignmentDTO(row, counts);
  }

  private async toDTOs(assignmentUuids: string[]): Promise<DrillAssignmentDTO[]> {
    const rows = await this.prisma.drillAssignment.findMany({
      where: { uuid: { in: assignmentUuids } },
      include: { items: { select: { uuid: true } } },
    });
    const counts = await this.assignments.countBlanksFor(assignmentUuids);
    return rows.map((row: any) => toAssignmentDTO(row, counts.get(row.uuid)!));
  }

  /**
   * Rejects an empty or duplicated student list.
   *
   * Duplicates matter: `createMany` would write two assignments for the same student
   * against one set, and the student would see the same homework twice with no way to
   * tell which one counts.
   */
  private validStudentIds(studentIds: number[] | undefined): number[] {
    const ids = studentIds ?? [];
    if (ids.length === 0) {
      throw new BadRequestException('At least one studentId is required');
    }
    if (!ids.every((id) => Number.isInteger(id) && id > 0)) {
      throw new BadRequestException('studentIds must be positive integers');
    }
    const unique = Array.from(new Set(ids));
    if (unique.length !== ids.length) {
      throw new BadRequestException('studentIds must not repeat');
    }
    return unique;
  }

  /** A title a teacher recognises in a list, derived from what they asked for. */
  private titleFor(request: GenerateAssignmentsRequest): string {
    const topics = request.topicSlugs ?? [];
    if (topics.length > 0) {
      return topics.slice(0, 3).join(', ').slice(0, 255);
    }
    const instructions = (request.instructions ?? '').trim();
    return (instructions.slice(0, 120) || 'Grammar practice').slice(0, 255);
  }
}
