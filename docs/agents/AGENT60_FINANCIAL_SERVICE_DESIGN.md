# AGENT60: Phase 4 — Financial Service Design (API Contract + Data Mapping) (TASK-60)

## Role

Backend Service Agent (Design): freeze **API surface** and **legacy → target** data mapping for **Financial** per `ROADMAP.md` Phase 4 and `PHASE4_TASK_DECOMPOSITION.md`.

## Objective

Produce contract artifacts so TASK-61 implementation has no ambiguous coupling.

## Inputs

- `docs/refactoring/PHASE4_TASK_DECOMPOSITION.md` — TASK-60
- `docs/refactoring/ROADMAP.md` — Phase 4
- Legacy repo: `speakasap-portal` — verify actual models/tables for: Billing categories, revenue/expense analytics per ROADMAP §4.5
- Prior wave frozen contracts where referenced (e.g. `USER_API_CONTRACT.md`, `COURSE_API_CONTRACT.md`, `PAYMENT_API_CONTRACT.md`, `EDUCATION_API_CONTRACT.md`) — read-only
- `financial-service/` scaffold from TASK-59

## Scope

1. Freeze financial API for billing categories, revenue/expense summaries, and dashboard data.
2. Freeze mapping for legacy billing/revenue/expense records.
3. Document read-model strategy from payment and salary services.
4. Resolve `products`/billing category ownership against course service.

## Do

- Reuse domain terms from legacy and `ROADMAP.md`; do not invent synonyms.
- List explicit **out-of-scope** items (helpdesk, analytics, marathon, catalog/warehouse microservices unless reopened).

## Environment keys (key names only)

- `FINANCIAL_SERVICE_PORT`
- `FINANCIAL_DATABASE_URL`
- `PAYMENT_SERVICE_URL`
- `SALARY_SERVICE_URL`
- `COURSE_SERVICE_URL`
- `LOGGING_SERVICE_URL`

## Do Not

- No handler implementation beyond scaffold stubs.
- Do not modify shared microservice repos (`auth-microservice`, `payments-microservice`, `notifications-microservice`, etc.) source.
- No nginx-microservice edits.

## Outputs

- `docs/refactoring/FINANCIAL_API_CONTRACT.md`
- `docs/refactoring/FINANCIAL_DATA_MAPPING.md`
- `docs/refactoring/COURSE_API_CONTRACT.md` — addendum only if TASK-60 determines course service owns billing categories

## Exit Criteria

- Contracts ready for freeze at sync **P4-FB** after Validator PASS.
- **Next:** `docs/agents/AGENT60V_FINANCIAL_SERVICE_DESIGN_VALIDATE.md` → **PASS**; prerequisite **P4-FA** satisfied.
