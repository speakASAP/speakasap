-- CreateTable
CREATE TABLE "CourseVocabulary" (
    "id" SERIAL NOT NULL,
    "courseKey" VARCHAR(255) NOT NULL,
    "languageId" INTEGER NOT NULL,
    "lessonOrder" INTEGER NOT NULL,
    "word" VARCHAR(255) NOT NULL,
    "lemma" VARCHAR(255),
    "translation" TEXT,
    "source" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseVocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseVocabulary_courseKey_languageId_lessonOrder_idx" ON "CourseVocabulary"("courseKey", "languageId", "lessonOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CourseVocabulary_courseKey_languageId_word_source_key" ON "CourseVocabulary"("courseKey", "languageId", "word", "source");

-- AddForeignKey
ALTER TABLE "CourseVocabulary" ADD CONSTRAINT "CourseVocabulary_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

