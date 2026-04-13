# AGENT62: Phase 4 — Financial Service Data Migration (TASK-62)

## Role

Data Migration Agent: ETL from legacy Django DB to **`speakasap_financial_db`** per frozen `FINANCIAL_DATA_MAPPING.md`.

## Objective

Idempotent migration script + logs + validation documentation.

## Inputs

- `FINANCIAL_DATA_MAPPING.md`, `FINANCIAL_API_CONTRACT.md`
- `financial-service/` service from prior tasks
- Legacy DB access rules per org (read-only from legacy)

## Scope

1. Place ETL script under `financial-service/scripts/`.
2. Support dry-run and idempotent rerun.
3. Produce migration docs (see Outputs).

## Outputs

- `financial-service/scripts/` — ETL migration script
- `docs/refactoring/FINANCIAL_DATA_MIGRATION_LOG.md`
- `docs/refactoring/FINANCIAL_DATA_VALIDATION.md`

## Do

- Document counts, orphans, rollback notes.
- Timestamped logging for long-running steps.
- Include category normalization and mapping reconciliation.

## Do Not

- Do not widen legacy DB credentials in committed code; use env only.

## Exit Criteria

- Validator PASS for **P4-FD**.
- **Next:** `docs/agents/AGENT62V_FINANCIAL_SERVICE_MIGRATION_VALIDATE.md`.
