# Legacy → speakasap-financial-service data mapping (TASK-60)

**Sources verified (workspace):** `speakasap-portal/administrator/models.py`, `speakasap-portal/administrator/views/base.py`, `speakasap-portal/products/models.py`, `speakasap-portal/orders/models.py` (`Order`, `Transaction`), `speakasap-portal/expenses/models.py`.  
**Related contracts:** `PAYMENT_DATA_MAPPING.md`, `SALARY_DATA_MAPPING.md`, `COURSE_API_CONTRACT.md` (§11 addendum), `ROADMAP.md` §4.5.

**Split reminder:** **Salary-classified** teacher compensation data is **owned by salary-service** (`SALARY_DATA_MAPPING.md`). Financial-service stores **references and monthly totals** for dashboards, not mutable salary lines.

---

## Legacy UI parity targets

| Legacy route / view | Legacy data source | Target financial capability |
|---------------------|--------------------|-----------------------------|
| `/administrator/billing/<YYYY-MM>/` | `PaymentStatMethod` → DB view `payment_stat_methods` | `GET /api/v1/revenue/by-payment-method` |
| `/administrator/billing/categories/` | `PaymentStatCategory` → DB view `payment_stat_category` + `products.Category` | `GET /api/v1/revenue/category-matrix` |
| `/administrator/transactions/` | `orders.Transaction` (+ country via student, permission-gated) | `transactions-slice` ingestion → financial **`LedgerLine`** + optional country dimension in TASK-62 if still required |

---

## Enum normalization

### Payment method key (revenue by method)

| Legacy `PaymentStatMethod.method` | Target `methodKey` |
|-----------------------------------|-------------------|
| `NULL` / empty | `null` (display label “карта” / unknown legacy quirk documented in portal `METHODS`) |
| `card` | `card` |
| `paypal` | `paypal` |
| `invoice` | `invoice` |

### Period key

| Legacy `month_paid` (date, first of month convention) | Target `periodMonth` |
|-------------------------------------------------------|----------------------|
| Any date in calendar month | `YYYY-MM-01` (normalized) or string `YYYY-MM` — **pick one in Prisma schema** and use consistently in TASK-61 |

### Revenue bucket

| Condition | Target bucket |
|-----------|---------------|
| Paid order with `product.category_id = N` | Aggregate under `legacyCategoryId = N` |
| Paid order with `product_id` null | `legacyCategoryId = null` (**uncategorized**) |
| `Transaction.is_income = true` | Operating **income** side of ledger (not double-counted with paid order totals unless business rule says otherwise — **default:** exclude `Transaction` rows that reference an `order_id` already counted in paid revenue; TASK-62 reconciles exceptions) |
| `Transaction.is_income = false` | Operating **expense** side |

**Double-counting guard (normative default):** Paid order totals are **canonical** for course sales revenue. **`Transaction`** lines adjust **inner balance / manual** flows only; ingestion must tag `source` = `order_payment` \| `ledger_transaction` and aggregate endpoints choose one net methodology — document chosen rule in TASK-62 validation report.

---

## Table mapping (conceptual Prisma / SQL in `speakasap_financial_db`)

### `CategoryAxisSnapshot` (read model, not writable SoT)

| Field | Source | Notes |
|-------|--------|------|
| `legacyCategoryId` | `products.Category.id` | From **course-service** HTTP batch |
| `title` | `Category.title` | Snapshot at sync time |
| `productForOffers` | `Category.product_for_offers` | Snapshot |

### `MonthlyRevenueByCategory`

| Legacy analogue | Target field | Notes |
|-----------------|--------------|------|
| `PaymentStatCategory.total_cat` for (`month_paid`, `category_id`) | `totalMinor` | **Initial backfill** from legacy DB view; **ongoing** recomputed from payment-service + course metadata |
| `PaymentStatCategory.title` | `titleSnapshot` | Denormalized for audit diff |
| N/A | `legacyProductId` | Not required at this aggregate grain |

### `MonthlyRevenueByMethod`

| Legacy | Target | Notes |
|--------|--------|------|
| `PaymentStatMethod` row | `methodKey`, `periodMonth`, `totalMinor` | Same backfill + recompute strategy |

### `LedgerLine` ← `orders_transaction`

| Legacy column | Target field | Notes |
|---------------|--------------|------|
| `id` | `legacyTransactionId` int **unique** | |
| `user_id` | `legacyPortalUserId` | Correlate to `authUserId` via user-service if needed for UI |
| `created` | `createdAt` | |
| `amount` | `amountMinor` | Integer; sign combined with `is_income` or store signed `netMinor` — TASK-61 picks |
| `comment` | `comment` | |
| `order_id` | `legacyOrderId` nullable | For dedupe rules |
| `is_income` | `isIncome` | bool |
| `external` | `external` | bool |

### `OperatingExpenseLine` (financial-owned, non-salary)

| Source | Target | Notes |
|--------|--------|------|
| Legacy base `expenses.Expense` rows **without** salary subclass | Rare in current portal code (all discovered subclasses extend `SalaryExpense`) | **TASK-62** verifies DB for orphan `expenses_expense` rows; if none, table exists for **future** manual operating expenses and **import-only** adjustments |
| Administrative manual entry (post-cutover) | New rows | Out of scope for TASK-60 beyond reserving the entity |

### `SalaryPeriodTotalCache` (derivative of salary-service)

| Source | Target | Notes |
|--------|--------|------|
| Salary internal `period-salary-totals` | `month`, `currencyTotals`, `lineCount`, `fetchedAt` | **Not** authoritative for payout truth; **display** only |

---

## Read dependencies (HTTP only, no cross-DB joins)

| Callee | Data | Auth |
|--------|------|------|
| **speakasap-payment-service** | Paid orders slice, transaction slice | `X-Internal-Token` |
| **speakasap-salary-service** | Monthly salary totals | `X-Internal-Token` |
| **speakasap-course-service** | Product → `categoryId`, titles | `X-Internal-Token` per addendum |

---

## Migration notes (TASK-62 prerequisites)

1. **Export legacy materialized views** `payment_stat_category`, `payment_stat_methods` into CSV or SQL **read-only** extracts for count reconciliation.
2. **Recompute** from `speakasap_payment_db` should match within tolerance after FX / rounding rules are fixed once.
3. **Orphans:** Orders with `product_id` pointing to deleted product → `legacyCategoryId = null` + `dataQualityFlag = missing_product`.

---

## Explicit non-goals

- Re-implementing **payments-microservice** provider logic.
- Storing **full payment instrument** payloads.
- **Teacher payout** detail rows (salary-service owns).
