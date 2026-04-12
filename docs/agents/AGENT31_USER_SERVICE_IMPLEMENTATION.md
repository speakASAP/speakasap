# AGENT31: Phase 3 Wave 1 — User Service Implementation

## Role

Backend Service Agent (Implementation): implement NestJS modules per frozen contracts.

## Objective

`user-service` behavior matches `USER_API_CONTRACT.md`; persistence aligns with `USER_DATA_MAPPING.md` and Prisma schema (if used).

## Inputs

- `docs/refactoring/USER_API_CONTRACT.md` (frozen)
- `docs/refactoring/USER_DATA_MAPPING.md` (frozen)
- `user-service/` codebase post TASK-29/30
- `content-service/` — patterns for logging, config, global pipes

## Scope

- Implement routes, services, DTO validation, Prisma repositories (or equivalent).
- JWT validation as **client** of **auth-microservice** only (no duplicate user store in auth).
- Centralized logging with timestamps on slow paths (do not raise global timeouts to mask hangs).

## Do

- Respect list limits ≤ **30**.
- **`speakasap/.env`** only via validated config; add new **key names** to **`speakasap/.env.example`** if new variables appear (`docs/infrastructure/ENV_MONOREPO.md`).

## Do Not

- Do not modify `auth-microservice`, `database-server`, `nginx-microservice`, `logging-microservice` repositories.
- No bulk migration of production data — TASK-32.
- No automated tests unless explicitly requested.

## Outputs

- Implemented `user-service/` application code
- `README.md` updates for run/config

## Exit Criteria

- `npm run build` passes.
- Manual smoke steps documented (health + one sample authenticated call outline).
- **Next:** `AGENT31V_USER_SERVICE_IMPLEMENTATION_VALIDATE.md` → **PASS** before TASK-32.
