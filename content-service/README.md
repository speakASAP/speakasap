# Content Service

Read-only Content Service (NestJS + TypeScript) for legacy content apps:
`grammar`, `phonetics`, `dictionary`, `songs`, `language`.

## Setup (production-only)

- Create `.env` from `.env.example`
- Build: `docker compose build`
- Run: `docker compose up -d`

## Deployment (blue/green)

- Use deployment script:
  - `cd /home/statex/content-service`
  - `./scripts/deploy.sh`

## API

- Health: `GET /health`
- Base path: `GET /api/v1/*`
- Pagination: `page` + `limit` (max 30)

## Database

- Prisma schema in `prisma/schema.prisma`
- Generate client: `npm run prisma:generate`

## Notes

- Production-only workflow
- Centralized logging via `LOGGING_SERVICE_URL`
- Nginx API routes in `nginx-api-routes.conf`
