# AGENT57V: Validator — Salary Service Migration (TASK-57)

## Role

QA / Data Validator.

## Objective

Clear sync **P4-SD**.

## Preconditions

- TASK-57 submitted (script + docs).

## Verification Scope

1. Script exists; docs exist; rollback approach described.
2. Mapping aligns with `SALARY_DATA_MAPPING.md`.
3. No secrets in repo.
4. Dry-run/idempotent behavior documented.
5. Payroll period reconciliation section present.

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Script + docs present | file check | paths |
| Mapping parity | compare docs | validation section |
| Secret hygiene | `rg` scan | no leaks |
| Rerun safety | script/doc review | idempotency section |
| Reconciliation | validation review | period totals |

## Commands (examples)

- `rg "SALARY_DATA_MIGRATION_LOG|SALARY_DATA_VALIDATION" docs/refactoring`
- `rg "secret|token|password" salary-service/scripts docs/refactoring/SALARY_DATA_*`

## Verification results (evidence)

| Check | Result | Evidence |
| --- | --- | --- |
| Script + docs | PASS | `speakasap/salary-service/scripts/migrate-salary-data.ts`; `docs/refactoring/SALARY_DATA_MIGRATION_LOG.md`, `SALARY_DATA_VALIDATION.md`, `SALARY_DATA_MAPPING.md`. Rollback: truncate SQL in `SALARY_DATA_VALIDATION.md` § Rollback; log file cross-references it. |
| Mapping parity | PASS | `SALARY_DATA_VALIDATION.md` enum/field sections match `SALARY_DATA_MAPPING.md` (currency, `preferable_pm`, expense `kind`, `lessonUuid` null, `documentStorageKey`). Lesson rows: mapping documents join-only `lesson_id` and no `legacyLessonId` on target (aligned with Prisma + ETL). |
| Secret hygiene | PASS | `rg -i "secret|token|password|api[_-]?key|BEGIN RSA|sk_live|postgresql://[^:]+:[^@]+@" salary-service/scripts docs/refactoring` (glob `SALARY_DATA_*` for second path): no matches. |
| Rerun safety | PASS | Script header: `--dry-run` overrides `--load`. `SALARY_DATA_MIGRATION_LOG.md` documents UUIDv5 + `skipDuplicates: true`. |
| Reconciliation | PASS | `SALARY_DATA_VALIDATION.md` § Payroll period reconciliation; script emits `transform.payrollPeriodSample` from `payrollByPeriod()`. |
| Build | PASS | `cd salary-service && npx tsc --noEmit` (exit 0). |

Live DB dry-run not executed in this pass (requires `SALARY_LEGACY_DATABASE_URL` / target URLs in env).

## Sync gate

- **P4-SD:** PASS

## Verdict

PASS (matrix satisfied: artifacts, doc review, secret scan, `tsc`. Operational dry-run/load remains operator checklist in `SALARY_DATA_VALIDATION.md`.)

### If FAIL

Return to `docs/agents/AGENT57_SALARY_SERVICE_MIGRATION.md`.
