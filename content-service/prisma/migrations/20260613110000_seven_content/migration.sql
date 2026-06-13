-- CreateTable
CREATE TABLE "SevenCourse" (
    "id" SERIAL NOT NULL,
    "legacyId" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "materialLanguage" VARCHAR(2) NOT NULL DEFAULT 'ru',
    "metaKeywords" TEXT,
    "metaDescription" TEXT,
    "languageId" INTEGER NOT NULL,
    "appPackage" VARCHAR(255),
    "materialsChanged" DATE NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "SevenCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SevenLesson" (
    "id" SERIAL NOT NULL,
    "legacyId" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "courseId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "prefix" VARCHAR(255),
    "template" VARCHAR(255) NOT NULL,
    "bodyHtml" TEXT NOT NULL DEFAULT '',
    "metaKeywords" TEXT,
    "metaDescription" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "SevenLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SevenExercise" (
    "id" SERIAL NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "legacyKey" VARCHAR(512) NOT NULL,
    "exerciseTemplate" VARCHAR(255) NOT NULL,
    "answerTemplate" VARCHAR(255),
    "exerciseHtml" TEXT NOT NULL DEFAULT '',
    "answerHtml" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "SevenExercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SevenCourse_legacyId_key" ON "SevenCourse"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "SevenCourse_languageId_materialLanguage_key" ON "SevenCourse"("languageId", "materialLanguage");

-- CreateIndex
CREATE INDEX "SevenCourse_materialLanguage_idx" ON "SevenCourse"("materialLanguage");

-- CreateIndex
CREATE UNIQUE INDEX "SevenLesson_legacyId_key" ON "SevenLesson"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "SevenLesson_courseId_order_key" ON "SevenLesson"("courseId", "order");

-- CreateIndex
CREATE INDEX "SevenLesson_courseId_order_idx" ON "SevenLesson"("courseId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SevenExercise_legacyKey_key" ON "SevenExercise"("legacyKey");

-- CreateIndex
CREATE UNIQUE INDEX "SevenExercise_lessonId_order_key" ON "SevenExercise"("lessonId", "order");

-- CreateIndex
CREATE INDEX "SevenExercise_lessonId_order_idx" ON "SevenExercise"("lessonId", "order");

-- AddForeignKey
ALTER TABLE "SevenCourse" ADD CONSTRAINT "SevenCourse_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SevenLesson" ADD CONSTRAINT "SevenLesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "SevenCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SevenExercise" ADD CONSTRAINT "SevenExercise_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "SevenLesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
