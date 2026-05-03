# speakasap-user-service

User domain — students, teachers, employee profiles, internal batch upsert.

## Port & Database

**Port:** 4207 | **DB:** `speakasap_user_db` (`USER_DATABASE_URL`) | **K8s:** `statex-apps` namespace

## Health

`GET /health` → 200 OK

## API

Base path: `/api/v1/*` · Auth: `Authorization: Bearer <JWT>`.

```bash
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:4207/api/v1/students/me"
# Internal batch (requires INTERNAL_API_TOKEN):
curl -s -X POST "http://localhost:4207/api/v1/internal/students/upsert-by-auth-user" \
  -H "X-Internal-Token: $INTERNAL_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"authUserId":"<UUID>","country":"ru"}]}'
```

Key env: `USER_SERVICE_PORT`, `USER_DATABASE_URL`, `AUTH_SERVICE_URL`, `INTERNAL_API_TOKEN`.

## Run locally

```bash
cd user-service
# .env at repo root — generate from Vault: ../shared/scripts/vault-env-gen.sh speakasap prod
docker compose up --build
```

## Deploy (K8s)

```bash
docker build -t localhost:5000/speakasap-user-service:latest .
docker push localhost:5000/speakasap-user-service:latest
kubectl rollout restart deployment/speakasap-user-service -n statex-apps
```
