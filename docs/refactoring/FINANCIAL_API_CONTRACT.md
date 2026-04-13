# Financial service API contract (frozen for TASK-61)

**Service:** `speakasap-financial-service` (`financial-service/`)  
**Base path:** `GET /health` (no prefix); other routes under `api/v1` (Nest global prefix, same as `payment-service` / `salary-service`).  
**Auth:** JWT from `auth-microservice` on staff/admin routes unless noted. Internal routes use `X-Internal-Token` equal to **`FINANCIAL_INTERNAL_API_TOKEN`** (key name only; value in monorepo `.env`).

## Out of scope (explicit)

- Helpdesk, analytics (`big_brother`, `actions`), marathon extraction.
- Catalog / warehouse / suppliers / `orders-microservice` unless Phase 4 decomposition reopens them.
- Editing **`auth-microservice`**, **`payments-microservice`**, **`notifications-microservice`**, **`nginx-microservice`**, or any shared microservice **source**.
- **Writable** copies of **`products.Category`** or **`products.Product`** (course-service remains SoT; see **Products / billing category ownership** below).
- Android billing / `AndroidPlayApp*` stats (legacy `administrator.models.AndroidPlayApp*` — not migrated in this wave).

## Products / billing category ownership (TASK-60 resolution)

- **Source of truth:** **`products.Category`** and **`products.Product`** are owned by **speakasap-course-service** (`COURSE_API_CONTRACT.md` + TASK-60 addendum).
- **Financial-service** stores **reporting keys only**: `legacyCategoryId` (integer, nullable = “uncategorized”), `legacyProductId` (integer, nullable), plus denormalized snapshot fields (`categoryTitleSnapshot`, `productTitleSnapshot`) filled at ingestion time for immutable monthly aggregates.
- **No second writable catalog:** admin UI parity for `/administrator/billing/categories/` is **read-only reporting** over the category axis plus time matrix; **creating/editing categories** remains a **course-service** concern when write APIs exist; until then, legacy Django admin is the operational write path (documented deferral, not a second SoT in financial DB).

## Cross-service identifiers (read-only references)

- **`legacyCategoryId`** — integer `products.Category.id` from course-service.
- **`legacyProductId`** — integer `products.Product.id` from course-service / payment `Order.productId`.
- **`legacyOrderId`** — integer legacy `orders_order.id` (payment-service may expose as `legacyOrderId` or preserve int per `PAYMENT_DATA_MAPPING.md`).
- **`authUserId`** — UUID string; aligned with **`USER_API_CONTRACT.md`** when attributing ledger lines.
- **Salary / payment opaque refs** — as returned by salary/payment internal endpoints below.

## Environment (key names only)

Per `AGENT60_FINANCIAL_SERVICE_DESIGN.md` and scaffold alignment:

- `FINANCIAL_SERVICE_PORT`
- `FINANCIAL_DATABASE_URL`
- `FINANCIAL_DB_NAME` (if split from URL in app config)
- `LOGGING_SERVICE_URL`
- `LOGGING_SERVICE_API_PATH`
- `LOGGING_SERVICE_TIMEOUT`
- `PAYMENT_SERVICE_URL`
- `SALARY_SERVICE_URL`
- `COURSE_SERVICE_URL`
- `FINANCIAL_INTERNAL_API_TOKEN` — protects financial `/api/v1/internal/**`.
- `PAYMENT_SERVICE_INTERNAL_TOKEN` / `SALARY_SERVICE_INTERNAL_TOKEN` / `COURSE_SERVICE_INTERNAL_TOKEN` (or monorepo-unified `INTERNAL_API_TOKEN`) — **must match** callee `X-Internal-Token` rules when calling their internal routes (exact names frozen with `.env.example` in TASK-61).

## Pagination and sorting

- List endpoints accept `limit` (default 20, **maximum 30**) and `cursor` (opaque, optional).
- Response: `{ "data": [...], "meta": { "nextCursor": string | null, "limit": number } }`.
- Matrix and summary endpoints use **bounded** `monthFrom` / `monthTo` (inclusive `YYYY-MM`) instead of unbounded lists where applicable; default range max **36** months per request.

## Error model

HTTP status + JSON body (same envelope style as **`PAYMENT_API_CONTRACT.md`**):

```json
{
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable message",
    "details": {}
  }
}
```

| HTTP | `error.code` | When |
|------|----------------|------|
| 400 | `VALIDATION_FAILED` | DTO / query validation |
| 401 | `UNAUTHORIZED` | Missing/invalid JWT |
| 403 | `FORBIDDEN` | Missing staff permission for financial admin |
| 404 | `NOT_FOUND` | Snapshot id or import batch id unknown |
| 409 | `CONFLICT` | Illegal transition on manual adjustment entity (if enabled later) |
| 502 | `DEPENDENCY_UNAVAILABLE` | payment / salary / course HTTP failure after bounded retries |

**Retries:** `GET` may retry on `502`/`503` with backoff. **Do not** increase global HTTP client timeouts as a policy; log `duration_ms` and failing dependency URL path.

---

## Read-model strategy (normative)

1. **Authoritative operational data** stays in **payment-service** (orders, payments, transactions) and **salary-service** (salary expenses, payouts). Financial-service **does not** query those PostgreSQL databases directly.
2. **Financial DB** holds **derived** tables: monthly revenue by category, monthly revenue by payment method, non-salary expense lines, optional **legacy view snapshots** for audit (see **`FINANCIAL_DATA_MAPPING.md`**).
3. **Refresh paths** (implementation choice in TASK-61, behavior fixed here):
   - **Event-driven (preferred):** subscribe to **`order.paid`** (and compatible payment events) per `ROADMAP.md` / `PAYMENT_API_CONTRACT.md` optional outbound section; upsert aggregate rows idempotently by `(periodMonth, legacyCategoryId)` and `(periodMonth, paymentMethodKey)`.
   - **Polling fallback:** if events are not wired, a worker calls **Payment internal — financial consumer** and **Course internal — financial consumer** endpoints below on a schedule; same idempotent upserts.
4. **Salary slice:** periodic **Salary internal — financial consumer** call to fetch period totals for teacher compensation; stored under **`salary`** bucket separate from **`operating`** (non-salary) expense lines in financial DB.
5. **Staleness:** API responses include `asOf` (ISO 8601) and `source` (`live` \| `snapshot`) per resource group; dashboard may show **last successful sync** timestamp.

---

## Upstream contracts (normative — implement on callee services in TASK-61 / aligned PRs)

Until merged into **`PAYMENT_API_CONTRACT.md`**, **`SALARY_API_CONTRACT.md`**, treat these as the interfaces **financial-service** will call:

### Payment-service (consumer)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/internal/financial/orders-paid-slice` | Query: `paidAfter` (ISO datetime, optional), `paidBefore` (optional), `cursor`, `limit` (max 30). Returns paid **order** rows needed for revenue aggregation: `legacyOrderId`, `userId`, `priceMinor`, `currency`, `paidAt`, `legacyProductId`, `status`. **Idempotent read**; safe to replay. |
| `GET` | `/api/v1/internal/financial/transactions-slice` | Same pagination; returns inner / user **ledger** lines mirroring legacy `orders.Transaction` fields mapped in payment DB (`amountMinor`, `isIncome`, `legacyUserId`, `legacyOrderId?`, `createdAt`, `external`). Used for non-order revenue/expense adjustments in dashboards. |

**Note:** If `orders-paid-slice` is deferred, TASK-61 may temporarily use staff-scoped paginated **`GET /api/v1/orders`** only if contractually filtered by `status=paid` and performance is acceptable; validator must record the deviation.

### Salary-service (consumer)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/internal/financial/period-salary-totals` | Query: `month`=`YYYY-MM`. Returns `{ "currencyTotals": { "EUR": string, "CZK": string, "RUB": string }, "lineCount": number, "periodStart": "...", "periodEnd": "..." }` using **same** classification rules as legacy salary aggregates (see **`SALARY_API_CONTRACT.md`** exclusions). **Idempotent read**. |

### Course-service (consumer)

See **`COURSE_API_CONTRACT.md`** — **§11 Financial consumer (TASK-60 addendum)** for batch product → category metadata.

---

## Domain endpoints (financial-service **outbound-facing**)

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness, no auth. |

### Revenue — category axis (parity `administrator/billing/categories/` matrix)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/revenue/category-matrix` | Query: `monthFrom`, `monthTo` (inclusive). Returns `{ "months": ["YYYY-MM-01", ...], "categories": [{ "legacyCategoryId", "title", "productForOffers" }], "cells": number[][], "grandTotalsByMonth": number[], "asOf": "..." }`. **Cells** are revenue minor units in the **service default display currency** per row metadata, or document per-currency matrices in `details` if multi-currency rows exist (TASK-61 picks one representation and sticks to it). |

### Revenue — payment method axis (parity `administrator/billing/` by month)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/revenue/by-payment-method` | Query: `month`=`YYYY-MM`. Returns `{ "month", "rows": [{ "methodKey": string \| null, "methodLabel": string, "totalMinor": number }], "totalMinor": number, "asOf": "..." }`. `methodKey` mirrors legacy `PaymentStatMethod.method` (`card`, `paypal`, `invoice`, `null`). |

### Revenue — simple summary

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/revenue/summary` | Query: `monthFrom`, `monthTo`. Returns `{ "periods": [{ "month", "totalPaidOrdersMinor", "totalTransactionsNetMinor" }], "asOf": "..." }`. |

### Expenses — operating (non-salary) and salary bucket

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/expenses/summary` | Query: `monthFrom`, `monthTo`. Returns `{ "periods": [{ "month", "operatingMinor", "salaryMinor", "currency" }], "asOf": "..." }`. **Operating** = financial-owned lines + transaction-derived adjustments mapped in **`FINANCIAL_DATA_MAPPING.md`**; **salary** = cached salary-service totals. |

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/expenses/operating-lines` | Paginated list of **non-salary** expense entries stored in financial DB (comment, amount, date, currency). |

### Dashboard (parity ROADMAP §4.5 “dashboards API”)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/dashboard/overview` | Query: `month` (single `YYYY-MM`). Returns `{ "revenueMinor", "expenseOperatingMinor", "expenseSalaryMinor", "netMinor", "currency", "revenueChangePct", "expenseChangePct", "asOf" }` — change fields optional if prior month missing. |

### Internal (other services → financial)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/internal/financial/refresh-window` | Body: `{ "monthFrom": "YYYY-MM", "monthTo": "YYYY-MM" }`. Triggers **idempotent** re-aggregation for window (admin/ops only; `X-Internal-Token`). Used after backfill or incident repair. |

---

## Events (optional inbound / outbound, TASK-61 if wired)

- **Inbound:** `order.paid` — `{ "legacyOrderId", "userId", "amountMinor", "currency", "paidAt", "legacyProductId?" }` (align field names with payment-service emission).
- **Outbound:** `financial.report.synced` — `{ "month", "rowsUpserted", "durationMs" }` (optional, for observability).

---

## Versioning

URL prefix `api/v1`. Breaking changes require `v2` and deprecation header.
