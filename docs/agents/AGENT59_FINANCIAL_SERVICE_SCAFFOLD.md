# AGENT59: Phase 4 — Financial Service Scaffold (TASK-59)

## Role

Infra/Docker Agent: add **financial-service** scaffold to the `speakasap` monorepo (consistent with `course-service/`, `user-service/`).

## Objective

Create baseline financial service scaffold with health endpoint, root env configuration, and centralized logging integration.

## Inputs

- `docs/refactoring/PHASE4_TASK_DECOMPOSITION.md` — TASK-59
- `docs/refactoring/ROADMAP.md` — Phase 4 (Financial)
- `docs/infrastructure/PORT_ALLOCATION.md`
- `docs/infrastructure/SHARED_SERVICES.md`
- `course-service/` — structural reference
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`

## Scope

1. Create `financial-service/` scaffold.
2. Wire compose/deploy entries with existing pattern.
3. Keep env keys in root env files only.

## Environment keys (key names only)

- `FINANCIAL_SERVICE_PORT`
- `FINANCIAL_DATABASE_URL`
- `FINANCIAL_DB_NAME`
- `LOGGING_SERVICE_URL`

## Legacy domain (for README context only — no business APIs in this task)

Billing categories, revenue/expense analytics per ROADMAP §4.5

## Do

- NestJS scaffold: `GET /health`, env validation on startup if used elsewhere, logging toward `LOGGING_SERVICE_URL`.
- README: port **4213**, DB **`speakasap_financial_db`**, dependency on **payment + salary services (HTTP)** documented as HTTP-only integration in later tasks.
- `npm install` and `npm run build` succeed in `financial-service/`.

## Do Not

- No domain HTTP routes beyond `/health` — later tasks.
- Do not add runtime coupling to other SpeakASAP services in scaffold code.
- Do not modify shared microservice repos (payment + salary services (HTTP), `auth-microservice`, `database-server`, `logging-microservice`, `nginx-microservice`).
- No automated tests unless explicitly requested.
- Do not self-run `AGENT59V` — hand to Validator.

## Outputs

- `financial-service/` — scaffold, `README.md`, `Dockerfile` if required by repo pattern

## Exit Criteria

- Build passes; `/health` documented for local manual check.
- **Next:** `docs/agents/AGENT59V_FINANCIAL_SERVICE_SCAFFOLD_VALIDATE.md` → **PASS** for sync **P4-FA** before TASK-60.
