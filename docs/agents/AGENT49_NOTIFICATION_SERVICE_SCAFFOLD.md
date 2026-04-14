# AGENT49: Phase 4 — Notification Service Scaffold (TASK-49)

## Role

Infra/Docker Agent: add **notification-service** scaffold to the `speakasap` monorepo (consistent with `course-service/`, `user-service/`).

## Objective

Create baseline `notification-service` with `/health`, root env wiring, and logging integration for the notification wave.

## Inputs

- `docs/refactoring/PHASE4_TASK_DECOMPOSITION.md` — TASK-49
- `docs/refactoring/ROADMAP.md` — Phase 4 (Notification)
- `docs/infrastructure/PORT_ALLOCATION.md`
- `docs/infrastructure/SHARED_SERVICES.md`
- `course-service/` — structural reference
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`

## Scope

1. Create `notification-service/` scaffold.
2. Wire compose/deploy using existing service pattern.
3. Ensure config uses root env only.

## Environment keys (key names only)

- `NOTIFICATION_SERVICE_PORT`
- `NOTIFICATION_DATABASE_URL`
- `NOTIFICATION_SERVICE_URL`
- `LOGGING_SERVICE_URL`

## Legacy domain (for README context only — no business APIs in this task)

`notifications` (and SES/SmartResponder boundaries per ROADMAP — delivery via notifications-microservice)

## Do

- NestJS scaffold: `GET /health`, env validation on startup if used elsewhere, logging toward `LOGGING_SERVICE_URL`.
- README: port **4209**, DB **`speakasap_notification_db`**, dependency on **notifications-microservice** documented as HTTP-only integration in later tasks.
- `npm install` and `npm run build` succeed in `notification-service/`.

## Do Not

- No domain HTTP routes beyond `/health` — later tasks.
- Do not add runtime coupling to other SpeakASAP services in scaffold code.
- Do not modify shared microservice repos (`notifications-microservice`, `auth-microservice`, `database-server`, `logging-microservice`, `nginx-microservice`).
- No automated tests unless explicitly requested.
- Do not self-run `AGENT49V` — hand to Validator.

## Outputs

- `notification-service/` — scaffold, `README.md`, `Dockerfile` if required by repo pattern

## Exit Criteria

- Build passes; `/health` documented for local manual check.
- **Next:** `docs/agents/AGENT49V_NOTIFICATION_SERVICE_SCAFFOLD_VALIDATE.md` → **PASS** for sync **P4-NA** before TASK-50.
