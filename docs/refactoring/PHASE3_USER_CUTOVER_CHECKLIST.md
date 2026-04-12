# Phase 3 user wave — cutover checklist (TASK-33)

**Aligned with:** `PHASE3_USER_VALIDATION_REPORT.md` (rev. **c**, **2026-04-12** — U3/U4 **PASS**; F3-BACKUP + rollback drill **closed**; F3-AUTH-PARITY **waived for Wave 1** per runbook §4).

**Operator reference:** `PHASE3_USER_OPERATOR_RUNBOOK.md` — backup policy, rollback drill record, auth parity decision + quick verify commands.

## Pre-cutover

- [x] Legacy ETL executed; `USER_DATA_MIGRATION_LOG.md` execution table filled.
- [x] `USER_DATA_VALIDATION.md` §1 counts reconciled with explained skips (unchanged skip pattern: **2** auth `users` at import time).
- [x] `speakasap_user_db` backups / snapshot policy agreed (no truncate on prod without snapshot) — **logical `pg_dump`** via `db-server-postgres`; copy **off-box** before truncate (**2026-04-12**, see runbook §2).
- [x] Monorepo `speakasap/.env` complete for user-service (`USER_DATABASE_URL`, `AUTH_SERVICE_URL`, logging, pagination caps, `INTERNAL_API_TOKEN`, ETL URLs).
- [x] Container healthy on `nginx-network`; `GET /health` **200**.

## Deploy (order)

1. [x] `npx prisma migrate deploy` on target (if migrations pending). *(Migration already applied before this run.)*
2. [x] Deploy **speakasap** stack via `speakasap/scripts/deploy.sh` (green includes **user-service**; no hand-edited nginx).
3. [x] Smoke: `GET /health` then JWT `GET /api/v1/students/me` (**200**, **2026-04-12**).

## Post-cutover

- [x] Centralized logging reachable from user-service (`logging-microservice` **network alias** on logging backend; `LOGGING_SERVICE_URL` canonical).
- [x] Rollback path exercised in drill — **DB:** `pg_dump` → `pg_restore` to scratch `speakasap_user_db_drill_scratch`, `students` count **2**, teardown **2026-04-12**; **image:** `speakasap_green-user-service:latest` @ `sha256:cc0f7d6823a368630f9dae9c555ef2aad11815544a8935a863d2ed1f1ebd9bdb`; **color flip:** standard BG only this run (see runbook §3).

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Lead Orchestrator | Operator pass (authorized) | 2026-04-12 | ETL + deploy + U3/U4; F3-BACKUP agreed + DB rollback drill executed (see runbook §2–§3) |
| Operator / automation | Cursor agent (alfares) | 2026-04-12 | Closed F3 items in §5 rev **c**; auth parity **waived** for Wave 1 (sparse ETL documented) |

**Cutover GO for traffic:** **GO** for Wave 1 — backup policy agreed, DB rollback drill executed, auth full parity **deferred** (not blocking) per `PHASE3_USER_OPERATOR_RUNBOOK.md` §4.
