# Phase 4 — Financial wave cutover checklist

**Companion:** [`PHASE4_FINANCIAL_VALIDATION_REPORT.md`](PHASE4_FINANCIAL_VALIDATION_REPORT.md) (TASK-63).
**Contract:** [`FINANCIAL_API_CONTRACT.md`](FINANCIAL_API_CONTRACT.md).

Use this list immediately before and during traffic migration to **speakasap-financial-service**. Check boxes only when verified.

**Products decision:** Category/product **writes** remain **course-service** (or legacy admin until write APIs exist). Financial-service is **read-only reporting** on the category axis plus aggregates — do not treat financial DB as a second catalog ([`FINANCIAL_API_CONTRACT.md`](FINANCIAL_API_CONTRACT.md) §Products / billing category ownership).

---

## Pre-cutover (engineering)

- [ ] **P4-FA…P4-FD** all **PASS** in validator docs (see report gate table): [`AGENT59V`](../agents/AGENT59V_FINANCIAL_SERVICE_SCAFFOLD_VALIDATE.md) … [`AGENT62V`](../agents/AGENT62V_FINANCIAL_SERVICE_MIGRATION_VALIDATE.md).
- [ ] **P4-FE** **PASS** in [`AGENT63V_FINANCIAL_PHASE4_VALIDATION_VALIDATE.md`](../agents/AGENT63V_FINANCIAL_PHASE4_VALIDATION_VALIDATE.md).
- [ ] **`npm run build`** succeeds in `speakasap/financial-service` on the commit being deployed.
- [ ] **`.env`** on target has `FINANCIAL_DATABASE_URL`, `FINANCIAL_SERVICE_PORT` (**4213**), `PAYMENT_SERVICE_URL`, `SALARY_SERVICE_URL`, `COURSE_SERVICE_URL`, internal tokens (`FINANCIAL_INTERNAL_API_TOKEN`, callee tokens per contract), `LOGGING_SERVICE_URL`, optional `FINANCIAL_DISPLAY_CURRENCY` — keys per `speakasap/.env.example` (no secrets in repo).

---

## Data

- [ ] **Snapshot** of `speakasap_financial_db` taken before first production **`--load`** (if not already done for this environment).
- [ ] Migration log reflects final run: append JSON via `npm run migrate:financial-data -- --dry-run --write-docs` / post-load steps per [`FINANCIAL_DATA_MIGRATION_LOG.md`](FINANCIAL_DATA_MIGRATION_LOG.md).
- [ ] Validation checklist executed: [`FINANCIAL_DATA_VALIDATION.md`](FINANCIAL_DATA_VALIDATION.md) §4–§7 (category-month SQL §5; rollup consistency §6); §8 rows set to **PASS** with evidence or **FAIL** with remediation — not left as template **PENDING**.

---

## Deploy / routing

- [ ] **Blue/green** (or project standard): new **financial-service** revision healthy before route switch (service `deploy.sh` / compose — **no** hand-edited nginx).
- [ ] **speakasap-payment-service** reachable at `PAYMENT_SERVICE_URL` for internal consumer paths used by aggregation (`X-Internal-Token` per payment contract / env).
- [ ] **speakasap-salary-service** reachable at `SALARY_SERVICE_URL` for period totals consumer.
- [ ] **speakasap-course-service** reachable at `COURSE_SERVICE_URL` for product → category metadata batches.
- [ ] **Auth** issuer validation matches deployed auth microservice / JWT settings for staff routes.

---

## HTTP smoke (close DEFERRED rows from report)

- [ ] **GET `/health`** → `200`.
- [ ] **Staff JWT:** `GET /api/v1/revenue/category-matrix` with bounded `monthFrom` / `monthTo`.
- [ ] **Staff JWT:** `GET /api/v1/revenue/by-payment-method?month=YYYY-MM`.
- [ ] **Staff JWT:** `GET /api/v1/revenue/summary` (range ≤ 36 months).
- [ ] **Staff JWT:** `GET /api/v1/expenses/summary` and `GET /api/v1/expenses/operating-lines` (`limit` ≤ 30).
- [ ] **Staff JWT:** `GET /api/v1/dashboard/overview?month=YYYY-MM`.
- [ ] **Internal:** `POST /api/v1/internal/financial/refresh-window` with `X-Internal-Token` on a narrow test window in staging (confirm idempotent behavior and logs).

**Out of scope for this checklist (by design):** HTTP **create/update/delete** of `products.Category` — use **course-service** / product workflows.

---

## Post-cutover

- [ ] Error rate and **logging-microservice** entries stable (timestamps + `duration_ms` on hot paths per AGENT61V).
- [ ] Confirm no expectation of **writable** category catalog in financial DB (reporting keys + snapshots only).

---

## Rollback

**Order:** traffic off → stabilize upstream dependencies → data truncate/surgical delete if needed (per migration log) → restore from snapshot if required → fix root cause → redeploy → re-smoke.

1. **Traffic:** switch routing back to previous revision (blue/green rollback per `nginx-microservice` + service deploy scripts — regenerated configs only).
2. **Data (if load must be undone):** follow **Rollback notes** in [`FINANCIAL_DATA_MIGRATION_LOG.md`](FINANCIAL_DATA_MIGRATION_LOG.md) — `DELETE` / `TRUNCATE` of derived tables as appropriate; restore from snapshot if needed before re-`--load`.
3. **Forward sync:** after repair, `POST /api/v1/internal/financial/refresh-window` when payment/salary/course HTTP paths are healthy.

---

## Sign-off

| Step | Owner | Done (ISO date) |
|------|--------|------------------|
| Engineering checklist | | |
| Operator HTTP smoke + SQL reconciliation | | |
| Lead approval for production traffic | | |
