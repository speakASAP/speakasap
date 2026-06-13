# Salary Migration Goal - Recording-Duration Payroll

Date: 2026-06-13

Status: new migration goal defined; implementation not started in this pass.

## Owner Direction

The legacy lesson-recording path remains available as fallback/reference if the new service is not running or a migrated workflow regresses.

Next migration target: salary, because teacher salary/payments depend on lesson-recording duration after a lesson is recorded and saved.

## Preserved Legacy Behavior

Legacy salary calculation uses lesson recordings as payroll evidence:

- When a lesson is finished, legacy creates a `LessonSalaryExpense`.
- When a lesson record is updated, legacy recalculates salary expense quantity from MP3 duration.
- If a non-demo lesson has a ready recording, `LessonRecord.get_record_length(as_string=False)` reads MP3 duration through `mutagen.mp3.MP3`.
- If the recorded duration is longer than 95% of scheduled lesson duration, legacy treats the lesson as full scheduled duration.
- The paid quantity is capped at scheduled lesson duration and quantized through `portal.utils.numbers.quantize`.
- If there is no duration:
  - demo lessons without MP3 are paid as `0`;
  - non-demo lessons without a record or with `record_unavailable` fall back to `1`.
- `get_real_lessons_duration(teacher, year, month)` sums recording-derived hours for finished lessons.
- Monthly salary creation uses real duration:
  - hourly `rate` creates a `SalaryExpense` with `qty=real_duration`;
  - fixed `salary` uses lower/upper duration bounds to decide full fixed salary or hourly delta rows.

## Legacy Evidence

Primary legacy sources:

- `speakasap-portal/education/lesson_records/models.py`
  - `LessonRecord.get_record_length()` reads MP3 length from local or storage-backed file.
- `speakasap-portal/expenses/salary/utils.py`
  - `check_expense_qty()`
  - `get_record_length_in_hours()`
  - `check_lesson_expense()`
  - `get_expected_lessons_duration()`
  - `get_real_lessons_duration()`
- `speakasap-portal/expenses/signals/handlers.py`
  - `add_lesson_expense()` on lesson finish.
  - `update_salary_expense()` on lesson record update.
- `speakasap-portal/expenses/tasks.py`
  - `calculate_salary()`
  - `create_salary_expense()`
  - `create_salary_expense_based_on_salary()`
- `speakasap-portal/expenses/management/commands/add_lessons_to_expenses.py`
  - backfills or updates lesson salary expenses by month/teacher.
- `speakasap-portal/administrator/views/salary.py`
  - admin monthly salary list/detail and expected vs real duration display.
- `speakasap-portal/expenses/tests/test_common.py`
  - legacy examples: finished lessons create salary expenses; uploaded example MP3 changes qty from `0` to `0.01`; monthly commands update only finished lessons.

## Current Target State

Existing `salary-service` already contains:

- `SalaryProfile`
- `SalaryExpense`
- `CalculationRun`
- `CalculationLine`
- `PayoutRun`
- `PayoutLine`
- `salary-service/scripts/migrate-salary-data.ts`
- `CalculationRunsService`, which already calls `EducationClientService.fetchPeriodAggregates()`

Current key gap:

- `education-service` does not yet expose `/api/v1/internal/salary/period-aggregates`.
- Migrated `LessonRecord` metadata currently stores private object keys and state, but does not persist MP3 duration seconds.
- `LessonRecordsService.getState()` returns `durationSeconds: null`.
- Salary calculations currently depend on the not-yet-implemented education aggregate endpoint, so the new system cannot yet reproduce legacy recording-duration payroll parity.

## Target Ownership

| Capability | Owner |
| --- | --- |
| Recording metadata, record duration, finished lessons, teacher assignment, paid lesson access | `education-service` |
| Salary profiles, salary expenses, calculation runs, payout runs | `salary-service` |
| Payment execution / external money movement | `payments-microservice`; salary-service may only create payout intent/records through approved payment boundary |
| Auth identity and role validation | `auth-microservice` through gateway/service guards |
| Private recording objects | `minio-microservice`; accessed only through controlled service paths |
| Public/API route boundary | `api-gateway` |

## New Goal Scope

Create a new migration goal for salary/payroll parity:

1. Inventory salary behavior and map source tables to target models.
2. Add a dry-run/reconciliation report for salary profiles, salary expenses, lesson-linked salary expenses, monthly salary rows, and payout-related rows.
3. Add education-service recording-duration support:
   - preserve private object access;
   - derive or persist MP3 duration in a controlled way;
   - expose internal salary period aggregates by teacher/profile identity and month.
4. Harden salary-service calculation parity:
   - use education aggregates;
   - preserve hourly and fixed-salary lower/upper-bound behavior;
   - preserve admin subtotal/total semantics where needed.
5. Add write gates and rollback evidence before any salary/payout data apply.
6. Add payment-boundary gates before creating or sending real payouts.
7. Add frontend/admin parity only after service contract and dry-run evidence exist.

## Acceptance Criteria

- Legacy fallback for lesson recordings remains available until a later owner-approved retirement window.
- Salary migration is dry-run/reconciliation first.
- Reports include source counts, target counts, duplicate keys, orphan lesson references, orphan salary profiles, missing auth/user mappings, missing teacher mappings, and sample source/target IDs.
- Recording-derived salary hours match legacy rules for selected parity cases.
- Demo/no-record/record-unavailable/95%-threshold/upper-bound/lower-bound cases are explicitly tested.
- `salary-service` does not bypass `payments-microservice` for real payout execution.
- No salary apply, payout creation, payment execution, destructive operation, or legacy retirement runs without explicit owner approval.

## First Implementation Chunk

Goal 9.1 should be investigation/design only:

- Produce `docs/orchestrator/SALARY_MIGRATION_INVENTORY.md`.
- Produce a source-to-target salary mapping for:
  - `expenses_salaryprofile`
  - `expenses_salaryexpense`
  - `education_lessonsalaryexpense`
  - `expenses_supportbonusexpense`
  - employee contract/payment profile data used by salary output
- Define the exact education aggregate contract consumed by `salary-service`.
- Define the salary dry-run report format and verification commands.

No code writes or runtime salary calculations should start before Goal 9.1 is complete.
