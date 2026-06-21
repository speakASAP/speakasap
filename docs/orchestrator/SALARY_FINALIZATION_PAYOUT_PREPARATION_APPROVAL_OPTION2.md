# Salary Finalization And Payout Preparation Approval Packet - Goal 9 Option B

Date: 2026-06-21

Status: approval packet prepared. No salary finalization, payout run creation, payout commit, payment-service disbursement, deployment, rollback execution, object-storage mutation, fallback DB write, legacy mutation, or destructive action is approved or run by this document unless the owner explicitly approves the exact text below.

## What This Means In Plain Language

The draft salary calculation already exists and can be reviewed in the system. The next possible step is to lock that draft calculation as final and prepare a draft payout run from it.

Finalization means changing the calculation run status from `draft` to `finalized` so it can no longer be treated as an editable draft.

Payout preparation means creating a draft payout batch and draft payout lines from the finalized calculation. It does not send money. It does not call the payment-service disbursement endpoint. The payment step is `POST /api/v1/payout-runs/:payoutRunId/commit`, and that remains blocked by this packet.

## Current Evidence

- Draft calculation approval/result packet: `docs/orchestrator/SALARY_DRAFT_CALCULATION_APPROVAL_OPTION2.md`.
- Draft calculation report: `/tmp/speakasap-salary-calculation-run-2026-05-option2-v1.json`.
- Post-run status report: `/tmp/speakasap-salary-status-after-calculation-option2-v1.json`.
- Rollback SQL for the draft run: `/tmp/speakasap-salary-calculation-run-rollback-2026-05-option2-v1.sql`.
- Option B fallback coverage: `/tmp/speakasap-salary-option2-import-coverage-v1.json`.

Evidence summary:

- Period: `2026-05`.
- Draft calculation run: `849b766d-90d4-415d-8e59-86fca05128d5`.
- Draft status: `draft`.
- Rules version: `salary-duration-v3-imported-legacy-qty-v1-option2`.
- Lines: `14`; imported legacy lesson salary lines: `14`.
- Totals: `EUR=21858`, `CZK=29035`.
- Payout runs before/after the draft calculation: `0/0`.
- Payout lines before/after the draft calculation: `0/0`.
- Payment disbursement created: `false`.

## Code Boundary Checked

- `POST /api/v1/calculation-runs/:runId/finalize` changes a draft calculation run to `finalized` and refuses runs without lines.
- `POST /api/v1/payout-runs` requires the calculation run to be `finalized` and creates a draft payout run plus draft payout lines.
- `POST /api/v1/payout-runs/:payoutRunId/commit` calls `payments-microservice` through `PaymentClientService.disburse()`; this packet does not approve that call.
- `SALARY_PAYOUT_FLOWS_ENABLED=true` is required for payout run creation and commit. If this packet is approved, the flag may be scoped only to the one payout-preparation command/process, not persisted.

## Proposed Approved Write

If the owner approves this packet, run exactly one finalization and payout-preparation operation for draft calculation run `849b766d-90d4-415d-8e59-86fca05128d5` and period `2026-05`.

Allowed:

- Verify the calculation run is still `draft`, period `2026-05`, line count `14`, totals `EUR=21858` and `CZK=29035`, with no existing payout run for the calculation.
- Generate rollback SQL before or with the write.
- Finalize calculation run `849b766d-90d4-415d-8e59-86fca05128d5` by changing its status from `draft` to `finalized`.
- Temporarily enable `SALARY_PAYOUT_FLOWS_ENABLED=true` only for the one payout-preparation command/process if the existing service path requires it.
- Create one draft payout run for calculation run `849b766d-90d4-415d-8e59-86fca05128d5`.
- Create the related draft payout lines from the finalized calculation lines.
- Capture a JSON execution report and post-run status report.
- Verify after the run that payout commit did not run and payment-service disbursement did not happen.

Not allowed:

- Payout commit.
- Payment-service disbursement or external money movement.
- Calling `POST /api/v1/payout-runs/:payoutRunId/commit`.
- Marking payout lines as `paid`, `processing`, or `failed` through a payment attempt.
- Persistent `SALARY_PAYOUT_FLOWS_ENABLED=true` runtime environment change.
- Creating more than one payout run.
- Recalculating salary or creating another calculation run.
- Salary expense/profile mutation.
- Education/user/legacy portal mutation.
- Object-storage copy, restore, delete, or key mutation.
- Deployment or Kubernetes rollout.
- Rollback SQL execution.
- Destructive cleanup or legacy retirement.

## Required Artifacts If Approved

- Execution report: `/tmp/speakasap-salary-finalization-payout-prep-2026-05-option2-v1.json`.
- Rollback SQL: `/tmp/speakasap-salary-finalization-payout-prep-rollback-2026-05-option2-v1.sql`.
- Post-run salary/payout status: `/tmp/speakasap-salary-status-after-payout-prep-option2-v1.json`.
- Status/doc update recording the result and boundaries.

## Rollback Plan

Rollback SQL must be prepared but not executed unless separately approved.

Rollback scope if the approved operation succeeds:

- Delete only the draft payout lines created by the new payout run.
- Delete only the new draft payout run linked to calculation run `849b766d-90d4-415d-8e59-86fca05128d5`.
- Change calculation run `849b766d-90d4-415d-8e59-86fca05128d5` from `finalized` back to `draft` only if no committed/paid/processing payout lines exist.

Rollback execution is not approved by this packet. If rollback is needed, record the failure and ask for separate rollback approval.

## What The Owner Needs To Do

The owner does not need to prepare any file or command.

Choose one:

1. Approve the exact finalization and draft payout-preparation write below.
2. Reject it and keep Goal 9 blocked before finalization/payout preparation.
3. Change the scope, for example finalization only without payout-run creation.

Approval text:

```text
Approved to finalize SpeakASAP Goal 9 Option B draft salary calculation run 849b766d-90d4-415d-8e59-86fca05128d5 for period 2026-05 and create exactly one draft payout run with draft payout lines from that finalized calculation. Generate rollback SQL before/with the write, capture /tmp/speakasap-salary-finalization-payout-prep-2026-05-option2-v1.json and /tmp/speakasap-salary-status-after-payout-prep-option2-v1.json, temporarily enable SALARY_PAYOUT_FLOWS_ENABLED only for the one payout-preparation command if required, and do not commit payouts, call payment-service disbursement, execute payments, persist runtime env changes, create another calculation run, deploy, mutate education/user/legacy/object storage data, execute rollback SQL, or perform destructive actions.
```

## Current Recommendation

Approve only if the draft calculation totals are accepted and you want a reviewable draft payout batch prepared.

Do not approve payout commit or payment execution yet. Those remain separate future gates after the prepared payout batch is reviewed.
