import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignmentsRepository } from '../assignments.repository';
import { toAssignmentDTO } from '../assignment.mapper';
import { DrillAssignmentDTO } from '../contracts';

/** The content-service calls this service needs. Implemented by Track D's client. */
export interface DrillSetsClient {
  getSet(setUuid: string): Promise<any>;
  incrementSelfSelected(setUuid: string): Promise<void>;
}

/** Where the student currently is in their course. */
export interface StudentProgressClient {
  getStudentProgress(studentId: number): Promise<{ courseKey: string | null; lessonOrder: number | null }>;
}

@Injectable()
export class SelfDrillService {
  private readonly logger = new Logger(SelfDrillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: AssignmentsRepository,
    private readonly sets: DrillSetsClient,
    private readonly progress: StudentProgressClient,
  ) {}

  /**
   * Start a self-selected drill.
   *
   * SECURITY: the first check below IS the self-drilling gate (spec 9.3).
   * Teacher-assigned work comes first, and that is enforced here, server-side,
   * before any other work happens. Hiding the button in the UI is not
   * enforcement — Track J's legacy portal and Track E's runner both reach this
   * same method, and a hand-crafted POST reaches it too.
   *
   * `findOutstanding` means ASSIGNED | IN_PROGRESS only (Track B handoff note 8).
   * A GENERATING or PENDING_REVIEW assignment is not something the student can
   * act on, so it must not block them.
   */
  async startSelfDrill(
    studentId: number,
    setUuid: string,
    lessonUuid: string | null = null,
  ): Promise<DrillAssignmentDTO> {
    const blocking = await this.assignments.findOutstanding(studentId);
    if (blocking) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ASSIGNMENT_OUTSTANDING',
        message: 'Finish the drilling your teacher assigned before starting your own',
        blockingAssignmentUuid: blocking.uuid,
      });
    }

    const set = await this.sets.getSet(setUuid);
    if (!set) {
      throw new NotFoundException('Drill set not found');
    }

    // A student may only ever practise vetted material.
    if (set.reviewState !== 'APPROVED') {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'SET_NOT_APPROVED',
        message: 'This drill set has not been approved yet',
      });
    }

    const where = await this.progress.getStudentProgress(studentId);
    const ahead =
      typeof set.lessonOrder === 'number' &&
      typeof where?.lessonOrder === 'number' &&
      set.lessonOrder > where.lessonOrder;
    if (ahead) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'SET_AHEAD_OF_STUDENT',
        message: 'This drill set is ahead of your current lesson',
      });
    }

    const assignmentUuid = randomUUID();
    const now = new Date();
    const row = await this.prisma.drillAssignment.create({
      data: {
        uuid: assignmentUuid,
        setUuid,
        studentId,
        // Self-selected work has no teacher behind it. Origin SELF is what keeps
        // it out of teacher review queues.
        teacherId: null,
        origin: 'SELF',
        // The lesson the student started from, so their own practice shows up in that
        // lesson's homework next to the work their teacher assigned. Null when they
        // started from the drills menu instead, which carries no lesson.
        lessonUuid: lessonUuid ?? null,
        title: set.title,
        languageCode: set.languageCode,
        materialLanguage: set.materialLanguage,
        status: 'ASSIGNED',
        assignedAt: now,
        resourceLinks: set.resourceLinks ?? [],
        items: {
          create: (set.items ?? []).map((item: any, index: number) => ({
            uuid: randomUUID(),
            order: typeof item.order === 'number' ? item.order : index,
            sourceItemId: item.id ?? null,
            template: item.template,
            blanks: item.blanks,
            hint: item.hint ?? null,
            topicSlug: item.topicSlug ?? null,
          })),
        },
      },
      include: { items: { select: { uuid: true } } },
    });

    await this.sets.incrementSelfSelected(setUuid);

    this.logger.log(
      `Self-drill started: assignment=${assignmentUuid} studentId=${studentId} setUuid=${setUuid} items=${row.items?.length ?? 0}`,
    );

    const counts = await this.assignments.countBlanks(assignmentUuid);
    return toAssignmentDTO(row, counts);
  }
}
