# Project Invariants: SpeakASAP Platform

```yaml
id: PROJECT-INVARIANTS-speakasap
status: approved
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: validated
upstream:
  - BUSINESS.md
  - SYSTEM.md
  - docs/01_vision/VISION.md
downstream:
  - docs/01_vision/VISION.md
  - docs/12_validation/VAL-TASK-001-bootstrap-service.md
```

## purpose

These invariants protect SpeakASAP's education-platform intent and the legacy-to-new migration from silent behavior changes.

## applicability

These invariants apply to all migration chunks, drill runner logic, payment delegation, and any change touching student/teacher data or course continuity.

## invariants

- SA-INV-001: Drill runner responses must never include an `answer` or `alternatives` key.
- SA-INV-002: Course payments must be processed only via payments-microservice, never directly.
- SA-INV-003: Table renames in content-service/education-service require hand-written `ALTER TABLE RENAME` migrations, never `prisma migrate diff` renders.
- SA-INV-004: Every legacy-portal migration chunk requires recorded intent-preservation evidence (context, legacy evidence, dry-run/reconciliation, verification, approval, rollback) before commit.
- SA-INV-005: Student data must remain GDPR-compliant and private.

## exceptions

Exceptions to these invariants require explicit owner approval and must be documented in the affected task or validation record.

## review cadence

Review project invariants when entering a materially new scope, a deployment readiness gate, or a workflow change that affects operator trust or production safety.
