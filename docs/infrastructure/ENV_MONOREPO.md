# SpeakASAP monorepo environment (single source of truth)

## Rule

- **One real env file:** `speakasap/.env` at the **repository root** (sibling of `content-service/`, `user-service/`, etc.).
- **One template:** `speakasap/.env.example` lists **all** keys (no secret values). Do not maintain `*/.env` or `*/.env.example` inside each service folder.

## Docker Compose

- **Root blue/green:** `docker-compose.blue.yml` / `docker-compose.green.yml` already use `env_file: .env` relative to the repo root.
- **Per-service local compose** (`content-service/docker-compose.yml`, etc.): `env_file: ../.env`.
- **Services with their own DB URL:** local compose sets `DATABASE_URL` from `CERTIFICATION_DATABASE_URL`, `ASSESSMENT_DATABASE_URL`, `USER_DATABASE_URL`, `COURSE_DATABASE_URL`, **`SALARY_DATABASE_URL`**, or **`FINANCIAL_DATABASE_URL`** (see `salary-service/docker-compose.yml`, `financial-service/docker-compose.yml`) so the process still sees `DATABASE_URL` while `speakasap/.env` keeps one row per database.

## Prisma CLI

From a service directory, use npm scripts (they load `../.env` and pick the correct database URL alias):

- `content-service`: `npm run prisma:validate`
- `certification-service`: `npm run prisma:validate` (uses `CERTIFICATION_DATABASE_URL`)
- `assessment-service`: `npm run prisma:validate` (uses `ASSESSMENT_DATABASE_URL`)
- `user-service`: `npm run prisma:validate` (uses `USER_DATABASE_URL`)
- `course-service`: `npm run prisma:validate` (uses `COURSE_DATABASE_URL`)
- `education-service`: `npm run prisma:validate` (uses `EDUCATION_DATABASE_URL`)
- `salary-service`: `npm run prisma:validate` / `npm run prisma:migrate:deploy` (uses **`SALARY_DATABASE_URL`**).

## salary-service

Phase 4 service; port and DB name are fixed in `docs/infrastructure/PORT_ALLOCATION.md` (**4212**, **`speakasap_salary_db`**). Root keys (see `speakasap/.env.example`):

- **`SALARY_SERVICE_PORT`**, **`SALARY_DATABASE_URL`** — required at startup (`salary-service/src/shared/validate-env.ts`).
- **`SALARY_DB_NAME`** — optional compose helper for default `SALARY_DATABASE_URL` interpolation in `docker-compose.template.yml` (not read by salary-service `validate-env`).
- **`SALARY_SERVICE_PORT_GREEN`** — used only by root `docker-compose.green.yml` for host port mapping; keep in sync with blue/green docs.
- Cross-service HTTP (optional until payout/education wiring is live): **`EDUCATION_SERVICE_URL`**, **`PAYMENT_SERVICE_URL`**, **`SALARY_PAYOUT_LOCK_TTL_MS`**, **`HTTP_CLIENT_TIMEOUT_MS`**, **`EDUCATION_SERVICE_INTERNAL_TOKEN`**, **`PAYMENT_SERVICE_INTERNAL_TOKEN`**, **`SALARY_INTERNAL_API_TOKEN`** (see `docs/refactoring/SALARY_API_CONTRACT.md`).
- Shared infra (same root `.env` as other Nest services): **`LOGGING_SERVICE_URL`**, **`LOGGING_SERVICE_API_PATH`**, **`LOGGING_SERVICE_TIMEOUT`**, and either **`AUTH_SERVICE_URL`** or **`AUTH_MICROSERVICE_URL`**, plus **`AUTH_SERVICE_TIMEOUT`**.

Local compose: `salary-service/docker-compose.yml` uses `env_file: ../.env` and sets `DATABASE_URL` / `SALARY_DATABASE_URL` from the root file.

## financial-service

Phase 4 scaffold; port and DB name in `docs/infrastructure/PORT_ALLOCATION.md` (**4213**, **`speakasap_financial_db`**). Root keys (`speakasap/.env.example`):

- **`FINANCIAL_SERVICE_PORT`**, **`FINANCIAL_DATABASE_URL`**, **`FINANCIAL_DB_NAME`** — required at startup (`financial-service/src/shared/validate-env.ts`).
- **`FINANCIAL_SERVICE_PORT_GREEN`** — host port for green stack in root `docker-compose.green.yml` only.
- Shared logging (same root `.env` as other Nest services): **`LOGGING_SERVICE_URL`**, **`LOGGING_SERVICE_API_PATH`**, **`LOGGING_SERVICE_TIMEOUT`**.

Local compose: `financial-service/docker-compose.yml` uses `env_file: ../.env`.

## course-materials-service

This app lives under `speakasap/course-materials-service/`. Scripts use:

`docker compose --env-file "$(dirname …)/../.env" …`

so interpolation reads the same root file.

## Quoted values in `speakasap/.env`

If a value contains spaces (for example `LOG_TIMESTAMP_FORMAT=YYYY-MM-DD HH:mm:ss`), **quote the whole value** in `speakasap/.env` so `set -a; . ./.env` and deploy scripts do not break.

## ETL database URLs (certification / assessment)

Both migration scripts read from **`speakasap/.env`** at repo root. Use **prefixed** variables so certification and assessment targets can coexist:

- **Certification** (`certification-service/scripts/migrate-certification-from-legacy.py`): `CERTIFICATION_SOURCE_DATABASE_URL`, `CERTIFICATION_TARGET_DATABASE_URL` (fallback: `SOURCE_DATABASE_URL`, `TARGET_DATABASE_URL`).
- **Assessment** (`assessment-service/scripts/migrate-assessment-from-legacy.py`): `ASSESSMENT_SOURCE_DATABASE_URL`, `ASSESSMENT_TARGET_DATABASE_URL` (same fallback).
- **Education** (`education-service/scripts/migrate-education-from-legacy.py`): `EDUCATION_SOURCE_DATABASE_URL`, `EDUCATION_TARGET_DATABASE_URL` (same fallback).

## Legacy portal DB tunnel (speakasap.com → this host)

When ETL runs on **alfares** (or any host that is not `speakasap.com`), `*_SOURCE_*` URLs typically use **`127.0.0.1:15432`**. PostgreSQL for the Django portal listens on **`127.0.0.1:5432`** on `speakasap.com` only.

**Start tunnel** (from the ETL host; requires SSH access to `speakasap`):

```bash
ssh -fN -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L 127.0.0.1:15432:127.0.0.1:5432 speakasap
```

**Stop tunnel:** `pkill -f '127.0.0.1:15432:127.0.0.1:5432'` (or kill the matching `ssh` PID).

**Course ETL** (`course-service/scripts/migrate-course-from-legacy.py`): `COURSE_SOURCE_DATABASE_URL` / `COURSE_TARGET_DATABASE_URL` (fallback: `SOURCE_DATABASE_URL`, `TARGET_DATABASE_URL`).

**Prisma migrate from the same host** (not from inside Docker): `course-service` npm scripts prefer `COURSE_TARGET_DATABASE_URL`, then `COURSE_DATABASE_URL`, so `db-server-postgres` is not required on the shell host.

**JWT smoke** for `GET /api/v1/*` on course-service: use **`AUTH_TEST_EMAIL`** and **`AUTH_TEST_PASSWORD`** in `speakasap/.env` (same as `auth-microservice/.env` `TEST_*`) and `POST /auth/login` with JSON body `{ "email", "password" }` — from a container on `nginx-network` use `{AUTH_SERVICE_URL}/auth/login`, from the host use `http://127.0.0.1:3370/auth/login` when auth publishes **3370**. See comment block above course keys in `speakasap/.env`.

## Migrating from old per-service `.env`

If you had `certification-service/.env` or `assessment-service/.env`, backups may exist as `.env.bak.ssot-*` in those folders. **Merge** any keys that are not yet in `speakasap/.env`, then rely on the root file only.
