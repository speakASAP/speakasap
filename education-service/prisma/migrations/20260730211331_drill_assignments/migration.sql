-- CreateTable
CREATE TABLE "drill_assignment" (
    "uuid" UUID NOT NULL,
    "set_uuid" UUID NOT NULL,
    "student_id" INTEGER NOT NULL,
    "teacher_id" INTEGER,
    "origin" VARCHAR(8) NOT NULL,
    "student_course_uuid" UUID,
    "lesson_uuid" UUID,
    "batch_uuid" UUID,
    "title" VARCHAR(255) NOT NULL,
    "language_code" VARCHAR(8) NOT NULL,
    "material_language" VARCHAR(2) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "due_at" TIMESTAMP(3),
    "resource_links" JSONB NOT NULL DEFAULT '[]',
    "generation_meta" JSONB NOT NULL DEFAULT '{}',
    "generation_progress" JSONB NOT NULL DEFAULT '{}',
    "first_try_accuracy" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "drill_assignment_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "drill_assignment_item" (
    "uuid" UUID NOT NULL,
    "assignment_uuid" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "source_item_id" INTEGER,
    "template" TEXT NOT NULL,
    "blanks" JSONB NOT NULL,
    "hint" TEXT,
    "topic_slug" VARCHAR(255),

    CONSTRAINT "drill_assignment_item_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "drill_attempt" (
    "uuid" UUID NOT NULL,
    "assignment_uuid" UUID NOT NULL,
    "item_uuid" UUID NOT NULL,
    "blank_index" INTEGER NOT NULL,
    "submitted_value" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "revealed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drill_attempt_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "drill_assignment_batch" (
    "uuid" UUID NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "instructions" TEXT NOT NULL,
    "filter" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drill_assignment_batch_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE INDEX "drill_assignment_student_id_status_idx" ON "drill_assignment"("student_id", "status");

-- CreateIndex
CREATE INDEX "drill_assignment_teacher_id_status_idx" ON "drill_assignment"("teacher_id", "status");

-- CreateIndex
CREATE INDEX "drill_assignment_lesson_uuid_idx" ON "drill_assignment"("lesson_uuid");

-- CreateIndex
CREATE INDEX "drill_assignment_set_uuid_idx" ON "drill_assignment"("set_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "drill_assignment_item_assignment_uuid_order_key" ON "drill_assignment_item"("assignment_uuid", "order");

-- CreateIndex
CREATE INDEX "drill_attempt_assignment_uuid_item_uuid_idx" ON "drill_attempt"("assignment_uuid", "item_uuid");

-- AddForeignKey
ALTER TABLE "drill_assignment" ADD CONSTRAINT "drill_assignment_lesson_uuid_fkey" FOREIGN KEY ("lesson_uuid") REFERENCES "education_lesson"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drill_assignment_item" ADD CONSTRAINT "drill_assignment_item_assignment_uuid_fkey" FOREIGN KEY ("assignment_uuid") REFERENCES "drill_assignment"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
