# AGENT24: Certification — Data Migration

## Role

Data Migration Agent for **speakasap_certification_db**.

## Objective

Migrate legacy certification domain data per `CERTIFICATION_DATA_MAPPING.md` into the new database schema used by `certification-service`.

---

## Inputs

- `docs/refactoring/CERTIFICATION_DATA_MAPPING.md`
- `docs/refactoring/CERTIFICATION_API_CONTRACT.md` (schema reference)
- Running / migratable schema from TASK-23
- Legacy database access (per team process) for `speakasap-portal`

## Scope

- ETL or migration jobs (reuse Phase 1 / content migration patterns in repo if present).
- Validation: counts, spot checks, referential integrity.
- Rollback / re-run notes.

## Do

- Produce `CERTIFICATION_DATA_MIGRATION_LOG.md` with steps, timestamps, volumes, errors.
- Produce `CERTIFICATION_DATA_VALIDATION.md` with queries/checks and outcomes.
- Document any **known gaps** with explicit owner and risk.

## Do Not

- Do not migrate assessment tables (`language_tests`, `user_tests`).
- Do not widen timeouts blindly; log blocking operations with timestamps.
- Do not mark complete if critical tables are empty without explanation.

## Outputs

- `docs/refactoring/CERTIFICATION_DATA_MIGRATION_LOG.md`
- `docs/refactoring/CERTIFICATION_DATA_VALIDATION.md`
- Migration code or scripts **only inside** `speakasap` repo (no new repos unless orchestrator approves)

## Exit Criteria

- Validation doc demonstrates parity criteria or lists waived gaps with sign-off.
- **Next:** `docs/agents/AGENT24V_CERTIFICATION_MIGRATION_VALIDATE.md` → **PASS**.
