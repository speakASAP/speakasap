-- CreateEnum
CREATE TYPE "SalaryExpenseKind" AS ENUM ('generic', 'lesson', 'support_bonus');

-- CreateEnum
CREATE TYPE "CalculationRunStatus" AS ENUM ('draft', 'finalized', 'failed');

-- CreateEnum
CREATE TYPE "PayoutRunStatus" AS ENUM ('draft', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "PayoutLineStatus" AS ENUM ('draft', 'queued', 'processing', 'paid', 'failed');

-- CreateTable
CREATE TABLE "salary_profiles" (
    "id" TEXT NOT NULL,
    "legacy_profile_id" INTEGER,
    "legacy_portal_user_id" INTEGER NOT NULL,
    "auth_user_id" TEXT,
    "currency" TEXT NOT NULL,
    "preferable_pm" TEXT,
    "salary" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "show_as_teacher" BOOLEAN NOT NULL DEFAULT true,
    "show_as_other" BOOLEAN NOT NULL DEFAULT false,
    "bank_account" TEXT,
    "paypal_account" TEXT,
    "work_duration_lower_bound" INTEGER,
    "work_duration_upper_bound" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_expenses" (
    "id" TEXT NOT NULL,
    "legacy_expense_id" INTEGER,
    "profile_id" TEXT NOT NULL,
    "legacy_portal_user_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "qty" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "comment" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL,
    "kind" "SalaryExpenseKind" NOT NULL,
    "lesson_uuid" TEXT,
    "legacy_student_id" INTEGER,
    "legacy_student_group_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_contracts" (
    "id" TEXT NOT NULL,
    "legacy_contract_id" INTEGER,
    "legacy_portal_user_id" INTEGER NOT NULL,
    "profile_id" TEXT,
    "document_storage_key" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "valid_from" DATE,
    "valid_till" DATE,
    "main_contract_id" TEXT,
    "contract_uid" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_runs" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" "CalculationRunStatus" NOT NULL DEFAULT 'draft',
    "rules_version" TEXT NOT NULL,
    "profile_ids_filter" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calculation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_lines" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "legacy_portal_user_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "breakdown" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_runs" (
    "id" TEXT NOT NULL,
    "status" "PayoutRunStatus" NOT NULL DEFAULT 'draft',
    "calculation_run_id" TEXT,
    "lock_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_lines" (
    "id" TEXT NOT NULL,
    "payout_run_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "legacy_portal_user_id" INTEGER NOT NULL,
    "calculation_line_id" TEXT,
    "salary_expense_id" TEXT,
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PayoutLineStatus" NOT NULL DEFAULT 'draft',
    "payout_ref" TEXT,
    "payment_service_ref" TEXT,
    "period" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "idempotency_key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("idempotency_key")
);

-- CreateIndex
CREATE UNIQUE INDEX "salary_profiles_legacy_profile_id_key" ON "salary_profiles"("legacy_profile_id");

-- CreateIndex
CREATE INDEX "salary_profiles_legacy_portal_user_id_idx" ON "salary_profiles"("legacy_portal_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "salary_expenses_legacy_expense_id_key" ON "salary_expenses"("legacy_expense_id");

-- CreateIndex
CREATE INDEX "salary_expenses_profile_id_date_idx" ON "salary_expenses"("profile_id", "date");

-- CreateIndex
CREATE INDEX "salary_expenses_legacy_portal_user_id_date_idx" ON "salary_expenses"("legacy_portal_user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "employee_contracts_legacy_contract_id_key" ON "employee_contracts"("legacy_contract_id");

-- CreateIndex
CREATE INDEX "employee_contracts_legacy_portal_user_id_idx" ON "employee_contracts"("legacy_portal_user_id");

-- CreateIndex
CREATE INDEX "employee_contracts_profile_id_idx" ON "employee_contracts"("profile_id");

-- CreateIndex
CREATE INDEX "calculation_runs_created_at_idx" ON "calculation_runs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "calculation_lines_run_id_idx" ON "calculation_lines"("run_id");

-- CreateIndex
CREATE INDEX "payout_runs_created_at_idx" ON "payout_runs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "payout_lines_payout_run_id_idx" ON "payout_lines"("payout_run_id");

-- AddForeignKey
ALTER TABLE "salary_expenses" ADD CONSTRAINT "salary_expenses_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "salary_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_contracts" ADD CONSTRAINT "employee_contracts_main_contract_id_fkey" FOREIGN KEY ("main_contract_id") REFERENCES "employee_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_lines" ADD CONSTRAINT "calculation_lines_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "calculation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_lines" ADD CONSTRAINT "calculation_lines_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "salary_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_runs" ADD CONSTRAINT "payout_runs_calculation_run_id_fkey" FOREIGN KEY ("calculation_run_id") REFERENCES "calculation_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_lines" ADD CONSTRAINT "payout_lines_payout_run_id_fkey" FOREIGN KEY ("payout_run_id") REFERENCES "payout_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_lines" ADD CONSTRAINT "payout_lines_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "salary_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_lines" ADD CONSTRAINT "payout_lines_calculation_line_id_fkey" FOREIGN KEY ("calculation_line_id") REFERENCES "calculation_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_lines" ADD CONSTRAINT "payout_lines_salary_expense_id_fkey" FOREIGN KEY ("salary_expense_id") REFERENCES "salary_expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
