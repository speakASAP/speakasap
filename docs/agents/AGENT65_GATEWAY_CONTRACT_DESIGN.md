# AGENT65: Phase 5 — API Gateway Contract Design (TASK-65)

## Role

Backend Service Agent (Design): freeze **gateway API surface** and **route ownership boundaries** per `ROADMAP.md` Phase 5 and `PHASE5_TASK_DECOMPOSITION.md`.

## Objective

Produce gateway contract artifacts so TASK-66 implementation has no ambiguous routing, ownership, or auth behavior.

## Prerequisites

- **P5-GA** PASS.
- `docs/refactoring/GATEWAY_ROUTE_OWNERSHIP_MATRIX.md` frozen.

## Inputs

- `docs/refactoring/PHASE5_TASK_DECOMPOSITION.md` — TASK-65
- `docs/refactoring/ROADMAP.md` — Phase 5.1
- `docs/refactoring/GATEWAY_ROUTE_OWNERSHIP_MATRIX.md`
- Existing frozen upstream contracts (`*_API_CONTRACT.md`) — read-only
- `api-gateway/` scaffold from TASK-64

## Scope

1. Freeze gateway route contract by public prefix and upstream owner.
2. Define auth propagation rules (JWT forwarding; internal token boundary).
3. Define rate-limit and versioning contract-level behavior (not full implementation details).
4. Define gateway error mapping and timeout/failure response rules.

## Do

- Reuse service/domain terms from frozen contracts and route matrix; do not invent synonyms.
- Keep internal routes (`/api/v1/internal/**`) blocked by default from browser/public traffic.
- Enforce list request cap semantics (`limit <= 30`) at gateway passthrough where relevant.
- Document timestamped gateway logging requirements and `duration_ms` for upstream calls.

## Environment keys (key names only)

- `GATEWAY_SERVICE_PORT`
- `GATEWAY_AUTH_SERVICE_URL`
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
- `LOGGING_SERVICE_URL`

## Do Not

- No controller/business implementation beyond scaffolding stubs.
- Do not change upstream service contracts in this task.
- Do not modify shared microservice repos (`auth-microservice`, `database-server`, `logging-microservice`, `nginx-microservice`, `payments-microservice`, `notifications-microservice`).
- No nginx repo edits.
- Do not self-run `AGENT65V` — hand to Validator.

## Outputs

- `docs/refactoring/GATEWAY_API_CONTRACT.md`
- `docs/refactoring/GATEWAY_AUTH_BOUNDARY.md`

## Exit Criteria

- Contract docs are internally consistent with `GATEWAY_ROUTE_OWNERSHIP_MATRIX.md`.
- Routes and ownership are explicit and single-writer boundaries preserved.
- **Next:** `docs/agents/AGENT65V_GATEWAY_CONTRACT_DESIGN_VALIDATE.md` → **PASS** for sync **P5-GB**.
