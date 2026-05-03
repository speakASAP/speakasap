# speakasap-salary-service

Staff salary management and teacher payments — salary calculations, payment schedules, expense tracking.

## Port & Database

**Port:** 4212 | **DB:** `speakasap_salary_db` (`SALARY_DATABASE_URL`) | **K8s:** `statex-apps` namespace

## Health

`GET /health` → 200 OK

## API

Base path: `/api/v1/*` · Auth: `Authorization: Bearer <JWT>`.

Key env: `SALARY_SERVICE_PORT`, `SALARY_DATABASE_URL`, `AUTH_SERVICE_URL`, `LOGGING_SERVICE_URL`.
Optional: `EDUCATION_SERVICE_URL`, `PAYMENT_SERVICE_URL`, `SALARY_INTERNAL_API_TOKEN`.

## Run locally

```bash
cd salary-service
# .env at repo root — generate from Vault: ../shared/scripts/vault-env-gen.sh speakasap prod
docker compose up --build
```

## Deploy (K8s)

```bash
docker build -t localhost:5000/speakasap-salary-service:latest .
docker push localhost:5000/speakasap-salary-service:latest
kubectl rollout restart deployment/speakasap-salary-service -n statex-apps
```
