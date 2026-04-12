# speakasap-education-service

Phase 3 Wave 3 — education delivery domain (`EDUCATION_API_CONTRACT.md`, `EDUCATION_DATA_MAPPING.md`).

| Item | Value |
| ---- | ----- |
| Default port | **4206** (`PORT` / `EDUCATION_SERVICE_PORT`) |
| Target PostgreSQL database | **`speakasap_education_db`** (`DATABASE_URL` / `EDUCATION_DATABASE_URL`) |
| HTTP API prefix | `/api/v1` (health: `GET /health` without prefix) |

## Local run (Node)

1. Configure **`speakasap/.env`** at the monorepo root (`docs/infrastructure/ENV_MONOREPO.md`). Set **`EDUCATION_DATABASE_URL`**, **`EDUCATION_SERVICE_PORT`**, **`EDUCATION_SERVICE_NAME`**, **`EDUCATION_DB_NAME`**, logging, auth timeouts, pagination, **`INTERNAL_API_TOKEN`** (same pattern as `course-service`).
2. `npm run prisma:migrate:deploy` (uses `../.env` and `EDUCATION_DATABASE_URL`).
3. `npm install`
4. `npm run build`
5. `PORT` and `SERVICE_NAME` must match compose overrides when running `npm start` manually.
6. Health: `curl -s http://localhost:${PORT:-4206}/health`

## API (JWT required on `/api/v1/**`)

Contract: `docs/refactoring/EDUCATION_API_CONTRACT.md`.

Staff-scoped list/detail routes (see contract). Example:

```bash
TOKEN="<access_token from auth-microservice>"
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:4206/api/v1/groups?page=1&limit=10"
```

## Docker (this directory)

```bash
docker compose build && docker compose up -d
curl -s "http://localhost:${PORT:-4206}/health"
```

## Next

- Extend contract for learner-facing routes and AI-teacher (`ai-microservice`) per `ROADMAP.md` §3.2.
