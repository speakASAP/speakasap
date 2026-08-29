# Claude Instructions

Shared rules live here:

- Claude profile: `/home/ssf/.claude/CLAUDE.md`
- Shared ecosystem instructions: `/home/ssf/Documents/Github/CLAUDE.md`
- Codex profile: `/home/ssf/.codex/AGENTS.md`
- Cross-agent standard: `/home/ssf/.ai-agent-standards/CROSS_AGENT_AUTOMATION_STANDARD.md`
- Repository operations: `AGENT_OPERATIONS.md`

Read those first, then follow the repository-specific notes below and the current planning/status files.


## Repository-Specific Notes

# CLAUDE.md (speakasap)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## Knowledge Retrieval

Use `docs-rag-microservice` for bounded discovery when it is healthy, then
verify deployment, security, database, integration and public-contract facts
against the cited Git source. Git remains authoritative.

Authority and fallback rules:
`/home/ssf/Documents/Github/shared/docs/DOCUMENTATION_AUTHORITY.md`.

Do not generate tokens in documentation or assume an unconfident/failed RAG
response means that source documentation does not exist.

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

**Ops**: `kubectl logs -n statex-apps -l app=speakasap -f` · `kubectl rollout restart deployment/speakasap -n statex-apps` · `../shared/scripts/deploy.sh speakasap` (never `./scripts/deploy.sh` — retired, built nothing)
