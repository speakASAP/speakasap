# SpeakASAP monorepo environment (single source of truth)

## Rule

- **One real env file:** `speakasap/.env` at the **repository root** (sibling of `content-service/`, `user-service/`, etc.).
- **One template:** `speakasap/.env.example` lists **all** keys (no secret values). Do not maintain `*/.env` or `*/.env.example` inside each service folder.

## Docker Compose

- **Root blue/green:** `docker-compose.blue.yml` / `docker-compose.green.yml` already use `env_file: .env` relative to the repo root.
- **Per-service local compose** (`content-service/docker-compose.yml`, etc.): `env_file: ../.env`.
- **Services with their own DB URL:** local compose sets `DATABASE_URL` from `CERTIFICATION_DATABASE_URL`, `ASSESSMENT_DATABASE_URL`, `USER_DATABASE_URL`, or `COURSE_DATABASE_URL` so the process still sees `DATABASE_URL` while `speakasap/.env` keeps one row per database.

## Prisma CLI

From a service directory, use npm scripts (they load `../.env` and pick the correct database URL alias):

- `content-service`: `npm run prisma:validate`
- `certification-service`: `npm run prisma:validate` (uses `CERTIFICATION_DATABASE_URL`)
- `assessment-service`: `npm run prisma:validate` (uses `ASSESSMENT_DATABASE_URL`)
- `user-service`: `npm run prisma:validate` (uses `USER_DATABASE_URL`)
- `course-service`: `npm run prisma:validate` (uses `COURSE_DATABASE_URL`)

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

## Migrating from old per-service `.env`

If you had `certification-service/.env` or `assessment-service/.env`, backups may exist as `.env.bak.ssot-*` in those folders. **Merge** any keys that are not yet in `speakasap/.env`, then rely on the root file only.
