# Phase 4 — Payment wave cutover checklist

**Companion:** [`PHASE4_PAYMENT_VALIDATION_REPORT.md`](PHASE4_PAYMENT_VALIDATION_REPORT.md) (TASK-48).  
**Contract:** [`PAYMENT_API_CONTRACT.md`](PAYMENT_API_CONTRACT.md).

Use this list immediately before and during traffic migration to **speakasap-payment-service**. Check boxes only when verified.

---

## Pre-cutover (engineering)

- [ ] **P4-OA…P4-OD** all **PASS** in validator docs (see report gate table).
- [ ] **P4-OE** **PASS** in [`AGENT48V_PAYMENT_PHASE4_VALIDATION_VALIDATE.md`](../agents/AGENT48V_PAYMENT_PHASE4_VALIDATION_VALIDATE.md).
- [ ] **`npm run build`** succeeds in `speakasap/payment-service` on the commit being deployed.
- [ ] **`.env`** on target has `PAYMENT_DATABASE_URL`, `PAYMENT_SERVICE_PORT`, `PAYMENTS_MICROSERVICE_URL`, `PAYMENTS_WEBHOOK_SHARED_SECRET`, `LOGGING_SERVICE_URL`, auth/JWT settings per root `speakasap/.env.example` (no secrets in repo).

---

## Data

- [ ] **Snapshot** of `speakasap_payment_db` taken before first production **`--load`** (if not already done for this environment).
- [ ] Migration log updated after final run: [`PAYMENT_DATA_MIGRATION_LOG.md`](PAYMENT_DATA_MIGRATION_LOG.md).
- [ ] Validation checklist current: [`PAYMENT_DATA_VALIDATION.md`](PAYMENT_DATA_VALIDATION.md) (orphan SQL = 0 post-load).

---

## Deploy / routing

- [ ] **Blue/green** (or project standard): new **payment-service** revision healthy before route switch (service `deploy.sh` / compose — no hand-edited nginx).
- [ ] **payments-microservice** reachable from payment-service container at `PAYMENTS_MICROSERVICE_URL` with valid `X-API-Key`.
- [ ] **Webhook URL** for normalized events points to **`POST …/api/v1/webhooks/payments`** on the **routed** payment-service host (signature per contract).

---

## HTTP smoke (close DEFERRED rows from report)

- [ ] **GET `/health`** → `200`.
- [ ] **Authenticated** sample: `GET /api/v1/orders` (pagination `limit` ≤ 30).
- [ ] **Webhook:** valid `X-Webhook-Signature` → `200`; bad signature → rejected (non-200 or contract error).
- [ ] **Admin guard:** non-admin **POST** `…/mark-paid` → **403** (spot check).

---

## Post-cutover

- [ ] Error rate and **logging-microservice** entries stable (timestamps + `duration_ms` on hot paths).
- [ ] Legacy **speakasap-portal** order/payment writes: confirm product decision (read-only vs dual-write) — out of scope for contract but required for business continuity.

---

## Rollback

1. **Traffic:** switch routing back to previous revision (blue/green rollback per `nginx-microservice` + service deploy scripts — regenerated configs only).
2. **Data (if load must be undone):** follow **Rollback (target DB only)** in [`PAYMENT_DATA_VALIDATION.md`](PAYMENT_DATA_VALIDATION.md) — `TRUNCATE` listed tables, restore from snapshot if needed, then remediate root cause before re-load.
3. **Webhooks:** pause or repoint bridge to old path until payment-service is healthy again.

---

## Sign-off

| Step | Owner | Done (ISO date) |
|------|--------|------------------|
| Engineering checklist | | |
| Operator HTTP smoke | | |
| Lead approval for production traffic | | |
