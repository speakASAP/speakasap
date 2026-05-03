# speakasap-notification-service

Notification domain — templates, preferences, delivery via `notifications-microservice`.

## Port & Database

**Port:** 4209 | **DB:** `speakasap_notification_db` (`NOTIFICATION_DATABASE_URL`) | **K8s:** `statex-apps` namespace

## Health

`GET /health` → 200 OK

## API

Base path: `/api/v1/*` · `GET /api/v1/templates` (cursor pagination, max 30).

Key env: `NOTIFICATION_SERVICE_PORT`, `NOTIFICATION_DATABASE_URL`, `NOTIFICATION_SERVICE_URL`, `AUTH_SERVICE_URL`.
Optional: `USER_SERVICE_URL`, `INTERNAL_API_TOKEN`, `NOTIFICATIONS_MICROSERVICE_API_KEY`.

## Run locally

```bash
cd notification-service
# .env at repo root — generate from Vault: ../shared/scripts/vault-env-gen.sh speakasap prod
docker compose up --build
```

## Deploy (K8s)

```bash
docker build -t localhost:5000/speakasap-notification-service:latest .
docker push localhost:5000/speakasap-notification-service:latest
kubectl rollout restart deployment/speakasap-notification-service -n statex-apps
```
