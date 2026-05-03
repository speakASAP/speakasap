# speakasap-course-service

Course catalog pricing domain — categories, products, offers, pricing rules.

## Port & Database

**Port:** 4205 | **DB:** `speakasap_course_db` (`COURSE_DATABASE_URL`) | **K8s:** `statex-apps` namespace

## Health

`GET /health` → 200 OK

## API

Base path: `/api/v1/*` · Auth: `Authorization: Bearer <JWT>` on all routes.

```bash
TOKEN="<JWT from auth-microservice>"
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:4205/api/v1/categories?page=1&limit=10"
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:4205/api/v1/products?page=1&limit=10"
```

Key env: `COURSE_SERVICE_PORT`, `COURSE_DATABASE_URL`, `AUTH_SERVICE_URL`, `INTERNAL_API_TOKEN`.

## Run locally

```bash
cd course-service
# .env at repo root — generate from Vault: ../shared/scripts/vault-env-gen.sh speakasap prod
docker compose up --build
```

## Deploy (K8s)

```bash
docker build -t localhost:5000/speakasap-course-service:latest .
docker push localhost:5000/speakasap-course-service:latest
kubectl rollout restart deployment/speakasap-course-service -n statex-apps
```
