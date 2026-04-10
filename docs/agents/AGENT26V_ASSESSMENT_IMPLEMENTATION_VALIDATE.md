# AGENT26V: Validator — Assessment Implementation (TASK-26)

## Role

QA / Contract Validator Agent.

## Objective

Verify `assessment-service` matches frozen assessment contract and excludes `teacher_tests`.

---

## Preconditions

- `AGENT25V` = PASS.
- Contract frozen (no unapproved changes).

## Verification Scope

1. **No teacher_tests**
   - Code search: no `teacher_tests` references (unless explicit commented exclusion doc only — acceptable).

2. **Endpoint parity**
   - Contract coverage in code.

3. **Scoring**
   - Behavior matches documented rules for sample cases (document manual test inputs/outputs).

4. **Pagination**
   - `limit` > 30 rejected or clamped per rules.

5. **Config / logging**
   - Same standards as TASK-23 validator (no hardcoded secrets; logging pattern).

6. **Build**
   - `npm run build` succeeds.

## Manual Smoke

- [ ] Health endpoint
- [ ] Create or fetch test flow per contract (pick minimum viable)
- [ ] Submit answers / score if applicable
- [ ] Error: invalid payload

## Verdict

**PASS** or **FAIL**.

### If FAIL

- **Return to:** `AGENT26_ASSESSMENT_IMPLEMENTATION.md`.

### If PASS

- Proceed to TASK-27 migration.
