-- CreateTable
CREATE TABLE "Language" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(2) NOT NULL,
    "machineName" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "iconPath" VARCHAR(255) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "speaker" VARCHAR(255) NOT NULL DEFAULT 'носитель',

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrammarCourse" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "materialLanguage" VARCHAR(2) NOT NULL DEFAULT 'ru',
    "metaKeywords" TEXT,
    "metaDescription" TEXT,
    "languageId" INTEGER NOT NULL,

    CONSTRAINT "GrammarCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrammarLesson" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(512) NOT NULL,
    "courseId" INTEGER NOT NULL,
    "template" VARCHAR(255) NOT NULL,
    "alias" VARCHAR(255),
    "url" VARCHAR(255) NOT NULL,
    "section" VARCHAR(255),
    "teaser" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "metaKeywords" TEXT,
    "metaDescription" TEXT,

    CONSTRAINT "GrammarLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneticsCourse" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "materialLanguage" VARCHAR(2) NOT NULL DEFAULT 'ru',
    "metaKeywords" TEXT,
    "metaDescription" TEXT,
    "languageId" INTEGER NOT NULL,

    CONSTRAINT "PhoneticsCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneticsLesson" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "courseId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "metaKeywords" TEXT,
    "metaDescription" TEXT,

    CONSTRAINT "PhoneticsLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongsCourse" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "materialLanguage" VARCHAR(2) NOT NULL DEFAULT 'ru',
    "languageId" INTEGER NOT NULL,

    CONSTRAINT "SongsCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongsLesson" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "courseId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "SongsLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Word" (
    "id" SERIAL NOT NULL,
    "word" VARCHAR(255) NOT NULL,
    "transcription" VARCHAR(255),
    "translation" TEXT,
    "languageId" INTEGER NOT NULL,

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordTheme" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "moduleClass" VARCHAR(255) NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WordTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordThemeRelation" (
    "id" SERIAL NOT NULL,
    "wordId" INTEGER NOT NULL,
    "themeId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WordThemeRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Language_code_key" ON "Language"("code");

-- CreateIndex
CREATE INDEX "Language_order_idx" ON "Language"("order");

-- CreateIndex
CREATE INDEX "Language_name_idx" ON "Language"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GrammarCourse_languageId_key" ON "GrammarCourse"("languageId");

-- CreateIndex
CREATE INDEX "GrammarLesson_courseId_order_idx" ON "GrammarLesson"("courseId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneticsCourse_languageId_key" ON "PhoneticsCourse"("languageId");

-- CreateIndex
CREATE INDEX "PhoneticsLesson_courseId_order_idx" ON "PhoneticsLesson"("courseId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SongsCourse_languageId_key" ON "SongsCourse"("languageId");

-- CreateIndex
CREATE INDEX "SongsLesson_courseId_order_idx" ON "SongsLesson"("courseId", "order");

-- CreateIndex
CREATE INDEX "Word_word_idx" ON "Word"("word");

-- CreateIndex
CREATE UNIQUE INDEX "Word_word_languageId_translation_key" ON "Word"("word", "languageId", "translation");

-- CreateIndex
CREATE INDEX "WordTheme_order_idx" ON "WordTheme"("order");

-- CreateIndex
CREATE INDEX "WordTheme_name_idx" ON "WordTheme"("name");

-- CreateIndex
CREATE INDEX "WordThemeRelation_themeId_order_idx" ON "WordThemeRelation"("themeId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "WordThemeRelation_wordId_themeId_order_key" ON "WordThemeRelation"("wordId", "themeId", "order");

-- AddForeignKey
ALTER TABLE "GrammarCourse" ADD CONSTRAINT "GrammarCourse_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrammarLesson" ADD CONSTRAINT "GrammarLesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "GrammarCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneticsCourse" ADD CONSTRAINT "PhoneticsCourse_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneticsLesson" ADD CONSTRAINT "PhoneticsLesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "PhoneticsCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongsCourse" ADD CONSTRAINT "SongsCourse_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongsLesson" ADD CONSTRAINT "SongsLesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "SongsCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Word" ADD CONSTRAINT "Word_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordThemeRelation" ADD CONSTRAINT "WordThemeRelation_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordThemeRelation" ADD CONSTRAINT "WordThemeRelation_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "WordTheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

