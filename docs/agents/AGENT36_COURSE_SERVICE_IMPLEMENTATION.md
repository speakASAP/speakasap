# AGENT36: Phase 3 Wave 2 — Course Service Implementation

## Role

Backend Service Agent (Implementation): implement NestJS modules per frozen contracts.

## Objective

`course-service` behavior matches `COURSE_API_CONTRACT.md`; persistence aligns with `COURSE_DATA_MAPPING.md` and Prisma schema (if used).

## Inputs

- `docs/refactoring/COURSE_API_CONTRACT.md` (frozen)
- `docs/refactoring/COURSE_DATA_MAPPING.md` (frozen)
- `course-service/` codebase post TASK-34/35
- `user-service/` or `content-service/` — patterns for logging, config, global pipes

## Scope

- Implement routes, services, DTO validation, Prisma repositories (or equivalent).
- JWT validation as **client** of **auth-microservice** only when contract requires authenticated routes (same consumer pattern as user-service where applicable).
- Centralized logging with timestamps on slow paths (do not raise global timeouts to mask hangs).

## Do

- Respect list limits ≤ **30**.
- **`speakasap/.env`** only via validated config; add new **key names** to **`speakasap/.env.example`** if new variables appear (`docs/infrastructure/ENV_MONOREPO.md`).

## Do Not

- Do not modify `auth-microservice`, `database-server`, `nginx-microservice`, `logging-microservice` repositories.
- No bulk migration of production data — TASK-37.
- No automated tests unless explicitly requested.
- Do not implement education-service APIs or call education-service HTTP from this task unless explicitly added to contract by Lead.

## Outputs

- Implemented `course-service/` application code
- `README.md` updates for run/config

## Exit Criteria

- `npm run build` passes.
- Manual smoke steps documented (health + sample API outline per contract).
- **Next:** `docs/agents/AGENT36V_COURSE_SERVICE_IMPLEMENTATION_VALIDATE.md` → **PASS** before TASK-37.
