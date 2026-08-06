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

## Drilling Assignments

Teacher-assigned and self-serve grammar drills. Spans content (item bank,
vocabulary, set library), education (assignments, grading, runner,
AI orchestration), notification (emails), ai-microservice (generator and
validator agents), and the legacy portal (entry points + SSO handoff).

Plan and per-track evidence: `docs/superpowers/plans/2026-07-29-drilling-assignments/`.

Live in production. Content bank as of 2026-08-06: 27,619 drill items
(24,102 grammar · 3,477 seven · 40 AI), 45,077 course-vocabulary rows,
547 topics.

**Answers never reach the browser** — the runner response carries no `answer` or
`alternatives` key. Treat that as a hard invariant when touching runner code.

## Database Conventions

`content-service` and `education-service` both map models to snake_case tables
via Prisma `@@map`. Physical table names are snake_case; the Prisma Client API
stays camelCase (`prisma.drillItem` → `drill_item`).

Renaming a table here needs a **hand-written** `ALTER TABLE … RENAME` migration.
Prisma's `migrate diff` renders a rename as `DROP TABLE` + `CREATE TABLE`, which
silently destroys data. See `content-service/prisma/migrations/20260806143845_snake_case_table_names`.

## Current State

Stage: active — Phases 1–5 complete, all services deployed on K8s.
Drilling assignments live; rollout Track K.4 (browser reproduction) outstanding.

## Known Issues

- `content-service` test `src/drills/contracts.spec.ts` fails: it resolves
  `../../../shared/scripts/sync-drill-contracts.sh`, which lands at
  `speakasap/shared/`, but the script lives at the ecosystem root
  `Github/shared/`. Pre-existing path bug, unrelated to the contracts themselves.
