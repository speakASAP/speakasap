import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { assertTransition, TERMINAL_STATUSES } from '../state-machine';
import { blanksFor, validateSentence } from '../sentence-editing';
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
  DrillAssignmentStatus,
  GenerateAssignmentsRequest,
  GenerateAssignmentsResponse,
} from '../contracts';

/** Matches the wizard's bound and the plan's stated 1..200 range. */
/** Longest first sentence still readable as a drill name rather than a prompt. */
const TITLE_MAX_LENGTH = 60;
const MIN_ITEM_COUNT = 1;
const MAX_ITEM_COUNT = 200;

/** Where the student is in their course, for the bank's lesson ceiling. */
export interface StudentProgressReader {
  getStudentProgress(
    studentId: number,
  ): Promise<{ courseKey: string | null; lessonOrder: number | null }>;
}

/**
 * The one lesson field pair `generate` needs, narrowed from `LessonClientService`.
 *
 * Teacher-origin drilling is always created within a lesson, so the lesson itself
 * carries the ceiling: its `order` is the furthest point the batch may draw from, and
 * its `courseClass` names the course the material must belong to. Reading it here
 * replaced a per-student lookup against `prisma.studentCourse` / `prisma.lesson`, tables
 * this service dropped in 0853b09 — the call survived a compile check only because of an
 * `as any` cast and 500'd every generation from 2026-08-22 onward.
 */
export interface LessonCeilingReader {
  getLesson(lessonUuid: string): Promise<{ order: number; courseClass: string }>;
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
    private readonly lessons: LessonCeilingReader,
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

    // The ceiling is the lesson the teacher is assigning FROM, read from the portal.
    //
    // It used to be the lowest per-student ceiling across the batch, computed from this
    // service's own `StudentCourse`/`Lesson` tables. Those tables were copies of the
    // portal's, frozen since 2026-06-26, and were dropped in 0853b09; the reads survived
    // compilation behind an `as any` cast and then threw
    // `Cannot read properties of undefined (reading 'findFirst')` on every generation.
    //
    // The lesson is the better source regardless of that history: the set is shared by
    // the whole batch and the teacher picked one lesson for it, so the lesson's own order
    // is the bound they intended. Not fail-soft — a lesson that cannot be read fails the
    // request, because a null ceiling would silently widen the bank to material the
    // students have not reached.
    const lesson = await this.lessons.getLesson(request.lessonUuid);
    const maxLessonOrder = typeof lesson.order === 'number' ? lesson.order : null;
    const courseKey = lesson.courseClass || null;

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
      instructions: this.briefFor(request),
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
  /**
   * `teacherIds` is a list because the same teacher exists under two ids: the legacy
   * Teacher profile pk that `Lesson.teacherId` and new assignments carry (182), and the
   * legacy user id the caller's JWT resolves to (3). This service cannot map one to the
   * other — `employees_teacher` lives in the portal's database — so ownership accepts
   * either rather than 404ing a teacher out of their own review screen.
   */
  /**
   * Deliver an approved set to the students it was generated for.
   *
   * Generation creates the assignment rows and puts the sentences on the **set**; nothing
   * ever copied them onto the assignments, so approving left rows in PENDING_REVIEW with
   * zero items and the student received nothing. `assignFromSet` does copy items, but
   * only while creating new rows — a different flow, for reusing a set later.
   *
   * Idempotent by construction: only PENDING_REVIEW rows are touched, so re-approving
   * cannot re-deliver a drill a student has already started.
   */
  async assignApprovedSet(setUuid: string, teacherId: number, token: string): Promise<number> {
    const set: any = await this.content.getSet(setUuid, token);
    const items: any[] = set?.items ?? [];

    if (items.length === 0) {
      // An assignment with no items looks identical to a finished one in the runner, so
      // refusing here beats delivering an empty drill.
      throw new BadRequestException(`Set ${setUuid} has no items to assign`);
    }

    const pending = await this.prisma.drillAssignment.findMany({
      where: { setUuid, status: 'PENDING_REVIEW' },
      select: { uuid: true, studentId: true },
    });

    if (pending.length === 0) {
      this.logger.log(`Approved set ${setUuid}: no pending assignments to deliver`);
      return 0;
    }

    const now = new Date();
    for (const assignment of pending) {
      await this.prisma.drillAssignment.update({
        where: { uuid: assignment.uuid },
        data: {
          status: 'ASSIGNED',
          assignedAt: now,
          items: {
            create: items.map((setItem: any, index: number) => ({
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
      this.logger.log(
        `Assigned ${assignment.uuid} to student ${assignment.studentId}: ${items.length} items from set ${setUuid} (teacher ${teacherId})`,
      );
    }

    // Generate-then-approve is the primary path a teacher takes, and it delivered
    // silently until now: only `assignSet` (reusing an existing set) ever called the
    // hook, so every assignment created through the wizard reached the student with no
    // email at all. After the loop, for the same reason as there — the rows are already
    // committed, and the hook is at-most-once and swallows its own failures.
    // Generate-then-approve is the primary path a teacher takes, and it delivered
    // silently until now: only `assignSet` (reusing an existing set) ever called the
    // hook, so every assignment created through the wizard reached the student with no
    // email at all. After the loop, for the same reason as there — the rows are already
    // committed, and the hook is at-most-once and swallows its own failures.
    for (const assignment of pending) {
      await this.notifications.onAssigned(assignment.uuid);
    }

    return pending.length;
  }

  /**
   * Revoke an assignment: take a drill back before, or while, a student works on it.
   *
   * `assertTransition` is the authority on what may be revoked — it already permits
   * `-> CANCELLED` from every non-terminal state and refuses COMPLETED, where the student
   * has done the work and undoing it is not this action's business.
   *
   * `teacherIds` carries both id spaces for the same reason as `getForTeacher`: rows
   * created before the lesson-teacher fix hold the legacy user id, newer ones the Teacher
   * profile pk.
   */
  async revokeAssignment(assignmentUuid: string, teacherIds: number | number[]): Promise<void> {
    const allowed = (Array.isArray(teacherIds) ? teacherIds : [teacherIds]).filter(
      (id): id is number => Number.isInteger(id),
    );

    const row = await this.prisma.drillAssignment.findUnique({
      where: { uuid: assignmentUuid },
      select: { uuid: true, teacherId: true, status: true },
    });

    // Same 404 for missing and not-yours, matching getForTeacher: distinguishing them
    // confirms another teacher's assignment exists.
    if (!row || row.teacherId === null || !allowed.includes(row.teacherId)) {
      throw new NotFoundException('Drill assignment not found');
    }

    assertTransition(row.status as DrillAssignmentStatus, 'CANCELLED');

    await this.prisma.drillAssignment.update({
      where: { uuid: assignmentUuid },
      data: { status: 'CANCELLED' },
    });

    this.logger.log(`Revoked assignment ${assignmentUuid} (was ${row.status})`);
  }

  /**
   * One assignment as the teacher needs to see it: every blank, its answer, whether the
   * student solved it, and what they typed when they did not.
   *
   * Teacher-only, and it DOES carry answers — that is the point. The runner payload is
   * deliberately answer-free, and `getForTeacher` returns counts, so neither can answer
   * "what is finished and what are the errors there".
   *
   * A revealed blank is reported as `revealed`, never as `solved`: an answer the student
   * was shown is not something they knew.
   */
  async progressForTeacher(
    assignmentUuid: string,
    teacherIds: number | number[],
  ): Promise<any> {
    const allowed = (Array.isArray(teacherIds) ? teacherIds : [teacherIds]).filter(
      (id): id is number => Number.isInteger(id),
    );

    const row: any = await this.prisma.drillAssignment.findUnique({
      where: { uuid: assignmentUuid },
      include: { items: { orderBy: { order: 'asc' } } },
    });

    if (!row || row.teacherId === null || !allowed.includes(row.teacherId)) {
      throw new NotFoundException('Drill assignment not found');
    }

    const attempts: any[] = await (this.prisma as any).drillAttempt.findMany({
      where: { assignmentUuid },
      orderBy: { attemptNo: 'asc' },
    });

    const byBlank = new Map<string, any[]>();
    for (const attempt of attempts) {
      const key = `${attempt.itemUuid}:${attempt.blankIndex}`;
      const list = byBlank.get(key);
      if (list) {
        list.push(attempt);
      } else {
        byBlank.set(key, [attempt]);
      }
    }

    const items = (row.items ?? []).map((item: any) => ({
      uuid: item.uuid,
      order: item.order,
      template: item.template,
      hint: item.hint ?? null,
      blanks: (item.blanks ?? []).map((blank: any) => {
        const tries = byBlank.get(`${item.uuid}:${blank.index}`) ?? [];
        const revealed = tries.some((t) => t.revealed);
        return {
          index: blank.index,
          prompt: blank.prompt,
          answer: blank.answer,
          solved: tries.some((t) => t.isCorrect),
          revealed,
          attemptCount: tries.length,
          // Only the wrong ones, in the order the student tried them — the shape of the
          // mistakes is what a teacher acts on.
          wrongAttempts: tries.filter((t) => !t.isCorrect && !t.revealed).map((t) => t.submittedValue),
        };
      }),
    }));

    return {
      uuid: row.uuid,
      title: row.title,
      status: row.status,
      studentId: row.studentId,
      lessonUuid: row.lessonUuid ?? null,
      createdAt: row.createdAt,
      items,
    };
  }

  /**
   * The assignment a teacher is allowed to edit, or a 404.
   *
   * Ownership matches `progressForTeacher` exactly, including the 404-not-403: a teacher
   * must not be able to discover that another teacher's assignment exists by the shape
   * of the error.
   *
   * Terminal statuses are refused separately. COMPLETED and CANCELLED have no outgoing
   * edges in the state machine, so an edit could not put the assignment back in front of
   * the student — it would silently rewrite finished history while leaving the student's
   * recorded result describing questions that no longer exist.
   */
  private async assertEditableAssignment(
    assignmentUuid: string,
    teacherIds: number[],
  ): Promise<{ uuid: string; status: string; items: { uuid: string; order: number }[] }> {
    const allowed = teacherIds.filter((id): id is number => Number.isInteger(id));

    const row: any = await this.prisma.drillAssignment.findUnique({
      where: { uuid: assignmentUuid },
      include: { items: { orderBy: { order: 'asc' } } },
    });

    if (!row || row.teacherId === null || !allowed.includes(row.teacherId)) {
      throw new NotFoundException('Drill assignment not found');
    }

    if (TERMINAL_STATUSES.has(row.status as DrillAssignmentStatus)) {
      throw new ConflictException(
        `This assignment is ${String(row.status).toLowerCase()} and can no longer be changed.`,
      );
    }

    return row;
  }

  /**
   * The sentence, or a 400 naming every reason it cannot be saved.
   *
   * Identical rules to content-service's set editing, from the same shared module —
   * a sentence one service accepts and the other rejects is the failure this prevents.
   */
  private assertValidSentence(raw: string): string {
    const template = (raw ?? '').trim();
    const issues = validateSentence(template);
    if (issues.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: issues.map((issue) => issue.message).join(' '),
        validationIssues: issues,
      });
    }
    return template;
  }

  /**
   * Edits one sentence of a live assignment.
   *
   * A template change resets that sentence's attempts. They were graded against the old
   * blanks, so keeping them would show the student's progress against a question they
   * were never asked — a "solved" badge for an answer they never gave. Only this
   * sentence is affected; every other sentence's progress is untouched.
   *
   * A hint-only change leaves attempts alone: the question is unchanged, so the answers
   * to it are still answers to it.
   */
  async updateAssignmentItem(
    itemUuid: string,
    patch: { template?: string; hint?: string | null },
    teacherIds: number[],
  ): Promise<void> {
    // Validated before anything opens a transaction, so a rejected sentence cannot
    // leave attempts deleted behind it.
    const template =
      patch.template === undefined ? undefined : this.assertValidSentence(patch.template);

    const existing: any = await this.prisma.drillAssignmentItem.findUnique({
      where: { uuid: itemUuid },
    });
    if (!existing) {
      throw new NotFoundException('Drill sentence not found');
    }

    await this.assertEditableAssignment(existing.assignmentUuid, teacherIds);

    await this.prisma.$transaction(async (tx: any) => {
      const data: Record<string, unknown> = {};

      if (template !== undefined) {
        // Written together, always: `blanksTotal` is summed from this column, and a
        // template whose blanks disagree with it leaves the assignment uncompletable —
        // which in turn blocks the student from self-drilling forever.
        data.template = template;
        data.blanks = blanksFor(template);
      }
      if (patch.hint !== undefined) {
        data.hint = patch.hint;
      }

      await tx.drillAssignmentItem.update({ where: { uuid: itemUuid }, data });

      if (template !== undefined) {
        const removed = await tx.drillAttempt.deleteMany({ where: { itemUuid } });
        this.logger.log(
          `Teacher edited sentence ${itemUuid} of assignment ${existing.assignmentUuid}; ` +
            `removed ${removed?.count ?? 0} attempt(s) graded against the old text`,
        );
      } else {
        this.logger.log(`Teacher edited the hint of sentence ${itemUuid}`);
      }
    });
  }

  /**
   * Removes one sentence from a live assignment, with its attempts, and closes the gap
   * in `order` so the screens do not skip a "Sentence N".
   */
  async deleteAssignmentItem(itemUuid: string, teacherIds: number[]): Promise<void> {
    const existing: any = await this.prisma.drillAssignmentItem.findUnique({
      where: { uuid: itemUuid },
    });
    if (!existing) {
      throw new NotFoundException('Drill sentence not found');
    }

    const assignment = await this.assertEditableAssignment(existing.assignmentUuid, teacherIds);
    const items = assignment.items ?? [];

    if (items.length <= 1) {
      // An assignment with no sentences is work the student cannot do and cannot
      // complete. Cancelling the assignment is the operation that means that.
      throw new BadRequestException(
        'An assignment needs at least one sentence. Cancel the assignment instead.',
      );
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.drillAttempt.deleteMany({ where: { itemUuid } });
      await tx.drillAssignmentItem.delete({ where: { uuid: itemUuid } });

      for (const row of items) {
        if (row.order > existing.order) {
          await tx.drillAssignmentItem.update({
            where: { uuid: row.uuid },
            data: { order: row.order - 1 },
          });
        }
      }
    });

    this.logger.log(
      `Teacher removed sentence ${itemUuid} from assignment ${existing.assignmentUuid}`,
    );
  }

  /** Appends a teacher-written sentence to a live assignment. */
  async addAssignmentItem(
    assignmentUuid: string,
    input: { template: string; hint: string | null },
    teacherIds: number[],
  ): Promise<void> {
    const template = this.assertValidSentence(input.template);
    const assignment = await this.assertEditableAssignment(assignmentUuid, teacherIds);

    const orders = (assignment.items ?? []).map((row) => row.order);
    const nextOrder = orders.length === 0 ? 0 : Math.max(...orders) + 1;

    await this.prisma.drillAssignmentItem.create({
      data: {
        uuid: randomUUID(),
        assignmentUuid,
        order: nextOrder,
        template,
        // `as any` for Prisma's Json input type, which does not accept a typed array
        // directly — the same cast the generation path uses for this column.
        blanks: blanksFor(template) as any,
        hint: input.hint,
      },
    });

    this.logger.log(
      `Teacher added a sentence to assignment ${assignmentUuid} at position ${nextOrder}`,
    );
  }

  /**
   * The assignment a sentence belongs to, for routes addressed by sentence uuid.
   * Null when no such sentence exists — the caller turns that into a 404.
   */
  async assignmentUuidForItem(itemUuid: string): Promise<string | null> {
    const row = await this.prisma.drillAssignmentItem.findUnique({
      where: { uuid: itemUuid },
      select: { assignmentUuid: true },
    });
    return row?.assignmentUuid ?? null;
  }

  /** The lesson an assignment belongs to, for resolving which teacher owns it. */
  async lessonUuidFor(assignmentUuid: string): Promise<string | null> {
    const row = await this.prisma.drillAssignment.findUnique({
      where: { uuid: assignmentUuid },
      select: { lessonUuid: true },
    });
    return row?.lessonUuid ?? null;
  }

  async getForTeacher(
    assignmentUuid: string,
    teacherIds: number | number[],
  ): Promise<DrillAssignmentDTO> {
    const allowed = (Array.isArray(teacherIds) ? teacherIds : [teacherIds]).filter(
      (id): id is number => Number.isInteger(id),
    );
    const row = await this.prisma.drillAssignment.findUnique({
      where: { uuid: assignmentUuid },
      include: { items: { select: { uuid: true } } },
    });
    // Same 404 for missing and not-yours, matching the runner: distinguishing them
    // confirms another teacher's assignment exists.
    if (!row || row.teacherId === null || !allowed.includes(row.teacherId)) {
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
  /**
   * The name every teacher and student sees in every list.
   *
   * The teacher's own words come first. Topic slugs used to win, which turned a drill a
   * teacher had named "тренировка на прошедшее время со словарным запасом уровня B2"
   * into "прошедшее-время, настоящее-время, словарыи-запас-в1" — machinery, not a name.
   * Slugs are the fallback for a teacher who chose topics and wrote nothing.
   */
  /**
   * The name the teacher and the student read in every list.
   *
   * The teacher's own words win when they read as a NAME — "тренировка на прошедшее
   * время" beats the slug "proshedshee-vremya", which is machinery. But instructions are
   * often a prompt, not a title, and slicing one at 120 characters produced
   * "…Человек должен вводить то" — cut mid-word and shown to the student as the drill's
   * name.
   *
   * So: take the first sentence if it is short enough to be a name, otherwise fall back
   * to the topics. Never truncate — a cut title is worse than a generic one, because it
   * looks like the system broke rather than like a label.
   */
  private titleFor(request: GenerateAssignmentsRequest): string {
    const instructions = (request.instructions ?? '').trim();
    const name = this.nameFromInstructions(instructions);
    if (name) {
      return name;
    }

    const topics = request.topicSlugs ?? [];
    if (topics.length > 0) {
      return topics.slice(0, 3).join(', ').slice(0, 255);
    }
    return 'Grammar practice';
  }

  /**
   * The brief the generator is given — never empty.
   *
   * A teacher who picks topics and types nothing is a supported request here (see the
   * `hasSubject` check in `generate`), but ai-microservice validates `instructions` with
   * `@IsNotEmpty`, so forwarding the empty string failed the whole generation with
   * `400 instructions should not be empty` (production, 2026-08-14).
   *
   * The topics are the teacher's stated subject, so they are what the brief is derived
   * from. This is the generator's copy only — `drillAssignmentBatch.instructions` keeps
   * the teacher's verbatim text (empty when they wrote nothing), because that row is the
   * record of what was asked for, not of what the model was told.
   */
  private briefFor(request: GenerateAssignmentsRequest): string {
    const instructions = (request.instructions ?? '').trim();
    if (instructions) {
      return instructions;
    }

    const topics = request.topicSlugs ?? [];
    if (topics.length > 0) {
      return `Drill these grammar topics: ${topics.join(', ')}.`;
    }

    // Unreachable: `generate` rejects a request with neither. Kept because an empty
    // string here is a 400 from the generator, and a generic brief is recoverable
    // where that is not.
    return 'General grammar practice at the requested level.';
  }

  /**
   * The first sentence of `instructions`, but only when it is short enough to pass as a
   * title. Returns null when the teacher wrote a paragraph rather than a name.
   */
  private nameFromInstructions(instructions: string): string | null {
    if (!instructions) {
      return null;
    }

    // First sentence, by the terminator the teacher actually typed.
    const firstSentence = instructions.split(/[.!?\n]/)[0].trim();
    if (!firstSentence) {
      return null;
    }

    // 60 characters is about as long as a name gets before it reads as prose. Anything
    // longer is a prompt, and the topics name the drill better than a cut paragraph.
    return firstSentence.length <= TITLE_MAX_LENGTH ? firstSentence : null;
  }
}
