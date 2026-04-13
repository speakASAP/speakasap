# AGENT52V: Validator — Notification Service Migration (TASK-52)

## Role

QA / Data Validator.

## Objective

Clear sync **P4-ND**.

## Preconditions

- TASK-52 submitted (script + docs).

## Verification Scope

1. Script exists; docs exist; rollback approach described.
2. Mapping aligns with `NOTIFICATION_DATA_MAPPING.md`.
3. No secrets in repo.
4. Dry-run and idempotent rerun behavior documented.
5. Template placeholder conversion checks included.

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Script presence | file check | script path |
| Migration docs | file check | doc paths |
| Mapping parity | compare docs | validation section |
| Secret hygiene | `rg` in scripts/docs | no matches |
| Rerun safety | inspect script/docs | idempotency note |

## Commands (examples)

- `rg "NOTIFICATION_DATA_MIGRATION_LOG|NOTIFICATION_DATA_VALIDATION" docs/refactoring`
- `rg "secret|token|password" notification-service/scripts docs/refactoring/NOTIFICATION_DATA_*`

## Verification results (evidence)

| Check | Result | Evidence |
| --- | --- | --- |
| Script presence | PASS | `speakasap/notification-service/scripts/migrate-notification-data.ts` |
| Migration docs | PASS | `docs/refactoring/NOTIFICATION_DATA_VALIDATION.md`, `docs/refactoring/NOTIFICATION_DATA_MIGRATION_LOG.md`, agent `docs/agents/AGENT52_NOTIFICATION_SERVICE_MIGRATION.md` |
| Mapping parity | PASS | Canonical mapping only in `NOTIFICATION_DATA_MAPPING.md` (incl. `managerUserId` TASK-52 rule); `NOTIFICATION_DATA_VALIDATION.md` points there; script `migrate-notification-data.ts` matches mapping |
| Secret hygiene | PASS | `rg` on `notification-service/scripts`: no `secret|token|password` matches; `rg` on `docs/refactoring/NOTIFICATION_DATA_*`: only policy wording (“No passwords…”, “Do not paste secrets”) |
| Dry-run | PASS | Script: `PrismaClient` only when `--load`; else `log('dry_run_no_writes')` (`migrate-notification-data.ts`); doc: `NOTIFICATION_DATA_VALIDATION.md` § Idempotency |
| Rerun / idempotency | PASS | Upserts on groups/templates/prefs/letters/in-app; `template_groups` + `notification_group_managers` deleteMany-by-migrated-set then createMany; doc states second `--load` behavior |
| Rollback | PASS | `NOTIFICATION_DATA_VALIDATION.md` § Rollback (snapshot / truncate order; legacy read-only) |
| Template placeholders | PASS | Script `readTemplateBodyHtml` HTML comment when file missing + `template_body_missing_file` log; validation § “Legacy template tokens” + missing-file row |

Commands run (workspace):

- `rg "NOTIFICATION_DATA_MIGRATION_LOG|NOTIFICATION_DATA_VALIDATION" speakasap/docs/refactoring` — hits validation + log + script references.
- `rg -i "secret|token|password" speakasap/notification-service/scripts` — no matches.
- `rg -i "secret|token|password" speakasap/docs/refactoring/NOTIFICATION_DATA_*` — policy lines only (see table).

**Not run here:** `npm run migrate:notification-data` against real DBs (needs env + operator); checklist and code inspection sufficient for static validator gate.

## Sync gate

- **P4-ND:** PASS

## Verdict

PASS (static review). Runtime confirmation: operator runs `--dry-run`, `--load`, `--verify-post-load` per `NOTIFICATION_DATA_VALIDATION.md`.

### If FAIL

Return to `docs/agents/AGENT52_NOTIFICATION_SERVICE_MIGRATION.md`.
