# AGENT50: Phase 4 — Notification Service Design (API Contract + Data Mapping) (TASK-50)

## Role

Backend Service Agent (Design): freeze **API surface** and **legacy → target** data mapping for **Notification** per `ROADMAP.md` Phase 4 and `PHASE4_TASK_DECOMPOSITION.md`.

## Objective

Produce contract artifacts so TASK-51 implementation has no ambiguous coupling.

## Prerequisites

- **P4-NA** PASS.

## Inputs

- `docs/refactoring/PHASE4_TASK_DECOMPOSITION.md` — TASK-50
- `docs/refactoring/ROADMAP.md` — Phase 4
- Legacy repo: `speakasap-portal` — verify actual models/tables for: `notifications` (and SES/SmartResponder boundaries per ROADMAP — delivery via notifications-microservice)
- Prior wave frozen contracts where referenced (e.g. `USER_API_CONTRACT.md`, `PAYMENT_API_CONTRACT.md`, `EDUCATION_API_CONTRACT.md`) — read-only
- `notification-service/` scaffold from TASK-49

## Scope

1. Define APIs for template management, preferences, and dispatch requests.
2. Freeze DTOs, errors, and pagination cap (`<= 30`).
3. Define external delivery boundary through `notifications-microservice` only.
4. Map legacy `notifications` and SES/SmartResponder concepts to new model.

## Do

- Reuse domain terms from legacy and `ROADMAP.md`; do not invent synonyms.
- List explicit **out-of-scope** items (helpdesk, analytics, marathon, catalog/warehouse microservices unless reopened).

## Environment keys (key names only)

- `NOTIFICATIONS_MICROSERVICE_URL`
- `NOTIFICATION_SERVICE_PORT`
- `NOTIFICATION_DATABASE_URL`
- `LOGGING_SERVICE_URL`

## Do Not

- No handler implementation beyond scaffold stubs.
- Do not modify `auth-microservice` or `notifications-microservice` source.
- No nginx-microservice edits.

## Outputs

- `docs/refactoring/NOTIFICATION_API_CONTRACT.md`
- `docs/refactoring/NOTIFICATION_DATA_MAPPING.md`

## Exit Criteria

- Contracts ready for freeze at sync **P4-NB** after Validator PASS.
- **Next:** `docs/agents/AGENT50V_NOTIFICATION_SERVICE_DESIGN_VALIDATE.md` → **PASS**; prerequisite **P4-NA** satisfied.
