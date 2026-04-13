# AGENT47: Phase 4 — Payment Service Data Migration (TASK-47)

## Role

Data Migration Agent: ETL from legacy Django DB to **`speakasap_payment_db`** per frozen `PAYMENT_DATA_MAPPING.md`.

## Objective

Idempotent migration script + logs + validation documentation.

## Inputs

- `PAYMENT_DATA_MAPPING.md`, `PAYMENT_API_CONTRACT.md`
- `payment-service/` service from prior tasks
- Legacy DB access rules per org (read-only from legacy)

## Prerequisites

- **P4-OC** PASS.
- Legacy table names confirmed against `speakasap-portal`.

## Scope

1. Add ETL script under `payment-service/scripts/`.
2. Support dry-run mode (extract + transform only).
3. Support idempotent load mode (safe rerun).
4. Produce wave-specific logs/validation docs:
   - `PAYMENT_DATA_MIGRATION_LOG.md`
   - `PAYMENT_DATA_VALIDATION.md`

## Do

- Document counts, orphans, rollback notes.
- Timestamped logging for long-running steps.
- Explicitly document enum/status normalization from legacy values.

## Do Not

- Do not widen legacy DB credentials in committed code; use env only.
- Do not alter source-of-truth legacy data.

## Exit Criteria

- Validator PASS for **P4-OD**.
- **Next:** `docs/agents/AGENT47V_PAYMENT_SERVICE_MIGRATION_VALIDATE.md`.
