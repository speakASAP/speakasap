# AGENT66: Phase 5 - API Gateway Implementation (TASK-66)

## Role

Backend Service Agent (Implementation): implement gateway routing and middleware behavior strictly from frozen Phase 5 gateway contracts.

## Objective

Implement auth, rate-limit, versioning, proxy routing, and gateway observability so behavior matches TASK-65 contract artifacts exactly.

## Prerequisites

- **P5-GB** PASS.
- `docs/refactoring/GATEWAY_API_CONTRACT.md` frozen.
- `docs/refactoring/GATEWAY_AUTH_BOUNDARY.md` frozen.

## Inputs

- `docs/refactoring/PHASE5_TASK_DECOMPOSITION.md` - TASK-66
- `docs/refactoring/GATEWAY_API_CONTRACT.md`
- `docs/refactoring/GATEWAY_AUTH_BOUNDARY.md`
- `docs/refactoring/GATEWAY_ROUTE_OWNERSHIP_MATRIX.md`
- `api-gateway/` scaffold from TASK-64

## Scope

1. Implement `/api/v1/**` route-to-upstream mapping aligned to ownership matrix.
2. Enforce auth boundary (`401`/`403` behavior, internal route deny by default).
3. Implement gateway rate limiting and request versioning behavior.
4. Implement timeout/error mapping and structured request logs with timestamps and `duration_ms`.

## Do

- Keep gateway transport-only; no domain ownership or business logic.
- Keep upstream base URLs env-driven.
- Preserve request size/list constraints (`limit <= 30`) at gateway edge.
- Log blocked/failed requests with enough context to find root cause (no secret leakage).
- Keep existing service contracts unchanged.

## Environment keys (key names only)

- `API_GATEWAY_PORT`
- `AUTH_SERVICE_URL`
- `LOGGING_SERVICE_URL`
- `CONTENT_SERVICE_URL`
- `CERTIFICATION_SERVICE_URL`
- `ASSESSMENT_SERVICE_URL`
- `USER_SERVICE_URL`
- `COURSE_SERVICE_URL`
- `EDUCATION_SERVICE_URL`
- `PAYMENT_SERVICE_URL`
- `NOTIFICATION_SERVICE_URL`
- `SALARY_SERVICE_URL`
- `FINANCIAL_SERVICE_URL`
- `GATEWAY_INTERNAL_API_TOKEN`
- `GATEWAY_RATE_LIMIT_WINDOW_MS`
- `GATEWAY_RATE_LIMIT_MAX`
- `GATEWAY_TIMEOUT`

## Do Not

- Do not change upstream service contracts/docs in this task.
- Do not expose `/api/v1/internal/**` to browser/public traffic.
- Do not hardcode URLs, ports, or credentials.
- Do not modify shared microservice repos (`auth-microservice`, `database-server`, `logging-microservice`, `nginx-microservice`, `payments-microservice`, `notifications-microservice`).
- Do not self-run `AGENT66V` - hand off to Validator.

## Outputs

- Updated `api-gateway/` implementation matching frozen contract behavior.
- Any contract clarifications captured as comments in code/docs only if non-breaking.

## Exit Criteria

- Gateway behavior matches frozen route/auth/error/limit rules.
- `npm run build` passes in `api-gateway/`.
- **Next:** `docs/agents/AGENT66V_GATEWAY_IMPLEMENTATION_VALIDATE.md` -> **PASS** for sync **P5-GC**.
