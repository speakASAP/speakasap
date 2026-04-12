# AGENT29: Phase 3 Wave 1 — User Service Scaffold

## Role

Infra/Docker Agent: add **speakasap-user-service** scaffold to the `speakasap` monorepo (`user-service/` directory, consistent with `content-service/`).

## Objective

Minimal NestJS app for **port 4207**, DB **`speakasap_user_db`**, with env-driven config, centralized logging, and `/health`, matching Phase 1/2 service patterns.

## Inputs

- `docs/refactoring/PHASE3_TASK_DECOMPOSITION.md` — TASK-29
- `docs/refactoring/ROADMAP.md` — Phase 3 §3.3
- `docs/infrastructure/PORT_ALLOCATION.md`
- `docs/infrastructure/SHARED_SERVICES.md`
- `content-service/` — structural reference
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`

## Scope

- Add `user-service/` at repo root (alongside `content-service/`).
- Root `docker-compose.yml` / deploy scripts: extend per existing patterns; do not edit `nginx-microservice` source.
- `.env.example` for the service (keys only).

## Do

- NestJS scaffold: `GET /health`, env validation if used elsewhere, logging toward `LOGGING_SERVICE_URL`.
- README: port **4207**, DB name, next step TASK-30.
- `npm install` and `npm run build` succeed in `user-service/`.

## Do Not

- No domain user APIs (profiles, teachers list) — TASK-31.
- No auth implementation duplicating **auth-microservice** — integration design is TASK-30+.
- Do not modify forbidden shared microservice repos.
- No automated tests unless explicitly requested.
- Do not self-run `AGENT29V` — hand to Validator.

## Outputs

- `user-service/` — scaffold, `README.md`, `.env.example`, `Dockerfile` if required by pattern
- Root compose / script updates if needed

## Exit Criteria

- Build passes; `/health` documented for local manual check.
- **Next:** `docs/agents/AGENT29V_USER_SERVICE_SCAFFOLD_VALIDATE.md` → **PASS** before TASK-30.
