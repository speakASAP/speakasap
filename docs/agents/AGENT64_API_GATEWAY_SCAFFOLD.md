# AGENT64: Phase 5 — API Gateway Scaffold (TASK-64)

## Role

Infra/Docker Agent: add **speakasap-api-gateway** scaffold to the `speakasap` monorepo (consistent with `course-service/`, `user-service/`).

## Objective

Create baseline API gateway scaffold with health endpoint, root env configuration, and centralized logging integration.

## Inputs

- `docs/refactoring/PHASE5_TASK_DECOMPOSITION.md` — TASK-64
- `docs/refactoring/ROADMAP.md` — Phase 5.1 (API Gateway)
- `docs/infrastructure/PORT_ALLOCATION.md`
- `docs/infrastructure/SHARED_SERVICES.md`
- `course-service/` — structural reference
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`

## Scope

1. Create `api-gateway/` scaffold.
2. Wire compose/deploy entries with existing pattern.
3. Keep env keys in root env files only.

## Environment keys (key names only)

- `GATEWAY_SERVICE_PORT`
- `GATEWAY_DATABASE_URL`
- `GATEWAY_DB_NAME`
- `LOGGING_SERVICE_URL`
- `AUTH_SERVICE_URL`

## Integration context (for README only — no routing APIs in this task)

Gateway fronts Phase 1-4 services over HTTP and enforces auth/rate-limit/versioning in later tasks.

## Do

- NestJS scaffold: `GET /health`, env validation on startup if used elsewhere, logging toward `LOGGING_SERVICE_URL`.
- README: port **4210**, dependency on SpeakASAP domain services via HTTP only.
- `npm install` and `npm run build` succeed in `api-gateway/`.

## Do Not

- No domain HTTP routes beyond `/health` — later tasks.
- Do not add runtime coupling to services in scaffold code.
- Do not modify shared microservice repos (`auth-microservice`, `database-server`, `logging-microservice`, `nginx-microservice`, `payments-microservice`, `notifications-microservice`).
- No automated tests unless explicitly requested.
- Do not self-run `AGENT64V` — hand to Validator.

## Outputs

- `api-gateway/` — scaffold, `README.md`, `Dockerfile` if required by repo pattern

## Exit Criteria

- Build passes; `/health` documented for local manual check.
- **Next:** `docs/agents/AGENT64V_API_GATEWAY_SCAFFOLD_VALIDATE.md` → **PASS** for sync **P5-GA** before TASK-65.
