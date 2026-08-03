import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * What a drill notification carries. Deliberately narrow: there is no accuracy,
 * score or percentage field anywhere in this type, so no template downstream can
 * render one and no future caller can supply one. The requirement that a teacher
 * never sees a score is enforced by the shape of the payload, not by remembering
 * to leave a field out.
 */
export interface DrillNotification {
  template: 'drill_assignment_assigned' | 'drill_assignment_completed';
  recipientId: number;
  materialLanguage: string;
  payload: Record<string, unknown>;
}

export interface NotificationsClient {
  dispatch(notification: DrillNotification): Promise<void>;
  createInApp(notification: DrillNotification): Promise<void>;
}

/** How many struggled items the teacher email lists before it stops. */
const STRUGGLED_LIMIT = 5;

/**
 * Fires the two drill emails: the student on assign, the teacher on completion.
 *
 * Two rules shape this class.
 *
 * A failed email must never block a state transition. A student who finished an
 * assignment has finished it whether or not SMTP was reachable, so every path
 * here catches, logs and resolves. Nothing rethrows.
 *
 * A notification is sent at most once. Idempotence is a conditional UPDATE that
 * only matches while the timestamp is still null, taken *before* dispatch rather
 * than after: claiming afterwards leaves a window in which two concurrent callers
 * both read null and both send. The cost of that ordering is that an email can be
 * marked sent and then fail — the right trade, since a missing email is recoverable
 * and a duplicate one is not.
 */
@Injectable()
export class NotificationsHook {
  private readonly logger = new Logger(NotificationsHook.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: NotificationsClient,
  ) {}

  async onAssigned(assignmentUuid: string): Promise<void> {
    try {
      const assignment = await this.prisma.drillAssignment.findUnique({
        where: { uuid: assignmentUuid },
      });
      if (!assignment) {
        return;
      }

      if (!(await this.claim(assignmentUuid, 'notifiedAssignedAt'))) {
        return;
      }

      const itemCount = await this.prisma.drillAssignmentItem.count({
        where: { assignmentUuid },
      });

      const notification: DrillNotification = {
        template: 'drill_assignment_assigned',
        recipientId: assignment.studentId,
        materialLanguage: assignment.materialLanguage,
        payload: {
          assignmentUuid,
          title: assignment.title,
          topics: this.topicsOf(assignment.resourceLinks),
          dueAt: assignment.dueAt ? assignment.dueAt.toISOString() : null,
          itemCount,
        },
      };

      await this.client.dispatch(notification);
      await this.client.createInApp(notification);
    } catch (error) {
      this.warn('assigned', assignmentUuid, error);
    }
  }

  async onCompleted(assignmentUuid: string): Promise<void> {
    try {
      const assignment = await this.prisma.drillAssignment.findUnique({
        where: { uuid: assignmentUuid },
      });
      if (!assignment) {
        return;
      }

      // A self-selected drill has no teacher to report to. Spec §14: nothing is sent.
      if (assignment.origin === 'SELF' || assignment.teacherId == null) {
        return;
      }

      if (!(await this.claim(assignmentUuid, 'notifiedCompletedAt'))) {
        return;
      }

      const notification: DrillNotification = {
        template: 'drill_assignment_completed',
        recipientId: assignment.teacherId,
        materialLanguage: assignment.materialLanguage,
        payload: {
          assignmentUuid,
          title: assignment.title,
          topics: this.topicsOf(assignment.resourceLinks),
          lessonUuid: assignment.lessonUuid,
          struggledWith: await this.struggledWith(assignmentUuid),
        },
      };

      await this.client.dispatch(notification);
      await this.client.createInApp(notification);
    } catch (error) {
      this.warn('completed', assignmentUuid, error);
    }
  }

  /**
   * Marks the notification sent, returning false when another caller got there
   * first. `updateMany` rather than `update` because the null check belongs in the
   * WHERE clause — read-then-write would reintroduce the race it exists to close.
   */
  private async claim(
    assignmentUuid: string,
    column: 'notifiedAssignedAt' | 'notifiedCompletedAt',
  ): Promise<boolean> {
    const result = await this.prisma.drillAssignment.updateMany({
      where: { uuid: assignmentUuid, [column]: null },
      data: { [column]: new Date() },
    });
    return result.count > 0;
  }

  /**
   * What the student got wrong, as sentence plus the blank's prompt — never the
   * answer, and never a count. One entry per blank the student missed on the first
   * try, oldest first, capped so a bad run does not produce an unreadable email.
   */
  private async struggledWith(
    assignmentUuid: string,
  ): Promise<{ sentence: string; blankPrompt: string }[]> {
    const firstAttempts = await this.prisma.drillAttempt.findMany({
      where: { assignmentUuid, attemptNo: 1, isCorrect: false },
      orderBy: { createdAt: 'asc' },
      take: STRUGGLED_LIMIT,
      include: { item: true },
    });

    return firstAttempts.map((attempt: any) => ({
      sentence: plainSentence(attempt.item?.template ?? ''),
      blankPrompt: promptOf(attempt.item?.blanks, attempt.blankIndex),
    }));
  }

  private topicsOf(resourceLinks: unknown): { topic: string; url: string }[] {
    if (!Array.isArray(resourceLinks)) {
      return [];
    }
    return resourceLinks
      .filter((l: any) => l && typeof l.topic === 'string' && typeof l.url === 'string')
      .map((l: any) => ({ topic: l.topic, url: l.url }));
  }

  private warn(event: string, assignmentUuid: string, error: unknown): void {
    const reason = error instanceof Error ? error.message : String(error);
    this.logger.warn(
      `drill notification (${event}) failed for assignment ${assignmentUuid}: ${reason}`,
    );
  }
}

/** Renders the template's blanks as `___`, so the teacher sees the gap, not the answer. */
function plainSentence(template: string): string {
  return template.replace(/\[([^\]]*)\]\{([^}]*)\}/g, '___');
}

function promptOf(blanks: unknown, blankIndex: number): string {
  if (!Array.isArray(blanks)) {
    return '';
  }
  const blank: any = blanks.find((b: any) => b && b.index === blankIndex);
  return typeof blank?.prompt === 'string' ? blank.prompt : '';
}
