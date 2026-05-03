# speakasap-api-gateway

Public HTTP entry point. Proxies `/api/v1/**` to Phase 1–4 services with JWT auth guard and rate limiting.

## Port & Database

**Port:** 4210 (`API_GATEWAY_PORT`) | **DB:** — (routing only) | **K8s:** `statex-apps` namespace

## Health

`GET /health` → 200 OK (no auth, no `/api/v1` prefix)

## API

Full route contract: `../docs/refactoring/GATEWAY_API_CONTRACT.md`
Auth boundary: `../docs/refactoring/GATEWAY_AUTH_BOUNDARY.md`

## Run locally

```bash
cd api-gateway
# .env at repo root — generate from Vault: ../shared/scripts/vault-env-gen.sh speakasap prod
docker compose up --build
```

## Deploy (K8s)

```bash
docker build -t localhost:5000/speakasap-api-gateway:latest .
docker push localhost:5000/speakasap-api-gateway:latest
kubectl rollout restart deployment/speakasap-api-gateway -n statex-apps
```
