# speakasap-assessment-service

Adaptive language tests (`language_tests`) and asset-based quizzes (`user_tests`).

## Port & Database

**Port:** 4203 | **DB:** `speakasap_assessment_db` (`ASSESSMENT_DATABASE_URL`) | **K8s:** `statex-apps` namespace

## Health

`GET /health` → 200 OK

## API

Base path: `/api/v1/*` · Auth: `Authorization: Bearer <JWT>` on protected routes.

Key env: `ASSESSMENT_SERVICE_PORT`, `ASSESSMENT_DATABASE_URL`, `AUTH_SERVICE_URL`, `ASSESSMENT_VIEW_TOKEN_SECRET`, `USER_TEST_ASSETS_DIR`, `LANGUAGE_TEST_LANDING_BASE_URL`, `ASSESSMENT_SERVICE_PUBLIC_BASE_URL`.

## Run locally

```bash
cd assessment-service
# .env at repo root — generate from Vault: ../shared/scripts/vault-env-gen.sh speakasap prod
docker compose up --build
```

## Deploy (K8s)

```bash
docker build -t localhost:5000/speakasap-assessment-service:latest .
docker push localhost:5000/speakasap-assessment-service:latest
kubectl rollout restart deployment/speakasap-assessment-service -n statex-apps
```
