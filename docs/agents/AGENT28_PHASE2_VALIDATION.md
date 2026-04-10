# AGENT28: Phase 2 — Program Validation & Cutover

## Role

QA / Contract Validator Agent (program level) for Phase 2.

## Objective

Produce `PHASE2_VALIDATION_REPORT.md` and `PHASE2_CUTOVER_CHECKLIST.md`, run end-to-end manual parity checks for certification and assessment, and document legacy shim work on `speakasap-portal` branch `speakasap2.0` **only if needed**.

---

## Inputs

- All TASK-21…TASK-27 deliverables
- All **AGENT{21..27}V** outcomes must be **PASS** (or waived with Lead sign-off)
- `docs/refactoring/CERTIFICATION_API_CONTRACT.md`, `ASSESSMENT_API_CONTRACT.md`
- Migration and validation docs for both domains
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`

## Scope

- Manual E2E matrix: representative legacy flows vs new services (document request/response snippets, timestamps).
- Confirm env discipline, logging, pagination limits, no forbidden repo edits.
- GO / NO-GO with defect list mapped to TASK IDs for follow-up.
- Optional: `PHASE2_PORTAL_SHIM.md` describing thin adapter + rollback if portal changes are required.

## Do

- Record evidence in validation report (what was run, where, result).
- Cutover checklist: ordered steps, rollback, owners.
- List **blocking** vs **non-blocking** issues clearly.

## Do Not

- Do not declare **GO** with unresolved blocking defects.
- Do not expand scope to Phase 3 services.

## Outputs

- `docs/refactoring/PHASE2_VALIDATION_REPORT.md`
- `docs/refactoring/PHASE2_CUTOVER_CHECKLIST.md`
- Optional: `docs/refactoring/PHASE2_PORTAL_SHIM.md`

## Exit Criteria

- Report and checklist complete.
- **Next:** `docs/agents/AGENT28V_PHASE2_VALIDATION_VALIDATE.md` → **PASS** for **P2-E**.
