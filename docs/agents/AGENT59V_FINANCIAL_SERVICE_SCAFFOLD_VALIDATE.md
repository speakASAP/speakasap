# AGENT59V: Validator — Financial Service Scaffold (TASK-59)

## Role

QA / Infra Validator. **Read-only** verification of TASK-59. Do not implement features.

## Objective

Confirm **financial-service** scaffold meets sync **P4-FA** so TASK-60 may start.

## Preconditions

- Implementation agent reports TASK-59 complete.

## Verification Scope

1. `financial-service/` exists; layout consistent with `course-service/` / `user-service/`.
2. `npm run build` succeeds in `financial-service/`.
3. `/health` exists; README documents how to run locally.
4. No hardcoded production URLs, ports, or secrets; keys in **`speakasap/.env.example`** (values in **`speakasap/.env`** only; `ENV_MONOREPO.md`).
5. Port **4213** and DB **`speakasap_financial_db`** match `PORT_ALLOCATION.md`.
6. No forbidden shared microservice repo changes.

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Scaffold layout | inspect `financial-service/` | file list |
| Build pass | run build | output |
| Health route | code inspection | path |
| Env keys in root | inspect `.env.example` | keys |
| Repo isolation | path review | diff summary |

## Commands (examples)

- `npm run build`
- `rg "FINANCIAL_SERVICE_PORT|FINANCIAL_DATABASE_URL" /home/ssf/Documents/Github/speakasap/.env.example`

## Verification results (evidence)

- **Layout:** `financial-service/` present with `src/`, `shared/`, `Dockerfile`, `docker-compose.yml`, `tsconfig*.json`, `scripts/`, `README.md` — aligned with `course-service/` / `user-service/` Nest scaffold pattern (no Prisma in scaffold by design).
- **Build:** `cd speakasap/financial-service && npm run build` → exit **0** (`tsc -p tsconfig.build.json`).
- **Health:** `AppController` `GET health`; `main.ts` sets `api/v1` global prefix with `{ exclude: ['health'] }` → **`GET /health`** at root.
- **Env:** `.env.example` keys `FINANCIAL_SERVICE_PORT`, `FINANCIAL_SERVICE_PORT_GREEN`, `FINANCIAL_DB_NAME`, `FINANCIAL_DATABASE_URL`; `validate-env.ts` requires env-only config; `rg` on `financial-service/src` for hardcoded URLs/secrets → **no matches**.
- **Port / DB:** `docs/infrastructure/PORT_ALLOCATION.md` row: speakasap-financial-service **4213**, **`speakasap_financial_db`** — matches README.
- **Isolation:** Scaffold under `speakasap/financial-service/` only; no shared Statex microservice repo edits in scope.

## Manual Checks (record evidence)

- [x] `npm run build` in `financial-service/` — pass (2026-04-14)
- [x] README port **4213** and DB **`speakasap_financial_db`**
- [x] Grep `financial-service/src` for suspicious hardcoded URLs — none

## Sync gate (before TASK-60)

- **P4-FA:** **PASS**

## Verdict

**PASS** — TASK-60 may start.

### If FAIL

- List defects with paths; **return to** `docs/agents/AGENT59_FINANCIAL_SERVICE_SCAFFOLD.md`.
- Do not clear **P4-FA** until PASS.
