# Financial data migration log (TASK-62)

Structured log for **legacy speakasap-portal Postgres → `speakasap_financial_db`**, aligned with `FINANCIAL_DATA_MAPPING.md`.

## Commands

From `speakasap/financial-service` (loads `../.env`):

```bash
npm run migrate:financial-data -- --dry-run
npm run migrate:financial-data -- --load
npm run migrate:financial-data -- --dry-run --write-docs
```

Required env keys (values never committed): `PAYMENT_LEGACY_DATABASE_URL` (same read-only portal URL as payment-service ETL), `FINANCIAL_DATABASE_URL`. Optional: `FINANCIAL_DISPLAY_CURRENCY` (default `CZK`).

## What the ETL loads

| Legacy source | Target model | Idempotency |
|---------------|--------------|-------------|
| `payment_stat_category` (aggregated) | `MonthlyRevenueByCategory` | Upsert `(periodMonth, categoryKey)` |
| `payment_stat_methods` (aggregated) | `MonthlyRevenueByMethod` | Upsert `(periodMonth, methodKeyRaw)` |
| `orders_transaction` | `LedgerLine` | Upsert `legacyTransactionId` |
| `products_category` (ids from stats) | `CategoryAxisSnapshot` | Upsert `legacyCategoryId` |
| — | `MonthlyFinancialRollup` | Upsert per calendar month present in aggregates + ledger |

**Not loaded here:** `SalaryPeriodTotalCache` (HTTP from salary-service per contract), `OperatingExpenseLine` (no stable legacy id in schema; non-salary `expenses_expense` rows are counted and logged only—see validation doc).

## Category / method normalization

- **Category key:** `legacyCategoryId == null` → `categoryKey = uncategorized` (matches runtime aggregation in `financial-aggregation.service.ts`).
- **Payment method key:** empty / NULL legacy `method` → `methodKeyRaw = __null__` (parity with live aggregation).

## Double-counting rule (normative)

Paid-order revenue remains **canonical** via payment-service in steady state. This backfill seeds **materialized-view parity** only. **`LedgerLine`** rows keep `source = ledger_transaction`. Rollups use **only** ledger rows with `legacyOrderId IS NULL` for `totalTransactionsNetMinor` / operating ledger splits, matching `FinancialAggregationService.recomputeRollups`.

## Orphans and data-quality checks (script logs)

- `payment_stat_category` rows whose `category_id` is missing from `products_category`.
- Count of `expenses_expense` rows **not** referenced by `expenses_salaryexpense` (potential operating expenses; import deferred).

## Rollback notes

- **Surgical:** `DELETE FROM ledger_lines WHERE source = 'ledger_transaction';` then delete monthly revenue / rollup rows for affected `period_month` values (adjust to your window).
- **Full reset of derived tables:** truncate `monthly_revenue_by_category`, `monthly_revenue_by_method`, `monthly_financial_rollups`, `ledger_lines`, `category_axis_snapshots` in `speakasap_financial_db`, then rerun `--load` (destructive—coordinate with ops).
- After rollback, prefer **`POST /api/v1/internal/financial/refresh-window`** for forward sync once payment/course/salary HTTP paths are authoritative.

## Append-only run history

The script appends a JSON block below when invoked with `--write-docs`.

## Run 2026-04-13T23:15:05.646Z

```json
{
  "dryRun": false,
  "stats": {
    "payment_stat_category_rows": 464,
    "payment_stat_methods_rows": 487,
    "orders_transaction_rows": 37071,
    "orphan_stat_category_fk": 0,
    "non_salary_expense_rows": 0,
    "category_snapshots_upserted": 5,
    "monthly_category_upserts": 464,
    "monthly_method_upserts": 487,
    "ledger_upserts": 37071,
    "rollup_months": 141
  },
  "aggregates": {
    "uniqueCategoryMonthKeys": 464,
    "uniqueMethodMonthKeys": 487,
    "ledgerRows": 37071
  }
}
```
