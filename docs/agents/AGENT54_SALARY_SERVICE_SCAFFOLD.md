# AGENT54: Phase 4 — Salary Service Scaffold (TASK-54)

## Role

Infra/Docker Agent: add **salary-service** scaffold to the `speakasap` monorepo (consistent with `course-service/`, `user-service/`).

## Objective

Create baseline salary service scaffold with health endpoint, root env configuration, and centralized logging integration.

## Inputs

- `docs/refactoring/PHASE4_TASK_DECOMPOSITION.md` — TASK-54
- `docs/refactoring/ROADMAP.md` — Phase 4 (Salary)
- `docs/infrastructure/PORT_ALLOCATION.md`
- `docs/infrastructure/SHARED_SERVICES.md`
- `course-service/` — structural reference
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`

## Scope

1. Create `salary-service/` directory and NestJS bootstrap.
2. Wire compose/deploy entries consistently with existing services.
3. Keep all configuration in root `.env` and `.env.example`.

## Environment keys (key names only)

- `SALARY_SERVICE_PORT`
- `SALARY_DATABASE_URL`
- `SALARY_DB_NAME`
- `LOGGING_SERVICE_URL`
- `AUTH_MICROSERVICE_URL`

## Legacy domain (for README context only — no business APIs in this task)

`expenses` (salary slice), employee/teacher contract data per ROADMAP

## Do

- NestJS scaffold: `GET /health`, env validation on startup if used elsewhere, logging toward `LOGGING_SERVICE_URL`.
- README: port **4212**, DB **`speakasap_salary_db`**, dependency on **speakasap-payment-service (HTTP)** documented as HTTP-only integration in later tasks.
- `npm install` and `npm run build` succeed in `salary-service/`.

## Do Not

- No domain HTTP routes beyond `/health` — later tasks.
- Do not add runtime coupling to other SpeakASAP services in scaffold code.
- Do not modify shared microservice repos (speakasap-payment-service (HTTP), `auth-microservice`, `database-server`, `logging-microservice`, `nginx-microservice`).
- No automated tests unless explicitly requested.
- Do not self-run `AGENT54V` — hand to Validator.

## Outputs

- `salary-service/` — scaffold, `README.md`, `Dockerfile` if required by repo pattern

## Exit Criteria

- Build passes; `/health` documented for local manual check.
- **Next:** `docs/agents/AGENT54V_SALARY_SERVICE_SCAFFOLD_VALIDATE.md` → **PASS** for sync **P4-SA** before TASK-55.
