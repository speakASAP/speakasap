-- CreateTable
CREATE TABLE "CourseCertificate" (
    "id" SERIAL NOT NULL,
    "studentCourseId" INTEGER NOT NULL,
    "ownerUserId" VARCHAR(64),
    "imagePath" VARCHAR(512) NOT NULL,
    "certText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationCertificate" (
    "id" SERIAL NOT NULL,
    "studentCourseId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "ownerUserId" VARCHAR(64),
    "imagePath" VARCHAR(512) NOT NULL,
    "certText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EducationCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestInstance" (
    "id" UUID NOT NULL,
    "userId" VARCHAR(64) NOT NULL,
    "code" VARCHAR(255) NOT NULL,
    "identifier" JSONB NOT NULL,
    "questions" JSONB NOT NULL DEFAULT '{}',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentCourseRef" VARCHAR(64),
    "studentPk" INTEGER,

    CONSTRAINT "QuestInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Questionnaire" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,

    CONSTRAINT "Questionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireQuestion" (
    "id" SERIAL NOT NULL,
    "questionnaireId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "header" VARCHAR(255),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuestionnaireQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuestionnaire" (
    "id" SERIAL NOT NULL,
    "questionnaireId" INTEGER NOT NULL,
    "userId" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "notificationTemplate" VARCHAR(255) NOT NULL DEFAULT 'quest_created',

    CONSTRAINT "UserQuestionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuestionnaireAnswer" (
    "userQuestionnaireId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "UserQuestionnaireAnswer_pkey" PRIMARY KEY ("userQuestionnaireId","questionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseCertificate_studentCourseId_key" ON "CourseCertificate"("studentCourseId");

-- CreateIndex
CREATE INDEX "CourseCertificate_ownerUserId_idx" ON "CourseCertificate"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "EducationCertificate_studentCourseId_studentId_key" ON "EducationCertificate"("studentCourseId", "studentId");

-- CreateIndex
CREATE INDEX "EducationCertificate_ownerUserId_idx" ON "EducationCertificate"("ownerUserId");

-- CreateIndex
CREATE INDEX "QuestInstance_userId_code_idx" ON "QuestInstance"("userId", "code");

-- CreateIndex
CREATE INDEX "QuestInstance_studentCourseRef_studentPk_idx" ON "QuestInstance"("studentCourseRef", "studentPk");

-- CreateIndex
CREATE INDEX "QuestionnaireQuestion_questionnaireId_sortOrder_idx" ON "QuestionnaireQuestion"("questionnaireId", "sortOrder");

-- CreateIndex
CREATE INDEX "UserQuestionnaire_userId_finishedAt_idx" ON "UserQuestionnaire"("userId", "finishedAt");

-- AddForeignKey
ALTER TABLE "QuestionnaireQuestion" ADD CONSTRAINT "QuestionnaireQuestion_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionnaire" ADD CONSTRAINT "UserQuestionnaire_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionnaireAnswer" ADD CONSTRAINT "UserQuestionnaireAnswer_userQuestionnaireId_fkey" FOREIGN KEY ("userQuestionnaireId") REFERENCES "UserQuestionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionnaireAnswer" ADD CONSTRAINT "UserQuestionnaireAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuestionnaireQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
