# AGENT44: Phase 4 — Payment Service Scaffold (TASK-44)

## Role

Infra/Docker Agent. Create `payment-service/` scaffold in the `speakasap` monorepo using the same structure and operational conventions as `course-service/` and `user-service/`.

## Objective

Prepare a production-ready baseline for payment wave implementation:

- NestJS app bootstraps with validated env.
- `/health` endpoint is available.
- Build and compose integration are wired.
- Logging is configured for centralized logging service.

## Inputs

- `docs/refactoring/PHASE4_TASK_DECOMPOSITION.md` — TASK-44 detail
- `docs/refactoring/ROADMAP.md` — Phase 4 payment scope
- `docs/infrastructure/PORT_ALLOCATION.md`
- `docs/infrastructure/SHARED_SERVICES.md`
- `course-service/`, `user-service/` — structure and config pattern references
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md` — global constraints

## Prerequisites

- Phase 3 closed and Phase 4 opened.
- No direct edits outside `speakasap` repository.
- Follow `ENV_MONOREPO.md`: no per-service `.env` file.

## Scope

1. Create `payment-service/` scaffold with standard NestJS folder layout.
2. Wire service in root compose/deploy paths used by existing services.
3. Keep configuration env-driven through root `.env`/`.env.example`.
4. Add README with run/build/debug instructions and dependencies.

## Legacy domain (for README context only — no business APIs in this task)

`orders`, `discount`, `subscription` (context only; no domain handlers in this task)

## Environment keys (key names only)

Add missing keys to `speakasap/.env.example` (values in `.env` only):

- `PAYMENT_SERVICE_PORT`
- `PAYMENT_DATABASE_URL`
- `PAYMENT_DB_NAME`
- `PAYMENTS_MICROSERVICE_URL`
- `LOGGING_SERVICE_URL`
- `AUTH_MICROSERVICE_URL`

## Do

1. Implement `GET /health`.
2. Ensure service startup fails fast when required env keys are missing.
3. Add timestamped request logging pattern placeholder used by other services.
4. Confirm `npm install` and `npm run build` pass.
5. Document that payment provider integration happens in TASK-46.

## Do Not

- No payment/order/subscription business endpoints.
- No webhook handlers yet.
- No direct DB references outside `speakasap_payment_db`.
- Do not modify shared microservice repos.
- Do not run validator prompt yourself.

## Outputs

- `payment-service/` scaffold
- `payment-service/README.md`
- Root compose/deploy updates for payment service if missing
- Root env key declarations (`.env.example`)

## Exit Criteria

- `npm run build` passes.
- `/health` documented and reachable in local compose context.
- Env key list documented with no secrets.
- **Next:** `docs/agents/AGENT44V_PAYMENT_SERVICE_SCAFFOLD_VALIDATE.md` for **P4-OA**.

## Status

**Complete 2026-04-13** — **P4-OA** PASS (`AGENT44V_PAYMENT_SERVICE_SCAFFOLD_VALIDATE.md`). Proceed to **TASK-45** / `AGENT45_PAYMENT_SERVICE_DESIGN.md`.
