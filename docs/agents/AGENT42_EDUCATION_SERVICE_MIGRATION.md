# AGENT42: Phase 3 Wave 3 — Education Data Migration

## Role

Data Migration Agent: ETL from legacy Django Postgres to **`speakasap_education_db`**.

## Objective

Repeatable import (dry-run supported), documented in migration log; validation queries documented for **`education`** scope per `EDUCATION_DATA_MAPPING.md` only.

## Inputs

- `docs/refactoring/EDUCATION_DATA_MAPPING.md` (frozen)
- `education-service/prisma/schema.prisma` (or target schema)
- Legacy DB access pattern from Wave 1/2 migration scripts (`course-service/scripts/` or `user-service/scripts/` style)
- `docs/refactoring/COURSE_DATA_MIGRATION_LOG.md` or `USER_DATA_MIGRATION_LOG.md` — template for logs

## Scope

- Script under `education-service/scripts/` (e.g. `migrate-education-from-legacy.py`) with `--dry-run`, idempotent strategy documented.
- `docs/refactoring/EDUCATION_DATA_MIGRATION_LOG.md` — operator runbook.
- `docs/refactoring/EDUCATION_DATA_VALIDATION.md` — counts, orphan SQL, sign-off table.

## Do

- Preserve id mapping rules from `EDUCATION_DATA_MAPPING.md`.
- Preserve FK integrity with **already migrated** course and user IDs where mapping references those tables (document ordering if education import must run after course/user ETL).
- Log with timestamps for long-running steps (diagnose hangs without raising DB timeouts arbitrarily).

## Do Not

- Do not truncate production without documented snapshot policy in the log.
- Do not import legacy models outside ROADMAP §3.2 education scope for this wave.
- Do not import `marathon` domain tables here.

## Outputs

- Migration script(s) in `education-service/scripts/`
- `EDUCATION_DATA_MIGRATION_LOG.md`, `EDUCATION_DATA_VALIDATION.md`

## Exit Criteria

- Dry-run documented; full-run steps documented.
- **Next:** `docs/agents/AGENT42V_EDUCATION_SERVICE_MIGRATION_VALIDATE.md` → **PASS** before TASK-43.
