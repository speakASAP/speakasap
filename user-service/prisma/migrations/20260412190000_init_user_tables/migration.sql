-- CreateTable
CREATE TABLE "user_identity_mirror" (
    "auth_user_id" UUID NOT NULL,
    "legacy_portal_user_id" INTEGER,
    "first_name" VARCHAR(255) NOT NULL DEFAULT '',
    "last_name" VARCHAR(255) NOT NULL DEFAULT '',
    "email" VARCHAR(255) NOT NULL DEFAULT '',
    "phone" VARCHAR(255) NOT NULL DEFAULT '',
    "interface_language" VARCHAR(10) NOT NULL DEFAULT 'ru',
    "user_country" VARCHAR(10) NOT NULL DEFAULT 'ru',
    "avatar_storage_key" VARCHAR(512),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_identity_mirror_pkey" PRIMARY KEY ("auth_user_id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" SERIAL NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "legacy_portal_user_id" INTEGER,
    "not_loyal" BOOLEAN NOT NULL DEFAULT false,
    "spam_bot" BOOLEAN NOT NULL DEFAULT false,
    "do_not_contact" BOOLEAN NOT NULL DEFAULT false,
    "email_additional" VARCHAR(255) NOT NULL DEFAULT '',
    "manager_id" INTEGER,
    "telegram" VARCHAR(64) NOT NULL DEFAULT '',
    "whatsapp" VARCHAR(64) NOT NULL DEFAULT '',
    "phone_additional" VARCHAR(32) NOT NULL DEFAULT '',
    "read_help" BOOLEAN NOT NULL DEFAULT false,
    "motivation" TEXT NOT NULL DEFAULT '',
    "portrait" TEXT NOT NULL DEFAULT '',
    "sales_info" TEXT NOT NULL DEFAULT '',
    "country" VARCHAR(10) NOT NULL DEFAULT 'ru',
    "invoice_address" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" SERIAL NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "legacy_portal_user_id" INTEGER,
    "description" TEXT,
    "position" VARCHAR(255) NOT NULL DEFAULT '',
    "contract_name" VARCHAR(255) NOT NULL DEFAULT '',
    "passport_number" VARCHAR(255) NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "postal_code" VARCHAR(32) NOT NULL DEFAULT '',
    "city" VARCHAR(255) NOT NULL DEFAULT '',
    "address_cz" TEXT NOT NULL DEFAULT '',
    "city_cz" VARCHAR(255) NOT NULL DEFAULT '',
    "language_code" VARCHAR(32) NOT NULL,
    "russian" BOOLEAN NOT NULL DEFAULT false,
    "native" BOOLEAN NOT NULL DEFAULT false,
    "language_support" BOOLEAN NOT NULL DEFAULT false,
    "can_get_students" BOOLEAN NOT NULL DEFAULT false,
    "coordinator_info" TEXT NOT NULL DEFAULT '',
    "work_since" DATE,
    "contract_end" DATE,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_additional_languages" (
    "teacher_id" INTEGER NOT NULL,
    "language_code" VARCHAR(32) NOT NULL,

    CONSTRAINT "teacher_additional_languages_pkey" PRIMARY KEY ("teacher_id","language_code")
);

-- CreateTable
CREATE TABLE "managers" (
    "id" SERIAL NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "legacy_portal_user_id" INTEGER,
    "description" TEXT,
    "position" VARCHAR(255) NOT NULL DEFAULT '',
    "contract_name" VARCHAR(255) NOT NULL DEFAULT '',
    "passport_number" VARCHAR(255) NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "postal_code" VARCHAR(32) NOT NULL DEFAULT '',
    "city" VARCHAR(255) NOT NULL DEFAULT '',
    "address_cz" TEXT NOT NULL DEFAULT '',
    "city_cz" VARCHAR(255) NOT NULL DEFAULT '',

    CONSTRAINT "managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_profiles" (
    "id" SERIAL NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "legacy_portal_user_id" INTEGER,
    "additional_info" TEXT,
    "description" TEXT,
    "position" VARCHAR(255),

    CONSTRAINT "employee_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_identity_mirror_legacy_portal_user_id_key" ON "user_identity_mirror"("legacy_portal_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_auth_user_id_key" ON "students"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_legacy_portal_user_id_key" ON "students"("legacy_portal_user_id");

-- CreateIndex
CREATE INDEX "students_manager_id_idx" ON "students"("manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_auth_user_id_key" ON "teachers"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_legacy_portal_user_id_key" ON "teachers"("legacy_portal_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "managers_auth_user_id_key" ON "managers"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "managers_legacy_portal_user_id_key" ON "managers"("legacy_portal_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_auth_user_id_key" ON "employee_profiles"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_legacy_portal_user_id_key" ON "employee_profiles"("legacy_portal_user_id");

-- AddForeignKey
ALTER TABLE "teacher_additional_languages" ADD CONSTRAINT "teacher_additional_languages_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
