# Salary Migration Inventory

Date: 2026-06-13

Status: inventory and contract plan only. No target salary data write, payout, payment disbursement, deployment, or legacy data mutation is approved by this document.

## 2026-06-13 Targeted Readiness Gate

Implementation now fails closed before salary calculation or payout enablement:

- `education-service` salary aggregates report demo unpaid/payable counters so demo lessons preserve the legacy rule: demo lessons without payable recording evidence remain unpaid, while demo lessons with recording duration use the same duration/tolerance/cap path as other lessons.
- Aggregate metadata now includes `readiness` and bounded `blockerSamples` for the remaining rows that must be reconciled:
  - missing `LessonRecord.durationSeconds`;
  - short recordings that need salary parity review;
  - requested legacy users without target teacher mapping.
- `salary-service` refuses calculation creation unless `SALARY_CALCULATION_RUNS_ENABLED=true` and aggregate readiness has no missing-duration, short-record, teacher-mapping, or dependency-warning blockers.
- `salary-service` refuses payout creation and payout commit unless `SALARY_PAYOUT_FLOWS_ENABLED=true`.
- `salary-service/scripts/check-salary-readiness.ts` produces a no-write JSON report for a period and exits nonzero when blockers remain.
- `salary-service` calculation code preserves imported historical lesson salary quantities: when imported lesson salary expenses exist for a profile/month, calculation lines use the stored imported `qty` hour sum instead of recomputing those historical lesson hours from recording duration. This is required by the 2026-05 short-record reconciliation evidence, where all six short-record blockers had legacy/imported `qty=1.00` and duration recalculation would underpay.

No salary calculation run, payout run, payment/disbursement, salary row write, education row write, legacy row write, deployment, destructive operation, or legacy retirement is approved by this gate.

## Preserved Intent

Salary migration must preserve the legacy teacher/staff pay workflow while keeping private employee, teacher, lesson, student, and payout data inside the correct service boundaries. Legacy `speakasap-portal` remains the behavior reference until salary-service parity is verified.

Target owner: `salary-service`.

Related owners:

- `auth-microservice`: identity, JWT validation, roles, and legacy identity mappings.
- `user-service`: migrated teacher, manager, employee-profile mirrors and profile ownership metadata.
- `education-service`: lesson completion, teacher lesson aggregates, paid/demo lesson semantics, and recording-duration derived minutes.
- `payment-service`: any real payout/disbursement execution.
- `financial-service`: cross-domain finance rollups and salary total consumption.
- `api-gateway`: external route proxy/auth boundary.

## Legacy Behavior

Evidence sources:

- `speakasap-portal/expenses/models.py`
- `speakasap-portal/expenses/salary/utils.py`
- `speakasap-portal/expenses/tasks.py`
- `speakasap-portal/expenses/signals/handlers.py`
- `speakasap-portal/expenses/api/views/common.py`
- `speakasap-portal/expenses/api/serializers/common.py`
- `speakasap-portal/expenses/forms.py`
- `speakasap-portal/administrator/urls.py`
- `speakasap-portal/administrator/views/salary.py`
- `speakasap-portal/education/models.py`
- `speakasap-portal/employees/models/contracts.py`

### Salary Profiles

`expenses_salaryprofile` is a one-to-one extension of `auth_user`. It stores pay configuration for teachers and other staff:

- `currency`
- `preferable_pm`
- fixed monthly `salary`
- hourly `rate`
- `show_as_teacher`
- `show_as_other`
- `bank_account`
- `paypal_account`
- `work_duration_lower_bound`
- `work_duration_upper_bound`

Legacy salary profile visibility is permission-driven:

- `expenses.view_teacher_profiles`
- `expenses.view_other_profiles`
- `expenses.view_private_profiles`
- `expenses.view_all_profiles`

Without private-profile permission, staff see only teacher or other profiles allowed by their profile permissions and the profile display flags.

### Salary Expenses

`expenses_expense` is the base table with `date`, `price`, `qty`, `comment`, and `currency`.

`expenses_salaryexpense` adds `user_id`. Its `total` is `price * qty` quantized to two decimals.

Subtypes:

- `education_lessonsalaryexpense`: one-to-one with a lesson. This is the teacher lesson pay row.
- `expenses_supportbonusexpense`: optional support bonus tied to legacy student and group references.

Legacy admin salary totals exclude rows whose comment contains `Salary` when calculating period subtotal views. The target already mirrors this behavior in `salary-service/src/admin/admin-summary.service.ts`.

### Lesson Salary Creation And Updates

Legacy lesson salary rows are created as a side effect of lesson completion:

- `Lesson.finish()` emits `lesson_finished`.
- `expenses.signals.handlers.add_lesson_expense` creates `LessonSalaryExpense` through `lesson.add_expense()`.
- Creation is skipped or logged if the lesson has no `start`, no teacher, or the teacher has no user.
- Duplicate lesson salary rows are skipped because `LessonSalaryExpense.lesson` is one-to-one.
- `lesson.add_expense()` defaults `qty` to `0` until the recording is uploaded; `price` comes from the teacher rate and `currency` from the teacher salary profile.

Recording updates then call `check_lesson_expense()` to sync the expense quantity from recorded duration.

### Recorded Duration Rules

Legacy pay duration is calculated by `expenses.salary.utils.get_record_length_in_hours()`:

- Demo course lessons are unpaid when no recording-duration rule applies.
- If no lesson record exists, the fallback quantity is `1` for non-demo lessons and `0` for demo lessons.
- If the lesson record is marked unavailable, quantity falls back to `1`.
- If recording duration is within five minutes of scheduled lesson duration, pay the full scheduled duration.
- Otherwise pay the minimum of recorded hours and scheduled lesson duration.
- Final quantity is quantized by the existing legacy number helper.

This means salary parity depends on migrated lesson metadata and recording duration semantics, not only on `education_lesson` completion rows.

### Monthly Salary Calculation

Legacy Celery task `expenses.calculate_salary` runs for the last month:

- period date is the last day of the previous month;
- comment is `Salary YYYY-MM`;
- active salary profiles with non-zero `rate` or `salary` are considered;
- existing `Salary YYYY-MM` rows for a user prevent duplicate monthly generation;
- teachers use real lesson duration from the legacy education/recording rules;
- hourly profiles create `SalaryExpense(price=rate, qty=real_duration)`;
- fixed salary profiles create a fixed salary expense when lower and upper work-duration bounds are equal;
- fixed salary profiles below lower bound create an hourly expense for real duration;
- fixed salary profiles above upper bound create an hourly expense for overtime above the upper bound.

Legacy notification task `expenses.notify_teachers_about_calculated_salary` sends `teacher/salary_ready` to teachers with active non-zero pay configuration.

### Teacher Self-Service API

Legacy `expenses/api/views/common.py::MySalaryExpenses` returns current user's salary rows for a requested month plus stub lesson expenses for finished teacher lessons that do not yet have a real `LessonSalaryExpense`.

The stub uses:

- lesson title;
- local lesson date;
- teacher rate;
- scheduled lesson duration;
- teacher currency;
- `stub=true`.

This behavior must be preserved or intentionally replaced before teacher-facing cutover.

### Admin UI Behavior

Legacy administrator salary pages provide:

- list by month and profile class: all, teachers, or other staff;
- per-profile monthly detail;
- manual salary expense create/update;
- salary profile create/update/list;
- totals by currency and preferable payment method;
- expected versus real lesson duration for teacher profiles.

The target service can expose this through API contracts rather than cloning templates, but the user-visible totals, filtering, and permission semantics must match.

### Employee Contracts

Legacy `employees_employeecontract` stores employee contract documents and metadata. Contracts can be main contracts or prolongations linked by `main_id`. Contract type text depends on salary profile: fixed salary, hourly rate, or empty when neither is configured.

Contract documents contain private employee data. Migrating `document` values must preserve controlled storage references and must not publish raw documents.

## Source-To-Target Mapping

Target evidence:

- `salary-service/prisma/schema.prisma`
- `salary-service/scripts/migrate-salary-data.ts`
- `salary-service/src/salary-profiles/*`
- `salary-service/src/salary-expenses/*`
- `salary-service/src/employee-contracts/*`
- `salary-service/src/calculation-runs/*`
- `salary-service/src/payout-runs/*`
- `salary-service/src/deps/education-client.service.ts`
- `salary-service/src/deps/payment-client.service.ts`
- `api-gateway/src/proxy/upstream-resolve.ts`

| Legacy source | Target model/table | Identifier strategy | Mapping notes | Reconciliation |
| --- | --- | --- | --- | --- |
| `expenses_salaryprofile` | `SalaryProfile` / `salary_profiles` | Deterministic UUID from `speakasap:salary:profile:<legacy id>`; preserve `legacy_profile_id` and `legacy_portal_user_id`. | Current ETL resolves `authUserId` from `user-service.user_identity_mirror`, which is populated from `auth-microservice.legacy_identity_mappings` during user migration. The 2026-06-13 auth-map-only run populated all imported salary profiles. Decimal salary/rate and display flags are preserved. | Count source/target profiles, missing auth mappings, duplicate legacy IDs, profiles without target user mirror. |
| `expenses_expense` + `expenses_salaryexpense` | `SalaryExpense` / `salary_expenses` | Deterministic UUID from `speakasap:salary:expense:<expense id>`; preserve `legacy_expense_id` and `legacy_portal_user_id`. | Maps base fields `date`, `price`, `qty`, `comment`, `currency`. Requires profile lookup by legacy user. Rows without salary profile are skipped and reported. | Count source/target expenses, skipped no-profile rows, duplicate `legacy_expense_id`, totals by month/currency. |
| `education_lessonsalaryexpense` | `SalaryExpense.kind = lesson` | Same salary expense UUID; `lesson_uuid` should be populated by education aggregate/backfill contract. | Existing ETL classifies kind and the 2026-06-13 approved lesson UUID backfill populated imported lesson salary expense `lesson_uuid` values. Final parity depends on target lesson record `duration_seconds` for recording-derived salary minutes. | Count lesson salary rows, missing target lessons, lesson rows with null `lesson_uuid`, totals by teacher/month versus education aggregate. |
| `expenses_supportbonusexpense` | `SalaryExpense.kind = support_bonus` | Same salary expense UUID. | Preserve `legacy_student_id` and `legacy_student_group_id`; target student/group UUID resolution can remain deferred if salary only needs legacy traceability. | Count support rows, missing profile rows, missing student/group warnings. |
| `employees_employeecontract` | `EmployeeContract` / `employee_contracts` | Deterministic UUID from `speakasap:salary:contract:<legacy id>`; preserve `legacy_contract_id`. | Load main contracts before subcontracts; preserve `main_id` relation, dates, `verified`, `contract_uid`, and document storage key. | Count contracts, missing user/profile mappings, missing parent contracts, document key null/non-null totals. |
| Legacy salary calculation task output | `CalculationRun` + `CalculationLine` | New UUIDs per run/line; period `YYYY-MM`; idempotency key required for API creation. | Target calculation currently uses monthly fixed salary plus `rate * education.totalMinutes/60`. It depends on education aggregate and should carry rules version. | Compare line count and amount by profile/currency against legacy monthly dry-run totals. |
| Legacy payout action is implicit/manual | `PayoutRun` + `PayoutLine` | New UUIDs; idempotency key required for create/commit. | Real disbursement crosses into `payment-service` through internal salary disburse APIs. No payout commit may run during migration without owner approval. | Payout lines equal finalized calculation lines; payment refs absent until approved commit. |

## Education Aggregate Contract

Salary-service already calls `education-service` through `EducationClientService`:

```text
GET /api/v1/internal/salary/period-aggregates?period=YYYY-MM&legacyPortalUserIds=1,2,3
Header: X-Internal-Token: <internal token>
```

Current status: `education-service` has a read-only implementation for `internal/salary/period-aggregates`, and `user-service` has a deployed internal teacher legacy-user mapping endpoint. Runtime smoke on 2026-06-13 returned valid JSON for the education aggregate endpoint. On 2026-06-13, target code/schema support was added for lesson record `duration_seconds` and the salary aggregate rule was changed to record-duration minutes with a fixed five-minute full-lesson tolerance. Existing migrated records still need trusted duration values before aggregate parity can be proven.

### Request

Query parameters:

- `period`: required `YYYY-MM`.
- `legacyPortalUserIds`: optional comma-separated legacy `auth_user.id` values. When absent, return all teacher users for the period.

Headers:

- `X-Internal-Token`: required. Must match `EDUCATION_SERVICE_INTERNAL_TOKEN` or shared internal token policy.

### Response

```json
{
  "period": "2026-05",
  "items": [
    {
      "legacyPortalUserId": 123,
      "teacherId": 45,
      "finishedLessonCount": 12,
      "paidLessonCount": 11,
      "demoLessonCount": 1,
      "scheduledMinutes": 720,
      "payableMinutes": 660,
      "totalMinutes": 660,
      "recordedMinutes": 640,
      "recordUnavailableCount": 0,
      "missingRecordCount": 1,
      "fallbackPaidLessonCount": 1,
      "currency": "EUR",
      "warnings": []
    }
  ],
  "meta": {
    "source": "education-service",
    "rulesVersion": "salary-duration-v3-record-length-5min-tolerance",
    "generatedAt": "2026-06-13T00:00:00.000Z"
  }
}
```

Compatibility note: salary-service currently reads only `legacyPortalUserId`, `finishedLessonCount`, and `totalMinutes`. The richer fields above are required for reconciliation and for proving parity with legacy demo, missing-record, unavailable-record, five-minute-tolerance, and capped-duration rules.

### Education Aggregate Rules

For each finished lesson in the period:

- Include only lessons whose teacher maps to one of the requested legacy portal user IDs.
- Use target migrated lesson start date to assign the period.
- Preserve legacy demo behavior: demo lessons without payable recording evidence count as `0`.
- Use target lesson record `duration_seconds` when available.
- If record duration is within five minutes of scheduled lesson duration, payable duration is full scheduled duration.
- If no record exists for a non-demo lesson, fallback payable duration is `1` hour unless owner approves a changed policy.
- If record is marked unavailable, fallback payable duration is `1` hour.
- Cap payable duration at scheduled lesson duration.
- Return minutes as integers; salary-service converts to hours for `rate * hours`.

### Failure Modes

- Missing internal token: `401`.
- Invalid token: `403`.
- Invalid period or malformed user IDs: `400`.
- Unknown requested user IDs: return no item for that ID and list count in `meta.missingUserIds` if implemented.
- Education database unavailable: `503`.

## Dry-Run Report Format

Salary migration dry-runs must write JSON to an explicit path and must not mutate source or target data.

Recommended command shape:

```bash
cd salary-service
npm run migrate:salary-data -- --dry-run --json-report /tmp/speakasap-salary-dry-run-YYYYMMDD.json
```

The current script now supports `--dry-run`, `--json-report`, `--apply`, `--confirm-write`, `--approval-note`, and `--rollback-plan`; legacy `--load` is treated as write mode and requires the same gates.

Required JSON shape:

```json
{
  "domain": "salary",
  "generated_at": "2026-06-13T00:00:00.000Z",
  "writes": false,
  "source": {
    "salary_profiles": 0,
    "salary_expenses": 0,
    "lesson_salary_expenses": 0,
    "support_bonus_expenses": 0,
    "employee_contracts": 0,
    "course_single_lesson_salary_rows": 0,
    "course_group_lesson_salary_rows": 0
  },
  "target": {
    "salary_profiles_existing": 0,
    "salary_expenses_existing": 0,
    "employee_contracts_existing": 0,
    "calculation_runs_existing": 0,
    "payout_runs_existing": 0
  },
  "would_write": {
    "salary_profiles": 0,
    "salary_expenses": 0,
    "employee_contracts": 0
  },
  "mapping": {
    "profiles_missing_auth_uuid": {
      "count": 0,
      "sample_legacy_profile_ids": []
    },
    "expenses_without_profile": {
      "count": 0,
      "sample_legacy_expense_ids": []
    },
    "lesson_expenses_missing_target_lesson": {
      "count": 0,
      "sample_legacy_expense_ids": []
    },
    "contracts_missing_parent": {
      "count": 0,
      "sample_legacy_contract_ids": []
    }
  },
  "conflicts": {
    "duplicate_legacy_profile_ids": [],
    "duplicate_legacy_expense_ids": [],
    "duplicate_legacy_contract_ids": [],
    "target_legacy_profile_id_conflicts": [],
    "target_legacy_expense_id_conflicts": [],
    "target_legacy_contract_id_conflicts": []
  },
  "period_reconciliation": [
    {
      "period": "2026-05",
      "currency": "EUR",
      "legacy_row_count": 0,
      "target_row_count": 0,
      "legacy_qty_sum": "0.0000",
      "target_qty_sum": "0.0000",
      "legacy_amount_sum": "0.00",
      "target_amount_sum": "0.00"
    }
  ],
  "education_aggregate_reconciliation": {
    "period": "2026-05",
    "requested_teacher_users": 0,
    "returned_teacher_users": 0,
    "legacy_real_duration_sum_minutes": 0,
    "education_total_minutes": 0,
    "mismatch_count": 0,
    "sample_mismatches": []
  },
  "approval": {
    "required_for_apply": true,
    "approval_note": null,
    "rollback_plan": null
  }
}
```

## Verification Commands

Run these only when the relevant repository, environment variables, and owner approval gates are satisfied.

### Read-Only Inventory Checks

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap-portal && rg -n "SalaryProfile|SalaryExpense|LessonSalaryExpense|calculate_salary|check_lesson_expense|MySalaryExpenses" expenses education administrator employees -S'
```

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap && rg -n "salary|period-aggregates|calculation-runs|payout-runs|contracts" salary-service api-gateway education-service -S'
```

### Target Static Checks

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap/salary-service && npm run prisma:validate'
```

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap/salary-service && npm run build'
```

### Salary ETL Dry Run

Current script:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap/salary-service && npm run migrate:salary-data -- --dry-run'
```

Required hardened script before apply:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap/salary-service && npm run migrate:salary-data -- --dry-run --json-report /tmp/speakasap-salary-dry-run-v1.json'
```

### Education Aggregate Smoke

After deploying the internal education endpoint, run from inside the cluster or through a temporary smoke pod so the internal token stays inside Kubernetes secret scope:

```bash
ssh alfares 'kubectl -n statex-apps run speakasap-education-salary-smoke --rm -i --restart=Never --image=curlimages/curl:8.10.1 --env="TOKEN=$(kubectl -n statex-apps get secret speakasap-education-secret -o jsonpath={.data.EDUCATION_SERVICE_INTERNAL_TOKEN} | base64 -d)" -- sh -lc '''curl -sS -H "X-Internal-Token: $TOKEN" "http://speakasap-education:4206/api/v1/internal/salary/period-aggregates?period=YYYY-MM&legacyPortalUserIds=<legacy-user-id>"''''
```

Expected: JSON response with `items[].legacyPortalUserId`, `finishedLessonCount`, and `totalMinutes`; no private student fields or recording object keys. The 2026-06-13 smoke returned valid JSON and warning `no_teacher_mapping_for_requested_legacy_users` for the sampled legacy user.

### Salary CLI Read-Only Checks

Use the CLI for target database inspection only; it must not create salary rows, calculation runs, payout runs, or payment disbursements. When running from the remote host against the Kubernetes Postgres service, use a temporary port-forward and stop it after the report is written.

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap/salary-service && npm run salary:cli -- --help'
```

```bash
ssh alfares 'kubectl -n statex-apps port-forward svc/db-server-postgres 15434:5432'
```

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap/salary-service && set -a && . ../.env && set +a && export SALARY_DATABASE_URL="${SALARY_DATABASE_URL/db-server-postgres:5432/127.0.0.1:15434}" && npm run salary:cli -- status --json-report /tmp/speakasap-salary-cli-status-v1.json'
```

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap/salary-service && set -a && . ../.env && set +a && export SALARY_DATABASE_URL="${SALARY_DATABASE_URL/db-server-postgres:5432/127.0.0.1:15434}" && npm run salary:cli -- period-summary --period YYYY-MM --json-report /tmp/speakasap-salary-cli-period-YYYY-MM.json'
```

### Cross-Service Reconciliation Queries

Run against target databases after dry-run or apply evidence is available:

```sql
-- Salary rows with no migrated profile.
SELECT legacy_portal_user_id, COUNT(*)
FROM salary_expenses se
WHERE NOT EXISTS (
  SELECT 1 FROM salary_profiles sp WHERE sp.id = se.profile_id
)
GROUP BY legacy_portal_user_id;
```

```sql
-- Lesson salary rows still missing target lesson UUID after backfill.
SELECT COUNT(*)
FROM salary_expenses
WHERE kind = 'lesson' AND lesson_uuid IS NULL;
```

```sql
-- Period totals by currency.
SELECT to_char(date, 'YYYY-MM') AS period,
       currency,
       COUNT(*) AS rows,
       SUM(qty) AS qty_sum,
       SUM(price * qty) AS amount_sum
FROM salary_expenses
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
```

### Apply Gate

Do not run a salary apply/load until all are true:

- Fresh dry-run report exists.
- Target schema validation and build pass.
- Education aggregate endpoint is implemented or lesson salary rows are explicitly deferred with owner approval.
- Rollback SQL or deletion criteria are generated.
- Owner approval is recorded in `docs/orchestrator/STATUS.md`.
- Apply command includes `--apply --confirm-write --approval-note ... --rollback-plan ...`.

## Open Gaps

- `/api/v1/internal/salary/period-aggregates` is deployed and smoke-tested, but sampled user coverage still needs a legacy user with a known migrated teacher mapping.
- Target education aggregate now has schema/code support for `duration_seconds`. Salary-period media metadata repair and duration backfill were applied on 2026-06-13: `/tmp/speakasap-lesson-record-key-repair-apply-v1.json` updated `835` record keys, and `/tmp/speakasap-lesson-record-duration-salary-period-apply-v1.json` updated `2420` duration rows for `2025-07` through `2026-06`. Remaining salary-period gap: `13` records still have missing media objects.
- `SalaryProfile.authUserId` is populated for all 386 imported salary profiles; future reruns still depend on `USER_DATABASE_URL` / `user_identity_mirror` availability.
- Salary ETL lesson `SalaryExpense.lessonUuid` backfill was applied with owner approval: post-apply report `/tmp/speakasap-salary-lesson-uuid-backfill-post-apply-v1.json` recorded `98753` imported lesson expenses with lesson UUID, `0` nulls, and `0` remaining updates.
- Salary ETL has explicit apply gates, JSON reports, and rollback SQL generation; future reruns still need owner approval and reconciliation review.
- Teacher self-service salary stubs are not yet mapped to a target route.
- Salary notification parity for `teacher/salary_ready` is not yet mapped to `notification-service`.
- Payout commit crosses into `payment-service` and requires separate owner approval before any real disbursement test.

## Next Implementation Boundary

The next salary migration chunk should be documentation-to-code hardening only:

1. Rerun salary aggregate parity with target `duration_seconds`, then isolate the 13 remaining salary-period records with missing media and decide recovery versus approved fallback before enabling salary calculation runs or payout flows.
2. Map teacher self-service salary stubs and salary-ready notifications to target services.

### 2026-06-13 Duration Parity Rerun

Read-only parity report `/tmp/speakasap-salary-duration-parity-2025-07_2026-06-v2.json` compared imported lesson salary rows against target education lesson records using `salary-duration-v3-record-length-5min-tolerance` for `2025-07` through `2026-06`. All `2687` imported lesson salary rows had populated lesson UUIDs and matched target education lessons. Full parity remains open: `215` row minute mismatches, `105` aggregate mismatches, `286` missing-duration fallback rows, and `1` teacher mapping mismatch remain. The five-minute tolerance correction reduced row mismatches from `300` to `215`; remaining blockers are demo zero-pay rows, missing measured duration/media, materially short recordings, and the single no-teacher target lesson.

### 2026-06-21 Salary-Scoped Duration Full Probe

Read-only salary-scoped duration probe `/tmp/speakasap-salary-scoped-duration-full-probe-goal9-v1.json` used the imported lesson salary UUID report for `2025-07` through `2026-06` and recorded `writes=false`, `candidates=9`, `attempted=9`, `succeeded=2`, and `failed=7`. The two measured target media rows produced durations `9` seconds and `30` seconds. The seven remaining rows failed private media probing with `http_404` and require media recovery or explicit fallback policy approval before full duration parity can be claimed.

Recovery approval packet: `docs/orchestrator/SALARY_DURATION_RECOVERY_APPROVAL.md`. No duration apply, object mutation, salary finalization, payout, payment execution, deployment, rollback execution, or destructive action ran in this probe.

### 2026-06-21 Option A Salary-Scoped Duration Apply

After owner approval, approved apply report `/tmp/speakasap-salary-scoped-duration-apply-goal9-v1.json` recorded `writes=true`, `candidates=9`, `selected=9`, `attempted=9`, `succeeded=2`, `failed=7`, and `updated=2`. The updated lesson records were `93e96231-2bf1-4a66-8273-bc153dbeb9ff` = `9` seconds and `03913255-48ca-470f-8fc1-47a141b7b492` = `30` seconds. Rollback SQL was generated at `/tmp/speakasap-salary-scoped-duration-apply-goal9-v1-rollback.sql`.

Post-apply no-write probe `/tmp/speakasap-salary-scoped-duration-post-apply-probe-goal9-v1.json` recorded `writes=false`, `candidates=7`, `attempted=7`, `succeeded=0`, and `failed=7`; all remaining rows still fail private media probing with `http_404`. No object mutation, salary finalization, payout, payment execution, deployment, rollback execution, legacy mutation, fallback write, or destructive action ran.

### 2026-06-21 Read-Only Media Recovery Probe

Approved read-only recovery report `/tmp/speakasap-salary-scoped-media-recovery-readonly-goal9-v1.json` checked the seven remaining salary-scoped private media `http_404` rows after Option A. It recorded `writes=false`, `recordCount=7`, `reachableRecords=0`, and `unresolvedRecords=7`.

The report tested current record keys, legacy-prefixed current keys, canonical dated mp3/webm/m4a keys, and legacy-prefixed canonical mp3 keys. All `40` candidate probes returned `http_404`. All seven rows have no parts JSON entries and no `education_lessonrecordpart` rows. Exact private object keys remain in the `/tmp` report only and were not copied into durable docs.

Next recovery requires a separate decision: locate a trusted legacy object source for restore/copy, approve an explicit salary fallback policy, or keep the rows blocked. No object mutation, fallback DB write, salary finalization, payout, payment execution, deployment, rollback execution, legacy mutation, or destructive action ran.
