# Financial data migration validation (TASK-62 / P4-FD)

Use after `npm run migrate:financial-data -- --load` against a target DB.

## 1. Script and docs presence

| Artifact | Path |
|----------|------|
| ETL | `financial-service/scripts/migrate-financial-data.ts` |
| npm script | `financial-service/package.json` → `migrate:financial-data` |
| Migration log | `docs/refactoring/FINANCIAL_DATA_MIGRATION_LOG.md` |
| This checklist | `docs/refactoring/FINANCIAL_DATA_VALIDATION.md` |

## 2. Secret hygiene

Run from repo root:

```bash
rg "postgres://|postgresql://|password=|secret|BEGIN RSA" financial-service/scripts docs/refactoring/FINANCIAL_DATA_*
```

Expect **no** connection strings or secrets in these paths (URLs belong in `.env` only).

## 3. Dry-run / idempotent behavior

- Default invocation without `--load` performs **no writes** and logs aggregate counts (`dry_run_no_writes`).
- `--load` uses Prisma **upsert** on unique keys documented in `FINANCIAL_DATA_MIGRATION_LOG.md`; safe to rerun after partial failure.

## 4. Mapping parity (`FINANCIAL_DATA_MAPPING.md`)

| Mapping item | Validation |
|--------------|------------|
| `PaymentStatCategory.total_cat` → `totalMinor` | Compare `SUM(total_cat)` per month on legacy view vs `SUM(total_minor)` grouped by `period_month` on `monthly_revenue_by_category` (same display currency). |
| `PaymentStatMethod` → `MonthlyRevenueByMethod` | Per-month sum of legacy `total` vs sum of `total_minor` on `monthly_revenue_by_method`. |
| `orders.Transaction` → `LedgerLine` | `COUNT(*)` on legacy `orders_transaction` vs `COUNT(*)` on `ledger_lines` where `legacy_transaction_id` is populated. |
| Method NULL → `__null__` | `SELECT method_key_raw, COUNT(*) FROM monthly_revenue_by_method GROUP BY 1` — expect `__null__` for legacy NULL/empty. |
| Uncategorized category | Rows with `category_key = 'uncategorized'` and `legacy_category_id IS NULL`. |

## 5. Category reconciliation (totals by category)

Legacy (read-only):

```sql
SELECT date_trunc('month', month_paid)::date AS m,
       COALESCE(category_id::text, 'null') AS cat,
       SUM(total_cat) AS minor_sum
  FROM payment_stat_category
 GROUP BY 1, 2
 ORDER BY 1, 2;
```

Target `speakasap_financial_db`:

```sql
SELECT period_month,
       category_key,
       legacy_category_id,
       SUM(total_minor) AS minor_sum
  FROM monthly_revenue_by_category
 GROUP BY 1, 2, 3
 ORDER BY 1, 2;
```

Allow small differences only if legacy view definition changed historically; otherwise investigate.

## 6. Ledger vs rollup consistency

For each `YYYY-MM` in scope:

- `monthly_financial_rollups.total_paid_orders_minor` should equal the sum of `monthly_revenue_by_category.total_minor` for that `period_month` in the service display currency (same rule as `FinancialAggregationService.recomputeRollups`).
- `total_transactions_net_minor` should match manual sum over `ledger_lines` with `created_at` in that UTC month and `legacy_order_id IS NULL`, using signed amounts: `is_income ? amount_minor : -amount_minor`.

## 7. Explicit non-validation

- Salary totals cache: filled by salary HTTP consumer, **not** this legacy ETL.
- Android billing stats: out of scope per `FINANCIAL_API_CONTRACT.md`.

## 8. P4-FD result template

| Check | Status |
|-------|--------|
| Script + docs | PASS / FAIL |
| Mapping parity | PASS / FAIL |
| Secret hygiene | PASS / FAIL |
| Idempotency | PASS / FAIL |
| Category reconciliation | PASS / FAIL |

**P4-FD:** _PENDING_
