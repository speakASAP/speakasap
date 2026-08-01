import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignmentsRepository } from '../assignments.repository';
import { toAssignmentDTO } from '../assignment.mapper';
import { toRunnerResponse } from './runner.projection';
import {
  InternalLessonAssignmentsResponse,
  InternalStudentAssignmentsResponse,
  InternalTeacherAssignmentsResponse,
  RunnerResponse,
} from '../contracts';

/** Statuses that count as outstanding — the same definition the gate uses. */
const OUTSTANDING = ['ASSIGNED', 'IN_PROGRESS'];

@Injectable()
export class DrillAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: AssignmentsRepository,
  ) {}

  /**
   * The student's runner payload. Ownership is enforced here, and the response
   * is built through `toRunnerResponse`, which is answer-free by construction.
   */
  async getRunner(assignmentUuid: string, studentId: number): Promise<RunnerResponse> {
    const assignment = await this.prisma.drillAssignment.findUnique({
      where: { uuid: assignmentUuid },
      include: { items: { select: { uuid: true } } },
    });
    // Same 404 for missing and not-yours: distinguishing them would confirm
    // another student's assignment exists.
    if (!assignment || assignment.studentId !== studentId) {
      throw new NotFoundException('Drill assignment not found');
    }

    const [items, attempts, counts] = await Promise.all([
      this.prisma.drillAssignmentItem.findMany({
        where: { assignmentUuid },
        orderBy: { order: 'asc' },
      }),
      this.prisma.drillAttempt.findMany({ where: { assignmentUuid } }),
      this.assignments.countBlanks(assignmentUuid),
    ]);

    return toRunnerResponse(assignment, items as any, attempts as any, counts);
  }

  /**
   * Contract C8's student view.
   *
   * `outstanding` is ASSIGNED | IN_PROGRESS — NOT `findForStudent().active`,
   * which also contains GENERATING and PENDING_REVIEW rows the student cannot
   * act on (Track B handoff note 8). `selfDrillingAllowed` is derived from the
   * same list, so this flag and `SelfDrillService`'s gate can never disagree —
   * Track J renders its dashboard button from this flag, and a disagreement
   * means offering a button that 409s.
   */
  async listForStudent(studentId: number): Promise<InternalStudentAssignmentsResponse> {
    const { active, completed } = await this.assignments.findForStudent(studentId);
    const outstandingRows = active.filter((row) => OUTSTANDING.includes(row.status));

    const uuids = [...outstandingRows, ...completed].map((r) => r.uuid);
    const counts = await this.assignments.countBlanksFor(uuids);
    const map = (row: any) => toAssignmentDTO(row, counts.get(row.uuid)!);

    return {
      outstanding: outstandingRows.map(map),
      completedRecent: completed.map(map),
      selfDrillingAllowed: outstandingRows.length === 0,
    };
  }

  async listForTeacher(teacherId: number): Promise<InternalTeacherAssignmentsResponse> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [awaitingReview, assigned, completedThisWeek, queue] = await Promise.all([
      this.prisma.drillAssignment.count({ where: { teacherId, status: 'PENDING_REVIEW' } }),
      this.prisma.drillAssignment.count({ where: { teacherId, status: { in: OUTSTANDING } } }),
      this.prisma.drillAssignment.count({
        where: { teacherId, status: 'COMPLETED', completedAt: { gte: weekAgo } },
      }),
      this.prisma.drillAssignment.findMany({
        where: { teacherId, status: 'PENDING_REVIEW' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    // One row per set, students counted per set, most recent first.
    const bySet = new Map<string, { setUuid: string; title: string; studentCount: number; createdAt: string }>();
    for (const row of queue) {
      const existing = bySet.get(row.setUuid);
      if (existing) {
        existing.studentCount += 1;
      } else {
        bySet.set(row.setUuid, {
          setUuid: row.setUuid,
          title: row.title,
          studentCount: 1,
          createdAt: row.createdAt.toISOString(),
        });
      }
    }

    return {
      awaitingReview,
      assigned,
      completedThisWeek,
      reviewQueue: Array.from(bySet.values()),
    };
  }

  async listForLesson(lessonUuid: string): Promise<InternalLessonAssignmentsResponse> {
    const rows = await this.prisma.drillAssignment.findMany({
      where: { lessonUuid },
      include: { items: { select: { uuid: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const counts = await this.assignments.countBlanksFor(rows.map((r) => r.uuid));
    return {
      assignments: rows.map((row) => ({
        ...toAssignmentDTO(row, counts.get(row.uuid)!),
        // Resolved by the caller/portal; education-service does not own student names.
        studentName: '',
      })),
    };
  }
}
