# AGENT38: Phase 3 Wave 2 — Course Service Program Validation

## Role

QA / Contract Validator Agent: program-level GO/NO-GO for **course-service** wave.

## Objective

Produce `PHASE3_COURSE_VALIDATION_REPORT.md` and `PHASE3_COURSE_CUTOVER_CHECKLIST.md` covering data integrity, config, logging, and agreed HTTP smoke (when service is routed).

## Inputs

- All prior TASK-34…TASK-37 artifacts and validator outcomes
- `COURSE_API_CONTRACT.md`, `COURSE_DATA_VALIDATION.md`
- `PHASE3_USER_VALIDATION_REPORT.md` or `PHASE2_VALIDATION_REPORT.md` — structural reference for report sections

## Scope

- Summarize gate evidence P3-CA…P3-CD.
- DB evidence section (counts, orphans) — operator fills execution timestamps.
- HTTP smoke matrix: at minimum `/health`; authenticated routes when deployment allows (may use DEFERRED if not routed).
- Cutover checklist: ordered deploy, rollback, sign-off line.

## Do

- Align terminology with `master-prompt.md` global rules.
- Call out non-blocking follow-ups explicitly.

## Do Not

- Do not claim PASS for unchecked items; use DEFERRED with reason if blocked by routing.

## Outputs

- `docs/refactoring/PHASE3_COURSE_VALIDATION_REPORT.md`
- `docs/refactoring/PHASE3_COURSE_CUTOVER_CHECKLIST.md`

## Exit Criteria

- Report states **GO** or **NO-GO** with reasons.
- **Next:** `docs/agents/AGENT38V_COURSE_PHASE3_VALIDATION_VALIDATE.md` → **PASS** for **P3-CE**.
