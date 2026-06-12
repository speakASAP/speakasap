# SpeakASAP Orchestrator Master Prompt

You are working on `speakasap`, the new Alpharis/SpeakASAP microservice platform that is absorbing behavior from the legacy `speakasap-portal` application.

## Preserved Intent

SpeakASAP exists to run online language education: courses, lesson materials, teacher/student workflows, lesson recordings, assessments, certifications, notifications, and payments. The refactor must preserve user-visible learning behavior and private student data while moving legacy portal capabilities into the new service architecture deliberately and verifiably.

## Non-Negotiable Boundaries

- `speakasap-portal` is the legacy behavior reference until a goal explicitly migrates and verifies a capability.
- `speakasap` owns the new microservice implementation and Kubernetes deployment manifests.
- `auth-microservice` owns login, JWT validation, identity, roles, and service identity.
- `payments-microservice` owns external payment processing. SpeakASAP payment-service may store SpeakASAP payment domain data but must not bypass payments ownership.
- `minio-microservice` owns object storage. Lesson recordings stay private and must be accessed through controlled/presigned paths.
- `notifications-microservice` owns cross-platform notification delivery. SpeakASAP notification-service owns SpeakASAP-specific notification data and orchestration.
- `database-server` owns PostgreSQL/Redis infrastructure. Service databases remain service-owned.
- Student data, lesson records, recordings, assessments, and certifications are private and GDPR-sensitive.
- No destructive migration, hard delete, or legacy data retirement is allowed without explicit owner approval and rollback evidence.
- Do not upgrade Django, Python, React, or Webpack in the legacy portal unless the owner explicitly approves a compatibility-breaking modernization goal.

## Required Workflow For Every Session

1. Read `BUSINESS.md`, `SYSTEM.md`, `docs/orchestrator/INTENT.md`, `docs/orchestrator/GOALS.md`, `docs/orchestrator/PLAN.md`, `docs/orchestrator/STATUS.md`, `TASKS.md`, and `STATE.json`.
2. Query the RAG service when reachable; if unavailable, continue from repository evidence and record the fallback.
3. Identify the earliest unfinished goal/chunk in `docs/orchestrator/GOALS.md` unless the owner explicitly selects another goal.
4. Restate the preserved intent and ownership boundary affected by the selected goal.
5. Implement only the smallest complete chunk that satisfies the selected acceptance criteria.
6. Run the selected verification commands or document why they could not run.
7. Append evidence to `docs/orchestrator/STATUS.md`.
8. End owner-facing reports with a clear `The next step is ...` sentence.

## Completion Standard

A goal or chunk is complete only when:

- Its acceptance criteria are met by code, docs, tests, runtime checks, or explicit investigation evidence.
- Evidence is recorded in `docs/orchestrator/STATUS.md`.
- Changed services build or have a documented reason why build verification was not applicable.
- Any protected behavior has a direct verification note.
- The next goal remains clear and small enough for one focused Codex session.
