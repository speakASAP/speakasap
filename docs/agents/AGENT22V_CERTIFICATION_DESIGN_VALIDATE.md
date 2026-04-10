# AGENT22V: Validator — Certification Design (TASK-22)

## Role

QA / Contract Validator Agent. Verify certification **design artifacts** only.

## Objective

Ensure certification contract and mapping are complete enough to implement without ambiguity.

---

## Preconditions

- `CERTIFICATION_API_CONTRACT.md` and `CERTIFICATION_DATA_MAPPING.md` exist (draft Prisma optional).

## Verification Scope

1. **Coverage**
   - All roadmap models addressed: `certificates`, `education_certificates`, `quests`, `user_quest`.
   - PDF / quest behaviors called out if present in legacy.

2. **Pagination**
   - Every list endpoint specifies `limit` max **30** (or equivalent contract language).

3. **Mapping**
   - Legacy tables/fields → new entities with types and nullability.
   - Primary keys / foreign keys / enums documented.

4. **Legacy mapping**
   - Table or appendix: legacy URL or view name → new API operation.

5. **Consistency**
   - No contradictions between contract and mapping (e.g. field names, cardinality).

6. **Scope creep**
   - No assessment (`language_tests`, `user_tests`) mixed into certification docs.

## Manual Checks

- [ ] Read both markdown files end-to-end
- [ ] Cross-check at least two legacy models in portal repo against mapping
- [ ] Confirm error shape section exists (or explicit deferral with orchestrator note — if deferral, **FAIL** unless Lead approved)

## Verdict

**PASS** or **FAIL**.

### If FAIL

- List ambiguous endpoints, missing mappings, or pagination violations.
- **Return to:** `AGENT22_CERTIFICATION_DESIGN.md`.

### If PASS

- Certification side of **P2-B** satisfied; still need TASK-25 validator PASS for full P2-B.
