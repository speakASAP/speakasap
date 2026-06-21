# Salary Draft Calculation Approval Packet - Goal 9 Option B

Date: 2026-06-21

Status: approval packet prepared. No salary calculation run, payout creation, payout commit, payment-service disbursement, deployment, rollback execution, object-storage mutation, fallback DB write, legacy mutation, or destructive action is approved or run by this document.

## What This Means In Plain Language

The next possible step is to create one draft salary calculation for the already-reviewed period `2026-05`.

Draft means the system writes a calculation record and calculation lines so the result can be reviewed. It does not pay anyone. It does not send money. It does not finalize payroll.

This packet exists so the owner can approve exactly that one draft write, with rollback SQL prepared, while keeping all payout/payment/finalization gates closed.

## Current Evidence

- Option B fallback policy: `docs/orchestrator/SALARY_MISSING_MEDIA_FALLBACK_POLICY.md`.
- Readiness report: `/tmp/speakasap-salary-readiness-2026-05-option2-v1.json`.
- Option B coverage report: `/tmp/speakasap-salary-option2-import-coverage-v1.json`.
- Recovery report: `/tmp/speakasap-salary-scoped-media-recovery-readonly-goal9-v1.json`.

Evidence summary:

- `writes=false` for all preparation reports.
- Period: `2026-05`.
- Current readiness still reports `salaryCalculationReady=false` because there are duration blockers.
- Those blockers are covered by imported legacy salary data:
  - duration blockers covered by imported lesson salary rows: `6/6`;
  - unresolved missing-media fallback rows covered by imported lesson salary rows: `7/7`;
  - uncovered rows: `0`;
  - teacher mapping blockers: `0`;
  - aggregate warnings: none.

## Approved Fallback Rule

For the seven unresolved missing-media salary rows, use imported legacy `LessonSalaryExpense.qty` as the authoritative salary quantity.

Do not synthesize or write `education_lessonrecord.duration_seconds`.

Keep those rows marked as missing-media for future recording-object recovery and recording-duration parity.

## Proposed Approved Write

If the owner approves this packet, run exactly one draft salary calculation for period `2026-05`.

Allowed:

- Temporarily enable salary calculation runs only for the one command or one short-lived process.
- Create one draft `calculation_runs` row.
- Create the related `calculation_lines` rows for period `2026-05`.
- Use imported legacy lesson salary quantities where the Option B fallback policy applies.
- Capture a JSON execution report.
- Generate rollback SQL for exactly the created draft calculation run.
- Verify after the run that no payout run exists and no payment/disbursement happened.

Not allowed:

- Salary finalization.
- Payout creation.
- Payout commit.
- Payment-service disbursement.
- Persistent `SALARY_CALCULATION_RUNS_ENABLED=true` runtime environment change.
- `SALARY_PAYOUT_FLOWS_ENABLED=true`.
- Salary expense/profile mutation.
- Education/user/legacy portal mutation.
- Object-storage copy, restore, delete, or key mutation.
- Deployment or Kubernetes rollout.
- Rollback SQL execution.
- Destructive cleanup or legacy retirement.

## Required Artifacts If Approved

- Execution report: `/tmp/speakasap-salary-calculation-run-2026-05-option2-v1.json`.
- Rollback SQL: `/tmp/speakasap-salary-calculation-run-rollback-2026-05-option2-v1.sql`.
- Post-run salary status: `/tmp/speakasap-salary-status-after-calculation-option2-v1.json`.
- Status/doc update recording the result and boundaries.

## Rollback Plan

Rollback SQL must delete only:

- `calculation_lines` for the created draft run ID;
- `calculation_runs` for the created draft run ID.

Rollback execution is not approved by this packet. If rollback is needed, record the failure and ask for separate rollback approval.

## What The Owner Needs To Do

The owner does not need to prepare any file or command.

Choose one:

1. Approve the exact draft calculation write below.
2. Reject it and keep Goal 9 blocked before draft calculation.
3. Change the scope, for example a different period or a smaller profile set.

Approval text:

```text
Approved to create one draft salary calculation run for SpeakASAP Goal 9 period 2026-05 using Option B imported legacy LessonSalaryExpense.qty fallback evidence from /tmp/speakasap-salary-option2-import-coverage-v1.json. Temporarily enable salary calculation only for the one command, generate rollback SQL before/with the write, capture /tmp/speakasap-salary-calculation-run-2026-05-option2-v1.json and /tmp/speakasap-salary-status-after-calculation-option2-v1.json, and do not create payouts, commit payouts, execute payments, persist runtime env changes, deploy, mutate education/user/legacy/object storage data, execute rollback SQL, or perform destructive actions.
```

## Current Recommendation

Approve only if you want a reviewable draft salary calculation record for `2026-05`.

Do not approve payouts or payment execution yet. Those remain separate future gates after the draft calculation is reviewed.
