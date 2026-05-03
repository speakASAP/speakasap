# speakasap-financial-service

Business financial analytics — billing categories, revenue/expense reporting, dashboard KPIs.

## Port & Database

**Port:** 4213 | **DB:** `speakasap_financial_db` (`FINANCIAL_DATABASE_URL`) | **K8s:** `statex-apps` namespace

## Health

`GET /health` → 200 OK

## API

Base path: `/api/v1/*` · Auth: staff JWT on admin routes; `X-Internal-Token` for internal.

Key routes:
- `GET /api/v1/revenue/category-matrix?monthFrom&monthTo`
- `GET /api/v1/revenue/summary?monthFrom&monthTo`
- `GET /api/v1/expenses/summary?monthFrom&monthTo`
- `GET /api/v1/dashboard/overview?month`
- `POST /api/v1/internal/financial/refresh-window`

Key env: `FINANCIAL_SERVICE_PORT`, `FINANCIAL_DATABASE_URL`, `AUTH_SERVICE_URL`, `PAYMENT_SERVICE_URL`, `SALARY_SERVICE_URL`, `FINANCIAL_INTERNAL_API_TOKEN`.

## Run locally

```bash
cd financial-service
# .env at repo root — generate from Vault: ../shared/scripts/vault-env-gen.sh speakasap prod
docker compose up --build
```

## Deploy (K8s)

```bash
docker build -t localhost:5000/speakasap-financial-service:latest .
docker push localhost:5000/speakasap-financial-service:latest
kubectl rollout restart deployment/speakasap-financial-service -n statex-apps
```
