-- CreateTable
CREATE TABLE "DrillTopic" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "languageId" INTEGER NOT NULL,
    "materialLanguage" VARCHAR(2) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "level" VARCHAR(4),
    "grammarLessonId" INTEGER,
    "parentTopicId" INTEGER,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrillTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrillItem" (
    "id" SERIAL NOT NULL,
    "languageId" INTEGER NOT NULL,
    "materialLanguage" VARCHAR(2) NOT NULL,
    "topicId" INTEGER,
    "level" VARCHAR(4),
    "template" TEXT NOT NULL,
    "blanks" JSONB NOT NULL,
    "plainText" TEXT NOT NULL,
    "hint" TEXT,
    "sourceType" VARCHAR(16) NOT NULL,
    "sourceRef" VARCHAR(255),
    "courseKey" VARCHAR(255),
    "lessonOrder" INTEGER,
    "unknownWords" JSONB NOT NULL DEFAULT '[]',
    "hash" VARCHAR(64) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    "timesShown" INTEGER NOT NULL DEFAULT 0,
    "timesCorrectFirstTry" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrillItemRevision" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "template" TEXT NOT NULL,
    "blanks" JSONB NOT NULL,
    "hint" TEXT,
    "reason" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrillItemRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrillTopic_languageId_materialLanguage_idx" ON "DrillTopic"("languageId", "materialLanguage");

-- CreateIndex
CREATE UNIQUE INDEX "DrillTopic_languageId_materialLanguage_slug_key" ON "DrillTopic"("languageId", "materialLanguage", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "DrillItem_hash_key" ON "DrillItem"("hash");

-- CreateIndex
CREATE INDEX "DrillItem_languageId_materialLanguage_topicId_status_idx" ON "DrillItem"("languageId", "materialLanguage", "topicId", "status");

-- CreateIndex
CREATE INDEX "DrillItem_courseKey_lessonOrder_idx" ON "DrillItem"("courseKey", "lessonOrder");

-- CreateIndex
CREATE INDEX "DrillItemRevision_itemId_createdAt_idx" ON "DrillItemRevision"("itemId", "createdAt");

-- AddForeignKey
ALTER TABLE "DrillTopic" ADD CONSTRAINT "DrillTopic_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillItem" ADD CONSTRAINT "DrillItem_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillItem" ADD CONSTRAINT "DrillItem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "DrillTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillItemRevision" ADD CONSTRAINT "DrillItemRevision_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "DrillItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

