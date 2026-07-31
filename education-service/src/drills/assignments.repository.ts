import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TERMINAL_STATUSES } from './state-machine';

export type AssignmentRow = Prisma.DrillAssignmentGetPayload<{ include: { items: true } }>;

@Injectable()
export class AssignmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Non-terminal assignments plus the 10 most recent COMPLETED. CANCELLED is
   *  terminal and excluded entirely — it never reappears as recent history. */
  async findForStudent(studentId: number): Promise<AssignmentRow[]> {
    const [active, completed] = await Promise.all([
      this.prisma.drillAssignment.findMany({
        where: { studentId, status: { notIn: Array.from(TERMINAL_STATUSES) } },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.drillAssignment.findMany({
        where: { studentId, status: 'COMPLETED' },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    return [...active, ...completed];
  }

  /** The assignment blocking self-drilling, if any. Track B2's gate calls this. */
  async findOutstanding(studentId: number): Promise<AssignmentRow | null> {
    return this.prisma.drillAssignment.findFirst({
      where: { studentId, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** blanksTotal sums blanks.length across the assignment's items. blanksCorrect
   *  counts DISTINCT (itemUuid, blankIndex) pairs among correct attempts — a
   *  blank solved correctly twice has been solved once, not twice. */
  async countBlanks(
    assignmentUuid: string,
  ): Promise<{ blanksCorrect: number; blanksTotal: number }> {
    const [items, correctAttempts] = await Promise.all([
      this.prisma.drillAssignmentItem.findMany({
        where: { assignmentUuid },
        select: { blanks: true },
      }),
      this.prisma.drillAttempt.findMany({
        where: { assignmentUuid, isCorrect: true },
        select: { itemUuid: true, blankIndex: true },
      }),
    ]);
    const blanksTotal = items.reduce(
      (sum, item) => sum + (Array.isArray(item.blanks) ? item.blanks.length : 0),
      0,
    );
    const solvedBlanks = new Set(
      correctAttempts.map((attempt) => `${attempt.itemUuid}:${attempt.blankIndex}`),
    );
    return { blanksCorrect: solvedBlanks.size, blanksTotal };
  }
}
