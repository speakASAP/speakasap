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

- [ ] `npm run build` in `education-service/`
- [ ] `/health` route present
- [ ] Route inventory vs contract (representative sample)

## Verification results (evidence)

_Record findings when run._

## Sync gate (before TASK-42)

- **P3-EC:** **PASS** or **FAIL**

## Verdict

**PENDING**

### If FAIL

Return to `AGENT41_EDUCATION_SERVICE_IMPLEMENTATION.md`. Do not clear **P3-EC** until PASS.
