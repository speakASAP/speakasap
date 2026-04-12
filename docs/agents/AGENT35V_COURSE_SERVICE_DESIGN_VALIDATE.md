# AGENT35V: Validator — Course Service Design (TASK-35)

## Role

QA / Contract Validator. **Read-only** review of design artifacts.

## Objective

Freeze contracts for **P3-CB** before implementation (TASK-36).

## Preconditions

- TASK-34 + `AGENT34V` PASS.
- `COURSE_API_CONTRACT.md` and `COURSE_DATA_MAPPING.md` present.

## Verification Scope

1. **API contract:** Every mutating/list endpoint specifies limits (≤ **30** per request where applicable), error envelope, auth header assumptions if endpoints are protected.
2. **Data mapping:** Primary keys, FKs, nullable fields; sources limited to **`products`**, **`offers`**, **`pricing`** per ROADMAP §3.1 (or corrected legacy names documented).
3. **Coupling:** No hidden cross-service DB access; logging and env placeholders referenced consistently with other speakasap services.
4. **Naming:** Aligns with `ROADMAP.md` §3.1 wording; out-of-scope legacy areas explicitly listed.

## Manual Checks

- [x] Cross-read mapping vs contract: every public field has a source or explicit computed rule (**2026-04-12**)
- [x] Out-of-scope legacy areas explicitly listed (education wave, financial, etc.)

## Verification results (evidence)

**2026-04-12:** `COURSE_API_CONTRACT.md` and `COURSE_DATA_MAPPING.md` present; §3.1 scope; pricing = `products_partpayment*`; offer state MVP; list cap 30; JWT consumer pattern documented.

## Sync gate (before TASK-36)

- **P3-CB:** **PASS**

## Verdict

**PASS**

### If FAIL

Return to `AGENT35_COURSE_SERVICE_DESIGN.md` with concrete edits. Do not clear **P3-CB** until PASS.
