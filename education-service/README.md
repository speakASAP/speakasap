# speakasap-education-service

Education delivery domain — groups, lessons, homework, student progress, AI-teacher integration.

## Port & Database

**Port:** 4206 | **DB:** `speakasap_education_db` (`EDUCATION_DATABASE_URL`) | **K8s:** `statex-apps` namespace

## Health

`GET /health` → 200 OK

## API

Base path: `/api/v1/*` · Auth: `Authorization: Bearer <JWT>`.

```bash
TOKEN="<JWT from auth-microservice>"
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:4206/api/v1/groups?page=1&limit=10"
```

Key env: `EDUCATION_SERVICE_PORT`, `EDUCATION_DATABASE_URL`, `AUTH_SERVICE_URL`, `INTERNAL_API_TOKEN`.

## Run locally

```bash
cd education-service
# .env at repo root — generate from Vault: ../shared/scripts/vault-env-gen.sh speakasap prod
docker compose up --build
```

## Deploy (K8s)

```bash
docker build -t localhost:5000/speakasap-education-service:latest .
docker push localhost:5000/speakasap-education-service:latest
kubectl rollout restart deployment/speakasap-education-service -n statex-apps
```
