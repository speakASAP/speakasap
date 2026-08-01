-- CreateTable
CREATE TABLE "DrillSet" (
    "uuid" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "languageId" INTEGER NOT NULL,
    "materialLanguage" VARCHAR(2) NOT NULL,
    "level" VARCHAR(4),
    "topicSlugs" TEXT[],
    "courseKey" VARCHAR(255),
    "lessonOrder" INTEGER,
    "origin" VARCHAR(16) NOT NULL,
    "reviewState" VARCHAR(16) NOT NULL,
    "createdByTeacherId" INTEGER,
    "instructions" TEXT,
    "visibility" VARCHAR(8) NOT NULL DEFAULT 'SHARED',
    "searchText" TEXT NOT NULL,
    "knownWordRatio" DOUBLE PRECISION,
    "timesAssigned" INTEGER NOT NULL DEFAULT 0,
    "timesSelfSelected" INTEGER NOT NULL DEFAULT 0,
    "teacherUpvotes" INTEGER NOT NULL DEFAULT 0,
    "studentUpvotes" INTEGER NOT NULL DEFAULT 0,
    "avgFirstTryAccuracy" DOUBLE PRECISION,
    "popularityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "DrillSet_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "DrillSetItem" (
    "id" SERIAL NOT NULL,
    "setUuid" UUID NOT NULL,
    "itemId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "validationState" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "validationIssues" JSONB NOT NULL DEFAULT '[]',
    "validatedAt" TIMESTAMP(3),
    "validatorVersion" VARCHAR(32),

    CONSTRAINT "DrillSetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrillSetRating" (
    "id" SERIAL NOT NULL,
    "setUuid" UUID NOT NULL,
    "raterType" VARCHAR(8) NOT NULL,
    "raterId" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrillSetRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrillSet_languageId_materialLanguage_reviewState_idx" ON "DrillSet"("languageId", "materialLanguage", "reviewState");

-- CreateIndex
CREATE INDEX "DrillSet_courseKey_lessonOrder_idx" ON "DrillSet"("courseKey", "lessonOrder");

-- CreateIndex
CREATE INDEX "DrillSet_popularityScore_idx" ON "DrillSet"("popularityScore");

-- CreateIndex
CREATE INDEX "DrillSetItem_itemId_idx" ON "DrillSetItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "DrillSetItem_setUuid_order_key" ON "DrillSetItem"("setUuid", "order");

-- CreateIndex
CREATE UNIQUE INDEX "DrillSetRating_setUuid_raterType_raterId_key" ON "DrillSetRating"("setUuid", "raterType", "raterId");

-- AddForeignKey
ALTER TABLE "DrillSet" ADD CONSTRAINT "DrillSet_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillSetItem" ADD CONSTRAINT "DrillSetItem_setUuid_fkey" FOREIGN KEY ("setUuid") REFERENCES "DrillSet"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillSetItem" ADD CONSTRAINT "DrillSetItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "DrillItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillSetRating" ADD CONSTRAINT "DrillSetRating_setUuid_fkey" FOREIGN KEY ("setUuid") REFERENCES "DrillSet"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;


-- Full-text index for library search. Prisma cannot express a GIN tsvector
-- index, so it is written by hand here.
--
-- 'simple' rather than a language-specific configuration is deliberate: the
-- corpus spans 16 languages and no single stemmer is right for all of them.
-- Substring recall matters more here than stemming.
CREATE INDEX "drill_set_searchtext_idx"
  ON "DrillSet"
  USING GIN (to_tsvector('simple', "searchText"));
