# Phase 3 — Course service wave validation (TASK-38)

**Date:** 2026-04-12  
**Scope:** `speakasap-course-service` (port **4205**, DB **`speakasap_course_db`**) per `COURSE_API_CONTRACT.md`.

## Executive summary

| Area | Status |
|------|--------|
| Scaffold + build | **PASS** (TASK-34) |
| Contract + mapping freeze | **PASS** (TASK-35) |
| NestJS implementation vs contract | **PASS** (TASK-36) |
| ETL script + validation docs | **PASS** (**2026-04-13**) — live ETL after SSH tunnel `127.0.0.1:15432 → speakasap:5432`; `--dry-run` + `--truncate-first` import completed |
| Deploy / traffic | **PASS** (**2026-04-13**) — `speakasap/scripts/deploy.sh` path; **`speakasap-course-blue`** healthy **4205**; **`speakasap-user-blue`** host **4207** after removing orphan `node dist/main.js` and `docker rm -f` + compose recreate user-service |

**Program decision:** **GO** for **engineering completion through P3-CD** (scaffold, contracts, API implementation, migration script + validation SQL). **Operator:** run `prisma migrate deploy`, ETL dry-run/full import, then compose deploy and HTTP smoke with real JWT.

**Operator pass (2026-04-13):** Created DB `speakasap_course_db` (was missing). `pg_dump` backup under `speakasap/backups/` (custom format). `npx prisma migrate deploy` applied init migration (host URL via `COURSE_TARGET_DATABASE_URL`). `npm run prisma:migrate:deploy` in `course-service` prefers `COURSE_TARGET_DATABASE_URL` then `COURSE_DATABASE_URL` ([`course-service/package.json`](../course-service/package.json)). SSH tunnel `127.0.0.1:15432 → speakasap:5432` enabled ETL (`--dry-run`, then `--truncate-first` full import). Blue/green deploy rebuilt **course-service**; **`speakasap-user-blue`** required freeing host **4207** (orphan `node`) then `docker rm -f speakasap-user-blue` + compose recreate for published **4207/tcp**. Tunnel + JWT mint procedure documented in [`docs/infrastructure/ENV_MONOREPO.md`](../infrastructure/ENV_MONOREPO.md) and `speakasap/.env` comment block.

## Gate table

| Gate | Task | Validator | Outcome |
|------|------|-----------|---------|
| P3-CA | TASK-34 | AGENT34V | **PASS** |
| P3-CB | TASK-35 | AGENT35V | **PASS** |
| P3-CC | TASK-36 | AGENT36V | **PASS** |
| P3-CD | TASK-37 | AGENT37V | **PASS** (doc + script; **live import PASS 2026-04-13**) |
| P3-CE | TASK-38 | AGENT38V | **PASS** (this report + checklist) |

## HTTP smoke (when routed)

| Check | Result |
|-------|--------|
| `GET /health` | **PASS** (**2026-04-13**, `http://127.0.0.1:4205/health` → `{"status":"ok"}`) |
| `GET /api/v1/categories` with JWT | **PASS** (**2026-04-13**) — list envelope with ETL-loaded categories |
| `GET /api/v1/products?page=1&limit=10` with JWT | **PASS** (**2026-04-13**) — list envelope with ETL-loaded products |

## Non-blocking follow-ups

- Align legacy column list in `migrate-course-from-legacy.py` with live `\d` output on `speakasap-portal` DB if any drift.
- Add staff-scope claim for catalog reads if product requires stricter auth than “any valid JWT”.
