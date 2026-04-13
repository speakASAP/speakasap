# AGENT47V: Validator — Payment Service Migration (TASK-47)

## Role

QA / Data Validator.

## Objective

Clear sync **P4-OD**.

## Preconditions

- TASK-47 submitted (script + docs).

## Verification Scope

1. Script exists; docs exist; rollback approach described.
2. Mapping aligns with `PAYMENT_DATA_MAPPING.md`.
3. No secrets in repo.
4. Dry-run and idempotent rerun behavior documented.
5. Counts and orphan handling are explicitly recorded.

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Script location | file check | `payment-service/scripts/*` |
| Docs present | file check | migration and validation docs |
| Mapping parity | compare columns/enums | validation notes |
| Secret hygiene | scan docs/scripts | no secret literals |
| Rerun safety | inspect script logic/docs | idempotency section |

## Commands (examples)

- `rg "PAYMENT_DATA_MIGRATION_LOG|PAYMENT_DATA_VALIDATION" docs/refactoring`
- `rg "password|secret|token" payment-service/scripts docs/refactoring/PAYMENT_DATA_*`

## Verification results (evidence)

| Check | Method | Evidence |
| --- | --- | --- |
| Script location | file | `payment-service/scripts/migrate-payment-data.ts` |
| Docs | file | `docs/refactoring/PAYMENT_DATA_{MAPPING,MIGRATION_LOG,VALIDATION}.md` |
| Secret hygiene | `rg password\|secret\|token` on scripts + `PAYMENT_DATA_*` | No matches (prior scan) |
| Dry-run + `--write-docs` | `cd payment-service && npm run migrate:payment-data -- --dry-run --write-docs` | Exit 0; JSON appended under **Runs** in `PAYMENT_DATA_MIGRATION_LOG.md` (2026-04-13T19:30:53.579Z) |
| Counts / orphans | stdout + log JSON | `orphanPayments` 0, `ordersMissingUser` 0; `orders`/`paymentAttempts`/`discount*` counts in log block |
| Subtype resilience | code + run log | Legacy DB lacked several `orders_*payment` tables; script now probes `information_schema` and builds joins dynamically (`legacy_payment_subtables_missing` in stdout) |

## Sync gate

- **P4-OD:** PASS _(checklist items 5–6 in `PAYMENT_DATA_VALIDATION.md` still open until manual spot-check before `--load`)_

## Verdict

PASS — TASK-47 artifacts verified; dry-run executed against configured env; migration log updated. **Follow-up:** complete validation checklist items 5–6 and re-run after `--load` for target orphan SQL.

### If FAIL

Return to `docs/agents/AGENT47_PAYMENT_SERVICE_MIGRATION.md`.
