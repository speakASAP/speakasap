# AGENT29V: Validator — User Service Scaffold (TASK-29)

## Role

QA / Infra Validator. **Read-only** verification of TASK-29. Do not implement features.

## Objective

Confirm user-service scaffold meets sync **P3-UA** so TASK-30 (design) may start.

## Preconditions

- Implementation reports TASK-29 complete.

## Verification Scope

1. `user-service/` exists; layout consistent with `content-service/`.
2. `npm run build` succeeds in `user-service/`.
3. `/health` exists; README documents how to run locally.
4. No hardcoded production URLs, ports, or secrets; keys live in **`speakasap/.env.example`** (values in **`speakasap/.env`** only; see `docs/infrastructure/ENV_MONOREPO.md`).
5. Port **4207** and DB **`speakasap_user_db`** match `PORT_ALLOCATION.md`.
6. No forbidden shared microservice repo changes.

## Verification results (evidence)

Recorded **2026-04-12**.

1. **Layout:** `speakasap/user-service/` exists with NestJS scaffold (`src/`, `package.json`, `tsconfig*.json`, `Dockerfile`, `docker-compose.yml`, `README.md`), consistent with the `content-service/` service pattern (domain `prisma/` and `scripts/` deferred to later tasks). Env template is **only** at repo root (`speakasap/.env.example`).
2. **Build:** `npm run build` in `user-service/` completed successfully (`tsc -p tsconfig.build.json`).
3. **`/health` + README:** `GET /health` implemented in `user-service/src/app.controller.ts`; `main.ts` uses `setGlobalPrefix('api/v1', { exclude: ['health'] })`. README documents local Node/Docker run and `curl` to `/health`.
4. **Env / secrets:** `speakasap/.env.example` lists required keys (`USER_SERVICE_PORT`, `USER_SERVICE_NAME`, `USER_DATABASE_URL`, `DB_*`, `LOGGING_SERVICE_URL`, etc.). Grep of `user-service/src/**/*.ts` found no hardcoded production URLs or service ports.
5. **Port / DB:** `docs/infrastructure/PORT_ALLOCATION.md` lists **4207** / **`speakasap_user_db`** for `speakasap-user-service` (aligned with README and root env template).
6. **Forbidden scope:** Working tree under `speakasap/` contains no edits to shared `*-microservice/` repositories (validator scope: `speakasap` app + `user-service/` only).

## Manual Checks (record evidence)

- [x] `npm run build` in `user-service/` — PASS (2026-04-12)
- [x] README DB name and port — PASS (`4207`, `speakasap_user_db` in README table)
- [x] Grep `user-service/src` for suspicious hardcoded URLs — PASS (no matches)

## Sync gate (before TASK-30)

- **P3-UA:** **PASS** — TASK-30 may proceed.

## Verdict

**PASS**

### If FAIL

- List defects with paths; **return to** `AGENT29_USER_SERVICE_SCAFFOLD.md`.
- Do not clear **P3-UA** until PASS.
