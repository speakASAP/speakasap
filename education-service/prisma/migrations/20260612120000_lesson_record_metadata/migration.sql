-- Lesson recording metadata and private object-key references.
-- Stores keys only; object storage remains private and is not modified by this migration.

CREATE TABLE "education_lessonrecord" (
    "uuid" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "record" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "record_unavailable" TEXT NOT NULL DEFAULT '',
    "parts" JSONB NOT NULL DEFAULT '[]',
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "education_lessonrecord_pkey" PRIMARY KEY ("uuid")
);

CREATE TABLE "education_lessonrecordpart" (
    "uuid" UUID NOT NULL,
    "lesson_record_id" UUID NOT NULL,
    "part_file" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "education_lessonrecordpart_pkey" PRIMARY KEY ("uuid")
);

CREATE UNIQUE INDEX "education_lessonrecord_lesson_id_key" ON "education_lessonrecord"("lesson_id");
CREATE INDEX "education_lessonrecord_lesson_id_idx" ON "education_lessonrecord"("lesson_id");
CREATE INDEX "education_lessonrecordpart_lesson_record_id_idx" ON "education_lessonrecordpart"("lesson_record_id");

ALTER TABLE "education_lessonrecord"
  ADD CONSTRAINT "education_lessonrecord_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "education_lesson"("uuid")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "education_lessonrecordpart"
  ADD CONSTRAINT "education_lessonrecordpart_lesson_record_id_fkey"
  FOREIGN KEY ("lesson_record_id") REFERENCES "education_lessonrecord"("uuid")
  ON DELETE CASCADE ON UPDATE CASCADE;
