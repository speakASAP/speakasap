# CLAUDE.md (speakasap)

Ecosystem defaults: sibling [`../CLAUDE.md`](../CLAUDE.md) and [`../shared/docs/PROJECT_AGENT_DOCS_STANDARD.md`](../shared/docs/PROJECT_AGENT_DOCS_STANDARD.md).

Read this repo's `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json` first.

---

## speakasap

**Purpose**: Online education platform for language learning — courses, assessments, certifications, and payments. Currently in refactoring state from legacy speakasap-portal.
**Ports**: 42xx range (multiple NestJS microservices)  
**Stack**: NestJS microservices · PostgreSQL · Redis

### Key constraints
- Payment processing via payments-microservice only — never directly
- Student data is private — GDPR compliant; no export without explicit approval
- Internal microservices: content, certification, assessment, course, education, user, payment, notification, API gateway

### Key integrations
| Service | Usage |
|---------|-------|
| auth-microservice:3370 | User auth |
| payments-microservice:3468 | Course payments |
| notifications-microservice:3368 | Student emails |

### Quick ops
```bash
docker compose logs -f
./scripts/deploy.sh
```
