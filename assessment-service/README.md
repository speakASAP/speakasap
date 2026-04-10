# speakasap-assessment-service (Phase 2 scaffold)

NestJS scaffold for assessment extraction from `speakasap-portal`. Domain APIs are **not** implemented here yet (see TASK-26). Legacy **`teacher_tests`** remain out of scope per `docs/refactoring/ROADMAP.md`.

## Port and database

| Item | Value |
| ---- | ----- |
| Default port | **4203** |
| PostgreSQL database name | **`speakasap_assessment_db`** |

See `docs/infrastructure/PORT_ALLOCATION.md` in the `speakasap` repo.

## Health

- **GET** `/health` — returns `{ "status": "ok" }` (no global API prefix).
- Versioned routes (when added) live under **`/api/v1`** (same pattern as `content-service`).

## Configuration

Copy `.env.example` to `.env` and set all required variables. Do not commit `.env`.

Required at runtime: `PORT`, `SERVICE_NAME`, `DATABASE_URL`, `LOGGING_SERVICE_URL`, `LOGGING_SERVICE_API_PATH`, `LOGGING_SERVICE_TIMEOUT`.

Centralized logging uses `LOGGING_SERVICE_URL` (e.g. `http://logging-microservice:3367` on Docker network).

## Local run

From this directory, with a filled `.env`:

```bash
npm install
npm run build
npm start
```

Or Docker:

```bash
docker compose up --build
```

## Docker / blue-green

Repo root `docker-compose.blue.yml` / `docker-compose.green.yml` include this service for production-style deploys.

## Next steps (refactoring program)

- **TASK-25** — API contract and data mapping (assessment).
- **TASK-26** — Implementation against the frozen contract.
