# SpeakASAP Refactor Implementation Plan

## Execution Rule

Work one goal chunk at a time. Prefer a complete, verifiable chunk over starting multiple migration tracks. The earliest unfinished chunk in `GOALS.md` is the default next target unless the owner explicitly selects another.

## Active Goal

Goal 4 - Data Migration And Reconciliation.

### Chunk 1.1 - Orchestrator Pack

Deliverables:

- `MASTER_PROMPT.md`
- `INTENT.md`
- `GOALS.md`
- `PLAN.md`
- `PROMPTS.md`
- `STATUS.md`
- Root `AGENTS.md` reference to these files
- Root `PLAN.md` refactoring roadmap

Verification:

- Files exist in `docs/orchestrator/`.
- Root `AGENTS.md` tells future agents to follow the orchestrator pack.
- Root `PLAN.md` names the active refactor phase.

### Chunk 1.2 - Repository Inventory Confirmation

Deliverables:

- Confirm authoritative repositories:
  - `/home/ssf/Documents/Github/speakasap`
  - `/home/ssf/Documents/Github/speakasap-portal`
- Record legacy/current system constraints and conflicts.
- Record whether RAG retrieval is available.

Verification:

- `git status --porcelain=v1` in both repos.
- `find`/`rg` evidence for orchestrator and refactoring docs.
- Status note captures stale/missing docs and owner instruction override.

### Chunk 1.3 - Migration Evidence Index

Deliverables:

- Index available docs, scripts, schemas, routes, services, and migration scripts.
- Identify missing historical artifacts referenced by `TASKS.md`.
- Create a starting evidence list for Goal 2.

Verification:

- Evidence index names exact files and repos.
- No production code is changed.

### Chunk 1.4 - First Executable Migration Target

Deliverables:

- Propose the first narrow workflow to migrate or verify.
- Define acceptance criteria and verification commands.
- Ask owner to approve or redirect before code changes.

Verification:

- Target workflow has owner, target service, data boundary, auth boundary, and rollback note.

## Active Goal 2

Goal 2 - Legacy Portal Inventory And Parity Map.

### Chunk 2.1 - Lesson Recording Workflow Inventory

Deliverables:

- `FIRST_MIGRATION_TARGET.md` selects the first executable migration target.
- `LESSON_RECORDING_INVENTORY.md` inventories legacy lesson-recording routes, models, API surfaces, merge jobs, playback, storage, notifications, tests, and new-platform gaps.
- Goal 2 backlog reflects that the selected workflow inventory has started.

Verification:

- Legacy files are named exactly enough for follow-up work.
- New-platform gap is backed by repository search and service schema review.
- No production code changes are made.

### Chunk 2.2 - Remaining Portal Surface Inventory

Deliverables:

- Inventory remaining Django apps, routes, Celery jobs, management commands, templates, React bundles, static assets, and deploy scripts.
- Categorize each surface as `migrate`, `defer`, `retire`, or `reference-only`.

Verification:

- Parity matrix exists and covers each major legacy domain.

## Active Goal 3

Goal 3 - Service Ownership And API Contract Mapping.

### Chunk 3.1 - Lesson Recording Service Contract

Deliverables:

- Define target `education-service` Prisma model changes for lesson recordings and parts.
- Define gateway routes for presign, commit, playback, and state reads.
- Define auth/RBAC checks for teacher, student, and manager/admin access.
- Define MinIO object-key and private playback contract.
- Define notification event contract for record-ready/lesson-finished behavior.

Verification:

- Contract references legacy parity evidence from `LESSON_RECORDING_INVENTORY.md`.
- Contract does not bypass `auth-microservice`, `minio-microservice`, or `notifications-microservice`.
- Contract identifies build/test commands for implementation chunks.

Status: done. See `LESSON_RECORDING_CONTRACT.md`.

### Chunk 3.2 - Missing Gateway/Refactor Artifacts

Deliverables:

- Recreate `docs/refactoring/GATEWAY_ROUTE_OWNERSHIP_MATRIX.md` or an equivalent orchestrator-owned route matrix.
- Recreate `docs/refactoring/GATEWAY_API_CONTRACT.md` or an equivalent gateway contract index.
- Link the lesson-recording contract into the route matrix.

Verification:

- Files or replacement docs exist and cite current `api-gateway/src/proxy/upstream-resolve.ts`.
- Missing historical docs referenced in `TASKS.md` are no longer blocking future work.

Status: done. Recreated `docs/refactoring/GATEWAY_ROUTE_OWNERSHIP_MATRIX.md`, `GATEWAY_API_CONTRACT.md`, and `GATEWAY_AUTH_BOUNDARY.md`.

### Chunk 3.3 - Remaining Route Ownership Mapping

Deliverables:

- Create an orchestrator route-to-service map for remaining legacy portal workflows using `PORTAL_SURFACE_INVENTORY.md`.
- Separate `migrate`, `defer`, `retire`, and `reference-only` routes.
- Identify any workflow whose owner is ambiguous.

Verification:

- The map covers every major legacy role/workflow group from Goal 2.

Status: done. See `WORKFLOW_OWNERSHIP_MAP.md`.

### Chunk 3.4 - Remaining Auth/RBAC Mapping

Deliverables:

- Create auth/RBAC matrix for remaining route groups: anonymous, student, teacher, manager, staff/admin, internal, webhook.
- Identify routes that require owner approval before implementation due to payment, private data, or destructive operations.

Verification:

- No route group lacks an auth mode or target owner.

Status: done. See `AUTH_RBAC_MATRIX.md`.

## Active Goal 4

Goal 4 - Data Migration And Reconciliation.

### Chunk 4.1 - Lesson Recording Migration Design

Deliverables:

- Define dry-run/reconciliation plan for legacy `education_lessonrecord` and `education_lessonrecordpart`.
- Map legacy rows and object keys to new `education-service` schema.
- Define conflict, missing object, duplicate, and rollback reporting.

Verification:

- Migration design cites legacy schema and new lesson-recording contract.
- No destructive writes or object deletion are allowed.

Status: done. See `LESSON_RECORDING_MIGRATION_DESIGN.md`.

### Chunk 4.2 - Lesson Recording Dry-Run Script

Deliverables:

- Add `education-service/scripts/migrate-lesson-records-from-legacy.py`.
- Implement `--dry-run`, `--check-target`, `--limit`, and `--json-report`.
- Output counts and exact conflict IDs from `LESSON_RECORDING_MIGRATION_DESIGN.md`.
- Do not implement writes or object deletion.

Verification:

- Script help runs.
- Script can fail cleanly when env URLs are absent.
- If DB URLs are available, dry-run produces source/target counts without writes.

Status: done. Script added in read-only mode only.

### Chunk 4.3 - Remaining Migration Script Inventory

Deliverables:

- Inventory existing migration scripts across SpeakASAP services.
- Identify which scripts already have dry-run/reconciliation and which need hardening.
- Prioritize next migration target after lesson recordings.

Verification:

- Inventory names exact script files and current safety gaps.

Status: done. See `MIGRATION_SCRIPT_INVENTORY.md`.

### Chunk 4.4 - Remaining Source-To-Target Mapping

Deliverables:

- Define source-to-target mappings for course, education, user, assessment, certification, payment, salary, financial, notification, and content records.
- Start with education, user, and course because lesson-recording parity depends on target lessons and participant role data.
- Record legacy source tables, target Prisma models, target ID strategy, required joins, orphan handling, and reconciliation checks.

Verification:

- Every mapped domain names source tables and target models.
- Destructive options remain out of scope unless owner approval is recorded.
- The selected lesson-recording dependency chain has enough mapping detail to harden dry-run reports.

Status: done. See `SOURCE_TARGET_MAPPING.md`.

### Chunk 4.5 - Dry-Run And Reconciliation Hardening

Deliverables:

- Harden selected migration scripts so dry runs emit row-level reconciliation reports before any write path is used.
- Start with `education-service/scripts/migrate-education-from-legacy.py`, then `user-service/scripts/migrate-user-from-legacy.py`, then `course-service/scripts/migrate-course-from-legacy.py`.
- Add or document checks for source IDs, target IDs, missing FK endpoints, duplicate keys, skipped rows, and affected rows for any scoped replacement.

Verification:

- Script help and no-env failure paths still work.
- Dry run remains no-write.
- Reconciliation output is stable enough to paste into `STATUS.md`.

Status: done. `education-service/scripts/migrate-education-from-legacy.py`, `user-service/scripts/migrate-user-from-legacy.py`, and `course-service/scripts/migrate-course-from-legacy.py` are hardened and verified at code/safety-gate level. DB-backed dry-run output still requires runtime database URLs.

### Chunk 4.6 - Idempotency And Duplicate Guards

Deliverables:

- Add duplicate guards or idempotent write behavior for migrations that currently use plain inserts.
- Start with `education-service/scripts/migrate-education-from-legacy.py` and `course-service/scripts/migrate-course-from-legacy.py`.
- Preserve service database ownership and keep destructive truncation opt-in only.

Verification:

- Scripts compile.
- Rerun behavior is documented.
- Any write-mode idempotency policy is explicit: upsert, skip duplicate, or fail with conflict report.

Status: done. Education and course write mode now use explicit `conflict_policy=fail` target preflight before plain inserts.

### Chunk 4.7 - DB-Backed Dry-Run Capture

Deliverables:

- Run education, user, course, and lesson-record dry-run reports against actual source and target databases.
- Store or summarize counts, missing references, duplicate keys, and target conflicts without exposing secrets.
- Keep reports read-only.

Verification:

- Legacy source DB endpoint is reachable.
- Dry-run commands complete without writes.
- Status records report locations or summarized counts.

Status: done. Captured DB-backed dry-run reports under `/tmp/speakasap-education-dry-run.json`, `/tmp/speakasap-course-dry-run.json`, `/tmp/speakasap-user-dry-run.json`, and `/tmp/speakasap-lesson-records-dry-run.json` on `alfares`.

### Chunk 4.8 - Auth Identity Reconciliation

Deliverables:

- Determine whether target `auth-microservice` should be bootstrapped from legacy `auth_user` before user-service profile migration.
- Define the exact identity mapping contract from legacy `auth_user.id` and email to target auth UUID.
- Add or identify a dry-run report that explains unresolved identities before any write path.
- Preserve `auth-microservice` ownership; user-service must not invent auth identities outside the approved auth path.

Verification:

- The target auth index size and unresolved legacy identity counts are recorded.
- Owner approval is required before any auth bootstrap or user/profile write migration.
- User migration remains read-only until identity reconciliation is resolved.

Status: done. See `AUTH_IDENTITY_RECONCILIATION.md`.

### Chunk 4.9 - Auth Bootstrap Owner Decision

Deliverables:

- Get owner approval for the auth bootstrap policy:
  - password reset/magic-link setup vs Django PBKDF2 compatibility;
  - duplicate email merge/skip/mapping-table handling;
  - auth-owned schema/API/script location.
- Implement only in `auth-microservice` after approval; do not write auth users directly from SpeakASAP scripts.
- Add an auth-owned dry-run report before any auth write path.
- Record the approval options and duplicate-email evidence in an owner-facing decision artifact.
- Prepare the implementation plan for the approved path without changing `auth-microservice` before owner approval.

Verification:

- Auth dry-run reports total legacy users, duplicate email groups, importable identities, skipped identities, and password policy.
- No direct DB write to auth `users` table is performed by AI outside an approved auth-service migration path.
- User-service dry run shows unresolved auth counts match the approved skip policy.

Status: done. Owner approved continuing development. Auth-owned dry-run script and mapping entity were implemented inside `auth-microservice`; `AUTH_BOOTSTRAP_DRY_RUN_REPORT.md` records build and dry-run evidence with `writes=false`.

### Chunk 4.10 - Auth Bootstrap Apply Gate

Deliverables:

- Review `/tmp/speakasap-auth-bootstrap-dry-run.json` and confirm duplicate-email handling for `192` duplicate candidates.
- Implement apply mode only with explicit write approval, confirmation flag, transaction, and rollback evidence.
- Keep `password = NULL` / reset-only policy unless owner explicitly requests Django PBKDF2 compatibility.
- Re-run user-service dry-run after auth bootstrap writes are approved and executed.

Verification:

- Apply mode refuses without explicit write approval and confirmation flag.
- Backup/rollback commands are recorded before any auth write.
- Post-apply auth report and user-service dry-run prove unresolved auth counts match the approved skip policy.

Status: done. Owner approved the write migration and Django PBKDF2 password-continuity path. The auth bootstrap applied `214230` legacy mappings and created `214224` auth users; `192` duplicate-email identities were preserved as separate null-email auth users. `auth-microservice` was deployed with legacy password verification and first-login bcrypt upgrade support, and the final health check passed.

### Chunk 4.11 - User/Profile Migration Auth Mapping

Deliverables:

- Re-run `user-service/scripts/migrate-user-from-legacy.py` after auth bootstrap.
- Replace email-only auth resolution with auth-owned `legacy_identity_mappings` lookup by legacy `auth_user.id`.
- Preserve user-service ownership: profiles reference auth UUIDs but do not create auth identities.
- Produce a no-write dry-run report showing unresolved auth references after mapping-table resolution.

Verification:

- User-service dry-run completes with `writes=false`.
- Duplicate-email legacy users resolve to distinct auth UUIDs through mappings.
- Any remaining unresolved users are listed by source ID and reason before write mode is considered.

Status: next.

## Next Goal Selection

Continue Goal 4.11 by re-running and hardening the user/profile migration against auth-owned `legacy_identity_mappings`.
