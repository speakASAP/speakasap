# System: SpeakASAP Platform

```yaml
id: SYSTEM-speakasap
status: approved
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: validated
upstream:
  - BUSINESS.md
  - docs/01_vision/VISION.md
downstream:
  - docs/06_architecture/INTEGRATION_CONTRACT.md
  - docs/11_tasks/TASK-001-bootstrap-service.md
```

## purpose

SpeakASAP is the production NestJS/Next.js microservice platform delivering online language-learning education: content, assessments, certifications, courses, education workflows (including drilling assignments), user accounts, payments, notifications, and teacher payroll.

## responsibilities

- Own course, lesson, content, and vocabulary data (content-service)
- Own assessment and certification workflows and records (assessment-service, certification-service)
- Own course/education workflows, drill assignments, grading, and AI-orchestrated drill generation/validation (course-service, education-service)
- Own student/user account data (user-service)
- Coordinate course payments via payments-microservice (payment-service)
- Compute teacher salary and recording-duration payroll (salary-service, financial-service)
- Dispatch student/teacher notifications (notification-service)
- Expose a single API surface (api-gateway) and web UI (frontend)

## non-responsibilities

- It does not process payments directly; it delegates to payments-microservice
- It does not own identity/auth issuance; auth-microservice validates JWTs
- It is not the legacy Django portal and does not replace its read-only production role during migration
- It does not fabricate migration completion evidence; every legacy-behavior migration chunk requires intent-preservation evidence

## inputs

- Student and teacher account actions via api-gateway/frontend
- Legacy portal SSO handoff data during migration
- Course, lesson, and drill content authored by staff
- Payment events from payments-microservice
- Teacher lesson recordings uploaded to MinIO-backed storage (education-service)

## outputs

- Course, assessment, and certification records per student
- Payment requests to payments-microservice
- Teacher salary/payroll calculations
- Student/teacher notifications (email/Telegram/WhatsApp)
- Structured logs to logging-microservice

## dependencies

- PostgreSQL per-service databases (speakasap_*_db) via database-server:5432
- Shared Redis cache via database-server:6379
- auth-microservice:3370 for JWT validation
- logging-microservice:3367 for centralized logs
- notifications-microservice:3368 for student/teacher notifications
- payments-microservice:3468 for course payments
- ai-microservice:3380 for AI content and drill generation/validation features
- minio-microservice for lesson-recording object storage (education-service `storage.service.ts`)
- backups-microservice for per-database backups

## upstream traceability

This system implements the approved intent in `BUSINESS.md` and the product vision in `docs/01_vision/VISION.md`.

## downstream artifacts

- `docs/06_architecture/INTEGRATION_CONTRACT.md`
- `docs/11_tasks/TASK-001-bootstrap-service.md`
- `docs/12_validation/VAL-TASK-001-bootstrap-service.md`
- `docs/21_execution_plans/EP-TASK-001-bootstrap-service.md`

## validation criteria

- Service health passes `GET /health` for every deployed service
- Drill runner responses never leak `answer`/`alternatives` (hard invariant, enforced by contract tests)
- Migration chunks carry recorded intent-preservation evidence in `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md`
- Per-service Jest suites pass for changed services

## open questions

- The current migration cadence follows goal-by-goal orchestrator planning (docs/orchestrator/GOALS.md); no fixed calendar completion date for the full legacy-portal migration is recorded in this repository.
