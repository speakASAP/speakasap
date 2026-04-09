# Shared Services Integration

This document lists shared microservices used by SpeakASAP services and the
standard environment variables for integration.

## Core Shared Services

### Auth Microservice

- URL: `AUTH_SERVICE_URL`
- Port: `AUTH_MICROSERVICE_PORT` (default 3370)
- Purpose: JWT validation, user identity resolution

### Database Server

- Host: `DB_HOST` (default `db-server-postgres`)
- Port: `DB_PORT` (default 5432)
- User: `DB_USER`
- Password: `DB_PASSWORD`
- Purpose: Postgres + Redis (shared)

### Logging Microservice

- URL: `LOGGING_SERVICE_URL` (default `http://logging-microservice:3367`)
- Port: `LOGGING_MICROSERVICE_PORT` (default 3367)
- Purpose: Centralized logging

### Notifications Microservice

- URL: `NOTIFICATIONS_MICROSERVICE_URL` (default `http://notifications-microservice:3368`)
- Port: `NOTIFICATIONS_MICROSERVICE_PORT` (default 3368)
- Purpose: Email/Telegram/WhatsApp notifications
- Usage: Services should forward notification events via HTTP API

### Payments Microservice

- URL: `PAYMENTS_MICROSERVICE_URL` (default `http://payments-microservice:3468`)
- Port: `PAYMENTS_MICROSERVICE_PORT` (default 3468)
- Purpose: Payment processing and checkout

### AI Microservice

- URL: `AI_SERVICE_URL` (default `http://ai-microservice:3380`)
- Port: `AI_MICROSERVICE_PORT` (default 3380)
- Purpose: AI-powered translations and content generation

### Nginx Microservice

- Used for reverse proxy and blue/green deployment
- Deployment script: `nginx-microservice/scripts/blue-green/deploy-smart.sh`

## Standard Env Keys

Include these in each service `.env.example` (keys only):

```text
AUTH_SERVICE_URL=
AUTH_MICROSERVICE_PORT=
LOGGING_SERVICE_URL=
LOGGING_MICROSERVICE_PORT=
LOGGING_SERVICE_API_PATH=
NOTIFICATION_SERVICE_URL=
NOTIFICATIONS_MICROSERVICE_URL=
NOTIFICATIONS_MICROSERVICE_PORT=
PAYMENTS_MICROSERVICE_URL=
PAYMENTS_MICROSERVICE_PORT=
AI_SERVICE_URL=
AI_MICROSERVICE_PORT=
```

## Connection examples

### Logging microservice

Send structured JSON logs via HTTP to `LOGGING_SERVICE_URL` (path from `LOGGING_SERVICE_API_PATH`, often `/api/logs`). Include ISO 8601 `timestamp` and `duration_ms` on request handlers. See `logging-microservice/README.md` in the ecosystem for DTO shape.

### Database

Use `DATABASE_URL` or `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`. From another container on `nginx-network`, PostgreSQL is typically `db-server-postgres:5432`.

### Auth

Validate JWTs or resolve users by calling `AUTH_SERVICE_URL` over HTTP from the service (no shared npm package; use your stack’s HTTP client with timeouts from env).

### Notifications

Call `NOTIFICATIONS_MICROSERVICE_URL` for outbound email/Telegram/WhatsApp; use service-level timeouts and retries from env (`NOTIFICATION_SERVICE_TIMEOUT`, `NOTIFICATION_RETRY_*`).

## .env sync (local and production)

1. Add new keys to `.env.example` first (keys only, no secrets).
2. Copy into local `.env` and production `.env` on the server.
3. Use `shared/scripts/compare-env.sh speakasap` or `shared/scripts/env-diff-summary.sh` from the GitHub workspace when aligning with other hosts.
4. After changing keys, run `docker compose -f docker-compose.blue.yml config --quiet` (and green) before deploy.

## Notes

- Use env-driven configuration only.
- Do not hardcode service URLs or ports.
- Keep `.env` synchronized with `.env.example` (local + prod).
