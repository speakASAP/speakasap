# AGENT32V: Validator — User Data Migration (TASK-32)

## Role

QA / Data Validator. Review migration **design and documentation**; operator executes SQL on target DB.

## Objective

Clear **P3-UD** before program validation (TASK-33).

## Preconditions

- TASK-31 + `AGENT31V` PASS.

## Verification Scope

1. Script matches `USER_DATA_MAPPING.md` (sources, transforms, FK rules).
2. Dry-run / full-run CLI documented; destructive flags explicit.
3. `USER_DATA_VALIDATION.md` includes count queries and orphan detection for all imported relations.
4. No credentials committed; connection strings via env only.

## Manual Checks

- [ ] Code review of migration script
- [ ] Validation doc SQL is executable and matches schema

## Verdict

**PASS** or **FAIL** (script/doc level). Record note when live import evidence is pending operator.

### If FAIL

Return to `AGENT32_USER_SERVICE_MIGRATION.md`. Do not clear **P3-UD** until PASS.
