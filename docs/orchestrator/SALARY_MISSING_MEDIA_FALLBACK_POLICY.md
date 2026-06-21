# Salary Missing Media Fallback Policy - Goal 9.6

Date: 2026-06-21

Status: owner selected Option 2 for the seven unresolved salary-scoped private media rows. This policy records the approved fallback decision only. It does not approve salary finalization, payout creation, payout commit, payment-service disbursement, deployment, rollback execution, object-storage mutation, legacy mutation, or destructive action.

## Preserved Intent

Goal 9 preserves legacy teacher payroll parity for periods where imported legacy salary data already records lesson salary quantities. Missing target private media must not silently create synthetic recording durations, but it also must not block salary parity when the exact affected lessons are covered by imported `LessonSalaryExpense` rows.

## Approved Fallback Policy

For the seven Goal 9.6 salary-scoped lesson records whose private media probes still return `http_404`:

- Do not synthesize or write `education_lessonrecord.duration_seconds`.
- Do not copy, restore, delete, or rewrite private recording objects.
- Use the already-imported legacy lesson salary expense quantity as the authoritative salary quantity for salary calculation preview/run logic.
- Keep `lessonSalaryHoursSource = imported_legacy_lesson_salary_expenses` in calculation line breakdowns when imported lesson salary quantities are used.
- Keep the rows classified as missing-media for recording-duration parity and future object recovery.
- Require separate approval before any salary calculation write, payout write, payment execution, deployment, rollback execution, object-storage mutation, fallback DB write, or legacy mutation.

## Evidence

- Recovery report: `/tmp/speakasap-salary-scoped-media-recovery-readonly-goal9-v1.json`.
- Salary lesson UUID report: `/tmp/speakasap-salary-lesson-uuids-2025-07_2026-06-goal9.json`.
- Read-only coverage check on 2026-06-21: seven unresolved rows, seven covered by imported lesson salary UUIDs, zero uncovered.
- All seven unresolved rows had `reachableCount=0`, `partsJsonCount=0`, and `recordPartRowCount=0`.
- Existing salary-service calculation logic already permits duration blockers only when every missing/short duration blocker is covered by imported lesson salary expenses and teacher mappings/dependency warnings are clear.

## Boundaries

Allowed now:

- Documentation/state update recording this owner decision.
- No-write salary readiness and calculation preview checks using current service logic.
- Future approval packet preparation for a gated draft salary calculation run if no-write preview is acceptable.

Not allowed by this policy:

- Any new DB write to salary, education, user, payment, or legacy portal data.
- Object-storage copy, restore, delete, or key mutation.
- Salary calculation run creation.
- Payout creation, payout commit, or payment-service disbursement.
- Deployment or persistent environment changes.
- Rollback SQL execution.
- Destructive cleanup or legacy retirement.

## Next Validation

Run no-write salary readiness and calculation preview for the target period using the imported lesson salary coverage path. If the preview is acceptable, prepare a separate gated approval packet before creating any draft salary calculation run.
