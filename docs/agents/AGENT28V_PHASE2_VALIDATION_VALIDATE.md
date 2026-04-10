# AGENT28V: Meta-Validator — Phase 2 Program Validation (TASK-28)

## Role

Independent Validator Agent. **Meta-validation** of TASK-28 outputs and closure of Phase 2 program gates.

## Objective

Ensure `PHASE2_VALIDATION_REPORT.md` and `PHASE2_CUTOVER_CHECKLIST.md` are complete, internally consistent, and aligned with prior PASS outcomes before **P2-E** closes.

---

## Preconditions

- TASK-24V and TASK-27V = **PASS** (migrations).
- TASK-28 deliverables exist.

## Verification Scope

1. **Prior gates**
   - Table of TASK-21…TASK-27 with Implementation done + Validator **PASS** date (or explicit **WAIVE** with Lead Orchestrator name).

2. **Validation report**
   - Contains E2E matrix or equivalent structured evidence (not only “looks good”).
   - GO/NO-GO stated unambiguously.
   - Every blocking issue has owner + TASK reference or ticket ID.

3. **Cutover checklist**
   - Ordered steps include: pre-checks, deploy order (if applicable), smoke, rollback, sign-off line.

4. **Consistency**
   - GO not claimed if report lists open blocking items.
   - Pagination / logging / env rules referenced if GO.

5. **Portal shim**
   - If legacy routing changes: `PHASE2_PORTAL_SHIM.md` exists or report explains “no portal change” with rationale.

6. **Scope**
   - No `teacher_tests` in production path for assessment.

## Manual Checks

- [ ] Read validation report and checklist end-to-end
- [ ] Cross-check at least two E2E rows against contract doc
- [ ] If GO: confirm no “TODO” in critical path steps

## Verdict

**PASS** or **FAIL**.

### If FAIL

- List documentation gaps, inconsistent GO, missing evidence, or unresolved blocking items.
- **Return to:** `AGENT28_PHASE2_VALIDATION.md`.

### If PASS

- **Sync P2-E** complete. Phase 2 may cut over or Phase 3 planning may start per Lead Orchestrator.
