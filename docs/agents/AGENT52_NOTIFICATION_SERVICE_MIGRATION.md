# AGENT52: Phase 4 — Notification Service Data Migration (TASK-52)

## Role

Data Migration Agent: ETL from legacy Django DB to **`speakasap_notification_db`** per frozen `NOTIFICATION_DATA_MAPPING.md`.

## Objective

Idempotent migration script + logs + validation documentation.

## Inputs

- `NOTIFICATION_DATA_MAPPING.md`, `NOTIFICATION_API_CONTRACT.md`
- `notification-service/` service from prior tasks
- Legacy DB access rules per org (read-only from legacy)

## Scope

1. ETL script under `notification-service/scripts/`.
2. Support dry-run and idempotent rerun.
3. Produce:
   - `NOTIFICATION_DATA_MIGRATION_LOG.md`
   - `NOTIFICATION_DATA_VALIDATION.md`

## Do

- Document counts, orphans, rollback notes.
- Timestamped logging for long-running steps.
- Document legacy template token transformation rules.

## Do Not

- Do not widen legacy DB credentials in committed code; use env only.

## Exit Criteria

- Validator PASS for **P4-ND**.
- **Next:** `docs/agents/AGENT52V_NOTIFICATION_SERVICE_MIGRATION_VALIDATE.md`.
