# SpeakASAP Platform

Online education platform — language learning courses, assessments, certifications, payments.

**Stack:** NestJS microservices (42xx range) · PostgreSQL · Redis · K8s (`statex-apps`)
**Deployment:** Kubernetes — manifests in `speakasap/k8s/`. Secrets via Vault → ESO → K8s Secrets.
**Local dev:** `vault-env-gen.sh speakasap prod` → `.env`, then `docker compose up`.

## Services & Ports

| Service | Port | DB |
|---------|------|----|
| content-service | 4201 | speakasap_content_db |
| certification-service | 4202 | speakasap_certification_db |
| assessment-service | 4203 | speakasap_assessment_db |
| course-service | 4205 | speakasap_course_db |
| education-service | 4206 | speakasap_education_db |
| user-service | 4207 | speakasap_user_db |
| payment-service | 4208 | speakasap_payment_db |
| notification-service | 4209 | speakasap_notification_db |
| api-gateway | 4210 | — |
| frontend | 4211 | — |
| salary-service | 4212 | speakasap_salary_db |
| financial-service | 4213 | speakasap_financial_db |

## Shared integrations

| Service | Purpose |
|---------|---------|
| auth-microservice:3370 | JWT auth |
| database-server:5432/6379 | PostgreSQL + Redis |
| logging-microservice:3367 | Centralized logs |
| notifications-microservice:3368 | Email/Telegram/WhatsApp |
| payments-microservice:3468 | Payment processing |
| ai-microservice:3380 | AI features |

## Key docs

- Secrets: `../shared/docs/VAULT.md`
- K8s ops: `../shared/docs/KUBERNETES_SETUP_GUIDE.md`
- Deploy standard: `../shared/docs/DEPLOY_STANDARD.md`
- Port allocation: `docs/infrastructure/PORT_ALLOCATION.md`
- API gateway contract: `docs/refactoring/GATEWAY_API_CONTRACT.md`
