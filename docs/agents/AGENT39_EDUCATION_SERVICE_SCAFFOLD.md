# AGENT39: Phase 3 Wave 3 — Education Service Scaffold

## Role

Infra/Docker Agent: add **speakasap-education-service** scaffold to the `speakasap` monorepo (`education-service/` directory, consistent with `course-service/` and `user-service/`).

## Objective

Minimal NestJS app for **port 4206**, DB **`speakasap_education_db`**, with env-driven config, centralized logging, and `/health`, matching Phase 1/2/Wave-1/Wave-2 service patterns.

## Inputs

- `docs/refactoring/PHASE3_WAVE3_EDUCATION_TASK_DECOMPOSITION.md` — TASK-39
- `docs/refactoring/ROADMAP.md` — Phase 3 §3.2 Education Service
- `docs/infrastructure/PORT_ALLOCATION.md`
- `docs/infrastructure/SHARED_SERVICES.md`
- `course-service/` or `user-service/` — structural reference
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`

## Scope

- Add `education-service/` at repo root (alongside `course-service/`).
- Root `docker-compose.yml` / blue-green compose: extend per existing patterns; do not edit `nginx-microservice` source.
- No per-service env template; use **`speakasap/.env.example`** / **`speakasap/.env`** only (`ENV_MONOREPO.md`).

## Do

- NestJS scaffold: `GET /health`, env validation if used elsewhere, logging toward `LOGGING_SERVICE_URL`.
- README: port **4206**, DB name, next step TASK-40.
- `npm install` and `npm run build` succeed in `education-service/`.
- Add **key names** only to **`speakasap/.env.example`** for any new `EDUCATION_*` / DB URL variables (`ENV_MONOREPO.md`).

## Do Not

- No domain education APIs — TASK-41.
- Do not import course-service or user-service runtime code — HTTP integration is TASK-40+ per contract.
- Do not modify forbidden shared microservice repos.
- No automated tests unless explicitly requested.
- Do not self-run `AGENT39V` — hand to Validator.

## Outputs

- `education-service/` — scaffold, `README.md`, `Dockerfile` if required by pattern (env at monorepo root only)
- Root compose / script updates if needed

## Exit Criteria

- Build passes; `/health` documented for local manual check.
- **Next:** `docs/agents/AGENT39V_EDUCATION_SERVICE_SCAFFOLD_VALIDATE.md` → **PASS** before TASK-40.
