# Phase 4 — Salary wave cutover checklist

**Companion:** [`PHASE4_SALARY_VALIDATION_REPORT.md`](PHASE4_SALARY_VALIDATION_REPORT.md) (TASK-58).  
**Contract:** [`SALARY_API_CONTRACT.md`](SALARY_API_CONTRACT.md).

Use this list immediately before and during traffic migration to **speakasap-salary-service**. Check boxes only when verified.

---

## Pre-cutover (engineering)

- [ ] **P4-SA…P4-SD** all **PASS** in validator docs (see report gate table); [`AGENT54V`](../agents/AGENT54V_SALARY_SERVICE_SCAFFOLD_VALIDATE.md) evidence complete **2026-04-14**.
- [ ] **P4-SE** **PASS** in [`AGENT58V_SALARY_PHASE4_VALIDATION_VALIDATE.md`](../agents/AGENT58V_SALARY_PHASE4_VALIDATION_VALIDATE.md).
- [ ] **`npm run build`** succeeds in `speakasap/salary-service` on the commit being deployed.
- [ ] **`.env`** on target has `SALARY_DATABASE_URL`, `SALARY_SERVICE_PORT` (**4212**), `PAYMENT_SERVICE_URL`, `EDUCATION_SERVICE_URL`, auth/JWT + internal tokens, `LOGGING_SERVICE_URL` per root `speakasap/.env.example` (no secrets in repo).

---

## Data

- [ ] **Snapshot** of `speakasap_salary_db` taken before first production **`--load`** (if not already done for this environment).
- [ ] Migration log reflects final run: [`SALARY_DATA_MIGRATION_LOG.md`](SALARY_DATA_MIGRATION_LOG.md).
- [ ] Validation checklist reviewed: [`SALARY_DATA_VALIDATION.md`](SALARY_DATA_VALIDATION.md) (orphan SQL on target; accept or remediate **1 338** skipped expenses without profile per business decision).
- [ ] Acknowledged: **1 338** `expensesSkippedNoProfile`, **courses_*** historical rows not in ETL, **`lessonUuid`** null until backfill — per report “Unresolved anomalies”.

---

## Deploy / routing

- [ ] **Blue/green** (or project standard): new **salary-service** revision healthy before route switch (service `deploy.sh` / compose — no hand-edited nginx).
- [ ] **speakasap-payment-service** reachable at `PAYMENT_SERVICE_URL` for internal disburse paths (`X-Internal-Token` per contract).
- [ ] **speakasap-education-service** reachable at `EDUCATION_SERVICE_URL` for period aggregates used by calculation runs.
- [ ] **Auth** issuer validation matches deployed auth microservice / JWT settings.

---

## HTTP smoke (close DEFERRED rows from report)

- [ ] **GET `/health`** → `200`.
- [ ] **Staff JWT:** `GET /api/v1/salary-profiles` (pagination `limit` ≤ 30).
- [ ] **Calculation:** `POST /api/v1/calculation-runs` with test period → `GET` run → `POST …/finalize` as appropriate for staging data.
- [ ] **Payout:** `POST /api/v1/payout-runs` → `GET …/:payoutRunId` → `POST …/commit` with **Idempotency-Key**; confirm payment-service interaction or expected error if rails unavailable.
- [ ] **Idempotency replay:** duplicate commit with same key → **409** + `IDEMPOTENCY_REPLAY` per contract.
- [ ] **Admin:** `GET /api/v1/admin/summary/by-profile` and `…/months` with date filters.

---

## Post-cutover

- [ ] Error rate and **logging-microservice** entries stable (timestamps + `duration_ms` on hot paths per AGENT56V).
- [ ] Legacy **speakasap-portal** salary writes: confirm product decision (read-only vs dual-write) — out of API contract but required for business continuity.

---

## Rollback

1. **Traffic:** switch routing back to previous revision (blue/green rollback per `nginx-microservice` + service deploy scripts — regenerated configs only).
2. **Data (if load must be undone):** follow **Rollback (target DB only)** in [`SALARY_DATA_VALIDATION.md`](SALARY_DATA_VALIDATION.md) — `TRUNCATE` listed tables, restore from snapshot if needed, then remediate root cause before re-`--load`.
3. **Payouts in flight:** pause commits; reconcile with payment-service disburse status per contract § Payout reconciliation before re-attempting.

**Order (align with report):** traffic off → stabilize dependencies → data truncate/restore if needed → fix cause → redeploy → re-smoke.

---

## Sign-off

| Step | Owner | Done (ISO date) |
|------|--------|------------------|
| Engineering checklist | | |
| Operator HTTP smoke | | |
| Lead approval for production traffic | | |
