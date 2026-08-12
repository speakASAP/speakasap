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
  /** Positions answered correctly. Never counts a reveal — this is the score. */
  blanksCorrect: number;
  /** Positions the student is done with: correct OR revealed. Decides completion. */
  blanksResolved: number;
  /** `blanksResolved - blanksCorrect`. Resolved by giving up, not by answering. */
  blanksRevealed: number;
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
   * Three distinct progress numbers, deliberately NOT collapsed into one:
   *
   * - **`blanksResolved`** — positions the student is done with: `isCorrect = true`
   *   **OR** `revealed = true`. **This, and only this, decides completion.** The
   *   reveal endpoint (spec §9.6) writes `{ isCorrect: false, revealed: true }`, so
   *   driving completion off correctness alone would leave a revealed blank
   *   permanently unresolved, its assignment stuck in IN_PROGRESS, and
   *   `findOutstanding` blocking that student from self-drilling forever. A student
   *   who reveals everything completes with zero correct — that is the ruled
   *   behaviour.
   * - **`blanksCorrect`** — positions actually answered correctly (`isCorrect = true`).
   *   Never counts a reveal. This is what a teacher reads as the score.
   * - **`blanksRevealed`** — resolved minus correct, reported on its own so a teacher
   *   can tell "22 correct + 8 revealed" from "30 correct".
   *
   * These two were previously one field: `blanksCorrect` carried the RESOLVED count.
   * The teacher panel rendered a fully-revealed assignment as a perfect "30 / 30",
   * which is the opposite of what happened. Callers deciding completion must use
   * `blanksResolved`; callers displaying a score must use `blanksCorrect`.
   *
   * First-try accuracy is computed separately from `attemptNo = 1 AND isCorrect`,
   * which a reveal never satisfies, so bank-selection statistics stay clean.
   *
   * Distinctness is preserved throughout: the same position counts once.
   */
  async countBlanks(assignmentUuid: string): Promise<BlankCounts> {
    const counts = await this.countBlanksFor([assignmentUuid]);
    return counts.get(assignmentUuid) ?? emptyCounts();
  }

  /**
   * Batch form of `countBlanks` — same resolved-position semantics, two queries
   * total regardless of how many assignments are asked for.
   *
   * `toAssignmentDTO` needs counts per assignment, so rendering a list of N
   * assignments through `countBlanks` costs 2N queries. Use this instead.
   *
   * Every uuid in `assignmentUuids` is present in the returned map, including ones
   * with no items and no attempts — those map to an all-zero `BlankCounts` rather
   * than being absent, so callers never need a `?? 0` fallback.
   */
  async countBlanksFor(assignmentUuids: string[]): Promise<Map<string, BlankCounts>> {
    const counts = new Map<string, BlankCounts>(
      assignmentUuids.map((uuid) => [uuid, emptyCounts()]),
    );
    if (counts.size === 0) return counts;

    const uuids = Array.from(counts.keys());
    const [items, resolvedAttempts] = await Promise.all([
      this.prisma.drillAssignmentItem.findMany({
        where: { assignmentUuid: { in: uuids } },
        select: { assignmentUuid: true, blanks: true },
      }),
      // `isCorrect` comes back too: the same query answers both "is this position
      // resolved" and "was it resolved by answering correctly", so splitting the
      // counts costs no extra round trip.
      this.prisma.drillAttempt.findMany({
        where: {
          assignmentUuid: { in: uuids },
          OR: [{ isCorrect: true }, { revealed: true }],
        },
        select: {
          assignmentUuid: true,
          itemUuid: true,
          blankIndex: true,
          isCorrect: true,
        },
      }),
    ]);

    for (const item of items) {
      const entry = counts.get(item.assignmentUuid);
      // `blanks` is an unvalidated Json column — a non-array contributes 0 rather
      // than throwing, matching gradeBlank's tolerance of the same blob.
      if (entry) entry.blanksTotal += Array.isArray(item.blanks) ? item.blanks.length : 0;
    }

    const resolved = new Map<string, Set<string>>();
    const correct = new Map<string, Set<string>>();
    for (const attempt of resolvedAttempts) {
      const position = `${attempt.itemUuid}:${attempt.blankIndex}`;
      addPosition(resolved, attempt.assignmentUuid, position);
      // A position counts as correct if ANY attempt on it was correct. A student who
      // answers correctly and later reveals the same blank keeps the correct answer;
      // one who reveals first and then types it does too.
      if (attempt.isCorrect) addPosition(correct, attempt.assignmentUuid, position);
    }

    for (const [assignmentUuid, entry] of counts) {
      entry.blanksResolved = resolved.get(assignmentUuid)?.size ?? 0;
      entry.blanksCorrect = correct.get(assignmentUuid)?.size ?? 0;
      // Derived, never counted separately: a position is revealed exactly when it is
      // resolved without being correct. Subtracting keeps the two consistent by
      // construction, so they can never disagree about the same blank.
      entry.blanksRevealed = entry.blanksResolved - entry.blanksCorrect;
    }

    return counts;
  }
}

function emptyCounts(): BlankCounts {
  return { blanksCorrect: 0, blanksResolved: 0, blanksRevealed: 0, blanksTotal: 0 };
}

function addPosition(index: Map<string, Set<string>>, key: string, position: string): void {
  let positions = index.get(key);
  if (!positions) {
    positions = new Set<string>();
    index.set(key, positions);
  }
  positions.add(position);
}
