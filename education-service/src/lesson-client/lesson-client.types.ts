/**
 * Types and errors for the portal lesson API.
 *
 * The portal (legacy Django) is the single source of truth for lessons. This service
 * holds no lesson tables: it previously read a COPY of them, populated by a one-shot ETL
 * that last ran 2026-06-26, which silently broke every lesson created after that date.
 *
 * LESSON-API: transitional — the portal is scheduled for sunset. When lessons move to
 * this platform, this module is the seam that gets repointed or deleted.
 */

/** One lesson, as served by the portal's internal API. Camelized from snake_case. */
export interface PortalLesson {
  uuid: string;
  order: number;
  /**
   * The legacy **Teacher profile pk** (182 for the user whose auth id resolves to 3) —
   * a different id space from the auth user id. Callers depend on that distinction.
   */
  teacherId: number | null;
  /** ISO-8601, or null for an unscheduled lesson. */
  start: string | null;
  isFinished: boolean;
  studentCourseUuid: string;
  moduleClass: string;
  needsTeacher: boolean;
  recommendation: string;
  toManager: string;
}

export interface PortalRosterGroup {
  uuid: string;
  name: string;
  studentIds: number[];
}

export interface PortalRoster {
  lessonUuid: string;
  teacherId: number | null;
  groups: PortalRosterGroup[];
  /** Everyone in the lesson's group — who attends. */
  studentIds: number[];
  /**
   * The subset who have PAID for this lesson (`StudentAccess.is_paid`).
   *
   * Separate from `studentIds` because they authorize different things. Drilling and
   * recording playback are for paying students; treating attendance as payment would
   * hand both to students who have not paid.
   */
  paidStudentIds: number[];
}

/**
 * The portal answered, definitively, that this lesson does not exist.
 *
 * Distinct from LessonServiceUnavailableError on purpose: this is a real 404 about a
 * real question, and a caller may legitimately turn it into its own 404. Never
 * represent it as an empty roster — that ambiguity hid a frozen lesson table for six
 * weeks.
 */
export class LessonNotFoundError extends Error {
  constructor(public readonly lessonUuid: string) {
    super(`Lesson ${lessonUuid} does not exist in the portal`);
    this.name = 'LessonNotFoundError';
  }
}

/**
 * The portal could not be reached, or answered with something unusable.
 *
 * ALWAYS raised, never swallowed. A drill roster that silently empties itself because
 * the portal was down is indistinguishable, to a teacher, from a genuinely empty group.
 */
export class LessonServiceUnavailableError extends Error {
  constructor(
    public readonly lessonUuid: string,
    public readonly reason: string,
  ) {
    super(`Portal lesson lookup failed for ${lessonUuid}: ${reason}`);
    this.name = 'LessonServiceUnavailableError';
  }
}
