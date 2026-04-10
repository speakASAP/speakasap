# AGENT27V: Validator — Assessment Migration (TASK-27)

## Role

QA / Data Validator Agent.

## Objective

Verify assessment migration is complete, scoped, and validated — with **no teacher_tests** data.

---

## Preconditions

- TASK-26 validator **PASS**.

## Verification Scope

1. **Documentation quality** — same bar as TASK-24V (log + validation with concrete checks).

2. **Scope**
   - Validation doc explicitly states `teacher_tests` excluded and **not** present in target.

3. **Parity**
   - Counts or samples for `language_tests` / `user_tests` aligned with legacy or variance explained.

4. **Isolation**
   - No certification tables in assessment DB.

## Manual Checks

- [ ] Independent validation query or API spot check
- [ ] Confirm no `teacher_tests` table import in migration script (code review)

## Verdict

**PASS** or **FAIL**.

### If FAIL

- **Return to:** `AGENT27_ASSESSMENT_MIGRATION.md`.

### If PASS

- With TASK-24V PASS, **P2-D** complete; TASK-28 may start.
