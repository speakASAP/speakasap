-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "machine_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "help" TEXT NOT NULL DEFAULT '',
    "settings_title" TEXT,
    "body_html" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_groups" (
    "id" TEXT NOT NULL,
    "machine_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_group_managers" (
    "group_id" TEXT NOT NULL,
    "manager_user_id" VARCHAR(64) NOT NULL,

    CONSTRAINT "notification_group_managers_pkey" PRIMARY KEY ("group_id","manager_user_id")
);

-- CreateTable
CREATE TABLE "template_groups" (
    "template_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,

    CONSTRAINT "template_groups_pkey" PRIMARY KEY ("template_id","group_id")
);

-- CreateTable
CREATE TABLE "letters" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "user_id" VARCHAR(64),
    "rendered_body" TEXT NOT NULL,
    "rendered_body_sha256" VARCHAR(64) NOT NULL,
    "recipients" JSONB NOT NULL,
    "from_email" VARCHAR(512),
    "sent_at" TIMESTAMP(3),
    "transport_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "common_email_settings" (
    "user_id" VARCHAR(64) NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "do_not_contact" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "common_email_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "template_preferences" (
    "id" TEXT NOT NULL,
    "user_id" VARCHAR(64) NOT NULL,
    "template_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "in_app_notifications" (
    "id" TEXT NOT NULL,
    "user_id" VARCHAR(64) NOT NULL,
    "text" TEXT NOT NULL,
    "link" VARCHAR(2048),
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_idempotency" (
    "idempotency_key" VARCHAR(128) NOT NULL,
    "body_hash" VARCHAR(128) NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatch_idempotency_pkey" PRIMARY KEY ("idempotency_key")
);

CREATE UNIQUE INDEX "notification_templates_machine_name_key" ON "notification_templates"("machine_name");

CREATE INDEX "notification_templates_created_at_id_idx" ON "notification_templates"("created_at" DESC, "id" DESC);

CREATE UNIQUE INDEX "notification_groups_machine_name_key" ON "notification_groups"("machine_name");

CREATE INDEX "notification_groups_created_at_id_idx" ON "notification_groups"("created_at" DESC, "id" DESC);

CREATE INDEX "letters_user_id_created_at_idx" ON "letters"("user_id", "created_at" DESC);

CREATE UNIQUE INDEX "template_preferences_user_id_template_id_key" ON "template_preferences"("user_id", "template_id");

CREATE INDEX "in_app_notifications_user_id_created_at_idx" ON "in_app_notifications"("user_id", "created_at" DESC);

CREATE INDEX "dispatch_idempotency_expires_at_idx" ON "dispatch_idempotency"("expires_at");

ALTER TABLE "notification_group_managers" ADD CONSTRAINT "notification_group_managers_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "notification_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "template_groups" ADD CONSTRAINT "template_groups_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "template_groups" ADD CONSTRAINT "template_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "notification_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "letters" ADD CONSTRAINT "letters_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "template_preferences" ADD CONSTRAINT "template_preferences_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
