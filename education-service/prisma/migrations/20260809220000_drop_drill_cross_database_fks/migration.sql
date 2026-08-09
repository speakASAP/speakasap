-- Drop the two cross-database foreign keys on drill_assignment.
--
-- `lesson_uuid` and `student_course_uuid` point at `education_lesson` and
-- `education_studentcourse`, which are COPIES of the portal's tables populated by a
-- one-shot ETL that last ran 2026-06-26. The portal is the single source of truth for
-- lessons; Postgres cannot enforce a foreign key across two databases.
--
-- Effect in production: every teacher generating drilling for a lesson created after
-- 2026-06-26 got HTTP 500,
-- `Foreign key constraint violated: drill_assignment_lesson_uuid_fkey`, for a lesson
-- that genuinely exists in the portal. Reported 2026-08-09 for lesson
-- f249c6e4-e6ef-451d-a1b0-c4fb0a3b4477.
--
-- The columns REMAIN, as plain nullable UUIDs — only the constraints go. The precedent
-- is DrillAssignmentItem.sourceItemId, deliberately bare because it points at
-- content-service's database. Existence is checked by LessonClientService at write
-- time, which raises when the portal denies the lesson.
--
-- `batch_uuid` keeps its FK: DrillAssignmentBatch lives in this database.
--
-- Reversible: re-adding the constraints would restore the defect, so do not.

ALTER TABLE "drill_assignment"
  DROP CONSTRAINT IF EXISTS "drill_assignment_lesson_uuid_fkey";

ALTER TABLE "drill_assignment"
  DROP CONSTRAINT IF EXISTS "drill_assignment_student_course_uuid_fkey";
