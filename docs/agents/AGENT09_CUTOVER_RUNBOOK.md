# AGENT09: Cutover Runbook

## Role

Release/Operations Agent responsible for drafting the cutover and rollback steps.

## Objective

Create a concise cutover runbook for enabling the marathon shim and switching traffic safely.

## Inputs

- `docs/refactoring/MARATHON_PHASE0_VALIDATION.md`
- `docs/refactoring/MARATHON_PARITY_CHECKLIST.md`
- `docs/refactoring/MARATHON_LEGACY_SHIM_PLAN.md`

## Scope

- Define steps to enable the shim and validate real traffic.
- Define rollback steps if issues appear.

## Do

- Include prerequisites (parity audit + validation GO).
- Provide exact environment toggle steps for `MARATHON_SHIM_ENABLED`.
- Include log checks (centralized logger) and success criteria.

## Do Not

- Do not execute any changes.
- Do not modify shared microservices.

## Outputs

- A one‑page cutover runbook (markdown) with steps and rollback.

**Runbook location:** `speakasap/docs/refactoring/MARATHON_CUTOVER_RUNBOOK.md`

## Exit Criteria

- Runbook is clear, minimal, and aligned to Phase 0 validation gates.
