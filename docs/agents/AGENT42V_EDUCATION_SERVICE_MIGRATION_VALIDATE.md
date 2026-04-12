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

- [ ] Code review of migration script vs mapping
- [ ] Validation SQL targets final Prisma table names

## Verification results (evidence)

_Record findings when run. Live ETL evidence may be **DEFERRED** to operator like prior waves — document explicitly._

## Sync gate (before TASK-43)

- **P3-ED:** **PASS** or **FAIL**

## Verdict

**PENDING**

### If FAIL

Return to `AGENT42_EDUCATION_SERVICE_MIGRATION.md`. Do not clear **P3-ED** until PASS.
