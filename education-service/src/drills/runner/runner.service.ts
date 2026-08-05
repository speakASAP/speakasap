import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { buildWrongAnswerHint } from '../wrong-answer-hint';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignmentsRepository } from '../assignments.repository';
import { gradeBlank, gradingOptionsFor } from '../grading';
import { assertTransition } from '../state-machine';
import { CheckBlankRequest, CheckBlankResponse, DrillAssignmentStatus, DrillBlank } from '../contracts';

/**
 * The one thing the runner needs from Track G's hook. Declared as a narrow
 * interface rather than importing `NotificationsHook`: the runner has no business
 * with the assign side, and depending on the whole class would drag the
 * notifications client into every test that constructs a runner.
 */
export interface DrillCompletionNotifier {
  onCompleted(assignmentUuid: string): Promise<void>;
}

@Injectable()
export class RunnerService {
  private readonly logger = new Logger(RunnerService.name);

  /**
   * `notifications` is optional so the two dozen existing constructions of this
   * service — and Track E's, once it lands — keep working without it. A missing
   * hook means no email, never a failure.
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: AssignmentsRepository,
    private readonly notifications?: DrillCompletionNotifier,
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
  /**
   * Reveal the answer for one blank — spec §9.6.
   *
   * Writes `{ isCorrect: false, revealed: true }`. The position RESOLVES, so the
   * assignment can reach COMPLETED and the student is not blocked from self-drilling
   * forever; but it never counts as a correct answer, and `attemptNo = 1 AND isCorrect`
   * still governs first-try accuracy, so bank statistics stay clean.
   *
   * Exists because the hint escalation ends by offering it — a sentence promising
   * something the student cannot do is worse than no hint at all.
   */
  async reveal(
    assignmentUuid: string,
    studentId: number,
    req: { itemUuid: string; blankIndex: number },
  ): Promise<CheckBlankResponse> {
    const { blank } = await this.loadBlank(assignmentUuid, studentId, req.itemUuid, req.blankIndex);

    const priorAttempts = await this.prisma.drillAttempt.count({
      where: { assignmentUuid, itemUuid: req.itemUuid, blankIndex: req.blankIndex },
    });

    await this.prisma.drillAttempt.create({
      data: {
        uuid: randomUUID(),
        assignmentUuid,
        itemUuid: req.itemUuid,
        blankIndex: req.blankIndex,
        submittedValue: '',
        isCorrect: false,
        attemptNo: priorAttempts + 1,
        revealed: true,
      },
    });

    const counts = await this.assignments.countBlanks(assignmentUuid);
    const answer = String((blank as any).answer ?? '');
    this.logger.log(
      `Blank revealed: assignment=${assignmentUuid} item=${req.itemUuid} blank=${req.blankIndex}`,
    );

    return {
      correct: false,
      // The answer, deliberately — the student asked for it. This is the only response
      // on which a wrong attempt carries acceptedText, and the reason the field is not
      // simply "the text you typed".
      acceptedText: answer,
      attemptNo: priorAttempts + 1,
      blanksCorrect: counts.blanksCorrect,
      blanksTotal: counts.blanksTotal,
      assignmentCompleted: counts.blanksTotal > 0 && counts.blanksCorrect >= counts.blanksTotal,
      hint: null,
    };
  }

  /**
   * The access checks `check` and `reveal` share: the assignment is this student's, it
   * is in a state that accepts attempts, and the blank exists on it.
   */
  private async loadBlank(
    assignmentUuid: string,
    studentId: number,
    itemUuid: string,
    blankIndex: number,
  ): Promise<{ blank: DrillBlank }> {
    const assignment = await this.prisma.drillAssignment.findUnique({
      where: { uuid: assignmentUuid },
    });
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
    const item = await this.prisma.drillAssignmentItem.findUnique({ where: { uuid: itemUuid } });
    if (!item || item.assignmentUuid !== assignmentUuid) {
      throw new NotFoundException('Drill item not found on this assignment');
    }
    const blanks: DrillBlank[] = Array.isArray(item.blanks) ? (item.blanks as any) : [];
    const blank = blanks.find((b, i) => (typeof b?.index === 'number' ? b.index : i) === blankIndex);
    if (!blank) {
      throw new BadRequestException(`blankIndex ${blankIndex} does not exist on this item`);
    }
    return { blank };
  }

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

      // Track G. After the write, never before: the email says the student
      // finished, so the row must already say so. Awaited rather than dangled so
      // the send is ordered and testable, but wrapped — the hook already swallows
      // its own errors, and this guarantees no future change there can turn a
      // completed assignment into a 500. The completion stands either way.
      if (this.notifications) {
        try {
          await this.notifications.onCompleted(assignmentUuid);
        } catch (error) {
          this.logger.warn(
            `Completion notification failed for assignment ${assignmentUuid}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }

    return {
      correct: grade.correct,
      acceptedText: grade.acceptedText,
      attemptNo,
      // Built here, from the answer this service can see and the response deliberately
      // cannot carry. Null when correct — there is nothing to nudge towards.
      hint: grade.correct ? null : buildWrongAnswerHint(String((blank as any).answer ?? ''), attemptNo),
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
