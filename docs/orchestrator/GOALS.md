# SpeakASAP Refactor Goal Backlog

Status values: `pending`, `active`, `done`, `blocked`.

> Live day-to-day state is in root `TASKS.md`, not in `STATUS.md` (whose last entry
> is 2026-06-24). This file holds chunk status; `TASKS.md` holds what is being
> worked on right now. Reconciled 2026-08-18.

> **Goals 1-8 are done, but cutover has not happened.** Goal 8 covers the
> controlled-cutover *validation*; the owner then chose legacy retention, so
> `speakasap.com` still serves the legacy Django portal on a separate host. Moving
> real traffic is Goal 11.

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
- Local implementation now adds `LessonRecord`/`LessonRecordPart` schema and a write-gated metadata migration that stores private object keys only; no object storage access or target DB write has run.

## Goal 5 - Lesson Recording And Private Media Migration

Status: done

Intent: Lesson recordings must remain private while moving storage references and access behavior.

Chunks:

- [x] 5.1 Confirm lesson-record target readiness after core education apply.
- [x] 5.2 Add target lesson-record schema and write-gated metadata/private key-reference migration.
- [x] 5.3 Run remote Prisma validation/build and capture fresh DB-backed no-write report.
- [x] 5.4 Run write-gated lesson-record metadata apply only after explicit owner approval.
- [x] 5.5 Verify delete, merge, playback, and download behaviors.
- [x] Add runtime checks for private access and failure modes.

Acceptance criteria:

- Recordings are never exposed through public permanent URLs.
- Presigned access has scoped expiry.
- Merge/delete flows have targeted verification.
- Existing ISSUE-106 through ISSUE-109 risks are accounted for.

## Goal 6 - Gateway, Auth, And Frontend Parity

Status: done

Intent: Users should reach migrated behavior through the new frontend and API gateway with role-appropriate access.

Chunks:

- [x] 6.1 Verify api-gateway proxy/auth guard behavior.
- [x] 6.2 Implement and verify frontend routes for selected migrated lesson-recording workflows.
- [x] 6.3 Add unauthorized and authorized checks for protected lesson-recording routes.
- [x] 6.4 Compare selected learner/teacher/staff parity cases against migrated gateway/runtime evidence.

Acceptance criteria:

- Gateway build passes for changed gateway code.
- Frontend build passes for changed frontend code.
- Unauthorized access is rejected.
- Parity cases are documented with old/new evidence.

## Goal 7 - Operational Cutover Readiness

Status: done

Intent: Cutover must be observable, reversible, and aligned with Kubernetes operations.

Chunks:

- [x] 7.1 Verify K8s manifests, secrets, health checks, logging, and smoke URLs for affected services.
- [x] 7.2 Add cutover checklist with DNS/nginx/ingress, rollback, database, object storage, and cache steps.
- [x] 7.3 Confirm Prisma OpenSSL 3.x runtime settings remain intact.
- [x] 7.4 Define smoke tests for the migrated workflows.

Acceptance criteria:

- Rollout and rollback commands are documented.
- Health and smoke checks cover all changed services.
- Logging reaches `logging-microservice` or an explicit fallback.
- Cutover is not approved until owner signs off.

## Goal 8 - Controlled Cutover And Legacy Decommission

Status: done

Intent: Legacy traffic and data should be retired only after verified parity and owner approval.

Chunks:

- [x] 8.1 Execute owner-approved controlled cutover validation plan.
- [x] 8.2 Monitor last-hour logs and workflow smoke tests.
- [x] 8.3 Keep rollback path available for the agreed window.
- [x] 8.4 Owner selected legacy retention as fallback/reference; no freeze/decommission executed.

Acceptance criteria:

- Owner approval is recorded.
- Smoke tests pass after cutover.
- Logs are checked for WARNING, ERROR, EXCEPTION classes relevant to migrated workflows.
- Legacy shutdown/freeze is documented and reversible until the rollback window closes.

## Goal 9 - Salary And Recording-Duration Payroll Migration

Status: active

Intent: Move salary workflows into the new platform while preserving legacy teacher payroll behavior that depends on lesson-recording duration, and keep payment execution behind the approved payments boundary.

Chunks:

- [x] 9.1 Inventory legacy salary behavior and source-to-target mapping for salary profiles, salary expenses, lesson salary expenses, support bonuses, contracts, and payout-related data.
- [x] 9.2 Define the education-service internal salary aggregate contract based on finished lessons and recording-derived duration.
- [x] 9.3 Harden salary migration dry-run/reconciliation reporting before any write mode.
- [x] 9.4 Implement recording-duration parity support without exposing private recording objects.
- [x] 9.5 Implement targeted demo salary parity and isolate remaining missing-duration, short-record, and teacher-mapping rows before enabling salary calculation runs.
- [ ] 9.6 Add write gates, rollback evidence, deploy/rerun evidence, and payment-boundary approval gates before any broader salary calculation or payout action.

Progress notes:

- Goal 9.5 is complete at scoped-smoke level: no-write readiness and short-record reconciliation isolated blockers, historical imported lesson salary quantities are preserved for the May 2026 preview, and owner-approved draft run `6576ac90-526e-47c6-8755-9631a4fb3149` created 14 draft lines with no payout or payment disbursement.
- Goal 9.6 remains active: the education-service fixed five-minute salary duration source change is verified by build/contract tests but is not deployed; runtime readiness and calculation preview must be rerun after owner-approved deploy before broader calculation enablement.
- **2026-08-18 gate update.** The salary aggregate reads the FROZEN `education_lesson`
  copy (182,600 rows, last start 2026-06-26), so lessons finished after that date are
  missing from teacher payout aggregation and the gap grows daily. The portal-side
  dependency is now **cleared**: `TeacherLessonsView` (`/lessons/by-teacher/`) is merged
  to portal `main` (`8dfed1f93a`) and confirmed present on the production portal host,
  so the "blocked on your deploy" note in `TASKS.md` is stale. `listLessonsByTeachers()`
  exists and is unit-tested in education-service. Outstanding: repoint
  `internal-salary.service.ts` to the client, then a 2026-05 parity check against the
  legacy `LessonSalaryExpense.qty` figures BEFORE any calculation run.

Acceptance criteria:

- Legacy lesson-recording fallback remains available until a later owner-approved retirement window.
- Recording-derived salary hours match legacy rules for selected parity cases, including demo/no-record/record-unavailable/fixed-five-minute-tolerance/cap/quantize behavior.
- Dry-run reports include source counts, target counts, duplicates, orphan profiles, orphan lesson references, missing auth/user/teacher mappings, and source/target sample IDs.
- `salary-service` consumes education aggregates through a documented internal contract and does not read private recording objects directly.
- Real payout execution does not bypass `payments-microservice` and requires explicit owner approval.
- No salary write, payout creation, payment execution, destructive operation, or legacy retirement runs without explicit owner approval and rollback evidence.

## Goal 10 - Seven-Lesson Course Frontend Migration

Status: paused

Intent: Move the legacy public seven-lesson course frontend and course content into the new SpeakASAP platform while preserving the learner-visible text style and keeping private progress, assessments, payments, and legacy retirement behind explicit later gates.

Chunks:

- [x] 10.0 Create the goal-driven migration plan and launch read-only sub-agents for legacy and target discovery.
- [x] 10.1 Add content-service seven-course schema and public API contract without writing migrated data.
- [x] 10.2 Add dry-run-first legacy seven content importer with reconciliation and rollback report output.
- [ ] 10.3 Run DB-backed no-write report for all seven-course lessons/templates/exercises and resolve blocking gaps.
- [ ] 10.4 Apply seven content migration only after explicit owner approval and rollback SQL generation.
- [x] 10.5 Build Next.js public course and lesson frontend using gateway-only data and preserved legacy typography.
- [ ] 10.6 Verify visual parity on desktop/mobile and deploy only after build, smoke, and rollback evidence.

Acceptance criteria:

- Legacy course/lesson order, titles, body HTML, exercises, answer templates, media references, and app material references are inventoried and reconciled.
- Target content data is service-owned by `content-service` and is reachable only through the API gateway from the frontend.
- On-screen lesson text preserves legacy readability: font family intent, font sizes, line-height, text color, heading styles, justified/hyphenated text, tables, and exercise controls.
- Dry-run reports include source counts, target counts, missing templates/assets, duplicates, source IDs, target IDs, and write status.
- No target DB write, deployment, destructive operation, or legacy route retirement runs without explicit owner approval and rollback evidence.
- Legacy `speakasap-portal` remains fallback/reference until a later cutover goal.

## Goal 11 - Legacy Retirement And Domain Cutover

Status: pending

Intent: Retire the legacy portal by moving real `speakasap.com` traffic to the new
platform, only after parity and payroll correctness are proven. This is the goal that
ends the cost of running two stacks.

Chunks:

- [ ] 11.1 Backfill the auth user migration. auth holds users only up to legacy id
      314012; ~113 portal users have no auth record. A rising `named_by_portal` counter
      in the roster log means the migration is falling further behind.
- [ ] 11.2 Drop the copied lesson tables and cross-database FKs (`TASKS.md` Task 10) —
      destructive, gated behind Tasks 1-9 merged and Task 11 verification passing.
- [ ] 11.3 Parity-sweep the remaining legacy surfaces against
      `PORTAL_SURFACE_INVENTORY.md`.
- [ ] 11.4 Move `speakasap.com` DNS/nginx to the new platform with the rollback window
      open.
- [ ] 11.5 Decommission the legacy portal after the rollback window closes.

Acceptance criteria:

- Goal 9 payroll parity passes before any traffic moves; teachers must not be paid from
  an unverified aggregate.
- Every legacy surface is migrated, deferred, or explicitly retired with owner sign-off.
- Rollback to the legacy host is available and tested for the whole window.
- No legacy data deletion until the rollback window has closed with owner approval.
