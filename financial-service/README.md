# speakasap-financial-service

Phase 4 **financial-service** (`TASK-59` scaffold, `TASK-61` domain API) for billing categories and revenue/expense analytics (see `docs/refactoring/ROADMAP.md` §4.5 and `docs/refactoring/FINANCIAL_API_CONTRACT.md`).

| Item | Value |
| ---- | ----- |
| Default port | **4213** (`FINANCIAL_SERVICE_PORT` / `PORT`) |
| Target PostgreSQL database | **`speakasap_financial_db`** (`FINANCIAL_DATABASE_URL` / `FINANCIAL_DB_NAME`) |
| HTTP API prefix | `/api/v1` (health: `GET /health` without prefix) |

## Local run (Node)

1. Configure `speakasap/.env` at monorepo root (`docs/infrastructure/ENV_MONOREPO.md`) with keys in `docs/refactoring/FINANCIAL_API_CONTRACT.md` (service port/DB, logging, auth, `PAYMENT_SERVICE_URL`, `SALARY_SERVICE_URL`, `COURSE_SERVICE_URL`, internal tokens, optional `FINANCIAL_DISPLAY_CURRENCY`, `FINANCIAL_HTTP_TIMEOUT_MS`).
2. `npm install`
3. `npm run prisma:migrate:deploy` (from this directory; loads parent `.env`)
4. `npm run build`
5. `npm start`
6. Health: `curl -s http://localhost:${FINANCIAL_SERVICE_PORT:-4213}/health`

## Docker (this directory)

```bash
docker compose build && docker compose up -d
curl -s "http://localhost:${FINANCIAL_SERVICE_PORT:-4213}/health"
```

## HTTP API (staff JWT on admin routes; `X-Internal-Token` for internal)

- `GET /api/v1/revenue/category-matrix?monthFrom&monthTo`
- `GET /api/v1/revenue/by-payment-method?month`
- `GET /api/v1/revenue/summary?monthFrom&monthTo`
- `GET /api/v1/expenses/summary?monthFrom&monthTo`
- `GET /api/v1/expenses/operating-lines?limit&cursor`
- `GET /api/v1/dashboard/overview?month`
- `POST /api/v1/internal/financial/refresh-window` (body `{ monthFrom, monthTo }`, header `X-Internal-Token: FINANCIAL_INTERNAL_API_TOKEN`)

## Next

Validator: `docs/agents/AGENT61V_FINANCIAL_SERVICE_IMPLEMENTATION_VALIDATE.md`.
