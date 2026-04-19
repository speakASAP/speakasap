# AGENT49V: Validator — Notification Service Scaffold (TASK-49)

## Role

QA / Infra Validator. **Read-only** verification of TASK-49. Do not implement features.

## Objective

Confirm **notification-service** scaffold meets sync **P4-NA** so TASK-50 may start.

## Preconditions

- Implementation agent reports TASK-49 complete.

## Verification Scope

1. `notification-service/` exists; layout consistent with `course-service/` / `user-service/`.
2. `npm run build` succeeds in `notification-service/`.
3. `/health` exists; README documents how to run locally.
4. No hardcoded production URLs, ports, or secrets; keys in **`speakasap/.env.example`** (values in **`speakasap/.env`** only; `ENV_MONOREPO.md`).
5. Port **4209** and DB **`speakasap_notification_db`** match `PORT_ALLOCATION.md`.
6. No forbidden shared microservice repo changes.

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Scaffold structure | inspect `notification-service/` | file list |
| Build | run `npm run build` | command output |
| Health endpoint | inspect code | path |
| Env root usage | verify `.env.example` keys | key names |
| Shared repo isolation | check changed paths | diff/path list |

## Commands (examples)

- `npm run build`
- `rg "NOTIFICATION_SERVICE_PORT|NOTIFICATION_DATABASE_URL" /home/ssf/Documents/Github/speakasap/.env.example`
- `rg "http://|https://|localhost" notification-service/src`

## Verification results (evidence)

- Scaffold structure: `notification-service/` present with expected scaffold (`src`, `prisma`, `scripts`, `Dockerfile`, `docker-compose.yml`, `README.md`, TypeScript build configs), consistent with `course-service/` and `user-service/` layout.
- Build: `npm run build` in `notification-service/` passed (`prisma generate` + `tsc -p tsconfig.build.json`, exit code 0).
- Health endpoint: implemented at `src/app.controller.ts` (`GET /health`) and exposed with global prefix exclusion in `src/main.ts`; documented in `notification-service/README.md` with curl example.
- Env root usage: `speakasap/.env.example` contains `NOTIFICATION_SERVICE_PORT` and `NOTIFICATION_DATABASE_URL`.
- Hardcoded values scan: no `http://`, `https://`, `localhost` matches in `notification-service/src`.
- Port/DB allocation check: `docs/infrastructure/PORT_ALLOCATION.md` matches `4209` and `speakasap_notification_db`; README matches the same mapping.
- Shared repo isolation: `git status --short` in `speakasap/` returned no changed paths.

## Manual Checks (record evidence)

- [x] `npm run build` in `notification-service/`
- [x] README port and DB name
- [x] Grep `notification-service/src` for suspicious hardcoded URLs

## Sync gate (before TASK-50)

- **P4-NA:** **PASS**

## Verdict

**PASS**

### If FAIL

- List defects with paths; **return to** `docs/agents/AGENT49_NOTIFICATION_SERVICE_SCAFFOLD.md`.
- Do not clear **P4-NA** until PASS.
