# speakasap-course-service

Phase 3 Wave 2 — course catalog pricing domain (`COURSE_API_CONTRACT.md`, `COURSE_DATA_MAPPING.md` after TASK-35).

| Item | Value |
| ---- | ----- |
| Default port | **4205** (`PORT` / `COURSE_SERVICE_PORT`) |
| Target PostgreSQL database | **`speakasap_course_db`** (`DATABASE_URL` / `COURSE_DATABASE_URL`) |
| HTTP API prefix | `/api/v1` (health: `GET /health` without prefix) |

## Local run (Node)

1. Configure **`speakasap/.env`** at the monorepo root (`docs/infrastructure/ENV_MONOREPO.md`). Set **`COURSE_DATABASE_URL`**, **`COURSE_SERVICE_PORT`**, **`COURSE_SERVICE_NAME`**, **`COURSE_DB_NAME`**, logging, auth timeouts, pagination, **`INTERNAL_API_TOKEN`** (same keys pattern as `user-service`).
2. `npm run prisma:migrate:deploy` (uses `../.env` and `COURSE_DATABASE_URL`).
3. `npm install`
4. `npm run build`
5. `PORT` and `SERVICE_NAME` must match compose overrides (`COURSE_SERVICE_PORT` / `COURSE_SERVICE_NAME`) when running `npm start` manually, or run via Docker Compose below.
6. Health: `curl -s http://localhost:${PORT:-4205}/health`

## API (JWT required on `/api/v1/**`)

Contract: `docs/refactoring/COURSE_API_CONTRACT.md`.

```bash
TOKEN="<access_token from auth-microservice>"
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:4205/api/v1/categories?page=1&limit=10"
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:4205/api/v1/products?page=1&limit=10"
```

## Docker (this directory)

```bash
docker compose build && docker compose up -d
curl -s "http://localhost:${PORT:-4205}/health"
```

## Next

- **TASK-35:** `docs/agents/AGENT35_COURSE_SERVICE_DESIGN.md` — freeze `COURSE_API_CONTRACT.md` + `COURSE_DATA_MAPPING.md`.
