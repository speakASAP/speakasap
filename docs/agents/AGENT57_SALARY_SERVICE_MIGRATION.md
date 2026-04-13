# AGENT57: Phase 4 — Salary Service Data Migration (TASK-57)

## Role

Data Migration Agent: ETL from legacy Django DB to **`speakasap_salary_db`** per frozen `SALARY_DATA_MAPPING.md`.

## Objective

Idempotent migration script + logs + validation documentation.

## Inputs

- `SALARY_DATA_MAPPING.md`, `SALARY_API_CONTRACT.md`
- `salary-service/` service from prior tasks
- Legacy DB access rules per org (read-only from legacy)

## Scope

1. Place ETL script under `salary-service/scripts/`.
2. Provide dry-run and idempotent rerun modes.
3. Produce:
   - `SALARY_DATA_MIGRATION_LOG.md`
   - `SALARY_DATA_VALIDATION.md`

## Do

- Document counts, orphans, rollback notes.
- Timestamped logging for long-running steps.
- Add reconciliation by payroll period where available.

## Do Not

- Do not widen legacy DB credentials in committed code; use env only.

## Exit Criteria

- Validator PASS for **P4-SD**.
- **Next:** `docs/agents/AGENT57V_SALARY_SERVICE_MIGRATION_VALIDATE.md`.
