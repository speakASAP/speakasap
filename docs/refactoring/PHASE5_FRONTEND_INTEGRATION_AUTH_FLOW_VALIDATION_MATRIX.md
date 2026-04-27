# Phase 5 Frontend Integration and Auth-Flow Validation Matrix (TASK-72)

**Date:** 2026-04-27  
**Wave:** Phase 5 - Wave 2 (`speakasap-frontend`)  
**Gate target:** `P5-FD`

## Objective

Validate frontend integration and auth-flow behavior for learner/teacher/admin portal surfaces against frozen frontend-gateway contract boundaries.

## Preconditions

- `P5-FC` PASS (TASK-71 + AGENT71V).
- Gateway-first boundary remains frozen (`NEXT_PUBLIC_API_URL` + `/api/v1/*`).

## Execution evidence

- Build: `npm run build` in `frontend/` -> **PASS** (Next.js static routes `/`, `/learner`, `/teacher`, `/admin` generated).
- Gateway env/auth wiring check: `rg "NEXT_PUBLIC_API_URL|Authorization|Bearer" frontend` -> **PASS** (`frontend/lib/gateway.ts`, `frontend/lib/api-client.ts`, role pages).
- Direct-service/internal route boundary check: `rg "/api/v1/internal|content-service|user-service|payment-service|notification-service|salary-service|financial-service" frontend` -> **PASS** (no matches for disallowed direct service/internal usage in app code).

## Validation matrix

| ID | Flow area | Check | Expected | Status | Evidence | Owner | Unblock condition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P5-FD-01 | Build/runtime baseline | Frontend build succeeds with current TASK-71 code | Build completes and emits learner/teacher/admin routes | PASS | `npm run build` output shows successful compile and route generation | Frontend | N/A |
| P5-FD-02 | Boundary compliance | API client uses gateway base URL from env | Calls go through `NEXT_PUBLIC_API_URL` only | PASS | `frontend/lib/gateway.ts` + `frontend/lib/api-client.ts` use env-driven base URL | Frontend | N/A |
| P5-FD-03 | Boundary compliance | Frontend forwards bearer token to gateway | `Authorization: Bearer <token>` header is set when token exists | PASS | `frontend/lib/api-client.ts` header injection | Frontend | N/A |
| P5-FD-04 | Learner integration | Learner page triggers mapped gateway actions | Learner actions map to `/api/v1/languages`, `/api/v1/student-courses`, `/api/v1/language-user-tests`, `/api/v1/course-certificates` | PASS | `frontend/app/learner/page.tsx` action table + `callGateway` usage | Frontend | N/A |
| P5-FD-05 | Teacher integration | Teacher page triggers mapped gateway actions | Teacher actions map to `/api/v1/teachers`, `/api/v1/groups`, `/api/v1/offers`, `/api/v1/in-app` | PASS | `frontend/app/teacher/page.tsx` action table + `callGateway` usage | Frontend | N/A |
| P5-FD-06 | Admin integration | Admin page triggers mapped gateway actions | Admin actions map to `/api/v1/admin/language-tests`, `/api/v1/templates`, `/api/v1/orders`, `/api/v1/dashboard/overview` | PASS | `frontend/app/admin/page.tsx` action table + `callGateway` usage | Frontend | N/A |
| P5-FD-07 | Auth flow (missing token) | Execute portal action with empty token field | Gateway responds with auth failure (`401`/`403`) on protected endpoints | DEFERRED | Static code path verified; live gateway runtime not executed in this task | Frontend + Gateway operator | Run manual browser/API smoke against running gateway and capture status evidence |
| P5-FD-08 | Auth flow (invalid token) | Execute portal action with malformed/expired JWT | Gateway responds with auth failure (`401`/`403`) and no data leakage | DEFERRED | Static code path verified; live gateway runtime not executed in this task | Frontend + Gateway operator | Run manual smoke with invalid JWT and log captured responses |
| P5-FD-09 | Auth flow (valid token) | Execute portal action with valid JWT per role | Authorized routes succeed and role-restricted routes enforce policy | DEFERRED | UI client sends bearer token; role authorization requires live auth + gateway environment | Frontend + Auth/Gateway operator | Run role-based manual smoke with real JWTs for learner/teacher/admin |
| P5-FD-10 | Internal route boundary | Confirm browser client cannot call `/api/v1/internal/**` | No internal route calls from frontend code | PASS | Pattern search across `frontend/` shows no `/api/v1/internal/**` usage | Frontend | N/A |

## Defect list

No implementation defects found in TASK-71 scope during static validation.

## Deferred items

| ID | Deferred item | Risk | Owner | Unblock condition |
| --- | --- | --- | --- | --- |
| P5-FD-D1 | Live auth status-code verification (`401`/`403`) for missing/invalid JWT | Medium | Frontend + Gateway operator | Execute manual runtime smoke in deployed environment and attach response evidence |
| P5-FD-D2 | Role-capability enforcement verification with real learner/teacher/admin tokens | Medium | Auth owner + Frontend owner | Run role-based E2E manual checks and confirm expected allow/deny outcomes |

## Verdict

`P5-FD` readiness: **PASS (engineering, static validation)** with runtime auth-flow smoke tracked as **DEFERRED** and explicitly owned.
