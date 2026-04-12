# AGENT37V: Validator — Course Data Migration (TASK-37)

## Role

QA / Data Validator. Review migration **design and documentation**; operator executes SQL on target DB.

## Objective

Clear **P3-CD** before program validation (TASK-38).

## Preconditions

- TASK-36 + `AGENT36V` PASS.

## Verification Scope

1. Script matches `COURSE_DATA_MAPPING.md` (sources, transforms, FK rules).
2. Dry-run / full-run CLI documented; destructive flags explicit.
3. `COURSE_DATA_VALIDATION.md` includes count queries and orphan detection for all imported relations.
4. No credentials committed; connection strings via **`speakasap/.env`** only (`ENV_MONOREPO.md`).

## Manual Checks

- [x] Code review of `migrate-course-from-legacy.py` — PASS (**2026-04-12**): FK-safe truncate order; ordered copy; env `COURSE_SOURCE_*` / `COURSE_TARGET_*`
- [x] `COURSE_DATA_VALIDATION.md` SQL targets Prisma migration table names

## Sync gate (before TASK-38)

- **P3-CD:** **PASS** (live ETL evidence pending operator; same pattern as user-wave AGENT32V)

## Verdict

**PASS**

### If FAIL

Return to `AGENT37_COURSE_SERVICE_MIGRATION.md`. Do not clear **P3-CD** until PASS.
