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
    const { blank, status } = await this.loadBlank(
      assignmentUuid,
      studentId,
      req.itemUuid,
      req.blankIndex,
    );

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

    // Revealing the last unresolved blank finishes the assignment, exactly as answering
    // it would. This call is the whole point of the shared helper: `reveal` used to
    // compute `assignmentCompleted` for its response and return without ever writing
    // COMPLETED, so a student who finished by revealing stayed IN_PROGRESS forever.
    const completed = await this.completeIfResolved(
      assignmentUuid,
      status,
      studentId,
      counts,
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
      assignmentCompleted: completed,
      hint: null,
    };
  }

  /**
   * Move an assignment to COMPLETED when every blank is resolved, and return whether
   * it is now complete.
   *
   * **Completion is decided from `blanksResolved`, never `blanksCorrect`.** A revealed
   * blank resolves without being correct; requiring correctness would strand any
   * assignment containing a reveal in IN_PROGRESS permanently.
   *
   * Shared by `check` and `reveal` so the two can never drift again — the original
   * defect was precisely that only one of them wrote the transition.
   *
   * `fromStatus` is the status read at the start of the request. ASSIGNED -> COMPLETED
   * is not a legal edge, so an assignment resolved on its very first touch makes both
   * hops here.
   */
  private async completeIfResolved(
    assignmentUuid: string,
    fromStatus: DrillAssignmentStatus,
    studentId: number,
    counts: { blanksCorrect: number; blanksResolved: number; blanksTotal: number },
  ): Promise<boolean> {
    if (counts.blanksTotal <= 0 || counts.blanksResolved < counts.blanksTotal) {
      return false;
    }
    if (fromStatus === 'COMPLETED') {
      return true;
    }

    if (fromStatus === 'ASSIGNED') {
      this.transition(fromStatus, 'IN_PROGRESS');
      await this.prisma.drillAssignment.update({
        where: { uuid: assignmentUuid },
        data: { status: 'IN_PROGRESS' },
      });
    }

    this.transition('IN_PROGRESS', 'COMPLETED');
    await this.prisma.drillAssignment.update({
      where: { uuid: assignmentUuid },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        // Persisted at completion, when the attempt history is final. The column
        // existed and was never written, so every completed assignment reported a
        // null accuracy to the teacher panel.
        firstTryAccuracy: await this.firstTryAccuracy(assignmentUuid, counts.blanksTotal),
      },
    });
    this.logger.log(
      `Drill assignment completed: uuid=${assignmentUuid} studentId=${studentId} ` +
        `blanks=${counts.blanksCorrect}/${counts.blanksTotal} resolved=${counts.blanksResolved}`,
    );

    // After the write, never before: the email says the student finished, so the row
    // must already say so. Awaited rather than dangled so the send is ordered and
    // testable, but wrapped — the hook already swallows its own errors, and this
    // guarantees no future change there can turn a completed assignment into a 500.
    // The completion stands either way.
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

    return true;
  }

  /**
   * Share of blanks solved on the first attempt with no reveal.
   *
   * `attemptNo = 1 AND isCorrect` is the definition the drilling spec uses for bank
   * selection, and a reveal never satisfies it: reveals are written `isCorrect: false`.
   * Counted over distinct positions so a duplicate attempt row cannot push the ratio
   * above 1.
   */
  private async firstTryAccuracy(assignmentUuid: string, blanksTotal: number): Promise<number | null> {
    if (blanksTotal <= 0) return null;

    const firstTry = await this.prisma.drillAttempt.findMany({
      where: { assignmentUuid, attemptNo: 1, isCorrect: true, revealed: false },
      select: { itemUuid: true, blankIndex: true },
    });
    const positions = new Set(firstTry.map((a) => `${a.itemUuid}:${a.blankIndex}`));
    return positions.size / blanksTotal;
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
  ): Promise<{ blank: DrillBlank; status: DrillAssignmentStatus }> {
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
    // The status travels with the blank so `reveal` can decide completion without a
    // second read of the same row.
    return { blank, status };
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
    // The IN_PROGRESS write above has already happened when status was ASSIGNED, so
    // the helper is told IN_PROGRESS and makes only the second hop.
    const completed = await this.completeIfResolved(
      assignmentUuid,
      'IN_PROGRESS',
      studentId,
      counts,
    );

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
