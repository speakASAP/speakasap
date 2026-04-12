# AGENT34V: Validator — Course Service Scaffold (TASK-34)

## Role

QA / Infra Validator. **Read-only** verification of TASK-34. Do not implement features.

## Objective

Confirm course-service scaffold meets sync **P3-CA** so TASK-35 (design) may start.

## Preconditions

- Implementation reports TASK-34 complete.

## Verification Scope

1. `course-service/` exists; layout consistent with `content-service/` / `user-service/`.
2. `npm run build` succeeds in `course-service/`.
3. `/health` exists; README documents how to run locally.
4. No hardcoded production URLs, ports, or secrets; keys live in **`speakasap/.env.example`** (values in **`speakasap/.env`** only; see `docs/infrastructure/ENV_MONOREPO.md`).
5. Port **4205** and DB **`speakasap_course_db`** match `PORT_ALLOCATION.md`.
6. No forbidden shared microservice repo changes.

## Verification results (evidence)

Recorded **2026-04-12**.

1. **Layout:** `speakasap/course-service/` exists with NestJS scaffold (`src/`, `package.json`, `tsconfig*.json`, `Dockerfile`, `docker-compose.yml`, `README.md`, `prisma/schema.prisma` with bootstrap model pending TASK-35/36 domain tables). Env template keys at repo root (`speakasap/.env.example`: `COURSE_SERVICE_*`, `COURSE_DATABASE_URL`, `COURSE_DB_NAME`).
2. **Build:** `npm run build` in `course-service/` completed successfully (`prisma generate` + `tsc -p tsconfig.build.json`).
3. **`/health` + README:** `GET /health` implemented; README documents port **4205**, DB **`speakasap_course_db`**, local Node/Docker.
4. **Env / secrets:** No hardcoded production URLs in `course-service/src/**/*.ts`; compose passes `COURSE_DATABASE_URL` / logging / auth timeouts via root `.env`.
5. **Port / DB:** `docs/infrastructure/PORT_ALLOCATION.md` lists **4205** / **`speakasap_course_db`** for `speakasap-course-service`.
6. **Compose:** `docker-compose.blue.yml` and `docker-compose.green.yml` include **course-service** with healthcheck on `COURSE_SERVICE_PORT`.
7. **Forbidden scope:** No edits under shared `*-microservice/` repos.

## Manual Checks (record evidence)

- [x] `npm run build` in `course-service/` — PASS (2026-04-12)
- [x] README DB name and port — PASS
- [x] Grep `course-service/src` for suspicious hardcoded URLs — PASS

## Sync gate (before TASK-35)

- **P3-CA:** **PASS** — TASK-35 may proceed.

## Verdict

**PASS**

### If FAIL

- List defects with paths; **return to** `AGENT34_COURSE_SERVICE_SCAFFOLD.md`.
- Do not clear **P3-CA** until PASS.
