# Phase 2 cutover checklist (TASK-28)

Ordered steps for certification + assessment extraction when **GO** is issued.  
**Status 2026-04-11:** Pre-checks incomplete — see `PHASE2_VALIDATION_REPORT.md` (**NO-GO**).

## Pre-checks

- [ ] `SOURCE_DATABASE_URL` = read-only legacy Django Postgres (reachable from import runner).
- [ ] `TARGET_DATABASE_URL` = same logical DB as each service’s `DATABASE_URL` (certification vs assessment targets **separate**).
- [ ] Host-side CLI: either rewrite `db-server-postgres` → `127.0.0.1` in URL for alfares shell, **or** run `npx` / `python3` in a container on `nginx-network`.
- [ ] Quote any `.env` values that contain spaces (e.g. `LOG_TIMESTAMP_FORMAT`) so `set -a && . ./.env` does not break.
- [ ] `pip` / `python3` with `psycopg2-binary` available on import host (alfares: OK).

## Schema

- [ ] `cd certification-service && npx prisma migrate deploy` on certification target.
- [ ] `cd assessment-service && npx prisma migrate deploy` on assessment target.

## Data import (destructive options: review snapshot policy first)

- [ ] Certification: `python3 scripts/migrate-certification-from-legacy.py --dry-run` then full run per `CERTIFICATION_DATA_MIGRATION_LOG.md`.
- [ ] Assessment: same per `ASSESSMENT_DATA_MIGRATION_LOG.md`.
- [ ] Update both migration **execution record** tables with timestamps and row summaries.

## Validation SQL

- [ ] Run legacy + target count queries in `CERTIFICATION_DATA_VALIDATION.md`; resolve or document variance.
- [ ] Run queries in `ASSESSMENT_DATA_VALIDATION.md`; confirm M2M table name on legacy if counts diverge.

## Deploy / smoke (when services are wired)

- [ ] Deploy certification-service (4202) and assessment-service (4203) per standard `deploy.sh` + nginx regeneration from service repos.
- [ ] `/health` on both; sample authenticated calls vs `CERTIFICATION_API_CONTRACT.md` / `ASSESSMENT_API_CONTRACT.md`.

## Rollback

- [ ] Restore Postgres snapshots taken before `--truncate-first` / bulk import, **or** truncate domain tables and re-import from legacy snapshot.
- [ ] Nginx / blue-green: revert active slot per `nginx-microservice` procedures.

## Sign-off

- [ ] Lead Orchestrator: P2-E **PASS** only after `AGENT28V` meta-validator **PASS** with no open blocking defects.

**Sign-off line (when complete):** Name: _______________  Date: _______________
