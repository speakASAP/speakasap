# SpeakASAP Refactor Goal Backlog

Status values: `pending`, `active`, `done`, `blocked`.

## Goal 1 - Intent Preservation And Refactor Governance

Status: done

Intent: SpeakASAP refactoring must follow a local intent-preservation system before implementation work begins.

Chunks:

- [x] 1.1 Create local orchestrator pack and owner-facing communication rule.
- [x] 1.2 Verify repository inventory and confirm which repo is authoritative for migration work.
- [x] 1.3 Create a current migration evidence index from available legacy/new-platform docs.
- [x] 1.4 Record the first executable migration target after owner review.

Acceptance criteria:

- `docs/orchestrator/MASTER_PROMPT.md`, `INTENT.md`, `GOALS.md`, `PLAN.md`, `PROMPTS.md`, and `STATUS.md` exist.
- Root `AGENTS.md` requires future agents to follow the orchestrator pack.
- Root `PLAN.md` points to this refactoring roadmap.
- Status evidence records RAG availability/fallback and the source files used.
- `docs/orchestrator/MIGRATION_EVIDENCE.md` records current repo boundaries and first inventory evidence.
- `docs/orchestrator/FIRST_MIGRATION_TARGET.md` names the first executable target with owner, service, data, auth, storage, rollback, and verification boundaries.

## Goal 2 - Legacy Portal Inventory And Parity Map

Status: done

Intent: The legacy portal must be understood as the behavior reference before migration changes are made.

Chunks:

- [x] Inventory the selected lesson-recording workflow: Django models, URL routes, upload/commit/playback paths, merge task, storage, and current new-platform gap.
- [x] Inventory remaining Django apps, URL routes, Celery jobs, management commands, templates, React bundles, static assets, and deployment scripts in `speakasap-portal`.
- [x] Map user roles and workflows: student, teacher, staff/admin, finance/salary, assessment/certification.
- [x] Identify current log/backlog issues that could affect migration parity.
- [x] Produce a parity matrix with `migrate`, `defer`, `retire`, or `reference-only` decisions.

Acceptance criteria:

- Each major legacy capability has a target service or an explicit deferred/retired decision.
- Python 3.4 / Django 1.11.2 constraints are preserved for any legacy-side checks.
- Lesson recording flows and private media paths are identified.
- Evidence is recorded without changing production code.
- `docs/orchestrator/PORTAL_SURFACE_INVENTORY.md` records domain-level surface inventory and parity decisions.

## Goal 3 - Service Ownership And API Contract Mapping

Status: done

Intent: Legacy behavior must land in the correct microservice and be exposed through stable contracts.

Chunks:

- [x] 3.1 Define the lesson recording service/gateway/auth/storage/notification contract.
- [x] 3.2 Reconstruct or recreate missing refactoring artifacts referenced in `TASKS.md`, including gateway ownership and API contract docs.
- [x] 3.3 Map remaining portal routes/workflows to `content`, `course`, `education`, `assessment`, `certification`, `user`, `payment`, `notification`, `salary`, `financial`, `api-gateway`, and `frontend`.
- [x] 3.4 Identify auth/RBAC requirements for remaining route groups.

Acceptance criteria:

- Every selected workflow has an owning service and gateway contract.
- No contract bypasses `auth-microservice` or `payments-microservice`.
- Frontend callers use gateway-facing contracts.
- Build or static verification commands are listed for affected services.
- `docs/orchestrator/LESSON_RECORDING_CONTRACT.md` defines the first selected workflow contract.
- `docs/refactoring/GATEWAY_ROUTE_OWNERSHIP_MATRIX.md`, `GATEWAY_API_CONTRACT.md`, and `GATEWAY_AUTH_BOUNDARY.md` exist and cite current gateway routing/auth sources.
- `docs/orchestrator/WORKFLOW_OWNERSHIP_MAP.md` and `AUTH_RBAC_MATRIX.md` cover remaining route groups at planning level.

## Goal 4 - Data Migration And Reconciliation

Status: active

Intent: Legacy data must move into service-owned databases with dry-run, reconciliation, and rollback evidence.

Chunks:

- [x] 4.1 Design lesson-recording migration dry-run/reconciliation.
- [x] 4.2 Add lesson-recording dry-run script with report output.
- [x] 4.3 Inventory remaining existing migration scripts and Prisma schemas.
- [x] 4.4 Define source-to-target mapping for course, education, user, assessment, certification, payment, salary, financial, notification, and content records.
- [x] 4.5 Add dry-run/reconciliation reports before writes for selected migrations.
- [x] 4.6 Add idempotency keys or duplicate guards where migration can be rerun.
- [x] 4.7 Capture DB-backed dry-run reports from education, user, course, and lesson-record migrations when the legacy source database endpoint is reachable.
- [x] 4.8 Resolve auth identity reconciliation/bootstrap prerequisite before any user/profile write migration.
- [x] 4.9 Get owner approval for auth bootstrap duplicate-email and password policy, then implement only inside `auth-microservice`.
- [x] 4.10 Review auth bootstrap dry-run evidence and implement write-gated apply/rollback path only after explicit write approval.
- [x] 4.11 Re-run and harden user/profile migration against auth-owned `legacy_identity_mappings`.
- [x] 4.12 Review user/profile dry-run evidence and run write-gated user-service apply only after explicit owner approval.
- [x] 4.13 Standardize education/course write gates and capture final pre-apply dry-runs.

Acceptance criteria:

- Dry-run output names source IDs, target IDs, counts, missing fields, and conflicts.
- No destructive change runs without owner approval.
- Service database ownership remains intact.
- Reconciliation is repeatable after deployment.
- `docs/orchestrator/LESSON_RECORDING_MIGRATION_DESIGN.md` defines dry-run-first lesson-record migration.
- `education-service/scripts/migrate-lesson-records-from-legacy.py` exists and supports read-only dry-run reporting.
- `docs/orchestrator/MIGRATION_SCRIPT_INVENTORY.md` records existing migration scripts, Prisma schemas, dry-run quality, write safety, and next mapping priority.
- `docs/orchestrator/SOURCE_TARGET_MAPPING.md` maps source tables, target models, identifier strategy, orphan handling, and reconciliation checks for the remaining migration domains.
- `education-service/scripts/migrate-education-from-legacy.py` and `course-service/scripts/migrate-course-from-legacy.py` refuse write-mode reruns when target preserved IDs or composite keys already exist, unless the owner-approved truncation path is explicitly selected.
- DB-backed dry-run reports were captured under `/tmp/speakasap-*-dry-run.json` on `alfares`; no writes were performed.
- User/profile migration remains gated by auth identity mapping because the target auth index currently resolves only a small subset of legacy portal users.
- `docs/orchestrator/AUTH_IDENTITY_RECONCILIATION.md` records the Goal 4.8 decision: auth bootstrap is required, email-only mapping is unsafe, and no user-service write migration may run before owner-approved auth-owned mapping exists.
- `docs/orchestrator/AUTH_BOOTSTRAP_OWNER_DECISION.md` records the Goal 4.9 approval request and recommended auth-owned mapping/password policy.
- `docs/orchestrator/AUTH_BOOTSTRAP_IMPLEMENTATION_PLAN.md` records the post-approval implementation boundary, proposed mapping schema, dry-run script contract, verification sequence, and rollback boundary.
- `docs/orchestrator/AUTH_BOOTSTRAP_DRY_RUN_REPORT.md` records the auth-owned dry-run implementation, report path, build verification, and `writes=false` evidence.
- `docs/orchestrator/AUTH_BOOTSTRAP_APPLY_GATE.md` records the gated apply implementation, rollback SQL path, latest dry-run evidence, and remaining pre-apply steps.
- Auth bootstrap was applied after explicit owner approval: `214230` legacy users mapped, `214224` auth users created, `192` duplicate-email identities preserved as separate null-email auth users, and the auth deployment health check passed after rollout.
- User/profile migration now resolves auth UUIDs from `legacy_identity_mappings`; dry-run report `/tmp/speakasap-user-dry-run-auth-mapping-v3.json` showed `auth_mapping_size=214230`, unresolved auth counts `0`, target user-service tables empty, and target conflicts `0`.
- User/profile migration was applied after the write gate: `/tmp/speakasap-user-profile-apply-v1.json` recorded `writes=true`, `user_identity_mirror=214231`, `students=214189`, `teachers=380`, `managers=3`, `employee_profiles=8`, and `teacher_additional_languages=80`; post-apply dry-run `/tmp/speakasap-user-dry-run-post-apply-v1.json` recorded unresolved auth counts `0`.
- Restored final user/profile pre-apply evidence: `/tmp/speakasap-user-dry-run-auth-mapping-v6.json` recorded `writes=false`, `auth_mapping_size=214231`, unresolved auth counts `0`, missing references `0`, target user-service counts `0`, target ID conflicts `0`, and target auth UUID conflicts `0`; the historical apply approval is not reusable for future user-service writes.
- Education and course migrations now refuse default writes and require `--apply --confirm-write --approval-note ... --rollback-plan ...` before write mode.
- Course migration was applied with rollback evidence: target counts now match source counts for categories, products, part-payment tables, extra lesson offers, and offers.
- Education migration was applied with rollback evidence: target counts now match source counts for groups, group-student links, student courses, lessons, and homework.
- Lesson-record dry-run after education apply shows `missing_target_lessons=0`; remaining issues are legacy media/key reconciliation (`parts_missing_rows=4080`, `orphan_parts=5781`, `legacy_prefix_keys_without_date=25934`, `record_key_date_mismatch=39477`).

## Goal 5 - Lesson Recording And Private Media Migration

Status: active

Intent: Lesson recordings must remain private while moving storage references and access behavior.

Chunks:

- Inventory legacy recording models, MinIO/S3 settings, and presigned URL usage.
- Define target object key/reference model.
- Verify delete, merge, playback, and download behaviors.
- Add runtime checks for private access and failure modes.

Acceptance criteria:

- Recordings are never exposed through public permanent URLs.
- Presigned access has scoped expiry.
- Merge/delete flows have targeted verification.
- Existing ISSUE-106 through ISSUE-109 risks are accounted for.

## Goal 6 - Gateway, Auth, And Frontend Parity

Status: pending

Intent: Users should reach migrated behavior through the new frontend and API gateway with role-appropriate access.

Chunks:

- Verify api-gateway proxy/auth guard behavior.
- Implement or verify frontend routes for selected migrated workflows.
- Add unauthorized/authorized checks for protected routes.
- Compare legacy and new responses for selected parity cases.

Acceptance criteria:

- Gateway build passes for changed gateway code.
- Frontend build passes for changed frontend code.
- Unauthorized access is rejected.
- Parity cases are documented with old/new evidence.

## Goal 7 - Operational Cutover Readiness

Status: pending

Intent: Cutover must be observable, reversible, and aligned with Kubernetes operations.

Chunks:

- Verify K8s manifests, secrets, health checks, logging, and smoke URLs for affected services.
- Add cutover checklist with DNS/nginx/ingress, rollback, database, object storage, and cache steps.
- Confirm Prisma OpenSSL 3.x runtime settings remain intact.
- Define smoke tests for the migrated workflows.

Acceptance criteria:

- Rollout and rollback commands are documented.
- Health and smoke checks cover all changed services.
- Logging reaches `logging-microservice` or an explicit fallback.
- Cutover is not approved until owner signs off.

## Goal 8 - Controlled Cutover And Legacy Decommission

Status: pending

Intent: Legacy traffic and data should be retired only after verified parity and owner approval.

Chunks:

- Execute owner-approved cutover plan.
- Monitor last-hour logs and workflow smoke tests.
- Keep rollback path available for the agreed window.
- Decommission or freeze legacy paths only after evidence is clean.

Acceptance criteria:

- Owner approval is recorded.
- Smoke tests pass after cutover.
- Logs are checked for WARNING, ERROR, EXCEPTION classes relevant to migrated workflows.
- Legacy shutdown/freeze is documented and reversible until the rollback window closes.
