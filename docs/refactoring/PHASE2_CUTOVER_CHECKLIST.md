# Phase 2 cutover checklist (TASK-28)

Ordered steps for certification + assessment extraction when **cutover GO** is issued in `PHASE2_VALIDATION_REPORT.md`.  
**Status 2026-04-12:** **GO** for data + integrity (`PHASE2_VALIDATION_REPORT.md`). **Follow-up:** deploy + JWT HTTP smoke (checklist § Deploy / smoke).

## Pre-checks

- [x] `SOURCE_DATABASE_URL` = read-only legacy Django Postgres (reachable from import runner). **2026-04-12:** operator workstation + SSH tunnel `speakasap` → local `15432` (see migration logs).
- [x] `TARGET_DATABASE_URL` = same logical DB as each service’s `DATABASE_URL` (certification vs assessment targets **separate**).
- [x] Host-side CLI: either rewrite `db-server-postgres` → `127.0.0.1` in URL for alfares shell, **or** run `npx` / `python3` in a container on `nginx-network`. **2026-04-12:** `127.0.0.1:25432` tunnel to alfares Postgres from Mac for Python ETL.
- [x] Quote any `.env` values that contain spaces (e.g. `LOG_TIMESTAMP_FORMAT`) so `set -a && . ./.env` does not break. (assessment-service quoted; certification empty value safe.)
- [x] `pip` / `python3` with `psycopg2-binary` available on import host (alfares: OK).

## Schema

- [x] `cd certification-service && npx prisma migrate deploy` on certification target.
- [x] `cd assessment-service && npx prisma migrate deploy` on assessment target.

## Data import (destructive options: review snapshot policy first)

- [x] Certification: `python3 scripts/migrate-certification-from-legacy.py --dry-run` then full run per `CERTIFICATION_DATA_MIGRATION_LOG.md`.
- [x] Assessment: same per `ASSESSMENT_DATA_MIGRATION_LOG.md`.
- [x] Update both migration **execution record** tables with timestamps and row summaries.

## Validation SQL

- [x] Run legacy + target count queries in `CERTIFICATION_DATA_VALIDATION.md`; resolve or document variance.
- [x] Run queries in `ASSESSMENT_DATA_VALIDATION.md`; confirm M2M table name on legacy if counts diverge.

## Deploy / smoke (when services are wired)

- [ ] Deploy certification-service (4202) and assessment-service (4203) per standard `deploy.sh` + nginx regeneration from service repos.
- [ ] `/health` on both; sample authenticated calls vs `CERTIFICATION_API_CONTRACT.md` / `ASSESSMENT_API_CONTRACT.md`.

## Rollback

- [ ] Restore Postgres snapshots taken before `--truncate-first` / bulk import, **or** truncate domain tables and re-import from legacy snapshot.
- [ ] Routing: redeploy previous service slot via each service’s `./scripts/deploy.sh` (and central blue/green flow); do not hand-edit nginx product rules.

## Sign-off

- [x] `AGENT28V` meta-validator **PASS** **2026-04-12** (see `PHASE2_VALIDATION_REPORT.md` — HTTP contract rows deferred as non-blocking).
- [ ] Lead Orchestrator name/date (human sign-off line below).

**Sign-off line (when complete):** Name: _______________  Date: _______________
