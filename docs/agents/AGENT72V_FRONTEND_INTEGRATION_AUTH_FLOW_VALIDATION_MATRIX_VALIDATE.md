# AGENT72V: Validator - Frontend Integration and Auth-Flow Validation Matrix (TASK-72)

## Role

QA / Contract Validator. Read-only verification of TASK-72 frontend integration and auth-flow matrix outputs.

## Objective

Clear sync **P5-FD** by confirming frontend integration/auth-flow validation evidence is complete, contract-aligned, and actionable.

## Preconditions

- TASK-72 output submitted.
- `PHASE5_FRONTEND_INTEGRATION_AUTH_FLOW_VALIDATION_MATRIX.md` exists.

## Verification Scope

1. Matrix covers learner/teacher/admin flows mapped in TASK-70.
2. Matrix covers auth-flow states: missing token, invalid token, and valid-token path expectations.
3. Matrix confirms boundary compliance: gateway-only client usage and no `/api/v1/internal/**` calls.
4. Matrix includes route-guard/authorization expectation notes (frontend guard UX vs backend source of truth).
5. Deferred rows include explicit owner + unblock condition.

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Matrix exists | file check | path |
| Portal coverage | inspect integration rows | learner/teacher/admin entries |
| Auth-flow coverage | inspect auth rows | no-token/invalid-token/valid-token outcomes |
| Boundary compliance | inspect policy rows | gateway-only + no internal routes |
| Deferred quality | inspect deferred rows | owner + unblock condition |

## Commands (examples)

- `npm run build` (in `frontend/`)
- `rg "NEXT_PUBLIC_API_URL|Bearer|Authorization" frontend`
- `rg "/api/v1/internal|content-service|user-service|payment-service|notification-service|salary-service|financial-service" frontend`
- `rg "DEFERRED|Owner|Unblock|learner|teacher|admin|401|403" docs/refactoring/PHASE5_FRONTEND_INTEGRATION_AUTH_FLOW_VALIDATION_MATRIX.md`

## Sync gate (before TASK-73)

- **P5-FD:** PASS / FAIL

## Verdict

PASS or FAIL with evidence.

### If FAIL

- List defects with exact paths.
- Return implementation to `docs/agents/AGENT72_FRONTEND_INTEGRATION_AUTH_FLOW_VALIDATION_MATRIX.md`.
- Do not clear **P5-FD** until PASS.
