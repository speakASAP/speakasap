ALTER TABLE "education_lessonrecord" ADD COLUMN "duration_seconds" INTEGER;

ALTER TABLE "education_lessonrecord" ADD CONSTRAINT "education_lessonrecord_duration_seconds_non_negative" CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0);
