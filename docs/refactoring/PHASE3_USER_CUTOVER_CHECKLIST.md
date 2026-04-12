# Phase 3 user wave — cutover checklist (TASK-33)

**Aligned with:** `PHASE3_USER_VALIDATION_REPORT.md` (rev. **b**, **2026-04-12** — U3/U4 **PASS**; F3-BACKUP / F3-AUTH-PARITY still open).

**Open items (operator):** `PHASE3_USER_OPERATOR_RUNBOOK.md` — backup policy, rollback drill, auth parity + quick verify commands.

## Pre-cutover

- [x] Legacy ETL executed; `USER_DATA_MIGRATION_LOG.md` execution table filled.
- [x] `USER_DATA_VALIDATION.md` §1 counts reconciled with explained skips (unchanged skip pattern: **2** auth `users` at import time).
- [ ] `speakasap_user_db` backups / snapshot policy agreed (no truncate on prod without snapshot).
- [x] Monorepo `speakasap/.env` complete for user-service (`USER_DATABASE_URL`, `AUTH_SERVICE_URL`, logging, pagination caps, `INTERNAL_API_TOKEN`, ETL URLs).
- [x] Container healthy on `nginx-network`; `GET /health` **200**.

## Deploy (order)

1. [x] `npx prisma migrate deploy` on target (if migrations pending). *(Migration already applied before this run.)*
2. [x] Deploy **speakasap** stack via `speakasap/scripts/deploy.sh` (green includes **user-service**; no hand-edited nginx).
3. [x] Smoke: `GET /health` then JWT `GET /api/v1/students/me` (**200**, **2026-04-12**).

## Post-cutover

- [x] Centralized logging reachable from user-service (`logging-microservice` **network alias** on logging backend; `LOGGING_SERVICE_URL` canonical).
- [ ] Rollback path exercised in drill (image + DB restore) — *documented only; no drill this run*.

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Lead Orchestrator | Operator pass (authorized) | 2026-04-12 | ETL + deploy + U3/U4; see `PHASE3_USER_VALIDATION_REPORT.md` §5 for open F3-BACKUP / F3-AUTH-PARITY |

**Cutover GO for traffic:** **conditional** — complete unchecked backup/rollback drill items before pointing customer traffic at user APIs.
