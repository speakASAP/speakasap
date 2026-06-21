# Salary Payout Commit And Payment Execution Approval Packet - Goal 9 Option B

Date: 2026-06-21

Status: approval packet prepared. No payout commit, payment-service disbursement, external money movement, deployment, rollback execution, object-storage mutation, fallback DB write, legacy mutation, or destructive action is approved or run by this document unless the owner explicitly approves the exact text below.

## What This Means In Plain Language

The salary calculation is finalized and the draft payout batch exists. The next possible step is the payment step.

This step commits draft payout run `ffefafe8-c2f7-4b76-8da6-3efbd5d707d1`. In code, this is `POST /api/v1/payout-runs/:payoutRunId/commit`. It calls `PaymentClientService.disburse()`, which calls the payment-service salary disbursement endpoint for each payout line.

This can create real payment/disbursement records and may move money or start money movement depending on the configured payment-service backend. Treat this as the payment execution gate.

## Current Evidence

- Finalization/payout-preparation approval/result packet: `docs/orchestrator/SALARY_FINALIZATION_PAYOUT_PREPARATION_APPROVAL_OPTION2.md`.
- Finalization/payout-preparation report: `/tmp/speakasap-salary-finalization-payout-prep-2026-05-option2-v1.json`.
- Current salary/payout status: `/tmp/speakasap-salary-status-after-payout-prep-option2-v1.json`.
- Draft payout rollback SQL: `/tmp/speakasap-salary-finalization-payout-prep-rollback-2026-05-option2-v1.sql`.

Evidence summary:

- Period: `2026-05`.
- Calculation run: `849b766d-90d4-415d-8e59-86fca05128d5`.
- Calculation status: `finalized`.
- Calculation lines: `14`.
- Calculation totals: `CZK=29035`, `EUR=21858`.
- Draft payout run: `ffefafe8-c2f7-4b76-8da6-3efbd5d707d1`.
- Payout run status: `draft`.
- Payout lines: `14`.
- Payout line statuses: `draft=14`.
- Payout line minor totals: `CZK=2903500`, `EUR=2185800`.
- Payment refs: `0`.
- Payment disbursement created so far: `false`.
- Payout commit called so far: `false`.

## Code Boundary Checked

- `PayoutRunsService.commit()` requires an `Idempotency-Key` header.
- The commit route is `POST /api/v1/payout-runs/:payoutRunId/commit`.
- During commit, each draft payout line calls `PaymentClientService.disburse()`.
- The payment client calls `/api/v1/internal/salary/disburse` on the configured payment-service.
- After disbursement, the service polls payment status and updates payout lines to `paid`, `processing`, or `failed`.
- `SALARY_PAYOUT_FLOWS_ENABLED=true` is required. If this packet is approved, the flag may be scoped only to the one commit command/process, not persisted.

## Proposed Approved Write

If the owner approves this packet, run exactly one payout commit/payment execution operation for draft payout run `ffefafe8-c2f7-4b76-8da6-3efbd5d707d1`.

Allowed:

- Verify payout run `ffefafe8-c2f7-4b76-8da6-3efbd5d707d1` is still `draft`, linked to calculation run `849b766d-90d4-415d-8e59-86fca05128d5`, has `14` draft lines, and has `0` payment refs before commit.
- Temporarily enable `SALARY_PAYOUT_FLOWS_ENABLED=true` only for the one commit command/process if required.
- Call the existing salary-service commit path for payout run `ffefafe8-c2f7-4b76-8da6-3efbd5d707d1` exactly once, with a unique idempotency key.
- Allow `PaymentClientService.disburse()` to call payment-service salary disbursement for the `14` payout lines.
- Capture a JSON execution report with payout run status, payout line status counts, payment refs, failures, and idempotency key label/hash evidence without exposing secrets.
- Capture a post-run salary/payout/payment status report.
- Update status docs with the result and boundary evidence.

Not allowed:

- Creating another payout run.
- Creating another calculation run.
- Recalculating salary.
- Changing the finalized calculation lines or amounts before payment.
- Persistent `SALARY_PAYOUT_FLOWS_ENABLED=true` runtime environment change.
- Deployment or Kubernetes rollout.
- Rollback SQL execution.
- Object-storage copy, restore, delete, or key mutation.
- Education/user/legacy portal mutation.
- Fallback DB write.
- Destructive cleanup or legacy retirement.

## Required Artifacts If Approved

- Execution report: `/tmp/speakasap-salary-payout-commit-payment-execution-2026-05-option2-v1.json`.
- Post-run status report: `/tmp/speakasap-salary-status-after-payout-commit-option2-v1.json`.
- Failure/rollback assessment: `/tmp/speakasap-salary-payout-commit-payment-execution-rollback-assessment-2026-05-option2-v1.md`.
- Status/doc update recording the result and boundaries.

## Rollback And Failure Policy

Payment execution is not safely reversible by SQL alone once payment-service disbursement has been called.

If the commit fails or returns partial processing/failed lines:

- Do not run SQL rollback automatically.
- Do not delete payout runs or payout lines automatically.
- Preserve payment refs and line statuses.
- Produce the failure/rollback assessment artifact.
- Ask for a separate owner decision before any retry, compensation, manual payment repair, SQL rollback, or payment-service reversal/refund action.

## What The Owner Needs To Do

The owner does not need to prepare any file or command.

Choose one:

1. Approve the exact payout commit/payment execution below.
2. Reject it and keep payout run `ffefafe8-c2f7-4b76-8da6-3efbd5d707d1` in draft.
3. Change the scope, for example dry-run/status inspection only.

Approval text:

```text
Approved to commit SpeakASAP Goal 9 Option B draft payout run ffefafe8-c2f7-4b76-8da6-3efbd5d707d1 for period 2026-05, linked to finalized calculation run 849b766d-90d4-415d-8e59-86fca05128d5, executing payment-service salary disbursement for its 14 draft payout lines. Use a unique idempotency key, temporarily enable SALARY_PAYOUT_FLOWS_ENABLED only for the one commit command if required, capture /tmp/speakasap-salary-payout-commit-payment-execution-2026-05-option2-v1.json and /tmp/speakasap-salary-status-after-payout-commit-option2-v1.json, and do not create another payout run, create another calculation run, recalculate salary, persist runtime env changes, deploy, mutate education/user/legacy/object storage data, execute rollback SQL, or perform destructive actions.
```

## Current Recommendation

Approve only if you want the prepared draft payout batch to be committed and sent through the payment-service disbursement boundary.

This is the money-movement approval. If you are not ready to execute payments, reject this packet and keep payout run `ffefafe8-c2f7-4b76-8da6-3efbd5d707d1` in draft.

## Approved Execution Blocked Before Write

Status: owner approved this packet, but execution was stopped before payout commit because the required payment boundary is missing in the deployed runtime.

- Blocker report: `/tmp/speakasap-salary-payout-commit-payment-execution-blocked-2026-05-option2-v1.json`.
- Deployed payment-service route check: `/api/v1/internal/salary/disburse` route not found.
- Deployed salary-service env check: `PAYMENT_SERVICE_URL` not configured.
- Payout run remains: `ffefafe8-c2f7-4b76-8da6-3efbd5d707d1`, status `draft`.
- Payout lines remain: `14`, statuses `draft=14`.
- Payment refs remain: `0`.
- Payout commit called: `false`.
- Payment disbursement created: `false`.

No payout commit, payment-service disbursement, external money movement, deployment, rollback execution, object-storage mutation, fallback DB write, legacy mutation, or destructive action ran.

Next required action: implement and deploy the salary disbursement payment boundary, or change the payout execution plan, before retrying payout commit.

## Execution Attempt Result

Status: approved payout commit was attempted, but it stopped with a dependency error after a partial state change. The boundary implementation has been fixed and redeployed, but retry/repair requires a separate owner decision.

- Execution report: `/tmp/speakasap-salary-payout-commit-payment-execution-2026-05-option2-v1.json`.
- Post-run status: `/tmp/speakasap-salary-status-after-payout-commit-option2-v1.json`.
- Rollback assessment: `/tmp/speakasap-salary-payout-commit-payment-execution-rollback-assessment-2026-05-option2-v1.md`.
- Calculation run: `849b766d-90d4-415d-8e59-86fca05128d5`; status `finalized`.
- Payout run: `ffefafe8-c2f7-4b76-8da6-3efbd5d707d1`; status changed `draft` -> `failed`.
- Payout line statuses after attempt: `processing=1`, `failed=1`, `draft=12`.
- Payment refs after attempt: `1`.
- Error: `DEPENDENCY_UNAVAILABLE payment_disburse_409`.
- Root cause: the first boundary implementation keyed salary disbursement idempotency on the payout-run commit header, causing line 2 to conflict with line 1.
- Fix deployed: payment-service now keys salary disbursements by the per-line body `idempotencyKey` before the route header key.

No deployment rollback, SQL rollback, refund/reversal, manual settlement, or retry was run after the partial state. Any retry, compensation, manual repair, reversal/refund, SQL repair, or rollback requires a separate owner decision.

## Owner-Approved Retry Result

Status: after the owner-approved retry/repair, payout commit completed to the `processing` state. This is not a paid or settled state.

- Retry execution report: `/tmp/speakasap-salary-payout-commit-payment-execution-2026-05-option2-v2.json`.
- Post-run status: `/tmp/speakasap-salary-status-after-payout-commit-option2-v2.json`.
- Rollback assessment: `/tmp/speakasap-salary-payout-commit-payment-execution-rollback-assessment-2026-05-option2-v2.md`.
- Calculation run: `849b766d-90d4-415d-8e59-86fca05128d5`; status `finalized`.
- Payout run: `ffefafe8-c2f7-4b76-8da6-3efbd5d707d1`; status `processing`.
- Payout line statuses after retry: `processing=14`.
- Payment refs after retry: `14`.
- Commit error after retry: `null`.

Boundary: no payout line was marked `paid`, no external provider settlement was faked, and no SQL rollback/refund/reversal/manual settlement completion/status finalization ran. The next owner decision is the settlement/finalization path for the 14 processing lines.
