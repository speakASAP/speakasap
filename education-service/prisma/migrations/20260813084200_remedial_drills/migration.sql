-- AlterTable
ALTER TABLE "drill_assignment" ADD COLUMN     "remedial_part" INTEGER,
ADD COLUMN     "source_analysis_uuid" UUID;

-- CreateTable
CREATE TABLE "grammar_topic" (
    "slug" VARCHAR(128) NOT NULL,
    "language_code" VARCHAR(8) NOT NULL,
    "titles" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grammar_topic_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "drill_analysis_run" (
    "uuid" UUID NOT NULL,
    "source_assignment_uuid" UUID NOT NULL,
    "student_id" INTEGER NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "error_message" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drill_analysis_run_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "drill_gap_analysis" (
    "uuid" UUID NOT NULL,
    "run_uuid" UUID NOT NULL,
    "source_assignment_uuid" UUID NOT NULL,
    "student_id" INTEGER NOT NULL,
    "topic_slug" VARCHAR(128) NOT NULL,
    "language_code" VARCHAR(8) NOT NULL,
    "material_language" VARCHAR(2) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "explanation" TEXT NOT NULL,
    "rules" JSONB NOT NULL DEFAULT '[]',
    "examples" JSONB NOT NULL DEFAULT '[]',
    "failed_answers" JSONB NOT NULL DEFAULT '[]',
    "edited_by_teacher_id" INTEGER,
    "edited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drill_gap_analysis_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "student_word_mastery" (
    "uuid" UUID NOT NULL,
    "student_id" INTEGER NOT NULL,
    "language_code" VARCHAR(8) NOT NULL,
    "normalized_answer" TEXT NOT NULL,
    "display_answer" TEXT NOT NULL,
    "clean_streak" INTEGER NOT NULL DEFAULT 0,
    "total_mistakes" INTEGER NOT NULL DEFAULT 0,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "mastered_at" TIMESTAMP(3),

    CONSTRAINT "student_word_mastery_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE INDEX "grammar_topic_language_code_idx" ON "grammar_topic"("language_code");

-- CreateIndex
CREATE UNIQUE INDEX "drill_analysis_run_source_assignment_uuid_key" ON "drill_analysis_run"("source_assignment_uuid");

-- CreateIndex
CREATE INDEX "drill_analysis_run_student_id_status_idx" ON "drill_analysis_run"("student_id", "status");

-- CreateIndex
CREATE INDEX "drill_gap_analysis_student_id_topic_slug_idx" ON "drill_gap_analysis"("student_id", "topic_slug");

-- CreateIndex
CREATE INDEX "drill_gap_analysis_run_uuid_idx" ON "drill_gap_analysis"("run_uuid");

-- CreateIndex
CREATE INDEX "drill_gap_analysis_topic_slug_idx" ON "drill_gap_analysis"("topic_slug");

-- CreateIndex
CREATE UNIQUE INDEX "drill_gap_analysis_source_assignment_uuid_topic_slug_key" ON "drill_gap_analysis"("source_assignment_uuid", "topic_slug");

-- CreateIndex
CREATE INDEX "student_word_mastery_student_id_language_code_mastered_at_idx" ON "student_word_mastery"("student_id", "language_code", "mastered_at");

-- CreateIndex
CREATE UNIQUE INDEX "student_word_mastery_student_id_language_code_normalized_an_key" ON "student_word_mastery"("student_id", "language_code", "normalized_answer");

-- CreateIndex
CREATE INDEX "drill_assignment_source_analysis_uuid_idx" ON "drill_assignment"("source_analysis_uuid");

-- AddForeignKey
ALTER TABLE "drill_assignment" ADD CONSTRAINT "drill_assignment_source_analysis_uuid_fkey" FOREIGN KEY ("source_analysis_uuid") REFERENCES "drill_gap_analysis"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drill_analysis_run" ADD CONSTRAINT "drill_analysis_run_source_assignment_uuid_fkey" FOREIGN KEY ("source_assignment_uuid") REFERENCES "drill_assignment"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drill_gap_analysis" ADD CONSTRAINT "drill_gap_analysis_run_uuid_fkey" FOREIGN KEY ("run_uuid") REFERENCES "drill_analysis_run"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drill_gap_analysis" ADD CONSTRAINT "drill_gap_analysis_topic_slug_fkey" FOREIGN KEY ("topic_slug") REFERENCES "grammar_topic"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

