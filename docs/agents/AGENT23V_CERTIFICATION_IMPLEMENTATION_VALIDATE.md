# AGENT23V: Validator — Certification Implementation (TASK-23)

## Role

QA / Contract Validator Agent. Verify implementation against **frozen** certification contract.

## Objective

Confirm `certification-service` matches `CERTIFICATION_API_CONTRACT.md` and engineering rules.

---

## Preconditions

- `AGENT22V` = PASS.
- Contract documents unchanged since freeze (or changes re-approved — if unapproved drift → **FAIL**).

## Verification Scope

1. **Endpoint parity**
   - Each contract endpoint exists with correct method and path (accounting for global prefix).

2. **Pagination**
   - List endpoints reject or clamp `limit` > 30 per project rules.

3. **Config**
   - No hardcoded secrets or environment-specific URLs in source.
   - Required keys documented in `.env.example`.

4. **Logging**
   - Critical paths log to logging microservice pattern (match `content-service`); timestamps present.

5. **Forbidden scope**
   - No assessment domain code in certification service.

6. **Build**
   - `npm run build` succeeds.

## Manual Smoke (document results)

- [ ] `GET /health` (or prefixed health) returns success
- [ ] At least one **read** and one **write** flow from contract (if writes exist), or all reads if read-only
- [ ] Error case: invalid input returns contract error shape

## Verdict

**PASS** or **FAIL**.

### If FAIL

- List endpoint mismatches, missing validation, logging gaps, hardcoded values.
- **Return to:** `AGENT23_CERTIFICATION_IMPLEMENTATION.md`.

### If PASS

- Certification track may proceed to TASK-24 (migration).
