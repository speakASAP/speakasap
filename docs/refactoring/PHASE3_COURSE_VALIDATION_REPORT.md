# Phase 3 — Course service wave validation (TASK-38)

**Date:** 2026-04-12  
**Scope:** `speakasap-course-service` (port **4205**, DB **`speakasap_course_db`**) per `COURSE_API_CONTRACT.md`.

## Executive summary

| Area | Status |
|------|--------|
| Scaffold + build | **PASS** (TASK-34) |
| Contract + mapping freeze | **PASS** (TASK-35) |
| NestJS implementation vs contract | **PASS** (TASK-36) |
| ETL script + validation docs | **PASS** (script/doc review; **live ETL** still **BLOCKED** until `COURSE_SOURCE_DATABASE_URL` is reachable — e.g. SSH tunnel `127.0.0.1:15432`) |
| Deploy / traffic | **PARTIAL** (**2026-04-13**) — `speakasap/scripts/deploy.sh` completed; **`speakasap-course-blue`** healthy on **4205**; **`GET /health` PASS**; JWT list smoke **pending** valid access token; **`speakasap-user-blue`**: initial compose start **failed** to bind host **4207** (orphan `node dist/main.js` on that port); container may run **without** host port mapping until that PID is stopped and the stack is recreated |

**Program decision:** **GO** for **engineering completion through P3-CD** (scaffold, contracts, API implementation, migration script + validation SQL). **Operator:** run `prisma migrate deploy`, ETL dry-run/full import, then compose deploy and HTTP smoke with real JWT.

**Operator pass (2026-04-13):** Created DB `speakasap_course_db` (was missing). `pg_dump` backup under `speakasap/backups/` (custom format). `npx prisma migrate deploy` applied init migration (host URL via `COURSE_TARGET_DATABASE_URL`). `npm run prisma:migrate:deploy` in `course-service` now prefers `COURSE_TARGET_DATABASE_URL` then `COURSE_DATABASE_URL` ([`course-service/package.json`](../course-service/package.json)). ETL `--dry-run` failed: connection refused to legacy source `127.0.0.1:15432`. Blue/green deploy rebuilt **course-service** image and started **`speakasap-course-blue`**.

## Gate table

| Gate | Task | Validator | Outcome |
|------|------|-----------|---------|
| P3-CA | TASK-34 | AGENT34V | **PASS** |
| P3-CB | TASK-35 | AGENT35V | **PASS** |
| P3-CC | TASK-36 | AGENT36V | **PASS** |
| P3-CD | TASK-37 | AGENT37V | **PASS** (doc + script; live import pending) |
| P3-CE | TASK-38 | AGENT38V | **PASS** (this report + checklist) |

## HTTP smoke (when routed)

| Check | Result |
|-------|--------|
| `GET /health` | **PASS** (**2026-04-13**, `http://127.0.0.1:4205/health` → `{"status":"ok"}`) |
| `GET /api/v1/categories` with JWT | **PENDING** — need `Authorization: Bearer <access_token>` from auth (`POST {AUTH_SERVICE_URL}/auth/login` or equivalent); run after ETL if validating row counts |
| `GET /api/v1/products?page=1&limit=10` with JWT | **PENDING** (same) |

## Non-blocking follow-ups

- Align legacy column list in `migrate-course-from-legacy.py` with live `\d` output on `speakasap-portal` DB if any drift.
- Add staff-scope claim for catalog reads if product requires stricter auth than “any valid JWT”.
