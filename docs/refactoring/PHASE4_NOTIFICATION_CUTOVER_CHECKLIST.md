# Phase 4 — Notification wave cutover checklist

**Companion:** [`PHASE4_NOTIFICATION_VALIDATION_REPORT.md`](PHASE4_NOTIFICATION_VALIDATION_REPORT.md) (TASK-53).  
**Contract:** [`NOTIFICATION_API_CONTRACT.md`](NOTIFICATION_API_CONTRACT.md).

Use this list immediately before and during traffic migration to **speakasap-notification-service**. Check boxes only when verified.

---

## Pre-cutover (engineering)

- [ ] **P4-NB … P4-ND** all **PASS** in paired validator docs (see report gate table).
- [ ] **P4-NA** **PASS** recorded in [`AGENT49V_NOTIFICATION_SERVICE_SCAFFOLD_VALIDATE.md`](../agents/AGENT49V_NOTIFICATION_SERVICE_SCAFFOLD_VALIDATE.md) (do not skip — report currently **NO-GO** until this is done).
- [ ] **P4-NE** **PASS** in [`AGENT53V_NOTIFICATION_PHASE4_VALIDATION_VALIDATE.md`](../agents/AGENT53V_NOTIFICATION_PHASE4_VALIDATION_VALIDATE.md).
- [ ] **`npm run build`** succeeds in `speakasap/notification-service` on the commit being deployed (`tsconfig.build.json` includes only `src/**/*.ts`).
- [ ] **`.env`** on target has `NOTIFICATION_DATABASE_URL`, `NOTIFICATION_SERVICE_PORT`, `NOTIFICATION_SERVICE_URL`, `LOGGING_SERVICE_URL`, auth/JWT settings per root `speakasap/.env.example` (no secrets in repo).

---

## Data

- [ ] **Snapshot** of `speakasap_notification_db` taken before first production **`--load`** (if not already done for this environment).
- [ ] Migration log updated after final run: [`NOTIFICATION_DATA_MIGRATION_LOG.md`](NOTIFICATION_DATA_MIGRATION_LOG.md) (append JSON from `--write-docs`).
- [ ] Validation checklist current: [`NOTIFICATION_DATA_VALIDATION.md`](NOTIFICATION_DATA_VALIDATION.md) (`--verify-post-load` / orphan policy).

---

## Deploy / routing

- [ ] **Blue/green** (or project standard): **notification-service** revision healthy before route switch (service `deploy.sh` / compose — no hand-edited nginx).
- [ ] **notifications-microservice** reachable from notification-service at `NOTIFICATION_SERVICE_URL` (headers/keys per that service’s deployment).
- [ ] **user-service** (if used for email resolution) reachable when `USER_SERVICE_URL` is set.

---

## HTTP smoke (close DEFERRED rows from report)

- [ ] **`GET /health`** → `200` (no `api/v1` prefix).
- [ ] **Templates:** authenticated **GET** `/api/v1/templates` (`limit` ≤ 30); **POST** / **PATCH** / **DELETE** spot checks per role rules in contract.
- [ ] **Preferences:** **PATCH** `/api/v1/preferences/me/email` and **PATCH** `/api/v1/preferences/me/templates/:machineName`.
- [ ] **Dispatch:** **POST** `/api/v1/dispatch/email` (and optional **POST** `…/group`) with valid JWT and `Idempotency-Key`; confirm non-502 when transport healthy.

---

## Post-cutover

- [ ] Error rate and **logging-microservice** entries stable (timestamps + `duration_ms` on hot paths).
- [ ] Legacy **speakasap-portal** notification paths: confirm product decision (read-only legacy vs dual traffic) — business continuity outside strict contract but required for go-live.

---

## Rollback

1. **Traffic:** switch routing back to previous revision (blue/green rollback per `nginx-microservice` + service deploy scripts — regenerated configs only).
2. **Data (if load must be undone):** follow **Rollback** in [`NOTIFICATION_DATA_VALIDATION.md`](NOTIFICATION_DATA_VALIDATION.md) — restore snapshot or truncate in FK-safe order, then remediate root cause before re-load.
3. **Dispatch:** pause or repoint callers if notification-service is rolled back while templates still point to new hostnames.

---

## Cutover ordering (recommended)

1. Execute and **PASS** **AGENT49V** (**P4-NA**).  
2. Confirm **P4-NB … P4-ND** unchanged PASS on the release commit.  
3. Run migration **dry-run** → review logs → **load** → **verify-post-load** → append **migration log**.  
4. Deploy green stack; **GET /health**; authenticated smoke (templates, preferences, dispatch).  
5. Switch traffic; monitor logs; **PASS** **AGENT53V** (**P4-NE**) for program closure.

---

## Sign-off

| Step | Owner | Done (ISO date) |
|------|--------|-----------------|
| Engineering checklist | | |
| Operator HTTP smoke | | |
| Lead approval for production traffic | | |
