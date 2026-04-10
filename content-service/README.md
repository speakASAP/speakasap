# Content Service

Read-only Content Service (NestJS + TypeScript) for legacy content apps:
`grammar`, `phonetics`, `dictionary`, `songs`, `language`.

## Setup

- Copy `.env` from `.env.example` and set `PORT`, `DATABASE_URL`, logging/notification URLs, pagination sizes.
- **Run from this folder:** `docker compose build && docker compose up -d` then `curl http://localhost:${PORT:-4201}/health`.
- **Blue/green (production):** compose files also live at `speakasap/docker-compose.blue.yml` and `docker-compose.green.yml` (repo root). Run `./scripts/deploy.sh` from `speakasap` after `docker network create nginx-network` (if missing).

## Deployment (blue/green)

- `cd <speakasap-repo-root> && ./content-service/scripts/deploy.sh` (script `cd`s to repo root and calls nginx-microservice `deploy-smart.sh`).

## API

- Health: `GET /health`
- Base path: `GET /api/v1/*`
- Pagination: `page` + `limit` (max 30)

## Database

- Prisma schema in `prisma/schema.prisma`
- Generate client: `npm run prisma:generate`

## Data migration (legacy → Prisma)

Script: `scripts/migrate-content-data.py` (canonical copy in this repo on **alfares** after `git pull`). Legacy Django **`speakasap-portal`** lives on **speakasap** — copy the script there for `--export-dir`. Full steps: `scripts/README_MIGRATION.md`.

## Notes

- Production-only workflow
- Centralized logging via `LOGGING_SERVICE_URL`
- Nginx API routes in `nginx-api-routes.conf`
