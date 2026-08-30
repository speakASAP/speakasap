# Business: SpeakASAP Platform

> Protected business baseline. Human approval is required before changes to the approved product scope.

```yaml
id: BUSINESS-speakasap
status: approved
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: validated
upstream:
  - docs/01_vision/VISION.md
  - docs/00_constitution/CONSTITUTION.md
downstream:
  - SYSTEM.md
  - docs/22_goal_impact/GOAL-IMPACT-TASK-001.md
```

## problem

SpeakASAP needs a modern, maintainable microservice platform for online language-learning education, replacing the legacy Django 1.11 portal, while preserving existing student, course, assessment, certification, and payment behavior without silently changing product intent.

## target users and stakeholders

- Language-learning students enrolled in courses
- Teachers assigning and grading drills, recording lessons, and receiving payroll
- Platform operators managing courses, certifications, and payments
- The legacy `speakasap-portal` (SSO handoff and behavior reference during migration)

## value proposition

SpeakASAP turns the legacy monolithic portal into an interconnected, independently deployable microservice platform, preserving course continuity, assessment/certification integrity, and payment correctness while enabling new features (e.g. drilling assignments) without destabilizing the live student base.

## goals

- Deliver online language education: courses, lessons, assessments, certifications, and payments
- Migrate legacy portal behavior deliberately, with intent preservation and rollback evidence for every migration chunk
- Support teacher-assigned and self-serve grammar drills across content, education, notification, and AI services
- Keep student data private and GDPR-compliant
- Process payments exclusively through `payments-microservice`

## non-goals

- Rebuilding the legacy Django portal itself (it remains SSH read-only, never migrating as an app server)
- General e-commerce catalog/order/warehouse/invoice functionality unrelated to education
- Payment processing outside `payments-microservice`
- Exposing drill answers or alternatives to the browser (hard invariant)

## success metrics

- Course completion rate
- Certification pass rate
- Monthly active learners
- Successful migration chunks with recorded intent-preservation evidence and no data loss

## business constraints

- Payment processing via `payments-microservice` only
- Student data is private and must remain GDPR compliant
- Drill runner responses must never include `answer` or `alternatives` keys
- Escalation contact: owner Telegram @sergej_partizan

## approval

Status: approved
Approved by: project owner
Approval evidence: owner-confirmation: speakasap-onboarding-approved
