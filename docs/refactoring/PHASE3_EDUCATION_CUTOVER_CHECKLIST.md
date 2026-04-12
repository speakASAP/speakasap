# Phase 3 — Education Wave Cutover Checklist

**Target:** `speakasap-education-service` production rollout.

## Pre-flight

- [ ] `EDUCATION_DATABASE_URL` / `EDUCATION_DB_NAME` set in `speakasap/.env` (operator).
- [ ] `prisma migrate deploy` executed on target DB.
- [ ] `migrate-education-from-legacy.py --dry-run` reviewed.
- [ ] Full ETL with `--truncate-first` only after backup.

## Deploy

- [ ] Blue or green stack builds `education-service` image.
- [ ] Container healthy on `GET /health`.

## Smoke (DEFERRED until routed + JWT)

- [ ] Staff token: `GET /api/v1/groups?page=1&limit=10` returns 200 + paginated JSON.
- [ ] Non-staff token receives 403 on staff routes.

## Rollback

- [ ] Prior stack revision tagged; DB restore procedure documented if ETL must be reversed.

## Sign-off

| Role | Name | Date | GO/NO-GO |
| ---- | ---- | ---- | -------- |
| Engineering | | 2026-04-12 | GO |
| Operator | | | Pending |
