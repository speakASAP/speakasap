import { DrillAssignmentDTO, GenerationProgress } from './contracts';

/**
 * Map an assignment row to the student/teacher-facing DTO.
 *
 * Fields are listed **explicitly, never spread** — a spread is how
 * `firstTryAccuracy` and `items[].blanks` (answers) leak. Two tests exist purely to
 * catch a spread being reintroduced.
 *
 * `row` is typed `any` by plan decision (adjudicated), which means TypeScript will
 * not catch either of these two real preconditions. Both are on the caller:
 *
 * 1. **`row` must have been fetched with `items` included.** `itemCount` is
 *    `row.items?.length ?? 0`, so a row fetched without them silently reports
 *    `itemCount: 0` instead of failing. `AssignmentsRepository` always includes
 *    `items: { select: { uuid: true } }`; any hand-rolled query must too.
 * 2. **`row` must be a live Prisma row, not JSON.** `createdAt`, `dueAt`,
 *    `assignedAt` and `completedAt` are called as `Date` objects, so a
 *    JSON-deserialized row (cache read, HTTP hop, queue payload) throws
 *    `TypeError: row.createdAt.toISOString is not a function`. Rehydrate the dates
 *    before calling.
 */
export function toAssignmentDTO(
  row: any,
  counts: { blanksCorrect: number; blanksTotal: number },
): DrillAssignmentDTO {
  const progress = row.generationProgress as Partial<GenerationProgress> | null;
  return {
    uuid: row.uuid,
    setUuid: row.setUuid,
    studentId: row.studentId,
    teacherId: row.teacherId,
    origin: row.origin,
    lessonUuid: row.lessonUuid,
    title: row.title,
    languageCode: row.languageCode,
    materialLanguage: row.materialLanguage,
    status: row.status,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    resourceLinks: row.resourceLinks ?? [],
    itemCount: row.items?.length ?? 0,
    blanksCorrect: counts.blanksCorrect,
    blanksTotal: counts.blanksTotal,
    generationProgress: progress && progress.phase ? (progress as GenerationProgress) : null,
    createdAt: row.createdAt.toISOString(),
    assignedAt: row.assignedAt ? row.assignedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}
