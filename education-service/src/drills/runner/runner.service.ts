import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignmentsRepository } from '../assignments.repository';
import { gradeBlank, gradingOptionsFor } from '../grading';
import { assertTransition } from '../state-machine';
import { CheckBlankRequest, CheckBlankResponse, DrillAssignmentStatus, DrillBlank } from '../contracts';

@Injectable()
export class RunnerService {
  private readonly logger = new Logger(RunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: AssignmentsRepository,
  ) {}

  /**
   * Grade one blank, server-side.
   *
   * Three properties this method exists to hold:
   *
   * 1. **The answer never leaves the server.** The response carries only
   *    `correct` and, when correct, `acceptedText` — which is the student's own
   *    trimmed input (Track B handoff note 3), not the stored answer.
   * 2. **Completion is server-decided.** It is recomputed from
   *    `countBlanks` AFTER the attempt is persisted, never inferred from the
   *    client's view or from a local tally.
   * 3. **Ownership is checked before anything else.** A student may only ever
   *    touch their own assignment.
   */
  async check(
    assignmentUuid: string,
    studentId: number,
    req: CheckBlankRequest,
  ): Promise<CheckBlankResponse> {
    const assignment = await this.prisma.drillAssignment.findUnique({
      where: { uuid: assignmentUuid },
      include: { items: { select: { uuid: true } } },
    });

    // Same 404 for "missing" and "not yours": a distinguishable error would
    // confirm the existence of another student's assignment.
    if (!assignment || assignment.studentId !== studentId) {
      throw new NotFoundException('Drill assignment not found');
    }

    const status = assignment.status as DrillAssignmentStatus;
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      throw new ConflictException({
        statusCode: 409,
        code: 'GENERATION_IN_PROGRESS',
        message: `Assignment is ${status} and no longer accepts attempts`,
      });
    }
    if (status === 'GENERATING' || status === 'PENDING_REVIEW') {
      throw new ConflictException({
        statusCode: 409,
        code: 'GENERATION_IN_PROGRESS',
        message: `Assignment is ${status} and cannot be answered yet`,
      });
    }

    const item = await this.prisma.drillAssignmentItem.findUnique({
      where: { uuid: req.itemUuid },
    });
    if (!item || item.assignmentUuid !== assignmentUuid) {
      throw new NotFoundException('Drill item not found on this assignment');
    }

    const blanks: DrillBlank[] = Array.isArray(item.blanks) ? (item.blanks as any) : [];
    const blank = blanks.find((b, i) => (typeof b?.index === 'number' ? b.index : i) === req.blankIndex);
    if (!blank) {
      throw new BadRequestException(`blankIndex ${req.blankIndex} does not exist on this item`);
    }

    const grade = gradeBlank(req.value ?? '', blank, gradingOptionsFor(assignment.languageCode));

    const priorAttempts = await this.prisma.drillAttempt.count({
      where: { assignmentUuid, itemUuid: req.itemUuid, blankIndex: req.blankIndex },
    });
    const attemptNo = priorAttempts + 1;

    await this.prisma.drillAttempt.create({
      data: {
        uuid: randomUUID(),
        assignmentUuid,
        itemUuid: req.itemUuid,
        blankIndex: req.blankIndex,
        submittedValue: req.value ?? '',
        isCorrect: grade.correct,
        attemptNo,
        revealed: false,
      },
    });

    // ASSIGNED -> IN_PROGRESS on the first attempt of the assignment.
    if (status === 'ASSIGNED') {
      this.transition(status, 'IN_PROGRESS');
      await this.prisma.drillAssignment.update({
        where: { uuid: assignmentUuid },
        data: { status: 'IN_PROGRESS' },
      });
    }

    // Recomputed from persisted state — the only permitted source of truth.
    const counts = await this.assignments.countBlanks(assignmentUuid);
    const completed = counts.blanksTotal > 0 && counts.blanksCorrect >= counts.blanksTotal;

    if (completed) {
      // Track B handoff note 1: ASSIGNED -> COMPLETED is not a legal edge, so a
      // single-blank assignment needs both hops in this one request. The
      // IN_PROGRESS write above has already happened when status was ASSIGNED.
      this.transition('IN_PROGRESS', 'COMPLETED');
      await this.prisma.drillAssignment.update({
        where: { uuid: assignmentUuid },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      this.logger.log(
        `Drill assignment completed: uuid=${assignmentUuid} studentId=${studentId} blanks=${counts.blanksCorrect}/${counts.blanksTotal}`,
      );
    }

    return {
      correct: grade.correct,
      acceptedText: grade.acceptedText,
      attemptNo,
      blanksCorrect: counts.blanksCorrect,
      blanksTotal: counts.blanksTotal,
      assignmentCompleted: completed,
    };
  }

  /**
   * Track B handoff note 5: `assertTransition` throws a bare ConflictException
   * whose body has no `code`, so it does not satisfy `DrillErrorBody`. Re-wrap
   * it here rather than letting a body other tracks cannot parse escape the
   * HTTP boundary.
   */
  private transition(from: DrillAssignmentStatus, to: DrillAssignmentStatus): void {
    try {
      assertTransition(from, to);
    } catch {
      throw new ConflictException({
        statusCode: 409,
        code: 'GENERATION_IN_PROGRESS',
        message: `Illegal drill assignment transition: ${from} -> ${to}`,
      });
    }
  }
}
