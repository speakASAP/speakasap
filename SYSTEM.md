# System: speakasap

## Architecture

NestJS microservices (42xx range) · PostgreSQL · Redis · Next.js frontend.
Services: content, certification, assessment, course, education, user, payment, notification, salary, financial, api-gateway, frontend.

## Deployment

**Production:** Kubernetes `statex-apps` namespace on k3s. Manifests: `speakasap/k8s/`.
**Secrets:** Vault (`secret/prod/speakasap`) → ESO → K8s Secrets → pod `envFrom`.
**Local dev:** `./shared/scripts/vault-env-gen.sh speakasap prod` → `.env` → docker compose.

## Integrations

| Service | Usage |
|---------|-------|
| auth-microservice:3370 | JWT validation |
| database-server:5432 | PostgreSQL (per-service DBs) |
| database-server:6379 | Redis (shared cache) |
| logging-microservice:3367 | Centralized logging |
| notifications-microservice:3368 | Student emails/Telegram |
| payments-microservice:3468 | Course payments |
| ai-microservice:3380 | AI content + education features |

## Current State

Stage: active — Phases 1–5 complete, all services deployed on K8s.

## Known Issues

- None
