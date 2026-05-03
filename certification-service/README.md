# speakasap-certification-service

Certification, quests, and user questionnaires. Generates PDF certificates, tracks quest progress, manages questionnaire lifecycle.

## Port & Database

**Port:** 4202 | **DB:** `speakasap_certification_db` (`CERTIFICATION_DATABASE_URL`) | **K8s:** `statex-apps` namespace

## Health

`GET /health` → `{ "status": "ok" }`

## API

Base path: `/api/v1/*` · Auth: `Authorization: Bearer <JWT>` (shared JWT_SECRET, HS256).

Routes: `/course-certificates`, `/education-certificates`, `/quests`, `/questionnaires`, `/user-questionnaires`.
Internal: `POST /internal/.../generate` with `X-Internal-Api-Key`.

Key env: `CERTIFICATION_SERVICE_PORT`, `CERTIFICATION_DATABASE_URL`, `JWT_SECRET`, `CERT_VIEW_TOKEN_SECRET`, `MATERIALS_PUBLIC_BASE_URL`, `INTERNAL_API_KEY`.

## Run locally

```bash
cd certification-service
# .env at repo root — generate from Vault: ../shared/scripts/vault-env-gen.sh speakasap prod
docker compose up --build
```

## Deploy (K8s)

```bash
docker build -t localhost:5000/speakasap-certification-service:latest .
docker push localhost:5000/speakasap-certification-service:latest
kubectl rollout restart deployment/speakasap-certification-service -n statex-apps
```
