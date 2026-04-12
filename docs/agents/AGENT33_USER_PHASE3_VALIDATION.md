# AGENT33: Phase 3 Wave 1 — User Service Program Validation

## Role

QA / Contract Validator Agent: program-level GO/NO-GO for **user-service** wave.

## Objective

Produce `PHASE3_USER_VALIDATION_REPORT.md` and `PHASE3_USER_CUTOVER_CHECKLIST.md` covering data integrity, config, logging, and agreed HTTP smoke (when service is routed).

## Inputs

- All prior TASK-29…TASK-32 artifacts and validator outcomes
- `USER_API_CONTRACT.md`, `USER_DATA_VALIDATION.md`
- `PHASE2_VALIDATION_REPORT.md` — structural reference for report sections

## Scope

- Summarize gate evidence P3-UA…P3-UD.
- DB evidence section (counts, orphans) — operator fills execution timestamps.
- HTTP smoke matrix: at minimum `/health`; authenticated routes when deployment allows (may mirror Phase 2 **DEF** pattern if not routed).
- Cutover checklist: ordered deploy, rollback, sign-off line.

## Do

- Align terminology with `master-prompt.md` global rules.
- Call out non-blocking follow-ups explicitly.

## Do Not

- Do not claim PASS for unchecked items; use DEFERRED with reason if blocked by routing.

## Outputs

- `docs/refactoring/PHASE3_USER_VALIDATION_REPORT.md`
- `docs/refactoring/PHASE3_USER_CUTOVER_CHECKLIST.md`

## Exit Criteria

- Report states **GO** or **NO-GO** with reasons.
- **Next:** `AGENT33V_USER_PHASE3_VALIDATION_VALIDATE.md` → **PASS** for **P3-UE**.
