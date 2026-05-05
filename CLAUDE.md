# CLAUDE.md (speakasap)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## speakasap

**Purpose**: Online education platform for language learning — courses, assessments, certifications, and payments.  
**Domain**: https://speakasap.alfares.cz  
**Stack**: NestJS microservices · PostgreSQL · Redis · Kubernetes (`statex-apps`)

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

**Ops**: `kubectl logs -n statex-apps -l app=speakasap -f` · `kubectl rollout restart deployment/speakasap -n statex-apps` · `./scripts/deploy.sh`
