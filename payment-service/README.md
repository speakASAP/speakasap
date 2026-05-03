# speakasap-payment-service

Payment domain — orders, discounts, subscriptions. Delegates payment capture to `payments-microservice`.

## Port & Database

**Port:** 4208 | **DB:** `speakasap_payment_db` (`PAYMENT_DATABASE_URL`) | **K8s:** `statex-apps` namespace

## Health

`GET /health` → 200 OK

## API

Base path: `/api/v1/*` · Auth: `Authorization: Bearer <JWT>`.

Key env: `PAYMENT_SERVICE_PORT`, `PAYMENT_DATABASE_URL`, `PAYMENTS_MICROSERVICE_URL`, `AUTH_MICROSERVICE_URL`.

## Run locally

```bash
cd payment-service
# .env at repo root — generate from Vault: ../shared/scripts/vault-env-gen.sh speakasap prod
docker compose up --build
```

## Deploy (K8s)

```bash
docker build -t localhost:5000/speakasap-payment-service:latest .
docker push localhost:5000/speakasap-payment-service:latest
kubectl rollout restart deployment/speakasap-payment-service -n statex-apps
```
