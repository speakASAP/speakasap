# AGENT55: Phase 4 — Salary Service Design (API Contract + Data Mapping) (TASK-55)

## Role

Backend Service Agent (Design): freeze **API surface** and **legacy → target** data mapping for **Salary** per `ROADMAP.md` Phase 4 and `PHASE4_TASK_DECOMPOSITION.md`.

## Objective

Produce contract artifacts so TASK-56 implementation has no ambiguous coupling.

## Inputs

- `docs/refactoring/PHASE4_TASK_DECOMPOSITION.md` — TASK-55
- `docs/refactoring/ROADMAP.md` — Phase 4
- Legacy repo: `speakasap-portal` — verify actual models/tables for: `expenses` (salary slice), employee/teacher contract data per ROADMAP
- Prior wave frozen contracts where referenced (e.g. `USER_API_CONTRACT.md`, `COURSE_API_CONTRACT.md`, `PAYMENT_API_CONTRACT.md`, `EDUCATION_API_CONTRACT.md`) — read-only
- `salary-service/` scaffold from TASK-54

## Scope

1. Freeze salary API for calculations, payout runs, status lookups, and admin summaries.
2. Freeze data mapping for `expenses` salary slice and employee contract references.
3. Document dependency boundaries to user/education/payment speakasap services over HTTP only.
4. Define idempotency strategy for payout operations.

## Do

- Reuse domain terms from legacy and `ROADMAP.md`; do not invent synonyms.
- List explicit **out-of-scope** items (helpdesk, analytics, marathon, catalog/warehouse microservices unless reopened).

## Environment keys (key names only)

- `SALARY_SERVICE_PORT`
- `SALARY_DATABASE_URL`
- `SALARY_PAYOUT_LOCK_TTL_MS`
- `LOGGING_SERVICE_URL`

## Do Not

- No handler implementation beyond scaffold stubs.
- Do not modify shared microservice repos (`auth-microservice`, `payments-microservice`, `notifications-microservice`, etc.) source.
- No nginx-microservice edits.

## Outputs

- `docs/refactoring/SALARY_API_CONTRACT.md`
- `docs/refactoring/SALARY_DATA_MAPPING.md`

## Exit Criteria

- Contracts ready for freeze at sync **P4-SB** after Validator PASS.
- **Next:** `docs/agents/AGENT55V_SALARY_SERVICE_DESIGN_VALIDATE.md` → **PASS**; prerequisite **P4-SA** satisfied.
