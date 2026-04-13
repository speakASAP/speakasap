# AGENT45: Phase 4 — Payment Service Design (API Contract + Data Mapping) (TASK-45)

## Role

Backend Service Agent (Design): freeze **API surface** and **legacy → target** data mapping for **Payment** per `ROADMAP.md` Phase 4 and `PHASE4_TASK_DECOMPOSITION.md`.

## Objective

Freeze contract and mapping for payment wave so TASK-46 can implement without ambiguity.

## Inputs

- `docs/refactoring/PHASE4_TASK_DECOMPOSITION.md` — TASK-45
- `docs/refactoring/ROADMAP.md` — Phase 4
- Legacy repo: `speakasap-portal` — verify actual models/tables for `orders`, `discount`, `subscription`
- Frozen cross-service contracts when identifiers are referenced (user/course/education)
- `payment-service/` scaffold from TASK-44

## Prerequisites

- **P4-OA** is PASS.
- No new scope outside payment wave.

## Scope

1. Define payment domain endpoints (orders, discounts, subscriptions, invoices, webhooks).
2. Define DTOs, status codes, errors, pagination (`limit <= 30`).
3. Define provider boundary for `payments-microservice` (capture/refund/status).
4. Define idempotency rules and webhook authenticity requirements.
5. Map legacy entities to new tables/fields with enum normalization.

## Do

- Reuse domain terms from legacy and `ROADMAP.md`; do not invent synonyms.
- List explicit **out-of-scope** items (helpdesk, analytics, marathon, catalog/warehouse microservices unless reopened).
- Document decision on subscription ownership (payment-only vs education access hooks).

## Environment keys (key names only)

- `PAYMENTS_MICROSERVICE_URL`
- `PAYMENTS_WEBHOOK_SHARED_SECRET`
- `PAYMENT_SERVICE_PORT`
- `PAYMENT_DATABASE_URL`
- `LOGGING_SERVICE_URL`

## Do Not

- No handler implementation beyond scaffold stubs.
- Do not modify `auth-microservice` or `payments-microservice` source.
- No nginx-microservice edits.

## Outputs

- `docs/refactoring/PAYMENT_API_CONTRACT.md`
- `docs/refactoring/PAYMENT_DATA_MAPPING.md`
- Optional addendum note if cross-service identifiers require clarification

## Exit Criteria

- Contracts ready for freeze at sync **P4-OB** after Validator PASS.
- **Next:** `docs/agents/AGENT45V_PAYMENT_SERVICE_DESIGN_VALIDATE.md` → **PASS**; prerequisite **P4-OA** satisfied.
