# Marathon Infra Plan (Draft)

## Docker Outline

Target repo: `/Users/sergiystashok/Documents/GitHub/marathon`

### Dockerfile

- Multi-stage build (deps → build → runtime)
- `WORKDIR /app`
- Copy `package*.json`, install deps, copy source, build
- Runtime uses `node dist/main.js`
- `PORT` from env

### docker-compose (production-only)

- `marathon` service
  - build: `.`
  - ports: `${PORT}:${PORT}`
  - env from `.env`
  - depends_on: database/redis only if hosted with the service
- Avoid touching production `nginx-microservice`.

## Env Keys (No Secrets)

- `PORT`
- `PUBLIC_BASE_URL`
- `DATABASE_URL`
- `REDIS_URL`
- `AUTH_SERVICE_URL`
- `PAYMENTS_SERVICE_URL`
- `NOTIFICATIONS_SERVICE_URL`
- `LOGGING_SERVICE_URL`
- `REQUEST_TIMEOUT_MS`
- `RATE_LIMIT_PER_MIN`
- `MAX_PAGE_SIZE=30`
- `DEFAULT_PAGE_SIZE=24`

## Port Guidance

Marathon is a standalone product. Use the SpeakASAP reserved 42xx range (define via `PORT`).

## Logging

Use centralized logging:
`LOGGING_SERVICE_URL=http://logging-microservice:3367`

## Network Notes

Service-to-service DNS on shared Docker network (production-only):

- `auth-microservice:3370`
- `database-server:5432`
- `logging-microservice:3367`
- `notifications-microservice:3368`
- `payments-microservice:3468`
