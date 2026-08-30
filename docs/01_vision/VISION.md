# Vision: SpeakASAP Platform

> Protected intent baseline. Human approval is required before changes to the approved project direction.

```yaml
id: VISION-speakasap
status: approved
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: validated
upstream:
  - ../00_constitution/CONSTITUTION.md
downstream:
  - ../../BUSINESS.md
  - ../17_governance/PROJECT_INVARIANTS.md
  - ../22_goal_impact/GOAL-IMPACT-TASK-001.md
```

## one-sentence vision

Deliver a trustworthy, maintainable microservice platform for online language-learning education that preserves every legacy behavior it replaces.

## problem statement

The legacy Django 1.11 portal cannot scale or evolve safely. SpeakASAP must migrate education, assessment, certification, payment, and payroll behavior to a new microservice platform without silently changing product intent or losing student/teacher trust.

## target users

- Language-learning students
- Teachers assigning drills, recording lessons, and receiving payroll
- Platform operators and course administrators

## core user need

Students and teachers need continuous, correct course, assessment, certification, payment, and payroll behavior throughout the migration from the legacy portal to the new platform.

## key outcomes

- All education services running independently on Kubernetes with per-service databases
- Migration chunks carry recorded intent-preservation and rollback evidence
- Drilling assignments live in production without leaking answers to the browser
- Payments remain correctly delegated to payments-microservice

## non-goals

- Rebuilding or extending the legacy Django portal itself
- General e-commerce functionality unrelated to education
- Silent, unverified migration of legacy behavior

## success criteria

- Course completion, certification pass rate, and active-learner metrics remain stable or improve through migration
- No student data loss or GDPR violation during migration
- Every migrated legacy behavior has recorded verification and rollback evidence

## approval

Status: approved
Approved by: project owner
Approval evidence: owner-confirmation: speakasap-onboarding-approved
