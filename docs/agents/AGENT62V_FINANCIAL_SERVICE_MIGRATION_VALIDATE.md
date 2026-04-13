# AGENT62V: Validator — Financial Service Migration (TASK-62)

## Role

QA / Data Validator.

## Objective

Clear sync **P4-FD**.

## Preconditions

- TASK-62 submitted (script + docs).

## Verification Scope

1. Script exists; docs exist; rollback approach described.
2. Mapping aligns with `FINANCIAL_DATA_MAPPING.md`.
3. No secrets in repo.
4. Dry-run/idempotent behavior documented.
5. Category normalization and reconciliation checks present.

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Script + docs present | file check | paths |
| Mapping parity | compare docs | validation section |
| Secret hygiene | `rg` scan | no leaks |
| Rerun safety | script/doc review | idempotency note |
| Category reconciliation | validation review | totals by category |

## Commands (examples)

- `rg "FINANCIAL_DATA_MIGRATION_LOG|FINANCIAL_DATA_VALIDATION" docs/refactoring`
- `rg "secret|token|password" financial-service/scripts docs/refactoring/FINANCIAL_DATA_*`

## Verification results (evidence)

- Paths: `financial-service/scripts/migrate-financial-data.ts`, `docs/refactoring/FINANCIAL_DATA_MIGRATION_LOG.md`, `docs/refactoring/FINANCIAL_DATA_VALIDATION.md`
- Financial ETL reuses `PAYMENT_LEGACY_DATABASE_URL` from `.env.example` (no second legacy URL).
- `npx tsc --noEmit -p financial-service/tsconfig.json` — exit 0.
- `rg "postgres://|postgresql://|password=|secret|BEGIN RSA" financial-service/scripts` — no hits (docs mention `rg` pattern text only).
- Live legacy/target dry-run not executed here (requires `PAYMENT_LEGACY_DATABASE_URL` + `FINANCIAL_DATABASE_URL` on runner).

## Sync gate

- **P4-FD:** PASS (scaffold + docs + static analysis; execute SQL reconciliation on real DB per `FINANCIAL_DATA_VALIDATION.md`)

## Verdict

PASS — run legacy ETL dry-run/load in an environment with portal + financial DB URLs, then fill SQL diff rows in the validation doc if needed.

### If FAIL

Return to `docs/agents/AGENT62_FINANCIAL_SERVICE_MIGRATION.md`.
