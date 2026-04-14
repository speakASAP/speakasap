# speakasap-notification-service

Phase 4 notification wave — NestJS scaffold. List pagination uses **cursor + `meta`** (same helpers as `payment-service` — `src/shared/pagination.ts`). `GET /api/v1/templates` is a **stub** (empty `data`) until TASK-51; it already clamps `limit` (max 30).

## Port and database

| Item | Value |
| --- | --- |
| HTTP port | **4209** (`NOTIFICATION_SERVICE_PORT`) |
| PostgreSQL database | **`speakasap_notification_db`** (name is part of `NOTIFICATION_DATABASE_URL`) |

Authoritative table: `docs/infrastructure/PORT_ALLOCATION.md`.

## Environment (root `speakasap/.env` only)

Required keys (see `speakasap/.env.example`):

- `NOTIFICATION_SERVICE_PORT`
- `NOTIFICATION_DATABASE_URL`
- `NOTIFICATION_SERVICE_URL`
- `LOGGING_SERVICE_URL`
- `LOGGING_SERVICE_API_PATH`, `LOGGING_SERVICE_TIMEOUT`
- `AUTH_SERVICE_URL` or `AUTH_MICROSERVICE_URL`, `AUTH_SERVICE_TIMEOUT`

Optional: `USER_SERVICE_URL` + `INTERNAL_API_TOKEN` (user-service internal `POST /api/v1/internal/notification-target` for `userId` → email / do-not-contact), `NOTIFICATIONS_MICROSERVICE_API_KEY`, `NOTIFICATION_SERVICE_TIMEOUT` (outbound HTTP to notifications-ms, default `8000` ms).

Outbound email uses **notifications-microservice** `POST /notifications/send` only (`NOTIFICATION_SERVICE_URL`).

## Local run

From repo root, ensure `speakasap/.env` defines the variables above, then:

```bash
cd notification-service
npm install
npm run build
npm start
```

Manual health check:

```bash
curl -sS "http://127.0.0.1:${NOTIFICATION_SERVICE_PORT:-4209}/health"
```

Docker (this folder):

```bash
docker compose up --build
```

## Logging

Structured logs are forwarded to **logging-microservice** via `LOGGING_SERVICE_URL` and `LOGGING_SERVICE_API_PATH`. Request logs include ISO timestamps and `duration_ms`.
