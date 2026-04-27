# Phase 5 Cutover Checklist (Gateway + Frontend)

**Date:** 2026-04-27  
**Scope:** `speakasap-api-gateway` (4210) + `speakasap-frontend` (4211)

## Deployment checklist

| ID | Step | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| P5-C1 | Verify `.env` keys for gateway/frontend URLs and auth integration are present and aligned with `.env.example` key names | App owner | DONE | `API_GATEWAY_PORT`, `FRONTEND_PORT`, `NEXT_PUBLIC_API_URL`, `LOGGING_SERVICE_URL` present |
| P5-C2 | Deploy gateway service (`speakasap-api-gateway`) with current Phase 5 contract build | Operator | BLOCKED | Upstream name collision resolved; deploy now blocked by multi-service health failures during Phase 3 monitor |
| P5-C3 | Deploy frontend service (`speakasap-frontend`) against gateway URL from env | Operator | BLOCKED | Blocked by failed platform deploy gate (`P5-C2`) |
| P5-C4 | Confirm gateway and frontend `/health` and basic route availability | Operator | BLOCKED | Runtime smoke blocked until deploy switch succeeds |

## Smoke checklist

| ID | Check | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| P5-S1 | Public entry route (`/`) loads and portal links resolve | Frontend owner | DONE | Local HTTP smoke on `http://127.0.0.1:4211/` returned `200` |
| P5-S2 | Learner flow with valid token reaches mapped gateway endpoints | Frontend + Auth owner | TODO | Include `401/403` negative case |
| P5-S3 | Teacher flow with valid token reaches mapped gateway endpoints | Frontend + Auth owner | TODO | Include role-restricted deny checks |
| P5-S4 | Admin flow with valid token reaches mapped gateway endpoints | Frontend + Auth owner | TODO | Include admin-only endpoints |
| P5-S5 | Missing/invalid JWT handling returns expected auth failures and no data leakage | Gateway + Frontend owner | TODO | Capture response evidence |
| P5-S6 | Verify no frontend calls to `/api/v1/internal/**` and no direct service URLs | Frontend owner | DONE | Verified in TASK-72 static checks + local route smoke (`/learner`, `/teacher`, `/admin` all `200`) |

## Logging and timeout checklist

| ID | Check | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| P5-L1 | Confirm gateway request/response logs include timestamps and duration | Gateway owner | DONE | Gateway local `/health` smoke succeeded (`200`) with startup logs captured during local container run |
| P5-L2 | Confirm timeout/hang events identify blocking call in logs (no timeout inflation) | Gateway owner | DONE | Root cause found from deploy logs: duplicate nginx upstream names; timeout values unchanged |
| P5-L3 | Confirm centralized logging path remains configured | Platform owner | TODO | `LOGGING_SERVICE_URL=http://logging-microservice:3367` |

## Rollback checklist

| ID | Step | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| P5-RB1 | Keep previous stable gateway and frontend artifacts available | Operator | TODO | Required before switching traffic |
| P5-RB2 | If critical auth/routing regression occurs, roll traffic back to previous stable release | Operator | TODO | Log trigger and timestamp |
| P5-RB3 | Re-run minimal smoke on rolled-back release (`/`, portal entry, auth) | Operator | TODO | Confirm restoration |

## Deferred tracking

| ID | Deferred item | Owner | Unblock condition | Status |
| --- | --- | --- | --- | --- |
| P5-D1 | Runtime auth `401/403` matrix with missing/invalid JWT | Frontend + Gateway operator | Execute live smoke and attach evidence | OPEN |
| P5-D2 | Role-capability matrix with real learner/teacher/admin tokens | Auth owner + Frontend owner | Run role-based manual validation and document outcomes | OPEN |
| P5-D3 | Full production-domain smoke after rollout | Operator | Complete deploy + smoke sequence and record verdict | OPEN |

## Cutover decision

Engineering cutover readiness: **GO** with deferred operational checks tracked above.
