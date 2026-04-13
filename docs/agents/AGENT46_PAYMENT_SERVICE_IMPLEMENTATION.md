# AGENT46: Phase 4 — Payment Service Implementation (TASK-46)

## Role

Backend Service Agent (Implementation): HTTP handlers and persistence matching frozen **`PAYMENT_API_CONTRACT.md`**.

## Objective

Implement domain routes and service logic for **payment-service** per TASK-45 artifacts.

## Inputs

- `PAYMENT_API_CONTRACT.md` and corresponding `*_DATA_MAPPING.md` (frozen after **P4-OB**)
- `payment-service/` codebase from TASK-45

## Prerequisites

- **P4-OB** PASS.
- No contract changes without reopening design task.

## Scope

1. Implement persistence and DTO validation per mapping.
2. Implement order/discount/subscription handlers from contract.
3. Implement webhook endpoint with authenticity validation and idempotency.
4. Implement provider adapter to `payments-microservice` only as defined in contract.
5. Add structured logs (ISO timestamp + `duration_ms`) for DB and outbound HTTP calls.

## Do

- Match frozen contract paths and semantics; document intentional deviations in PR notes (prefer zero deviation).
- Preserve list cap `<= 30`.
- Use env keys only; no hardcoded provider URLs, secrets, or credentials.

## Environment keys (key names only)

- `PAYMENTS_MICROSERVICE_URL`
- `PAYMENTS_WEBHOOK_SHARED_SECRET`
- `PAYMENT_DATABASE_URL`
- `PAYMENT_SERVICE_PORT`
- `LOGGING_SERVICE_URL`

## Do Not

- Do not change frozen contract files without a new design task + Lead approval.
- Do not increase timeouts to mask hangs — log slow calls with timestamps.
- No automated tests unless explicitly requested.
- Do not add direct integration with `notifications-microservice` unless frozen contract requires it.

## Exit Criteria

- `npm run build` passes; manual smoke of `/health` and key routes as documented.
- Manual smoke checklist includes webhook replay/idempotency behavior.
- **Next:** `docs/agents/AGENT46V_PAYMENT_SERVICE_IMPLEMENTATION_VALIDATE.md` → **PASS** for **P4-OC**.
