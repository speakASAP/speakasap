# AGENT25V: Validator — Assessment Design (TASK-25)

## Role

QA / Contract Validator Agent.

## Objective

Ensure assessment contract and mapping are implementable and explicitly exclude `teacher_tests`.

---

## Preconditions

- `ASSESSMENT_API_CONTRACT.md` and `ASSESSMENT_DATA_MAPPING.md` exist.

## Verification Scope

1. **Exclusion**
   - Both documents contain a clear **teacher_tests out of scope** statement.
   - No API or model references to `teacher_tests`.

2. **Coverage**
   - `language_tests` and `user_tests` covered with fields, relationships, and lifecycles.

3. **Scoring**
   - Scoring section exists with inputs, outputs, and tie-break / partial credit rules as legacy requires (or explicit “not applicable” with evidence).

4. **Pagination**
   - List endpoints max **30** items.

5. **Legacy mapping**
   - Legacy → new route/operation table present.

6. **Separation**
   - No certification domain (certificates, quests) mixed in.

## Manual Checks

- [ ] Spot-check two legacy models in portal against mapping
- [ ] Confirm scoring section matches at least one real legacy code path (view or service)

## Verdict

**PASS** or **FAIL**.

### If FAIL

- **Return to:** `AGENT25_ASSESSMENT_DESIGN.md`.

### If PASS

- With TASK-22V PASS, **P2-B** complete.
