-- CreateTable
CREATE TABLE "education_group" (
    "uuid" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "education_group_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "education_group_students" (
    "id" SERIAL NOT NULL,
    "group_id" UUID NOT NULL,
    "student_id" INTEGER NOT NULL,

    CONSTRAINT "education_group_students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education_studentcourse" (
    "uuid" UUID NOT NULL,
    "course_class" VARCHAR(255) NOT NULL,
    "course_display_title" VARCHAR(255) NOT NULL DEFAULT '',
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "open_strategy_class" VARCHAR(255) NOT NULL,
    "group_id" UUID NOT NULL,
    "previous_id" UUID,
    "is_finished" BOOLEAN NOT NULL DEFAULT false,
    "end_date" TIMESTAMP(3),
    "is_new" BOOLEAN NOT NULL DEFAULT true,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "auto_pause" BOOLEAN NOT NULL DEFAULT false,
    "pause_date" TIMESTAMP(3),

    CONSTRAINT "education_studentcourse_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "education_lesson" (
    "uuid" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "teacher_id" INTEGER,
    "start" TIMESTAMP(3),
    "lesson_change_start_count" INTEGER NOT NULL DEFAULT 0,
    "is_finished" BOOLEAN NOT NULL DEFAULT false,
    "student_course_id" UUID NOT NULL,
    "module_class" VARCHAR(255) NOT NULL,
    "needs_teacher" BOOLEAN NOT NULL DEFAULT false,
    "assign_teacher_automatically" BOOLEAN NOT NULL DEFAULT false,
    "recommendation" TEXT NOT NULL DEFAULT '',
    "to_manager" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "education_lesson_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "education_homework" (
    "uuid" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "student_id" INTEGER NOT NULL,
    "content_student" TEXT NOT NULL DEFAULT '',
    "content_teacher" TEXT NOT NULL DEFAULT '',
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "checked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "education_homework_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "education_group_students_group_id_student_id_key" ON "education_group_students"("group_id", "student_id");

-- CreateIndex
CREATE INDEX "education_group_students_student_id_idx" ON "education_group_students"("student_id");

-- AddForeignKey
ALTER TABLE "education_group_students" ADD CONSTRAINT "education_group_students_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "education_group"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "education_studentcourse_previous_id_key" ON "education_studentcourse"("previous_id");

-- CreateIndex
CREATE INDEX "education_studentcourse_group_id_idx" ON "education_studentcourse"("group_id");

-- AddForeignKey
ALTER TABLE "education_studentcourse" ADD CONSTRAINT "education_studentcourse_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "education_group"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_studentcourse" ADD CONSTRAINT "education_studentcourse_previous_id_fkey" FOREIGN KEY ("previous_id") REFERENCES "education_studentcourse"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "education_lesson_student_course_id_idx" ON "education_lesson"("student_course_id");

-- AddForeignKey
ALTER TABLE "education_lesson" ADD CONSTRAINT "education_lesson_student_course_id_fkey" FOREIGN KEY ("student_course_id") REFERENCES "education_studentcourse"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "education_homework_lesson_id_student_id_key" ON "education_homework"("lesson_id", "student_id");

-- CreateIndex
CREATE INDEX "education_homework_student_id_idx" ON "education_homework"("student_id");

-- AddForeignKey
ALTER TABLE "education_homework" ADD CONSTRAINT "education_homework_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "education_lesson"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
