# AGENT31V: Validator — User Service Implementation (TASK-31)

## Role

QA / Backend Validator. Verify implementation vs **frozen** contracts.

## Objective

Clear **P3-UC** before migration work (TASK-32).

## Preconditions

- TASK-30 + `AGENT30V` PASS.
- Contracts unchanged since PASS (or changes re-validated by Lead).

## Verification Scope

1. Each `USER_API_CONTRACT.md` endpoint exists with matching method/path and documented status codes.
2. Request/response shapes match contract (field-level spot check on critical flows).
3. List endpoints enforce ≤ **30** items.
4. No forbidden hardcoded secrets/URLs; logging calls present on main request paths.
5. `npm run build` succeeds.

## Manual Checks

- [ ] Build
- [ ] `/health`
- [ ] One read and one write flow per critical aggregate (document curl examples)

## Verdict

**PASS** or **FAIL**.

### If FAIL

Return to `AGENT31_USER_SERVICE_IMPLEMENTATION.md`. Do not clear **P3-UC** until PASS.
