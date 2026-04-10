# speakasap-certification-service (Phase 2 scaffold)

NestJS scaffold for certification extraction from `speakasap-portal`. Domain APIs are **not** implemented here yet (see TASK-23).

## Port and database

| Item | Value |
| ---- | ----- |
| Default port | **4202** |
| PostgreSQL database name | **`speakasap_certification_db`** |

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

- **TASK-22** — API contract and data mapping (certification).
- **TASK-23** — Implementation against the frozen contract.
