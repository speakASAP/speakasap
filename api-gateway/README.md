# speakasap-api-gateway

Public HTTP entry for Phase 5. Proxies `/api/v1/**` to Phase 1–4 SpeakASAP services per `docs/refactoring/GATEWAY_API_CONTRACT.md`.

## Port

Default **4210** (`API_GATEWAY_PORT` in monorepo `.env`).

## Health

`GET /health` — no auth, no `/api/v1` prefix.

## Run locally

From repo root `speakasap/`:

```bash
cd api-gateway && npm install && npm run build && PORT=4210 SERVICE_NAME=api-gateway node dist/main.js
```

Load env from `../.env` (required keys in `src/shared/validate-env.ts`).

## Docker

```bash
docker compose -f api-gateway/docker-compose.yml --env-file .env up --build
```
