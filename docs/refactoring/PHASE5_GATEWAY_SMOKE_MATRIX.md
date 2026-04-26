# Phase 5 Gateway Smoke Matrix (TASK-67)

**Date:** 2026-04-25  
**Scope:** `speakasap-api-gateway` integration behavior against frozen TASK-65 contracts  
**Gate target:** `P5-GD`

## Evidence baseline

- Build check: `cd api-gateway && npm run build` -> PASS.
- Contract docs used: `GATEWAY_API_CONTRACT.md`, `GATEWAY_AUTH_BOUNDARY.md`, `GATEWAY_ROUTE_OWNERSHIP_MATRIX.md`.
- Code evidence sources: `api-gateway/src/proxy/*`, `api-gateway/src/shared/http-exception.filter.ts`.

## Smoke matrix

| ID | Area | Scenario | Expected | Result | Evidence | Owner / Unblock |
| --- | --- | --- | --- | --- | --- | --- |
| G67-01 | Health | `GET /health` without auth | 200 from gateway, no `/api/v1` prefix required | PASS | Health controller from scaffold retained and build passes | n/a |
| G67-02 | Public auth | Missing bearer on `/api/v1/**` | `401 UNAUTHORIZED`; upstream not called | PASS | `gateway-auth.guard.ts` checks bearer and throws `UNAUTHORIZED` before proxy | n/a |
| G67-03 | Internal boundary | Browser/public attempt to `/api/v1/internal/**` | `403 FORBIDDEN_INTERNAL_ROUTE` by default | PASS | `gateway-auth.guard.ts` internal branch enforces `x-internal-token` equality | n/a |
| G67-04 | Internal channel | Valid internal token on `/api/v1/internal/**` | request allowed to proxy | PASS | `gateway-auth.guard.ts` returns true when token matches env key | n/a |
| G67-05 | Rate limiting | Exceed configured requests/IP window | `429 RATE_LIMITED` envelope | PASS | `rate-limit.middleware.ts` enforces `GATEWAY_RATE_LIMIT_*` and returns 429 payload | n/a |
| G67-06 | Request-size/list policy | Query with `limit > 30`, `<1`, or non-numeric | `400 INVALID_LIMIT` | PASS | `proxy.service.ts` `enforceListLimit` added at forward entry (`1..30`) | n/a |
| G67-07 | Route ownership forwarding | Prefix routing for all service families | longest-prefix mapping to single owner service | PASS | `upstream-resolve.ts` matrix-aligned route table covers content/cert/assessment/user/course/education/payment/notification/salary/financial | n/a |
| G67-08 | Error mapping - upstream unavailable | Upstream hard failure | `502 UPSTREAM_UNAVAILABLE` | PASS | `proxy.service.ts` catch block maps non-timeout failures to 502 | n/a |
| G67-09 | Error mapping - timeout | Upstream timeout | `504 GATEWAY_TIMEOUT` | PASS | `proxy.service.ts` abort timeout maps `AbortError` to 504 | n/a |
| G67-10 | Webhook boundary | `POST /api/v1/webhooks/payments` without JWT | bypasses JWT guard and proxies to payment service | PASS | `gateway-auth.guard.ts` explicit webhook bypass for POST | n/a |
| G67-11 | Structured observability | Request/upstream logs include timestamp + `duration_ms` + request id context | required fields present and no raw token logging | PASS | request context middleware + proxy/auth client logs include timestamp and `duration_ms`; no token value logs in inspected code | n/a |
| G67-12 | Live cross-service HTTP smoke | Execute end-to-end gateway->all upstream services with real env and live containers | status matrix across representative routes | DEFERRED | Not executed in this cycle (no full live stack run attached to TASK-67 execution) | **Owner:** operator; **Unblock:** run manual curl matrix after all upstream containers are up and reachable via configured service URLs |

## Error semantics coverage

| Status | Covered by | Result |
| --- | --- | --- |
| 401 | missing/invalid bearer path | PASS |
| 403 | internal route boundary | PASS |
| 429 | rate limit middleware | PASS |
| 502 | upstream unavailable mapping | PASS |
| 504 | upstream timeout mapping | PASS |

## Verdict

`P5-GD` readiness: **PASS (engineering)** with one explicit operational **DEFERRED** row (`G67-12`) for live multi-service HTTP smoke.
