# speakasap-salary-service

Phase 4 Wave 3 scaffold (`TASK-54`) for future salary domain implementation.

| Item | Value |
| ---- | ----- |
| Default port | **4212** (`SALARY_SERVICE_PORT` / `PORT`) |
| Target PostgreSQL database | **`speakasap_salary_db`** (`SALARY_DATABASE_URL` / `DATABASE_URL`) |
| HTTP API prefix | `/api/v1` (health: `GET /health` without prefix) |

## Local run (Node)

1. Configure `speakasap/.env` at monorepo root with:
   - `SALARY_SERVICE_PORT`
   - `SALARY_DATABASE_URL`
   - `SALARY_DB_NAME`
   - `LOGGING_SERVICE_URL`, `LOGGING_SERVICE_API_PATH`, `LOGGING_SERVICE_TIMEOUT`
   - `AUTH_SERVICE_URL` or `AUTH_MICROSERVICE_URL`
   - `AUTH_SERVICE_TIMEOUT`
2. `npm install`
3. `npm run build`
4. `npm start`
5. Health: `curl -s http://localhost:${SALARY_SERVICE_PORT:-4212}/health`

## Docker (this directory)

```bash
docker compose build && docker compose up -d
curl -s "http://localhost:${SALARY_SERVICE_PORT:-4212}/health"
```

## Scope for this scaffold

- `GET /health` only
- Fail-fast env validation before startup
- Timestamped request logs with `duration_ms`
- Centralized logging via `LOGGING_SERVICE_URL`

## Planned integration (later tasks)

- **speakasap-payment-service (HTTP)** for payout and related flows; no shared database and no scaffold-time HTTP client.

## Next

Salary API design and contracts are deferred to `TASK-55` (`docs/agents/AGENT55_SALARY_SERVICE_DESIGN.md`).
