# AGENT58: Phase 4 — Salary Wave Program Validation (TASK-58)

## Role

QA / Contract Validator Agent: program-level GO/NO-GO for **Salary** wave.

## Objective

Produce `PHASE4_SALARY_VALIDATION_REPORT.md` and `PHASE4_SALARY_CUTOVER_CHECKLIST.md`.

## Inputs

- Prior TASK artifacts for this wave; frozen contracts; migration validation docs.

## Scope

1. Summarize gate evidence for **P4-SA..P4-SD**.
2. Include migration reconciliation and unresolved anomalies.
3. Add smoke matrix for `/health`, calculation runs, payout status endpoints.
4. Mark blocked checks as **DEFERRED** with owner and unblock condition.
5. Provide cutover and rollback order.

## Do Not

- Do not claim PASS for unchecked items; use DEFERRED with reason if blocked.

## Outputs

- `docs/refactoring/PHASE4_SALARY_VALIDATION_REPORT.md`
- `docs/refactoring/PHASE4_SALARY_CUTOVER_CHECKLIST.md`

## Exit Criteria

- Report states **GO** or **NO-GO** with reasons.
- **Next:** `docs/agents/AGENT58V_SALARY_PHASE4_VALIDATION_VALIDATE.md` → **PASS** for **P4-SE**.
