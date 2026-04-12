# AGENT40V: Validator — Education Service Design (TASK-40)

## Role

QA / Contract Validator. **Read-only** review of design artifacts.

## Objective

Freeze contracts for **P3-EB** before implementation (TASK-41).

## Preconditions

- TASK-39 + `AGENT39V` PASS.
- `EDUCATION_API_CONTRACT.md` and `EDUCATION_DATA_MAPPING.md` present.

## Verification Scope

1. **API contract:** Every mutating/list endpoint specifies limits (≤ **30** per request where applicable), error envelope, auth header assumptions if endpoints are protected.
2. **Data mapping:** Primary keys, FKs, nullable fields; sources aligned with **`education`** app per ROADMAP §3.2 (legacy names verified or documented).
3. **Coupling:** No cross-service DB access; references to course/user via documented ID fields and HTTP contracts only.
4. **Naming:** Aligns with `ROADMAP.md` §3.2; **marathon**, payments, orders explicitly out of scope where applicable.
5. **Downstream IDs:** Education IDs needed by certification/assessment contracts are consistent or gaps are explicitly flagged for Lead.

## Manual Checks (record date + outcome)

- [ ] Cross-read mapping vs contract: every public field has a source or explicit computed rule
- [ ] Out-of-scope legacy areas explicitly listed

## Verification results (evidence)

_Record findings when run._

## Sync gate (before TASK-41)

- **P3-EB:** **PASS** or **FAIL**

## Verdict

**PENDING**

### If FAIL

Return to `AGENT40_EDUCATION_SERVICE_DESIGN.md` with concrete edits. Do not clear **P3-EB** until PASS.
