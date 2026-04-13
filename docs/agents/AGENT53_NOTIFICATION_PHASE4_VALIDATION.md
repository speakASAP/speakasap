# AGENT53: Phase 4 — Notification Wave Program Validation (TASK-53)

## Role

QA / Contract Validator Agent: program-level GO/NO-GO for **Notification** wave.

## Objective

Produce `PHASE4_NOTIFICATION_VALIDATION_REPORT.md` and `PHASE4_NOTIFICATION_CUTOVER_CHECKLIST.md`.

## Inputs

- Prior TASK artifacts for this wave; frozen contracts; migration validation docs.

## Scope

1. Summarize gate evidence for **P4-NA..P4-ND**.
2. Include migration reconciliation summary.
3. Add HTTP smoke matrix for `/health`, template CRUD, preference update, dispatch request.
4. Mark blocked checks as **DEFERRED** with owner.
5. Provide rollback and cutover ordering.

## Do Not

- Do not claim PASS for unchecked items; use DEFERRED with reason if blocked.

## Outputs

- `docs/refactoring/PHASE4_NOTIFICATION_VALIDATION_REPORT.md`
- `docs/refactoring/PHASE4_NOTIFICATION_CUTOVER_CHECKLIST.md`

## Exit Criteria

- Report states **GO** or **NO-GO** with reasons.
- **Next:** `docs/agents/AGENT53V_NOTIFICATION_PHASE4_VALIDATION_VALIDATE.md` → **PASS** for **P4-NE**.
