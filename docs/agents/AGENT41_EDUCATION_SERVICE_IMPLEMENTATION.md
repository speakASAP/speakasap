# AGENT41: Phase 3 Wave 3 — Education Service Implementation

## Role

Backend Service Agent (Implementation): implement NestJS modules per frozen **`EDUCATION_API_CONTRACT.md`** and **`EDUCATION_DATA_MAPPING.md`**.

## Objective

`education-service` behavior matches the frozen API contract; persistence aligns with data mapping and Prisma schema (if used).

## Inputs

- `docs/refactoring/EDUCATION_API_CONTRACT.md` (frozen)
- `docs/refactoring/EDUCATION_DATA_MAPPING.md` (frozen)
- `education-service/` codebase post TASK-39/40
- `course-service/` or `user-service/` — patterns for logging, config, global pipes
- `docs/refactoring/COURSE_API_CONTRACT.md` — **client** calls only where contract requires course resolution

## Scope

- Implement routes, services, DTO validation, Prisma repositories (or equivalent).
- JWT validation as **client** of **auth-microservice** when contract requires authenticated routes (same consumer pattern as other speakasap services).
- **ai-microservice** HTTP client only for operations defined in the frozen education contract (AI-teacher); no duplicate AI orchestration logic in-repo beyond thin adapters.
- Centralized logging with timestamps on slow paths (do not raise global timeouts to mask hangs).

## Do

- Respect list limits ≤ **30**.
- **`speakasap/.env`** only via validated config; add new **key names** to **`speakasap/.env.example`** if new variables appear (`ENV_MONOREPO.md`).

## Do Not

- Do not modify `auth-microservice`, `database-server`, `nginx-microservice`, `logging-microservice`, or **`ai-microservice`** repositories.
- No bulk migration of production data — TASK-42.
- No automated tests unless explicitly requested.
- Do not add direct SQL to course or user databases.

## Outputs

- Implemented `education-service/` application code
- `README.md` updates for run/config

## Exit Criteria

- `npm run build` passes.
- Manual smoke steps documented (health + sample API outline per contract).
- **Next:** `docs/agents/AGENT41V_EDUCATION_SERVICE_IMPLEMENTATION_VALIDATE.md` → **PASS** before TASK-42.
