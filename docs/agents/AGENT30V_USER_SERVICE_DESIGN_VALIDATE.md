# AGENT30V: Validator — User Service Design (TASK-30)

## Role

QA / Contract Validator. **Read-only** review of design artifacts.

## Objective

Freeze contracts for **P3-UB** before implementation (TASK-31).

## Preconditions

- TASK-29 + `AGENT29V` PASS.
- `USER_API_CONTRACT.md` and `USER_DATA_MAPPING.md` present.

## Verification Scope

1. **API contract:** Every mutating/list endpoint specifies limits (≤ **30** per request where applicable), error envelope, auth header assumptions.
2. **Data mapping:** Primary keys, FKs to auth identities, nullable fields, tables covered for `students` / `employees` scope per TASK-30 prompt.
3. **Coupling:** No hidden cross-service DB access; logging and env placeholders referenced consistently with other speakasap services.
4. **Naming:** Aligns with `ROADMAP.md` §3.3 wording.

## Manual Checks

- [ ] Cross-read mapping vs contract: every public field has a source or explicit computed rule
- [ ] Out-of-scope legacy areas explicitly listed

## Verdict

**PASS** or **FAIL**.

### If FAIL

Return to `AGENT30_USER_SERVICE_DESIGN.md` with concrete edits. Do not clear **P3-UB** until PASS.
