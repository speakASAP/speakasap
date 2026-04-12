# Phase 3 user wave — cutover checklist (TASK-33)

**Aligned with:** `PHASE3_USER_VALIDATION_REPORT.md` (**GO** for engineering gates through P3-UD; customer cutover follows F3-* follow-ups).

## Pre-cutover

- [ ] Legacy ETL executed; `USER_DATA_MIGRATION_LOG.md` execution table filled.
- [ ] `USER_DATA_VALIDATION.md` §1 counts reconciled with explained skips.
- [ ] `speakasap_user_db` backups / snapshot policy agreed (no truncate on prod without snapshot).
- [ ] `user-service` `.env` complete (`DATABASE_URL`, `AUTH_SERVICE_URL`, logging, pagination caps, `INTERNAL_API_TOKEN`).
- [ ] Container healthy on `nginx-network`; `GET /health` **200**.

## Deploy (order)

1. [ ] `npx prisma migrate deploy` on target (if migrations pending).
2. [ ] Deploy **user-service** via service `scripts/deploy.sh` (no hand-edited nginx).
3. [ ] Smoke: `GET /health` then one JWT call per aggregate (`/api/v1/students/me`, etc.).

## Post-cutover

- [ ] Centralized logging shows requests with timestamps / `duration_ms` on slow paths.
- [ ] Rollback path documented: prior container image + DB restore from snapshot if ETL was destructive.

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Lead Orchestrator | | | |

**Cutover GO for traffic:** pending completion of unchecked items above.
