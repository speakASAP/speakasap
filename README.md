# SpeakASAP Platform

## status

SpeakASAP is an active production education platform on Kubernetes. This repository is the new NestJS/Next.js microservice monorepo replacing the legacy `speakasap-portal` Django app; migration is in progress under the intent-preservation orchestrator pack in `docs/orchestrator/`.

## documentation authority

- `BUSINESS.md` for approved product intent
- `SYSTEM.md` for architecture and integration facts
- `docs/orchestrator/*` for the migration orchestrator pack (MASTER_PROMPT, GOALS, PLAN, STATE.json)
- `AGENTS.md` for repository agent instructions
- `docs/01_vision/VISION.md` for durable product direction

## capabilities

- Language-learning course delivery, lessons and content management (content-service)
- Assessments and certifications (assessment-service, certification-service)
- Course/education workflows including teacher-assigned and self-serve grammar drills (course-service, education-service)
- Student/user account management (user-service)
- Course payments (payment-service, via payments-microservice)
- Salary and recording-duration payroll for teachers (salary-service, financial-service)
- Student notifications via email/Telegram/WhatsApp (notification-service)
- Unified API entry point (api-gateway) and web frontend (frontend)

## interfaces

- api-gateway on port 4210 as the unified HTTP entry point
- frontend (Next.js) on port 4211
- Per-service REST APIs on ports 4201-4213 (see Services & Ports table)
- Per-service PostgreSQL databases (speakasap_*_db) via database-server
- Shared Redis cache via database-server

## development

- Stack: NestJS microservices (42xx port range), Next.js frontend, PostgreSQL, Redis
- Local secrets: `./shared/scripts/vault-env-gen.sh speakasap prod` generates `.env`
- Local run: `docker compose up` after `.env` generation
- Per-service tests run with each service's own Jest config; see `jest.config.base.js`

## configuration

- Runtime namespace: `statex-apps`
- Secrets: Vault `secret/prod/speakasap` -> External Secrets Operator -> Kubernetes Secrets -> pod `envFrom`
- Manifests: `k8s/services/*.yaml`
- Deploy config: `deploy.config.sh`

## deployment

- Deploy command: `./scripts/deploy.sh` (or repo-standard `shared/scripts/deploy.sh` from the ecosystem root)
- Target: Kubernetes `statex-apps` namespace on the single-node `alfares` k3s cluster
- Rollout restart per-service: `kubectl rollout restart deployment/<svc> -n statex-apps`
- Deployment is serialized via the shared ecosystem deploy lock

## health and observability

- Health endpoint: `GET /health` on each service and on api-gateway
- Structured logging via `logging-microservice:3367`
- Notifications/escalation via `notifications-microservice:3368`
- Database backups via `backups-microservice` (`backup-db.sh <db-name>` per service database)
