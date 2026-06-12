-- Student lesson paid-access parity for private recording playback.
-- Mirrors legacy education_studentaccess without changing object storage.

CREATE TABLE "education_studentaccess" (
    "uuid" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "student_id" INTEGER NOT NULL,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "education_studentaccess_pkey" PRIMARY KEY ("uuid")
);

CREATE UNIQUE INDEX "education_studentaccess_lesson_id_student_id_key"
  ON "education_studentaccess"("lesson_id", "student_id");

CREATE INDEX "education_studentaccess_student_id_idx"
  ON "education_studentaccess"("student_id");

ALTER TABLE "education_studentaccess"
  ADD CONSTRAINT "education_studentaccess_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "education_lesson"("uuid")
  ON DELETE CASCADE ON UPDATE CASCADE;
