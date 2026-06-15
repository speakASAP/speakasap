# Salary Calculation Run Approval

Date: 2026-06-13

Status: owner approved a scoped draft calculation smoke in chat: "Agree, go ahead."

## Scope

Run one gated draft salary calculation smoke for period `2026-05` after no-write parity evidence showed:

- `/tmp/speakasap-salary-readiness-2026-05.json`: `writes=false`, `missingDurationCount=0`, `shortRecordCount=6`, `teacherMappingMissingCount=0`.
- `/tmp/speakasap-salary-short-record-reconciliation-2026-05.json`: all six short-record rows have legacy/imported salary expense `qty=1.00`.
- `/tmp/speakasap-salary-calculation-preview-2026-05.json`: `writes=false`, `linesUsingImportedLessonSalary=14`, `blockerSamplesCoveredByImportedSalaryExpenses=6`.

## Approved Write

Allowed:

- Temporarily set `SALARY_CALCULATION_RUNS_ENABLED=true` in a local smoke process only.
- Create one draft `calculation_runs` row and related `calculation_lines` rows for period `2026-05`.
- Capture a JSON execution report and rollback SQL for the exact created run.

Not allowed:

- Payout creation or payout commit.
- Payment-service disbursement.
- Deployment, Kubernetes rollout, or persistent env change.
- Salary expense/profile mutation.
- Education, user, legacy portal, object storage, or destructive mutation.

## Rollback

Rollback SQL must delete only:

- `calculation_lines` for the created run ID.
- `calculation_runs` for the created run ID.

## Next Gate

Review the draft calculation report before any broader calculation enablement. Payouts remain blocked until separate payment-boundary approval.
