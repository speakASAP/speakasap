# AGENT42V: Validator — Education Data Migration (TASK-42)

## Role

QA / Data Validator. Review migration **design and documentation**; operator executes SQL on target DB.

## Objective

Clear **P3-ED** before program validation (TASK-43).

## Preconditions

- TASK-41 + `AGENT41V` PASS.

## Verification Scope

1. Script matches `EDUCATION_DATA_MAPPING.md` (sources, transforms, FK rules).
2. Dry-run / full-run CLI documented; destructive flags explicit.
3. `EDUCATION_DATA_VALIDATION.md` includes count queries and orphan detection for all imported relations.
4. No credentials committed; connection strings via **`speakasap/.env`** only (`ENV_MONOREPO.md`).
5. Ordering / dependency on course and user migrated data is documented if required.

## Manual Checks (record date + outcome)

- [x] Code review of migration script vs mapping — PASS (**2026-04-12**)
- [x] Validation SQL targets final Prisma table names — PASS

## Verification results (evidence)

**2026-04-12:** `migrate-education-from-legacy.py` + `EDUCATION_DATA_MIGRATION_LOG.md` + `EDUCATION_DATA_VALIDATION.md`; env `EDUCATION_SOURCE_*` / `EDUCATION_TARGET_*`; live ETL **DEFERRED** operator.

## Sync gate (before TASK-43)

- **P3-ED:** **PASS**

## Verdict

**PASS**

### If FAIL

Return to `AGENT42_EDUCATION_SERVICE_MIGRATION.md`. Do not clear **P3-ED** until PASS.
