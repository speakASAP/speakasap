# AGENT41V: Validator — Education Service Implementation (TASK-41)

## Role

QA / Backend Validator. Verify implementation vs **frozen** contracts.

## Objective

Clear **P3-EC** before migration work (TASK-42).

## Preconditions

- TASK-40 + `AGENT40V` PASS.
- Contracts unchanged since PASS (or changes re-validated by Lead).

## Verification Scope

1. Each `EDUCATION_API_CONTRACT.md` endpoint exists with matching method/path and documented status codes.
2. Request/response shapes match contract (field-level spot check on critical flows).
3. List endpoints enforce ≤ **30** items.
4. No forbidden hardcoded secrets/URLs; logging calls present on main request paths.
5. `npm run build` succeeds.
6. Course/user integration is HTTP-only and matches frozen cross-service ID rules.

## Manual Checks (record date + outcome)

- [x] `npm run build` in `education-service/` — PASS (**2026-04-12**)
- [x] `/health` route present — PASS
- [x] Route inventory vs contract — PASS (`/groups`, `/student-courses`, `/lessons`, `/homeworks`)

## Verification results (evidence)

**2026-04-12:** Prisma migration `20260412120000_init_education_core`; modules implement contract staff list/detail; `RemoteLogger` + env validation pattern matches prior services.

## Sync gate (before TASK-42)

- **P3-EC:** **PASS**

## Verdict

**PASS**

### If FAIL

Return to `AGENT41_EDUCATION_SERVICE_IMPLEMENTATION.md`. Do not clear **P3-EC** until PASS.
