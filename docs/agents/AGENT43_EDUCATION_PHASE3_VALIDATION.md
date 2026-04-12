# AGENT43: Phase 3 Wave 3 — Education Service Program Validation

## Role

QA / Contract Validator Agent: program-level GO/NO-GO for **education-service** wave.

## Objective

Produce `PHASE3_EDUCATION_VALIDATION_REPORT.md` and `PHASE3_EDUCATION_CUTOVER_CHECKLIST.md` covering data integrity, config, logging, AI-adapter wiring (per contract), and agreed HTTP smoke (when service is routed).

## Inputs

- All prior TASK-39…TASK-42 artifacts and validator outcomes
- `EDUCATION_API_CONTRACT.md`, `EDUCATION_DATA_VALIDATION.md`
- `PHASE3_COURSE_VALIDATION_REPORT.md` or `PHASE3_USER_VALIDATION_REPORT.md` — structural reference for report sections

## Scope

- Summarize gate evidence P3-EA…P3-ED.
- DB evidence section (counts, orphans) — operator fills execution timestamps.
- HTTP smoke matrix: at minimum `/health`; authenticated routes when deployment allows (may use DEFERRED if not routed).
- Cutover checklist: ordered deploy, rollback, sign-off line.
- Cross-service smoke: documented checks against course and user APIs if required by contract.

## Do

- Align terminology with `master-prompt.md` global rules.
- Call out non-blocking follow-ups explicitly.

## Do Not

- Do not claim PASS for unchecked items; use DEFERRED with reason if blocked by routing or operator steps.

## Outputs

- `docs/refactoring/PHASE3_EDUCATION_VALIDATION_REPORT.md`
- `docs/refactoring/PHASE3_EDUCATION_CUTOVER_CHECKLIST.md`

## Exit Criteria

- Report states **GO** or **NO-GO** with reasons.
- **Next:** `docs/agents/AGENT43V_EDUCATION_PHASE3_VALIDATION_VALIDATE.md` → **PASS** for **P3-EE**.
