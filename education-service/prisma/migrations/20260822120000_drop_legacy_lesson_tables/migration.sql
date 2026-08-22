-- Drop the copied lesson tables. See prisma/schema.prisma header.
--
-- These six tables were filled by a one-shot ETL (scripts/migrate-education-from-legacy.py)
-- that last ran 2026-06-26 and had no recurring sync. Every lesson created after that date
-- was missing, which is why rosters came back empty and drills 500'd for lessons that
-- genuinely existed. All readers moved to the portal HTTP API in Tasks 5-9; verified at
-- generation time that no `prisma.lesson`/`group`/`studentCourse`/`studentAccess`/`homework`
-- call sites remain in src/.
--
-- The DropForeignKey statements below are constraints BETWEEN these six tables. The
-- cross-database FKs were already removed earlier (drill assignments 2026-08-09,
-- education_lessonrecord in 20260818210000_drop_lesson_record_cross_database_fk).
--
-- Prisma also wanted to emit
--   ALTER TABLE "education_lessonrecord" ALTER COLUMN "updated" DROP DEFAULT;
-- That is the known drift documented at schema.prisma and is deliberately STRIPPED:
-- dropping a DB-level default on a legacy table Django may still write is not this
-- change's business.

-- DropForeignKey
ALTER TABLE "education_group_students" DROP CONSTRAINT "education_group_students_group_id_fkey";

-- DropForeignKey
ALTER TABLE "education_homework" DROP CONSTRAINT "education_homework_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "education_lesson" DROP CONSTRAINT "education_lesson_student_course_id_fkey";

-- DropForeignKey
ALTER TABLE "education_studentaccess" DROP CONSTRAINT "education_studentaccess_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "education_studentcourse" DROP CONSTRAINT "education_studentcourse_group_id_fkey";

-- DropForeignKey
ALTER TABLE "education_studentcourse" DROP CONSTRAINT "education_studentcourse_previous_id_fkey";

-- AlterTable

-- DropTable
DROP TABLE "education_group";

-- DropTable
DROP TABLE "education_group_students";

-- DropTable
DROP TABLE "education_homework";

-- DropTable
DROP TABLE "education_lesson";

-- DropTable
DROP TABLE "education_studentaccess";

-- DropTable
DROP TABLE "education_studentcourse";

