# AGENT34: Phase 3 Wave 2 — Course Service Scaffold

## Role

Infra/Docker Agent: add **speakasap-course-service** scaffold to the `speakasap` monorepo (`course-service/` directory, consistent with `content-service/` and `user-service/`).

## Objective

Minimal NestJS app for **port 4205**, DB **`speakasap_course_db`**, with env-driven config, centralized logging, and `/health`, matching Phase 1/2/Wave-1 service patterns.

## Inputs

- `docs/refactoring/PHASE3_WAVE2_COURSE_TASK_DECOMPOSITION.md` — TASK-34
- `docs/refactoring/ROADMAP.md` — Phase 3 §3.1 Course Service
- `docs/infrastructure/PORT_ALLOCATION.md`
- `docs/infrastructure/SHARED_SERVICES.md`
- `user-service/` or `content-service/` — structural reference
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`

## Scope

- Add `course-service/` at repo root (alongside `user-service/`).
- Root `docker-compose.yml` / deploy scripts: extend per existing patterns; do not edit `nginx-microservice` source.
- No per-service env template; use **`speakasap/.env.example`** / **`speakasap/.env`** only (`ENV_MONOREPO.md`).

## Do

- NestJS scaffold: `GET /health`, env validation if used elsewhere, logging toward `LOGGING_SERVICE_URL`.
- README: port **4205**, DB name, next step TASK-35.
- `npm install` and `npm run build` succeed in `course-service/`.

## Do Not

- No domain course/product/offer/pricing APIs — TASK-36.
- Do not import education-service or user-service runtime coupling — contract references are TASK-35+.
- Do not modify forbidden shared microservice repos.
- No automated tests unless explicitly requested.
- Do not self-run `AGENT34V` — hand to Validator.

## Outputs

- `course-service/` — scaffold, `README.md`, `Dockerfile` if required by pattern (env at monorepo root only)
- Root compose / script updates if needed

## Exit Criteria

- Build passes; `/health` documented for local manual check.
- **Next:** `docs/agents/AGENT34V_COURSE_SERVICE_SCAFFOLD_VALIDATE.md` → **PASS** before TASK-35.
