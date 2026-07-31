import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TERMINAL_STATUSES } from './state-machine';

/**
 * The assignment shape every caller of this repository receives.
 *
 * `items` is selected down to `{ uuid }` **deliberately**: the only thing any
 * consumer needs from it is `items.length` (see `toAssignmentDTO`), while
 * `items.blanks` is the answer/alternatives blob. Selecting the full item would
 * (a) drag ~20 rows of `template` + `blanks` JSON per assignment out of Postgres
 * to produce one integer, and (b) make `return row` in any of Tracks B2/D/E/G an
 * answer leak. It stays narrow so that mistake is not available.
 *
 * `firstTryAccuracy` is still on this type — it is a scalar on the assignment row
 * itself. It is internal-only and must never reach a DTO; `toAssignmentDTO` lists
 * fields explicitly for exactly that reason.
 */
export type AssignmentRow = Prisma.DrillAssignmentGetPayload<{
  include: { items: { select: { uuid: true } } };
}>;

const ITEM_COUNT_ONLY = { items: { select: { uuid: true } } } as const;

export interface BlankCounts {
  blanksCorrect: number;
  blanksTotal: number;
}

/** What `findForStudent` returns. The two buckets have different definitions and
 *  must not be flattened together — see the doc comment on `findForStudent`. */
export interface StudentAssignments {
  active: AssignmentRow[];
  completed: AssignmentRow[];
}

@Injectable()
export class AssignmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The student's assignment list, in two distinct buckets.
   *
   * - `active` — every **non-terminal** assignment (GENERATING, PENDING_REVIEW,
   *   ASSIGNED, IN_PROGRESS), newest first. GENERATING is included on purpose: the
   *   student should see generation progress, which is what the DTO's
   *   `generationProgress` field renders.
   * - `completed` — the 10 most recent COMPLETED, newest first. CANCELLED is
   *   terminal and excluded entirely; it never reappears as recent history.
   *
   * **`active` is NOT "outstanding".** The contract's `outstanding` — the thing that
   * drives `selfDrillingAllowed` — means ASSIGNED or IN_PROGRESS only. Deriving the
   * self-drilling gate from this bucket would block a student on a PENDING_REVIEW or
   * GENERATING assignment they cannot act on. Use `findOutstanding` for the gate.
   * The two definitions are kept in separate methods so they cannot be conflated.
   */
  async findForStudent(studentId: number): Promise<StudentAssignments> {
    const [active, completed] = await Promise.all([
      this.prisma.drillAssignment.findMany({
        where: { studentId, status: { notIn: Array.from(TERMINAL_STATUSES) } },
        include: ITEM_COUNT_ONLY,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.drillAssignment.findMany({
        where: { studentId, status: 'COMPLETED' },
        include: ITEM_COUNT_ONLY,
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    return { active, completed };
  }

  /** The assignment blocking self-drilling, if any — ASSIGNED or IN_PROGRESS only.
   *  Track B2's gate calls exactly this, and `selfDrillingAllowed` must be derived
   *  from it, never from `findForStudent().active`. */
  async findOutstanding(studentId: number): Promise<AssignmentRow | null> {
    return this.prisma.drillAssignment.findFirst({
      where: { studentId, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
      include: ITEM_COUNT_ONLY,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Progress counts for one assignment.
   *
   * `blanksTotal` sums `blanks.length` across the assignment's items.
   *
   * **`blanksCorrect` counts RESOLVED positions, not correct ones** — a distinct
   * `(itemUuid, blankIndex)` pair counts when `isCorrect = true` **OR**
   * `revealed = true`. The field keeps the name `blanksCorrect` only because it is a
   * contract field consumed by four tracks; renaming it is out of scope. Do not
   * "fix" this back to `isCorrect` alone: the reveal endpoint (spec §9.6) writes
   * `{ isCorrect: false, revealed: true }`, so a revealed blank could otherwise
   * never be resolved, its assignment would sit in IN_PROGRESS forever, and
   * `findOutstanding` would block that student from self-drilling permanently.
   * A student who reveals everything completes with zero correct — that is the
   * ruled behaviour.
   *
   * First-try accuracy is computed elsewhere from `attemptNo = 1 AND isCorrect`,
   * which a reveal never satisfies, so bank-selection statistics stay clean.
   *
   * Distinctness is preserved: the same position resolved twice counts once.
   */
  async countBlanks(assignmentUuid: string): Promise<BlankCounts> {
    const counts = await this.countBlanksFor([assignmentUuid]);
    return counts.get(assignmentUuid) ?? { blanksCorrect: 0, blanksTotal: 0 };
  }

  /**
   * Batch form of `countBlanks` — same resolved-position semantics, two queries
   * total regardless of how many assignments are asked for.
   *
   * `toAssignmentDTO` needs counts per assignment, so rendering a list of N
   * assignments through `countBlanks` costs 2N queries. Use this instead.
   *
   * Every uuid in `assignmentUuids` is present in the returned map, including ones
   * with no items and no attempts — those map to `{ blanksCorrect: 0, blanksTotal: 0 }`
   * rather than being absent, so callers never need a `?? 0` fallback.
   */
  async countBlanksFor(assignmentUuids: string[]): Promise<Map<string, BlankCounts>> {
    const counts = new Map<string, BlankCounts>(
      assignmentUuids.map((uuid) => [uuid, { blanksCorrect: 0, blanksTotal: 0 }]),
    );
    if (counts.size === 0) return counts;

    const uuids = Array.from(counts.keys());
    const [items, resolvedAttempts] = await Promise.all([
      this.prisma.drillAssignmentItem.findMany({
        where: { assignmentUuid: { in: uuids } },
        select: { assignmentUuid: true, blanks: true },
      }),
      this.prisma.drillAttempt.findMany({
        where: {
          assignmentUuid: { in: uuids },
          OR: [{ isCorrect: true }, { revealed: true }],
        },
        select: { assignmentUuid: true, itemUuid: true, blankIndex: true },
      }),
    ]);

    for (const item of items) {
      const entry = counts.get(item.assignmentUuid);
      // `blanks` is an unvalidated Json column — a non-array contributes 0 rather
      // than throwing, matching gradeBlank's tolerance of the same blob.
      if (entry) entry.blanksTotal += Array.isArray(item.blanks) ? item.blanks.length : 0;
    }

    const resolvedPositions = new Map<string, Set<string>>();
    for (const attempt of resolvedAttempts) {
      let positions = resolvedPositions.get(attempt.assignmentUuid);
      if (!positions) {
        positions = new Set<string>();
        resolvedPositions.set(attempt.assignmentUuid, positions);
      }
      positions.add(`${attempt.itemUuid}:${attempt.blankIndex}`);
    }
    for (const [assignmentUuid, positions] of resolvedPositions) {
      const entry = counts.get(assignmentUuid);
      if (entry) entry.blanksCorrect = positions.size;
    }

    return counts;
  }
}
