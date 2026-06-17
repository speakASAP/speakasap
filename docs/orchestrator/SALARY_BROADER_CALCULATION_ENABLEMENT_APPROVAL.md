# Salary Broader Calculation Enablement Approval

Date: 2026-06-15

Status: approval packet prepared; no broader calculation run has been executed by this packet.

## Decision Needed

Approve or reject one scoped broader salary calculation run for period `2026-05` using the post-deploy evidence captured after the education-service fixed five-minute tolerance deploy.

## Evidence Reviewed

Post-deploy no-write evidence:

- Readiness report: `/tmp/speakasap-salary-readiness-2026-05-postdeploy-v1.json`
  - `writes=false`
  - rules version `salary-duration-v3-record-length-5min-tolerance`
  - `missingDurationCount=0`
  - `shortRecordCount=6`
  - `teacherMappingMissingCount=0`
  - `demoPayableLessonCount=1`
- Calculation preview: `/tmp/speakasap-salary-calculation-preview-2026-05-postdeploy-v1.json`
  - `writes=false`
  - `profiles=14`
  - `lines=14`
  - `linesUsingImportedLessonSalary=14`
  - `blockerSamples=6`
  - `blockerSamplesCoveredByImportedSalaryExpenses=6`
  - `calculationRunCreated=false`
- Salary status: `/tmp/speakasap-salary-status-postdeploy-20260615.json`
  - `calculationRuns=1`
  - `payoutRuns=0`
  - existing calculation run is the prior owner-approved draft smoke `6576ac90-526e-47c6-8755-9631a4fb3149`

## Proposed Approved Write

If approved, run exactly one additional draft salary calculation for period `2026-05` using the deployed salary calculation logic and the same post-deploy evidence constraints.

Allowed:

- Temporarily set `SALARY_CALCULATION_RUNS_ENABLED=true` only in a local/one-shot smoke process.
- Create one draft `calculation_runs` row and related `calculation_lines` rows for period `2026-05`.
- Scope the run to the 14 legacy portal user IDs in the post-deploy readiness/preview evidence.
- Capture JSON execution report and rollback SQL for the exact created run.
- Verify `payoutRuns=0` and no payment disbursement after the run.

Not allowed:

- Persistent environment change to `SALARY_CALCULATION_RUNS_ENABLED`.
- Any payout creation, payout commit, payment-service disbursement, or `SALARY_PAYOUT_FLOWS_ENABLED=true`.
- Salary expense/profile mutation.
- Education/user/legacy portal row mutation.
- Root all-service deploy, Kubernetes rollout, object-storage mutation, destructive cleanup, rollback execution, or legacy retirement.

## Required Command Shape

The implementation must use a one-shot process or direct service call that sets `SALARY_CALCULATION_RUNS_ENABLED=true` only for the command invocation, not in Kubernetes runtime env.

Required artifacts:

- Execution report: `/tmp/speakasap-salary-calculation-run-2026-05-v2.json`
- Rollback SQL: `/tmp/speakasap-salary-calculation-run-rollback-2026-05-v2.sql`
- Post-run salary status: `/tmp/speakasap-salary-status-after-calculation-v2.json`

## Rollback Plan

Rollback SQL must delete only:

- `calculation_lines` for the created run ID.
- `calculation_runs` for the created run ID.

Rollback execution is not approved by this packet. If rollback is needed, record the failure and ask for explicit rollback approval.

## Approval Wording

To approve this exact write gate, owner should say:

```text
Approved to create one additional draft salary calculation run for period 2026-05 using post-deploy preview /tmp/speakasap-salary-calculation-preview-2026-05-postdeploy-v1.json, with SALARY_CALCULATION_RUNS_ENABLED=true only for the one-shot command, rollback SQL captured, no payout runs, no payment disbursement, no persistent env change, and no unrelated deployment or data mutation.
```

## Current Recommendation

Proceed only if the owner wants a second draft calculation run after reviewing the post-deploy preview. Otherwise keep the existing draft smoke run and keep salary/payout gates closed.
