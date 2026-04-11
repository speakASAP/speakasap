-- CreateTable
CREATE TABLE "LanguageTest" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "tag" VARCHAR(255) NOT NULL,
    "languageId" INTEGER NOT NULL,
    "languageCode" VARCHAR(32) NOT NULL,
    "languageName" VARCHAR(255) NOT NULL,

    CONSTRAINT "LanguageTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Level" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "difficult" INTEGER NOT NULL,

    CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelRecommendation" (
    "id" SERIAL NOT NULL,
    "levelId" INTEGER NOT NULL,
    "languageId" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "link" VARCHAR(512) NOT NULL,

    CONSTRAINT "LevelRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LanguageQuestion" (
    "id" SERIAL NOT NULL,
    "testId" INTEGER NOT NULL,
    "levelId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "isTrashed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LanguageQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LanguageAnswer" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "isTrashed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LanguageAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LanguageUserTest" (
    "id" SERIAL NOT NULL,
    "testId" INTEGER NOT NULL,
    "userId" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "LanguageUserTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LanguageUserTestQuestion" (
    "id" SERIAL NOT NULL,
    "userTestId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LanguageUserTestQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LanguageUserTestQuestionAnswer" (
    "userTestQuestionId" INTEGER NOT NULL,
    "answerId" INTEGER NOT NULL,

    CONSTRAINT "LanguageUserTestQuestionAnswer_pkey" PRIMARY KEY ("userTestQuestionId","answerId")
);

-- CreateTable
CREATE TABLE "LanguageUserTestResult" (
    "userTestId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "levelId" INTEGER NOT NULL,

    CONSTRAINT "LanguageUserTestResult_pkey" PRIMARY KEY ("userTestId")
);

-- CreateTable
CREATE TABLE "AssetUserTest" (
    "id" UUID NOT NULL,
    "userId" VARCHAR(64) NOT NULL,
    "asset" VARCHAR(255) NOT NULL,
    "questions" JSONB NOT NULL DEFAULT '{}',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dueDate" DATE,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetUserTest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LanguageTest_tag_languageId_key" ON "LanguageTest"("tag", "languageId");

-- CreateIndex
CREATE UNIQUE INDEX "LanguageTest_tag_languageCode_key" ON "LanguageTest"("tag", "languageCode");

-- CreateIndex
CREATE INDEX "LevelRecommendation_levelId_languageId_idx" ON "LevelRecommendation"("levelId", "languageId");

-- CreateIndex
CREATE INDEX "LanguageQuestion_testId_levelId_idx" ON "LanguageQuestion"("testId", "levelId");

-- CreateIndex
CREATE INDEX "LanguageUserTest_userId_createdAt_idx" ON "LanguageUserTest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AssetUserTest_userId_asset_createdAt_idx" ON "AssetUserTest"("userId", "asset", "createdAt");

-- AddForeignKey
ALTER TABLE "LevelRecommendation" ADD CONSTRAINT "LevelRecommendation_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanguageQuestion" ADD CONSTRAINT "LanguageQuestion_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LanguageTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanguageQuestion" ADD CONSTRAINT "LanguageQuestion_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanguageAnswer" ADD CONSTRAINT "LanguageAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "LanguageQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanguageUserTest" ADD CONSTRAINT "LanguageUserTest_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LanguageTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanguageUserTestQuestion" ADD CONSTRAINT "LanguageUserTestQuestion_userTestId_fkey" FOREIGN KEY ("userTestId") REFERENCES "LanguageUserTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanguageUserTestQuestion" ADD CONSTRAINT "LanguageUserTestQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "LanguageQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanguageUserTestQuestionAnswer" ADD CONSTRAINT "LanguageUserTestQuestionAnswer_userTestQuestionId_fkey" FOREIGN KEY ("userTestQuestionId") REFERENCES "LanguageUserTestQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanguageUserTestQuestionAnswer" ADD CONSTRAINT "LanguageUserTestQuestionAnswer_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "LanguageAnswer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanguageUserTestResult" ADD CONSTRAINT "LanguageUserTestResult_userTestId_fkey" FOREIGN KEY ("userTestId") REFERENCES "LanguageUserTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanguageUserTestResult" ADD CONSTRAINT "LanguageUserTestResult_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

