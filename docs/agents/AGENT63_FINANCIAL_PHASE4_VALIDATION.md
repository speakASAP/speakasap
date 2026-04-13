# AGENT63: Phase 4 — Financial Wave Program Validation (TASK-63)

## Role

QA / Contract Validator Agent: program-level GO/NO-GO for **Financial** wave.

## Objective

Produce `PHASE4_FINANCIAL_VALIDATION_REPORT.md` and `PHASE4_FINANCIAL_CUTOVER_CHECKLIST.md`.

## Inputs

- Prior TASK artifacts for this wave; frozen contracts; migration validation docs.

## Scope

1. Summarize gate evidence for **P4-FA..P4-FD**.
2. Include migration reconciliation with category-level totals.
3. Add smoke matrix for category CRUD, revenue/expense summaries, dashboard endpoints.
4. Mark blocked checks as **DEFERRED** with owner and unblock condition.
5. Provide phase close-out cutover and rollback order.

## Do Not

- Do not claim PASS for unchecked items; use DEFERRED with reason if blocked.

## Outputs

- `docs/refactoring/PHASE4_FINANCIAL_VALIDATION_REPORT.md`
- `docs/refactoring/PHASE4_FINANCIAL_CUTOVER_CHECKLIST.md`

## Exit Criteria

- Report states **GO** or **NO-GO** with reasons.
- **Next:** `docs/agents/AGENT63V_FINANCIAL_PHASE4_VALIDATION_VALIDATE.md` → **PASS** for **P4-FE**.
