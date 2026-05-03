# speakasap-content-service

Read-only content service for: grammar, phonetics, dictionary, songs, language.

## Port & Database

**Port:** 4201 | **DB:** `speakasap_content_db` (`DATABASE_URL`) | **K8s:** `statex-apps` namespace

## Health

`GET /health` → 200 OK

## API

Base path: `GET /api/v1/*` · Pagination: `page` + `limit` (max 30)

## Run locally

```bash
cd content-service
# .env at repo root — generate from Vault: ../shared/scripts/vault-env-gen.sh speakasap prod
docker compose up --build
```

## Deploy (K8s)

```bash
docker build -t localhost:5000/speakasap-content-service:latest .
docker push localhost:5000/speakasap-content-service:latest
kubectl rollout restart deployment/speakasap-content-service -n statex-apps
```

## Database

Prisma schema: `prisma/schema.prisma`. Generate client: `npm run prisma:generate`.

## Data migration (legacy → Prisma)

Script: `scripts/migrate-content-data.py`. Full steps: `scripts/README_MIGRATION.md`.
