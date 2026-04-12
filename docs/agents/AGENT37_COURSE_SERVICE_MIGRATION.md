# AGENT37: Phase 3 Wave 2 — Course Data Migration

## Role

Data Migration Agent: ETL from legacy Django Postgres to **`speakasap_course_db`**.

## Objective

Repeatable import (dry-run supported), documented in migration log; validation queries documented for **products**, **offers**, **pricing** only.

## Inputs

- `docs/refactoring/COURSE_DATA_MAPPING.md` (frozen)
- `course-service/prisma/schema.prisma` (or target schema)
- Legacy DB access pattern from Phase 2 / Wave 1 migration scripts (`user-service/scripts/` or `certification-service/scripts/` style)
- `docs/refactoring/USER_DATA_MIGRATION_LOG.md` or `CERTIFICATION_DATA_MIGRATION_LOG.md` — template for logs

## Scope

- Script under `course-service/scripts/` (e.g. `migrate-course-from-legacy.py`) with `--dry-run`, idempotent strategy documented.
- `docs/refactoring/COURSE_DATA_MIGRATION_LOG.md` — operator runbook.
- `docs/refactoring/COURSE_DATA_VALIDATION.md` — counts, orphan SQL, sign-off table.

## Do

- Preserve id mapping rules from `COURSE_DATA_MAPPING.md`.
- Log with timestamps for long-running steps (diagnose hangs without raising DB timeouts arbitrarily).

## Do Not

- Do not truncate production without documented snapshot policy in the log.
- Do not import legacy models outside ROADMAP §3.1 scope for this wave.
- Do not pull financial-domain tables unless Lead expands §3.1.

## Outputs

- Migration script(s) in `course-service/scripts/`
- `COURSE_DATA_MIGRATION_LOG.md`, `COURSE_DATA_VALIDATION.md`

## Exit Criteria

- Dry-run documented; full-run steps documented.
- **Next:** `docs/agents/AGENT37V_COURSE_SERVICE_MIGRATION_VALIDATE.md` → **PASS** before TASK-38.
