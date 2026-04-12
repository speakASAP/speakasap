# AGENT32: Phase 3 Wave 1 — User Data Migration

## Role

Data Migration Agent: ETL from legacy Django Postgres to **`speakasap_user_db`**.

## Objective

Repeatable import (dry-run supported), documented in migration log; validation queries documented.

## Inputs

- `docs/refactoring/USER_DATA_MAPPING.md` (frozen)
- `user-service/prisma/schema.prisma` (or target schema)
- Legacy DB access pattern from Phase 2 migration scripts (`certification-service/scripts/` style)
- `docs/refactoring/CERTIFICATION_DATA_MIGRATION_LOG.md` — template for logs

## Scope

- Script under `user-service/scripts/` (e.g. `migrate-user-from-legacy.py`) with `--dry-run`, idempotent strategy documented.
- `docs/refactoring/USER_DATA_MIGRATION_LOG.md` — operator runbook.
- `docs/refactoring/USER_DATA_VALIDATION.md` — counts, orphan SQL, sign-off table.

## Do

- Preserve id mapping rules from `USER_DATA_MAPPING.md`.
- Log with timestamps for long-running steps (diagnose hangs without raising DB timeouts arbitrarily).

## Do Not

- Do not truncate production without documented snapshot policy in the log.
- Do not import legacy apps outside user wave scope.

## Outputs

- Migration script(s) in `user-service/scripts/`
- `USER_DATA_MIGRATION_LOG.md`, `USER_DATA_VALIDATION.md`

## Exit Criteria

- Dry-run documented; full-run steps documented.
- **Next:** `AGENT32V_USER_SERVICE_MIGRATION_VALIDATE.md` → **PASS** before TASK-33.
