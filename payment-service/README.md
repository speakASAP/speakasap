# speakasap-payment-service

Phase 4 Wave 1 scaffold (`TASK-44`) for future payment domain implementation.

| Item | Value |
| ---- | ----- |
| Default port | **4208** (`PAYMENT_SERVICE_PORT` / `PORT`) |
| Target PostgreSQL database | **`speakasap_payment_db`** (`PAYMENT_DATABASE_URL` / `DATABASE_URL`) |
| HTTP API prefix | `/api/v1` (health: `GET /health` without prefix) |

## Local run (Node)

1. Configure `speakasap/.env` at monorepo root (`docs/infrastructure/ENV_MONOREPO.md`) with:
   - `PAYMENT_SERVICE_PORT`
   - `PAYMENT_DATABASE_URL`
   - `PAYMENT_DB_NAME`
   - `PAYMENTS_MICROSERVICE_URL`
   - `LOGGING_SERVICE_URL`, `LOGGING_SERVICE_API_PATH`, `LOGGING_SERVICE_TIMEOUT`
   - `AUTH_MICROSERVICE_URL`
2. `npm install`
3. `npm run build`
4. `npm start`
5. Health: `curl -s http://localhost:${PAYMENT_SERVICE_PORT:-4208}/health`

## Docker (this directory)

```bash
docker compose build && docker compose up -d
curl -s "http://localhost:${PAYMENT_SERVICE_PORT:-4208}/health"
```

## Scope for this scaffold

- `GET /health` only
- Fail-fast env validation before startup
- Timestamped request logs with `duration_ms`
- Centralized logging via `LOGGING_SERVICE_URL`

## Next

Payment provider integration and business APIs (`orders`, `discount`, `subscription`) are intentionally deferred to `TASK-46` (`docs/agents/AGENT46_PAYMENT_SERVICE_IMPLEMENTATION.md`).
