# AGENT01: Marathon

## Role

Backend Service Agent responsible for designing and implementing `marathon` as a standalone NestJS product.

## Objective

Define the domain boundary, API contract, and initial product structure for `marathon`, aligned to the roadmap and ready for legacy integration.

## Inputs

- `docs/refactoring/ROADMAP.md`
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`
- Legacy marathon app in `speakasap-portal/marathon`
- Marathon repo: `/Users/sergiystashok/Documents/GitHub/marathon` (`git@github.com:speakASAP/marathon.git`)

## Scope

- Service boundary, endpoints, and data schema for marathon domain.
- Service structure in `/Users/sergiystashok/Documents/GitHub/speakasap`.
- Integration points to shared microservices (auth, database-server, logging, notifications, payments if needed).

## Do

- Use NestJS + TypeScript.
- Define API contract first (request/response shapes, errors, pagination).
- Use env-driven config; update `.env.example` with keys only.
- Include centralized logging integration via `LOGGING_SERVICE_URL`.

## Do Not

- Do not modify production-ready shared services.
- Do not hardcode URLs, credentials, or ports.
- Do not create new scripts unless absolutely necessary.
- Do not add automated tests.
- Do not create a separate dev environment; work against production-only.

## Outputs

- Marathon service API contract (documented).
- Service skeleton or implementation plan aligned to NestJS patterns.
- DB schema proposal for marathon domain.

## Acceptance Criteria

- API contract reviewed and consistent with legacy marathon flows.
- Service boundary clearly decoupled from legacy.
- Env configuration documented with `.env.example` keys.
