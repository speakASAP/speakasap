# SpeakASAP Migration Evidence Index

Created: 2026-06-12

## Authoritative Repositories

| Repository | Role | Current evidence |
|---|---|---|
| `/home/ssf/Documents/Github/speakasap` | New SpeakASAP implementation and Kubernetes deployment repo | Branch `main`; current HEAD `a390a5f docs: Update CLAUDE.md to reflect service name change in curl command`; local changes are the orchestrator pack and root plan/agent docs. |
| `/home/ssf/Documents/Github/speakasap-portal` | Legacy Django portal and behavior reference | Branch `main`; current HEAD `1076474e8 Update AGENTS.md and CLAUDE.md for deployment readiness`; no uncommitted changes shown during inventory. |

## Existing SpeakASAP Platform Evidence

- `BUSINESS.md`: online education platform for language learning; student data privacy and GDPR compliance are explicit constraints.
- `SYSTEM.md`: NestJS microservices, PostgreSQL, Redis, Next.js frontend, Kubernetes `statex-apps`, Vault -> ESO -> K8s Secrets.
- `README.md`: service map and ports for content, certification, assessment, course, education, user, payment, notification, api-gateway, frontend, salary, and financial services.
- `TASKS.md`: historical migration/refactor work recorded through Phase 5 gateway work, including references to docs that are missing in this checkout.
- `shared/.claude/memory/project_speakasap_k8s_migration.md`: states all 13 SpeakASAP microservices were migrated to Kubernetes on 2026-05-26 and records Prisma/OpenSSL runtime lessons.
- `api-gateway/src/proxy/gateway-proxy.controller.ts` and `api-gateway/src/proxy/gateway-auth.guard.ts`: existing gateway/auth work from earlier Phase 5 tasks.
- Existing migration scripts under service folders:
  - `assessment-service/scripts/migrate-assessment-from-legacy.py`
  - `certification-service/scripts/migrate-certification-from-legacy.py`
  - `course-service/scripts/migrate-course-from-legacy.py`
  - `education-service/scripts/migrate-course-from-legacy.py`
  - `education-service/scripts/migrate-education-from-legacy.py`
  - `financial-service/scripts/migrate-financial-data.ts`
  - `notification-service/scripts/migrate-notification-data.ts`
  - `payment-service/scripts/migrate-payment-data.ts`

## Legacy Portal Evidence

- `BUSINESS.md`: legacy Django education portal for lesson management, teacher/student workflows, and lesson recording storage.
- `SYSTEM.md`: Django 1.11.2, Python 3.4, React 15.4.2, Redux, Webpack 2; dedicated legacy server; supervisord; MinIO lesson recordings.
- `TASKS.md`: open runtime verification items ISSUE-106 through ISSUE-109 for notification and merge flows.
- `requirements.txt`, `package.json`, `webpack.config.js`, `manage.py`, `portal/settings.py`, `portal/urls.py`, and `scripts/deploy.sh` define legacy runtime/build/deploy boundaries.
- Legacy app directories include:
  - Learning/course domains: `courses`, `education`, `course_materials`, `grammar`, `dictionary`, `phonetics`, `songs`, `books`, `seven`, `marathon`
  - Student/teacher/admin domains: `students`, `cabinet`, `administrator`, `employees`, `helpdesk`
  - Assessment/certification domains: `language_tests`, `user_tests`, `teacher_tests`, `education_certificates`, `certificates`
  - Payment/commercial domains: `orders`, `offers`, `products`, `discount`, `delivery`, `pricing`
  - Finance/salary domains: `expenses`, `investors`, `employees`
  - Communication domains: `notifications`, `ses`
  - Recording/private-media domain: `education/lesson_records`

## Conflicts And Gaps

- `speakasap-portal/SYSTEM.md` says no K8s migration is planned. Owner instruction from 2026-06-12 makes migration/refactoring active for this workstream, while preserving legacy compatibility constraints.
- `speakasap/TASKS.md` references `docs/refactoring/*` and `docs/agents/*` artifacts, but those directories currently contain no files in the checked-out repo.
- The internal RAG endpoint was not reachable from the remote shell during initial setup; repository evidence was used and recorded in `STATUS.md`.

## First Goal 2 Inventory Targets

1. Legacy URL and route inventory from `portal/urls.py`, app `urls.py` files, and API URL modules.
2. Legacy model inventory from `models.py` files, starting with `education/lesson_records`, `courses`, `education`, `orders`, `students`, `certificates`, and `notifications`.
3. Migration script review in the new services to identify already-migrated domains and missing dry-run/reconciliation behavior.
4. Gateway contract review in `api-gateway/src/proxy` and `frontend/lib/gateway.ts`.
