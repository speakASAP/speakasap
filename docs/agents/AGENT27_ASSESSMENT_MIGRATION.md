# AGENT27: Assessment — Data Migration

## Role

Data Migration Agent for **speakasap_assessment_db**.

## Objective

Migrate `language_tests` and `user_tests` data per `ASSESSMENT_DATA_MAPPING.md`. **Do not** migrate `teacher_tests`.

---

## Inputs

- `docs/refactoring/ASSESSMENT_DATA_MAPPING.md`
- `docs/refactoring/ASSESSMENT_API_CONTRACT.md`
- Schema from TASK-26
- Legacy DB for `speakasap-portal`

## Scope

- ETL / migration with logging and validation artifacts.
- Explicit confirmation that `teacher_tests` was not imported.

## Do

- `ASSESSMENT_DATA_MIGRATION_LOG.md` — procedure, volumes, errors, timestamps.
- `ASSESSMENT_DATA_VALIDATION.md` — checks, results, sample row parity.

## Do Not

- Do not import `teacher_tests`.
- Do not store certification data in assessment DB.

## Outputs

- ETL env: **`ASSESSMENT_SOURCE_DATABASE_URL`** / **`ASSESSMENT_TARGET_DATABASE_URL`** in **`speakasap/.env`** (`ENV_MONOREPO.md`; script falls back to `SOURCE_*` / `TARGET_*`).
- `docs/refactoring/ASSESSMENT_DATA_MIGRATION_LOG.md`
- `docs/refactoring/ASSESSMENT_DATA_VALIDATION.md`
- Migration scripts in `speakasap` repo per existing conventions

## Exit Criteria

- **Next:** `docs/agents/AGENT27V_ASSESSMENT_MIGRATION_VALIDATE.md` → **PASS**.
