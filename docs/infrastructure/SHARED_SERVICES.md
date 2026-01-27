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

## Notes

- Use env-driven configuration only.
- Do not hardcode service URLs or ports.
- Keep `.env` synchronized with `.env.example` (local + prod).
