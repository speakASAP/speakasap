CREATE TABLE "category_axis_snapshots" (
    "id" TEXT NOT NULL,
    "legacy_category_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "product_for_offers" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "category_axis_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "category_axis_snapshots_legacy_category_id_key" ON "category_axis_snapshots"("legacy_category_id");

CREATE TABLE "monthly_revenue_by_category" (
    "id" TEXT NOT NULL,
    "period_month" DATE NOT NULL,
    "category_key" TEXT NOT NULL,
    "legacy_category_id" INTEGER,
    "total_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "title_snapshot" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "monthly_revenue_by_category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "monthly_revenue_by_category_period_month_category_key_key" ON "monthly_revenue_by_category"("period_month", "category_key");

CREATE INDEX "monthly_revenue_by_category_period_month_idx" ON "monthly_revenue_by_category"("period_month");

CREATE TABLE "monthly_revenue_by_method" (
    "id" TEXT NOT NULL,
    "period_month" DATE NOT NULL,
    "method_key_raw" TEXT NOT NULL,
    "total_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "monthly_revenue_by_method_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "monthly_revenue_by_method_period_month_method_key_raw_key" ON "monthly_revenue_by_method"("period_month", "method_key_raw");

CREATE INDEX "monthly_revenue_by_method_period_month_idx" ON "monthly_revenue_by_method"("period_month");

CREATE TABLE "ledger_lines" (
    "id" TEXT NOT NULL,
    "legacy_transaction_id" INTEGER NOT NULL,
    "legacy_portal_user_id" INTEGER NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "is_income" BOOLEAN NOT NULL,
    "legacy_order_id" INTEGER,
    "comment" TEXT NOT NULL DEFAULT '',
    "external" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ledger_transaction',
    CONSTRAINT "ledger_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ledger_lines_legacy_transaction_id_key" ON "ledger_lines"("legacy_transaction_id");

CREATE INDEX "ledger_lines_created_at_idx" ON "ledger_lines"("created_at");

CREATE INDEX "ledger_lines_legacy_order_id_idx" ON "ledger_lines"("legacy_order_id");

CREATE TABLE "operating_expense_lines" (
    "id" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operating_expense_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operating_expense_lines_date_idx" ON "operating_expense_lines"("date");

CREATE TABLE "salary_period_total_cache" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "currency_totals" JSONB NOT NULL,
    "line_count" INTEGER NOT NULL,
    "period_start" TEXT,
    "period_end" TEXT,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "salary_period_total_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "salary_period_total_cache_month_key" ON "salary_period_total_cache"("month");

CREATE TABLE "monthly_financial_rollups" (
    "period_month" DATE NOT NULL,
    "total_paid_orders_minor" INTEGER NOT NULL,
    "total_transactions_net_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "operating_expense_ledger_minor" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "monthly_financial_rollups_pkey" PRIMARY KEY ("period_month")
);

CREATE TABLE "financial_sync_state" (
    "id" TEXT NOT NULL,
    "last_refresh_at" TIMESTAMP(3),
    "last_refresh_error" TEXT,
    CONSTRAINT "financial_sync_state_pkey" PRIMARY KEY ("id")
);

INSERT INTO "financial_sync_state" ("id", "last_refresh_at", "last_refresh_error") VALUES ('default', NULL, NULL);
