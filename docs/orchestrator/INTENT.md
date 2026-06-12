# SpeakASAP Intent Preservation

## Original Intent

SpeakASAP is an online language education platform. It must let students learn through courses and lessons, let teachers and staff manage education workflows, preserve lesson recordings securely, assess and certify progress, collect payments through the approved payment boundary, and communicate with learners through approved notification channels.

## Refactor Intent

Move the legacy `speakasap-portal` behavior into the new `speakasap` microservice platform without losing product behavior, private data guarantees, or service ownership boundaries. The legacy portal is the reference for behavior until a migrated capability has parity evidence.

## Intent Preservation Rules

1. Student privacy is primary. Student profile data, lesson records, recordings, assessment results, certificates, payment history, and notification history must remain protected.
2. Legacy behavior is evidence. Do not remove, reinterpret, or simplify a legacy workflow until it is inventoried and either migrated, intentionally retired by owner approval, or explicitly deferred.
3. Service ownership is stable. Auth, payments, notifications, storage, logging, and database infrastructure must remain in their owning services.
4. SpeakASAP service databases are bounded by domain. Course, education, assessment, certification, user, payment, notification, salary, and financial data must not be collapsed into an unowned shared schema.
5. Recording access remains private. Lesson recordings must use controlled object references or presigned access, never public buckets or permanent exposed URLs.
6. Migration must be reversible until cutover. Data migrations need dry-run/reconciliation output before destructive changes or legacy shutdown.
7. The API gateway is the contract layer. Frontend and external callers should move through documented gateway contracts rather than ad hoc service calls.
8. Every implementation goal must preserve these boundaries and record evidence.

## Drift Checks

Before any change, ask:

- Does this preserve the student/teacher learning workflow that the legacy portal supports?
- Does this move ownership into the correct SpeakASAP service instead of creating a shortcut?
- Does this bypass auth, payments, notifications, MinIO privacy, or logging boundaries?
- Does this preserve existing public/user-facing behavior unless a goal explicitly changes it?
- Can this change be verified, rolled back, or reconciled before cutover?
- Is the next step still a single goal chunk instead of an uncontrolled rewrite?
