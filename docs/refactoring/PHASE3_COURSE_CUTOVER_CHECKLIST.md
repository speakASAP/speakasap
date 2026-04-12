# Phase 3 — Course service cutover checklist

**Wave:** Course (TASK-34…TASK-38)  
**Artifacts:** `PHASE3_COURSE_VALIDATION_REPORT.md`, `COURSE_*` docs, `course-service/`

## Pre-cutover

- [x] `speakasap/.env` contains `COURSE_DATABASE_URL`, `COURSE_SERVICE_PORT`, `COURSE_SERVICE_NAME`, `COURSE_DB_NAME`, logging, auth, pagination, `INTERNAL_API_TOKEN`.
- [x] Target DB exists: `speakasap_course_db` on `database-server` (**created 2026-04-13** where missing).
- [x] `cd course-service && npm run prisma:migrate:deploy` executed successfully on target (**2026-04-13**).

## ETL

- [x] `python3 course-service/scripts/migrate-course-from-legacy.py --dry-run` reviewed (**2026-04-13**, tunnel `127.0.0.1:15432 → speakasap:5432`).
- [x] Full import with `--truncate-first` (or incremental strategy approved by Lead) (**2026-04-13**).

## Deploy

- [x] `speakasap` blue/green compose includes **course-service** (blue + green already wired **2026-04-12**).
- [x] `./scripts/deploy.sh` (or standard BG) — no hand-edited nginx (**2026-04-13**).

## Post-cutover smoke

- [x] `GET /health` on course container (**2026-04-13**, blue stack).
- [x] Authenticated `GET /api/v1/products?page=1&limit=10` returns list envelope (**2026-04-13**).

## Rollback

- Re-deploy previous stack color without course traffic; DB rollback via `pg_dump` / `pg_restore` per operator runbook (mirror user-service drill).

## Sign-off

| Role | Name | Date | GO |
|------|------|------|-----|
| Lead | | | [ ] |
