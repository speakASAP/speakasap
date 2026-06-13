# SpeakASAP Orchestrator Status

## 2026-06-12 - Goal 1.1 Intent Preservation Pack

Status: done

Changed:

- Created SpeakASAP-local orchestrator governance modeled after the existing catalog orchestrator pack.
- Replaced the stale root growth plan with a refactoring roadmap for legacy portal migration.
- Added Goalkeeper-style owner communication rule requiring reports to end with `The next step is ...`.

Evidence:

- Remote RAG query to `docs-rag-microservice.statex-apps.svc.cluster.local:3397` failed with curl exit code 6, so repository evidence was used.
- Existing source files reviewed:
  - `/home/ssf/Documents/Github/speakasap/AGENTS.md`
  - `/home/ssf/Documents/Github/speakasap/PLAN.md`
  - `/home/ssf/Documents/Github/speakasap/BUSINESS.md`
  - `/home/ssf/Documents/Github/speakasap/SYSTEM.md`
  - `/home/ssf/Documents/Github/speakasap/TASKS.md`
  - `/home/ssf/Documents/Github/speakasap/STATE.json`
  - `/home/ssf/Documents/Github/speakasap/docs/orchestrator/STATE.json`
  - `/home/ssf/Documents/Github/speakasap-portal/AGENTS.md`
  - `/home/ssf/Documents/Github/speakasap-portal/BUSINESS.md`
  - `/home/ssf/Documents/Github/speakasap-portal/SYSTEM.md`
  - `/home/ssf/Documents/Github/speakasap-portal/TASKS.md`
  - `/home/ssf/Documents/Github/shared/.claude/memory/project_speakasap_k8s_migration.md`
  - `/home/ssf/Documents/Github/catalog-microservice/docs/orchestrator/*`

Notes:

- `speakasap/TASKS.md` references historical `docs/refactoring/*` and `docs/agents/*` artifacts, but those directories currently contain no files in this checkout.
- `speakasap-portal/SYSTEM.md` says K8s migration was permanently excluded. The owner instruction from 2026-06-12 supersedes that for this refactor workstream, but compatibility constraints remain: no unapproved Python/Django/React/Webpack upgrade and no production behavior change without a goal and evidence.

Next:

- Goal 1.2: confirm repository inventory and authoritative migration boundaries for `speakasap` and `speakasap-portal`.

## 2026-06-12 - Goal 1.2 And 1.3 Repository Inventory / Evidence Index

Status: done

Changed:

- Confirmed `/home/ssf/Documents/Github/speakasap` as the new implementation and Kubernetes deployment repo.
- Confirmed `/home/ssf/Documents/Github/speakasap-portal` as the legacy Django behavior-reference repo.
- Added `docs/orchestrator/MIGRATION_EVIDENCE.md` with current repository boundaries, source evidence, conflicts, gaps, and first Goal 2 inventory targets.
- Marked Goal 1.2 and 1.3 complete in `GOALS.md`.

Evidence:

- `speakasap` branch: `main`; HEAD `a390a5f docs: Update CLAUDE.md to reflect service name change in curl command`.
- `speakasap-portal` branch: `main`; HEAD `1076474e8 Update AGENTS.md and CLAUDE.md for deployment readiness`.
- Legacy portal inventory found many Django app domains plus `manage.py`, `portal/settings.py`, `portal/urls.py`, `requirements.txt`, `package.json`, `webpack.config.js`, and `scripts/deploy.sh`.
- New platform inventory found service package manifests, Prisma migrations, migration scripts, `api-gateway/src/proxy/*`, `frontend/lib/gateway.ts`, and K8s manifests.

Next:

- Goal 1.4: choose the first narrow migration target for owner approval, using the Goal 2 inventory targets as input.

## 2026-06-12 - Goal 1.4 First Migration Target

Status: done

Changed:

- Selected the first executable migration target: lesson workflow recordings.
- Added `docs/orchestrator/FIRST_MIGRATION_TARGET.md` with target owner, service, gateway, auth, data, storage, notification, rollback, acceptance, and verification boundaries.
- Marked Goal 1.4 complete and moved Goal 2 to active.

Evidence:

- Owner continuation request on the active goal was treated as approval to proceed with the recommended target from the prior report.
- The target was selected because legacy docs explicitly identify lesson recordings as private and MinIO-backed, and the workflow spans education data, teacher/student access, storage, merge jobs, playback, and notification.

Next:

- Goal 2.1: inventory lesson recording parity in the legacy portal and compare against the new platform.

## 2026-06-12 - Goal 2.1 Lesson Recording Workflow Inventory

Status: done

Changed:

- Added `docs/orchestrator/LESSON_RECORDING_INVENTORY.md`.
- Recorded legacy data model, teacher upload/presign/commit routes, student/teacher playback routes, tokenized playback, S3/MinIO storage rules, merge job behavior, notification behavior, DRF API surface, tests, and new-platform gaps.
- Marked the selected lesson-recording inventory chunk complete under Goal 2.

Evidence:

- Reviewed legacy files:
  - `/home/ssf/Documents/Github/speakasap-portal/education/lesson_records/models.py`
  - `/home/ssf/Documents/Github/speakasap-portal/cabinet/teacher/urls.py`
  - `/home/ssf/Documents/Github/speakasap-portal/cabinet/teacher/views/lessons.py`
  - `/home/ssf/Documents/Github/speakasap-portal/cabinet/student/urls.py`
  - `/home/ssf/Documents/Github/speakasap-portal/cabinet/record_playback.py`
  - `/home/ssf/Documents/Github/speakasap-portal/cabinet/views.py`
  - `/home/ssf/Documents/Github/speakasap-portal/education/tasks.py`
  - `/home/ssf/Documents/Github/speakasap-portal/education/api/teacher/urls.py`
  - `/home/ssf/Documents/Github/speakasap-portal/education/api/teacher/serializers/records.py`
  - `/home/ssf/Documents/Github/speakasap-portal/education/api/teacher/views/records.py`
  - `/home/ssf/Documents/Github/speakasap-portal/education/signals/handlers.py`
  - `/home/ssf/Documents/Github/speakasap-portal/education/lesson_records/tests/test_lesson_records.py`
  - `/home/ssf/Documents/Github/speakasap-portal/portal/utils/common.py`
  - `/home/ssf/Documents/Github/speakasap-portal/portal/utils/records_storage.py`
- Reviewed new platform files:
  - `/home/ssf/Documents/Github/speakasap/education-service/prisma/schema.prisma`
  - `/home/ssf/Documents/Github/speakasap/education-service/scripts/migrate-education-from-legacy.py`
  - `/home/ssf/Documents/Github/speakasap/education-service/src/app.module.ts`
  - `/home/ssf/Documents/Github/speakasap/api-gateway/src/proxy/gateway-proxy.controller.ts`
  - `/home/ssf/Documents/Github/speakasap/frontend/lib/gateway.ts`
- Repository search found no current new-platform implementation for lesson-record metadata, recording presign, recording commit, playback, MinIO/S3 adapter, or merge worker in the searched services.

Next:

- Goal 2.2: inventory the remaining legacy portal surfaces and produce the broader parity matrix.

## 2026-06-12 - Goal 2.2 Portal Surface Inventory And Parity Matrix

Status: done

Changed:

- Added `docs/orchestrator/PORTAL_SURFACE_INVENTORY.md`.
- Classified legacy runtime/deploy, URL modules, Celery task files, management commands, templates/static/assets/locales, React source, roles/workflows, domain surfaces, and current backlog risks.
- Marked Goal 2 complete and moved active state to Goal 3.
- Updated root `PLAN.md` active goal to Goal 2 completion / Goal 3 preparation.

Evidence:

- Legacy URL modules found for `administrator`, `big_brother`, `books`, `delivery`, `employees`, `helpdesk`, `investors`, `language_tests`, `marathon`, `notifications`, `offers`, `orders`, `portal`, `products`, `redirecter`, `rest`, `ses`, `seven`, `seven_test`, `speakasap_site`, and `user_quest`.
- Legacy task files found for `actions`, `administrator`, `big_brother`, `course_parser`, `courses`, `delivery`, `discount`, `education`, `education_certificates`, `employees`, `expenses`, `helpdesk`, `marathon`, `notifications`, `offers`, `orders`, `portal`, `seven`, `seven_test`, and `user_tests`.
- Management commands, template/static/asset/locale directories, React source directories, root URL includes, and new platform service folders were inventoried.
- Legacy backlog risks ISSUE-106 through ISSUE-109 were carried forward because they affect notification and recording merge verification.

Next:

- Goal 3.1: define the lesson recording service/gateway/auth/storage/notification contract before implementation code changes.

## 2026-06-12 - Goal 3.1 Lesson Recording Service Contract

Status: done

Changed:

- Added `docs/orchestrator/LESSON_RECORDING_CONTRACT.md`.
- Defined target `education-service` data model, route contract, auth/RBAC checks, storage requirements, merge behavior, notification contract, gateway requirements, frontend expectations, and verification commands.
- Marked Goal 3.1 complete while keeping Goal 3 active for the remaining gateway/refactor artifact reconstruction and broader route mapping.

Evidence:

- `education-service/src/main.ts` confirms global prefix `api/v1`, so gateway routes under `/api/v1/lessons/:lessonUuid/record...` align with service routing.
- `api-gateway/src/proxy/upstream-resolve.ts` already maps `/api/v1/lessons` to `EDUCATION_SERVICE_URL`.
- `education-service/src/lessons/*` shows current lesson endpoints are staff-only and need teacher/student-specific access helpers for recording parity.
- `education-service/prisma/schema.prisma` currently has no `LessonRecord` or `LessonRecordPart`.
- `api-gateway/src/proxy/gateway-auth.guard.ts` confirms bearer validation is centralized at gateway and must be preserved.

Next:

- Goal 3.2: recreate the missing gateway ownership/API contract artifacts referenced by `TASKS.md`, linking the lesson-recording contract to current `api-gateway` upstream routing.

## 2026-06-12 - Goal 3.2 Gateway Ownership/API/Auth Artifacts

Status: done

Changed:

- Recreated `docs/refactoring/GATEWAY_ROUTE_OWNERSHIP_MATRIX.md`.
- Recreated `docs/refactoring/GATEWAY_API_CONTRACT.md`.
- Recreated `docs/refactoring/GATEWAY_AUTH_BOUNDARY.md`.
- Linked lesson-recording routes to the existing `/api/v1/lessons` gateway ownership.
- Marked Goal 3.2 complete and advanced state to Goal 3.3.

Evidence:

- `api-gateway/src/proxy/upstream-resolve.ts` is the route ownership source of truth and already comments that it aligns with `docs/refactoring/GATEWAY_ROUTE_OWNERSHIP_MATRIX.md`.
- `README.md` links `docs/refactoring/GATEWAY_API_CONTRACT.md`.
- `TASKS.md` records that the original gateway route ownership matrix, gateway API contract, and auth boundary had existed historically, but the files were absent from the current checkout.
- The recreated docs preserve current gateway behavior and add the first migration target route contract under `/api/v1/lessons/:lessonUuid/record...`.

Next:

- Goal 3.3: map remaining legacy portal workflows to owner services and gateway route groups.

## 2026-06-12 - Goal 3.3 And 3.4 Workflow Ownership / Auth Matrix

Status: done

Changed:

- Added `docs/orchestrator/WORKFLOW_OWNERSHIP_MAP.md`.
- Added `docs/orchestrator/AUTH_RBAC_MATRIX.md`.
- Marked Goal 3.3 and Goal 3.4 complete.
- Advanced state to Goal 4.1: lesson recording migration design.

Evidence:

- Workflow ownership map uses Goal 2 portal surface inventory and current gateway route ownership as inputs.
- Auth/RBAC matrix preserves the boundary that `auth-microservice` owns identity while SpeakASAP services enforce domain access.
- High-risk gates are explicitly carried forward for payments, private recordings, student data, salary/finance, auth, and destructive migration.

Next:

- Goal 4.1: design the lesson-recording dry-run/reconciliation migration before any schema or runtime code changes.

## 2026-06-12 - Goal 4.1 Lesson Recording Migration Design

Status: done

Changed:

- Added `docs/orchestrator/LESSON_RECORDING_MIGRATION_DESIGN.md`.
- Marked Goal 3 complete and Goal 4 active.
- Split Goal 4 into dry-run-first chunks, starting with lesson-recording migration.
- Updated root `PLAN.md` and `STATE.json` to point to Goal 4.2.

Evidence:

- Legacy migrations show current lesson-record shape evolved from initial `ready/order/FK` model to JSONB `parts` with `processed` and `record_unavailable`.
- Legacy management commands show existing DB-only key normalization for `courses/records/YYYY/MM/DD/...` to `YYYY/MM/DD/...`.
- Current `education-service` migration script imports education core tables but not lesson records.
- Current target Prisma migration has no lesson-record tables yet.

Next:

- Goal 4.2: add `education-service/scripts/migrate-lesson-records-from-legacy.py` as a dry-run/reporting script only.

## 2026-06-12 - Goal 4.2 Lesson Recording Dry-Run Script

Status: done

Changed:

- Added `education-service/scripts/migrate-lesson-records-from-legacy.py`.
- Script is read-only and refuses to run unless `--dry-run` is supplied.
- Supports `--check-target`, `--limit`, and `--json-report`.
- Reports source counts, state classification, key classification, missing target lessons, missing/orphan parts, duplicate records, and exact IDs for conflicts.
- Marked Goal 4.2 complete and advanced state to Goal 4.3.

Evidence:

- Script follows `LESSON_RECORDING_MIGRATION_DESIGN.md`.
- No write mode, truncation, legacy DB write, target DB write, or object deletion exists in the script.
- `python3 -m py_compile education-service/scripts/migrate-lesson-records-from-legacy.py` passed.
- `python3 education-service/scripts/migrate-lesson-records-from-legacy.py --help` printed the expected CLI options.
- Running without `--dry-run` returned code 2 and refused to run.
- Running with `--dry-run` but without `EDUCATION_SOURCE_DATABASE_URL` / `SOURCE_DATABASE_URL` returned code 1 and failed before opening any DB connection.

Next:

- Goal 4.3: inventory remaining migration scripts and Prisma schemas for dry-run/reconciliation safety gaps.

## 2026-06-12 - Goal 4.3 Remaining Migration Script Inventory

Status: done

Changed:

- Added `docs/orchestrator/MIGRATION_SCRIPT_INVENTORY.md`.
- Inventoried existing migration scripts and Prisma schemas across the service repo.
- Classified dry-run quality, write safety, destructive flags, idempotency posture, and next priority.
- Marked Goal 4.3 complete and advanced state to Goal 4.4.

Evidence:

- Migration scripts found in `assessment-service`, `certification-service`, `course-service`, `education-service`, `financial-service`, `notification-service`, `payment-service`, `salary-service`, and `user-service`.
- Prisma schemas found in `assessment-service`, `certification-service`, `content-service`, `course-service`, `education-service`, `financial-service`, `notification-service`, `payment-service`, `salary-service`, and `user-service`.
- `content-service` has schema/migration coverage but no legacy migration script was found.
- Older Python scripts in `course-service` and `education-service` expose `--truncate-first` and use plain insert copy helpers, so they are not safe rerun targets without hardening.
- `assessment-service`, `certification-service`, and `user-service` have dry-run and upsert behavior, but still expose `--truncate-first` and need stronger source-to-target conflict reports.
- TypeScript scripts in `financial-service`, `notification-service`, `payment-service`, and `salary-service` require explicit `--load` and mostly use upserts or deterministic IDs with `skipDuplicates`; payment remains high business risk and notification has scoped link replacement via `deleteMany`.
- The new lesson-record dry-run script remains the safest current migration artifact because it has no write mode.

Next:

- Goal 4.4: define source-to-target mappings, starting with `education-service`, `user-service`, and `course-service` because lesson-recording reconciliation depends on target lessons and participant role data.

## 2026-06-12 - Goal 4.4 Source-To-Target Mapping

Status: done

Changed:

- Added `docs/orchestrator/SOURCE_TARGET_MAPPING.md`.
- Mapped education, user, course, assessment, certification, content, payment, notification, salary, and financial source tables to target Prisma models.
- Identified identifier strategy, required joins, orphan handling, and reconciliation checks.
- Prioritized the Goal 4.5 implementation order: education, user, course, then lesson-record target checks.
- Marked Goal 4.4 complete and advanced state to Goal 4.5.

Evidence:

- Education mapping is based on `education-service/scripts/migrate-education-from-legacy.py` and `education-service/prisma/schema.prisma`.
- User mapping is based on `user-service/scripts/migrate-user-from-legacy.py` and `user-service/prisma/schema.prisma`.
- Course mapping is based on `course-service/scripts/migrate-course-from-legacy.py` and `course-service/prisma/schema.prisma`.
- Assessment, certification, payment, notification, salary, and financial mappings are based on their existing migration scripts and Prisma schemas.
- Content mapping is based on `content-service/prisma/schema.prisma` plus legacy `language`, `grammar`, `phonetics`, and `songs` model evidence; no content migration script exists yet.
- The selected lesson-recording workflow remains blocked on reliable target lesson and participant mappings before any write mode can be considered.

Next:

- Goal 4.5: harden `education-service/scripts/migrate-education-from-legacy.py` so its dry run reports source/target IDs, missing FK endpoints, duplicate keys, and conflicts without writes.

## 2026-06-12 - Goal 4.5 Education Dry-Run/Reconciliation Hardening

Status: in progress

Changed:

- Hardened `education-service/scripts/migrate-education-from-legacy.py`.
- Added `--check-target`, `--json-report`, `--limit`, and `--allow-truncate-first`.
- Replaced counts-only dry run with a reconciliation report for source counts, duplicate keys, missing FK endpoints, target counts, target key conflicts, and target pair conflicts.
- Kept dry run read-only.
- Added a pre-connection refusal for `--truncate-first` unless `--allow-truncate-first` is also supplied.

Evidence:

- `python3 -m py_compile education-service/scripts/migrate-education-from-legacy.py` passed on the remote repo.
- `python3 education-service/scripts/migrate-education-from-legacy.py --help` shows the new dry-run/reporting flags.
- Running dry run without `EDUCATION_SOURCE_DATABASE_URL` or `SOURCE_DATABASE_URL` exits with code 1 and reports the missing source URL.
- Running `--truncate-first` with invalid source/target URLs exits with code 2 and refuses before attempting a DB connection.

Remaining for Goal 4.5:

- Harden `user-service/scripts/migrate-user-from-legacy.py` dry-run reporting for unresolved auth identities, duplicate emails, missing manager references, and teacher language replacement scope.
- Harden `course-service/scripts/migrate-course-from-legacy.py` dry-run reporting for missing FK endpoints, duplicate keys, and target conflicts.
- Re-run the lesson-record dry-run target checks after education/user/course reconciliation reports exist.

Next:

- Goal 4.5 continuation: harden `user-service/scripts/migrate-user-from-legacy.py` dry-run/reconciliation reporting.

## 2026-06-12 - Goal 4.5 User Dry-Run/Reconciliation Hardening

Status: in progress

Changed:

- Hardened `user-service/scripts/migrate-user-from-legacy.py`.
- Added `--check-target`, `--json-report`, `--limit`, and `--allow-truncate-first`.
- Replaced counts-only dry run with source reconciliation for counts, duplicate keys, missing FK endpoints, unresolved auth identities, missing manager references, and teacher language relation issues.
- Added optional target reconciliation for existing target IDs, auth UUID conflicts, target counts, and teacher language replacement scope.
- Kept dry run read-only.
- Added a pre-connection refusal for `--truncate-first` unless `--allow-truncate-first` is also supplied.

Evidence:

- `python3 -m py_compile user-service/scripts/migrate-user-from-legacy.py` passed on the remote repo.
- `python3 user-service/scripts/migrate-user-from-legacy.py --help` shows the new dry-run/reporting flags.
- Running dry run without `SOURCE_DATABASE_URL` exits with code 1 and reports the missing source URL.
- Running `--truncate-first` with invalid source/target URLs exits with code 2 and refuses before attempting a DB connection.

Remaining for Goal 4.5:

- Harden `course-service/scripts/migrate-course-from-legacy.py` dry-run reporting for missing FK endpoints, duplicate keys, and target conflicts.
- Re-run the lesson-record dry-run target checks after education/user/course reconciliation reports exist.

Next:

- Goal 4.5 continuation: harden `course-service/scripts/migrate-course-from-legacy.py` dry-run/reconciliation reporting.

## 2026-06-12 - Goal 4.5 Course Dry-Run/Reconciliation Hardening

Status: done

Changed:

- Hardened `course-service/scripts/migrate-course-from-legacy.py`.
- Added `--check-target`, `--json-report`, `--limit`, and `--allow-truncate-first`.
- Replaced counts-only dry run with source reconciliation for counts, duplicate keys, missing FK endpoints, offer/product/order relationship gaps, and teacher/student cross-service references.
- Added optional target reconciliation for existing target IDs, offer UUID conflicts, and product-part composite link conflicts.
- Kept dry run read-only.
- Added a pre-connection refusal for `--truncate-first` unless `--allow-truncate-first` is also supplied.
- Marked Goal 4.5 complete and advanced state to Goal 4.6.

Evidence:

- `python3 -m py_compile course-service/scripts/migrate-course-from-legacy.py` passed on the remote repo.
- `python3 course-service/scripts/migrate-course-from-legacy.py --help` shows the new dry-run/reporting flags.
- Running dry run without `COURSE_SOURCE_DATABASE_URL` or `SOURCE_DATABASE_URL` exits with code 1 and reports the missing source URL.
- Running `--truncate-first` with invalid source/target URLs exits with code 2 and refuses before attempting a DB connection.
- Remote shell environment does not currently contain `EDUCATION_*`, `COURSE_*`, `SOURCE_DATABASE_URL`, `TARGET_DATABASE_URL`, `AUTH_DATABASE_URL`, or `DATABASE_URL`, so DB-backed dry-run reports were not executed in this pass.

Goal 4.5 result:

- `education-service/scripts/migrate-education-from-legacy.py`, `user-service/scripts/migrate-user-from-legacy.py`, and `course-service/scripts/migrate-course-from-legacy.py` now have dry-run/reconciliation reporting before write use.
- All three scripts require an explicit second approval flag before destructive truncation.
- DB-backed dry-run output remains a cutover prerequisite when runtime database URLs are available in a safe execution environment.

Next:

- Goal 4.6: add idempotency or duplicate guards where these migrations can be rerun, starting with plain-insert education/course copy paths.

## 2026-06-12 - Goal 4.6 Idempotency / Duplicate Guards

Status: done

Changed:

- Added write-mode duplicate guards to `education-service/scripts/migrate-education-from-legacy.py`.
- Added write-mode duplicate guards to `course-service/scripts/migrate-course-from-legacy.py`.
- Both scripts now run target conflict preflight before plain-insert write mode when `--truncate-first` is not selected.
- The explicit write-mode policy is `conflict_policy=fail`: preserved target IDs and composite keys are checked before inserts, and any conflict causes the script to exit before writing rows.
- Existing owner-gated truncation remains the only path that can deliberately clear target tables before import.
- Marked Goal 4.6 complete and added Goal 4.7 for DB-backed dry-run capture.

Evidence:

- `python3 -m py_compile education-service/scripts/migrate-education-from-legacy.py course-service/scripts/migrate-course-from-legacy.py user-service/scripts/migrate-user-from-legacy.py education-service/scripts/migrate-lesson-records-from-legacy.py` passed on the remote repo.
- `python3 education-service/scripts/migrate-education-from-legacy.py --help` and `python3 course-service/scripts/migrate-course-from-legacy.py --help` show the dry-run/reporting and truncation-approval flags.
- Running `--truncate-first` with invalid source/target URLs exits with code 2 for both education and course scripts and refuses before attempting a DB connection.
- `.env` exists and contains the required key names for education/course/source/target/auth database URLs, but the configured legacy source endpoint at `127.0.0.1:15432` refused connection during DB-backed dry-run execution.

Remaining for Goal 4:

- Capture DB-backed dry-run reports once the legacy source database endpoint is reachable.

Next:

- Goal 4.7: restore or start the legacy source DB endpoint configured at `127.0.0.1:15432`, then run read-only dry-run reports for education, user, course, and lesson-record migrations.

## 2026-06-12 - Goal 4.7 DB-Backed Dry-Run Capture

Status: done

Changed:

- Started a read-only legacy DB tunnel on `alfares`: `127.0.0.1:15432` to the legacy SpeakASAP Postgres endpoint through the `speakasap` SSH alias.
- Ran education, course, user, and lesson-record migration dry runs against the legacy source database and target Kubernetes Postgres service.
- Updated `education-service/scripts/migrate-lesson-records-from-legacy.py` so `--limit` limits emitted sample arrays only; full counts now inspect all source lesson-record rows by default.
- Added `--source-limit` as an explicit debug-only source cap and added `issueCounts` to the lesson-record JSON report.
- No source or target writes were performed.

Evidence:

- Report files on `alfares`:
  - `/tmp/speakasap-education-dry-run.json`
  - `/tmp/speakasap-course-dry-run.json`
  - `/tmp/speakasap-user-dry-run.json`
  - `/tmp/speakasap-lesson-records-dry-run.json`
- Education source counts: `education_group=21476`, `education_group_students=21655`, `education_homework=52616`, `education_lesson=182600`, `education_studentcourse=20125`.
- Education duplicate keys, missing references, target key conflicts, and target pair conflicts are all `0`; target education tables are currently empty.
- Course source counts: `offers_extralessonsoffer=994`, `offers_offer=1900`, `products_category=5`, `products_partpaymentcollection=24`, `products_partpaymentoption=71`, `products_product=238`, `products_product_part_payments=108`.
- Course duplicate keys, missing references, target key conflicts, and target pair conflicts are all `0`; target course tables are currently empty.
- User source counts: `auth_user=214230`, `students_student=214188`, `employees_teacher=380`, `employees_manager=3`, `employees_employeeprofile=8`, `employees_teacher_additional_languages=80`.
- User duplicate keys, missing references, target ID conflicts, and target auth conflicts are all `0`; target user-service tables are currently empty.
- User auth reconciliation is not ready: target auth matching indexed `22` emails, leaving `214224` legacy `auth_user` rows unresolved, plus unresolved profile references for `214182` students, `377` teachers, `6` employee profiles, and `1` manager.
- Lesson-record source counts: `source_lesson_records=101181`, `source_lesson_record_parts=58234`, `records_ready=96726`, `records_processing=1414`, `records_unavailable=2332`, `records_none=2`.
- Lesson-record issue counts: `missing_target_lessons=101181`, `parts_missing_rows=4080`, `orphan_parts=5781`, `legacy_prefix_keys_without_date=25934`, `record_key_date_mismatch=39477`.
- Lesson-record `missing_target_lessons=101181` is expected while target `education_lesson` is empty; lesson-record migration must run after education core data is loaded and reconciled.

Result:

- Goal 4.7 is complete as a dry-run evidence capture.
- Write migration remains blocked by ordering and identity prerequisites: auth identity reconciliation first, then education/course/user load sequencing, then lesson-record metadata and private media migration.

Next:

- Goal 4.8: trace the existing auth migration/bootstrap path and decide how legacy `auth_user` rows map to target auth UUIDs before any user/profile write migration.

## 2026-06-12 - Goal 4.8 Auth Identity Reconciliation

Status: done

Changed:

- Added `docs/orchestrator/AUTH_IDENTITY_RECONCILIATION.md`.
- Confirmed `auth-microservice` is a separate repo at `/home/ssf/Documents/Github/auth-microservice`, not a service folder inside the SpeakASAP repo.
- Confirmed `auth-microservice` has no existing SpeakASAP legacy auth import script.
- Recorded the decision gate that user-service write migration must wait for auth-owned bootstrap/mapping.

Evidence:

- `auth-microservice/BUSINESS.md` says password hashing is bcrypt only and AI agents must not directly write the user table.
- `auth-microservice/src/auth/auth.service.ts` rejects password login when stored password is not bcrypt format.
- Target auth `users` table currently has `22` rows, `22` emails, `17` passwords, and `0` duplicate email groups.
- Legacy `auth_user` has `214230` rows, all with email and password, and `95` duplicate lower-trimmed email groups.
- Legacy password hash families are `212415` Django PBKDF2 hashes and `1815` Django unusable-password markers.
- The Goal 4.7 user dry run indexed only `22` target auth emails and left `214224` legacy `auth_user` rows unresolved.

Decision:

- Auth bootstrap is required before user-service profile migration.
- Email-only mapping is unsafe because legacy has duplicate email groups while target auth email is unique.
- Copying legacy Django password hashes into target auth is rejected without owner approval because current auth login accepts bcrypt only.
- Recommended first cutover policy is auth-owned bootstrap with `password = NULL` plus password reset or magic-link setup.
- Alternative policy is an owner-approved auth-service code change to verify Django PBKDF2 and rehash to bcrypt on successful login.

Next:

- Goal 4.9: get owner approval for the auth bootstrap duplicate-email and password policy, then implement the approved path only inside `auth-microservice`.

## 2026-06-12 - Goal 4.9 Auth Bootstrap Owner Decision Packet

Status: in progress

Changed:

- Added `docs/orchestrator/AUTH_BOOTSTRAP_OWNER_DECISION.md`.
- Recorded the recommended policy: auth-owned legacy identity mapping plus `password = NULL` with password reset or magic-link setup.
- Kept Goal 4.9 pending because owner approval is still required before implementation or writes.

Evidence:

- Legacy duplicate lower-trimmed email groups: `95`.
- Rows in duplicate email groups: `192`.
- Largest duplicate group size: `3`.
- Active rows in duplicate groups: `190`.
- Student user references in duplicate groups: `192`.
- Teacher user references in duplicate groups: `2`.
- Staff and superuser rows in duplicate groups: `0`.

Decision Request:

- Password policy: approve `password = NULL` plus reset/magic-link setup, or require Django PBKDF2 compatibility in `auth-microservice`.
- Duplicate-email policy: approve a dedicated auth-owned mapping table, account merge, or canonical import with skipped duplicates.
- Implementation boundary: approve adding the dry-run/bootstrap path only inside `/home/ssf/Documents/Github/auth-microservice`.

Next:

- Record owner approval for the recommended auth-owned mapping and password-reset policy, then create the auth-microservice dry-run/bootstrap implementation plan.

## 2026-06-12 - Goal 4.9 Auth Bootstrap Implementation Plan

Status: in progress

Changed:

- Added `docs/orchestrator/AUTH_BOOTSTRAP_IMPLEMENTATION_PLAN.md`.
- Inspected `auth-microservice` implementation patterns without changing that repo.
- Recorded the proposed TypeORM mapping entity, dry-run script contract, apply-mode restrictions, verification sequence, and rollback boundary.

Evidence:

- `auth-microservice/package.json` uses NestJS/TypeScript with `npm run build`, `npm run test`, and TypeORM dependencies.
- `auth-microservice/shared/database/database.module.ts` registers TypeORM entities directly and uses `DB_SYNC=true` only when configured.
- Existing operational scripts include TypeScript/Nest application-context scripts such as `scripts/seed-rbac.ts`.
- No `auth-microservice` files were modified in this step.

Guardrail:

- The implementation plan does not authorize auth code changes or writes. Owner approval is still required for password policy, duplicate-email policy, and the auth-owned implementation boundary.

Next:

- Owner approval remains required before creating the auth-microservice dry-run/bootstrap implementation.

## 2026-06-12 - Thread Objective Completion Audit

Status: done

Changed:

- Added `docs/orchestrator/OBJECTIVE_COMPLETION_AUDIT.md`.
- Audited the original thread objective separately from the broader SpeakASAP refactor roadmap.

Evidence:

- Intent-preserving governance exists in root `AGENTS.md` and `docs/orchestrator/*`.
- Existing migration/refactoring evidence is indexed in `docs/orchestrator/MIGRATION_EVIDENCE.md`.
- Sequenced roadmap exists in root `PLAN.md` and `docs/orchestrator/GOALS.md`.
- Execution has progressed one chunk at a time from Goal 1.1 through active Goal 4.9, with evidence recorded in `STATUS.md`.
- No unapproved auth writes, destructive migrations, payment ownership changes, or recording privacy changes were performed.

Result:

- The setup/orchestration objective for this thread is complete.
- The broader refactor roadmap remains active at Goal 4.9 and should continue under the orchestrator pack.

Next:

- Continue the roadmap by getting owner approval for the auth bootstrap policy before any auth-microservice implementation or user/profile write migration.

## 2026-06-12 - Goal 4.9 Auth Bootstrap Dry-Run Implementation

Status: done

Changed:

- Owner approved the documented direction and continuing development.
- Added auth-owned dry-run script in `/home/ssf/Documents/Github/auth-microservice/scripts/bootstrap-speakasap-legacy-users.ts`.
- Added auth-owned mapping entity in `/home/ssf/Documents/Github/auth-microservice/src/users/entities/legacy-identity-mapping.entity.ts`.
- Registered the mapping entity in `/home/ssf/Documents/Github/auth-microservice/shared/database/database.module.ts`.
- Added `docs/orchestrator/AUTH_BOOTSTRAP_DRY_RUN_REPORT.md`.
- Marked Goal 4.9 complete and advanced active state to Goal 4.10.

Evidence:

- Safety checks passed:
  - script help prints expected usage;
  - running without `--dry-run` refuses;
  - running with `--dry-run --apply` refuses apply mode.
- `npm run build` passed in `auth-microservice`.
- Dry-run report path: `/tmp/speakasap-auth-bootstrap-dry-run.json`.
- Dry-run result:
  - `writes=false`
  - legacy users: `214230`
  - target auth users: `22`
  - existing target email matches: `6`
  - create candidates: `214032`
  - duplicate email candidates: `192`
  - blank email skips: `0`
  - planned user writes: `0`
  - planned mapping writes: `0`

Guardrail:

- No auth database writes, service restarts, deployments, or user-service write migrations were performed.

Next:

- Goal 4.10: review the auth dry-run report and implement apply mode only behind explicit write approval, confirmation flag, transaction, and rollback evidence.

## 2026-06-12 - Goal 4.10 Auth Bootstrap Apply Gate Implementation

Status: done

Changed:

- Implemented the owner-approved Django PBKDF2 password-continuity path in `auth-microservice`.
- Added legacy password verification fallback to `AuthService.login`.
- Added first-login upgrade behavior: successful legacy password login writes a bcrypt password through `UsersService.updatePassword` and clears the legacy hash from `legacy_identity_mappings`.
- Updated `legacy_identity_mappings` with `legacyPasswordHash` and `legacyPasswordMigratedAt`; the hash column is excluded from default TypeORM selects.
- Updated the auth bootstrap apply path to create duplicate-email legacy identities as separate auth users with `email = NULL`, preserving login via mapping lookup instead of merging users by shared email.
- Hardened mapping upsert idempotency so reruns do not reintroduce legacy hashes after a completed first-login upgrade.
- Applied the approved auth bootstrap migration to the auth database.
- Deployed `auth-microservice` so the runtime login path can verify legacy Django PBKDF2 hashes and upgrade them to bcrypt.
- Added `docs/orchestrator/AUTH_BOOTSTRAP_APPLY_GATE.md`.

Evidence:

- Build checks:
  - `node --check scripts/bootstrap-speakasap-legacy-users.ts` passed.
  - `npm run build` passed before apply and before deploy.
- Final no-write dry-run report before apply: `/tmp/speakasap-auth-bootstrap-dry-run-v5.json`.
- Final rollback SQL artifact before apply: `/tmp/speakasap-auth-bootstrap-rollback-v5.sql`.
- Final dry-run summary before apply:
  - `writes=false`
  - legacy users: `214230`
  - target users before apply: `22`
  - duplicate email groups: `95`
  - duplicate email rows: `192`
  - existing target email matches: `6`
  - create candidates: `214032`
  - duplicate email candidates: `192`
  - planned user writes: `214224`
  - planned mapping writes: `214230`
- Apply command used `--apply --confirm-write --approval-note "User approved legacy SpeakASAP auth bootstrap with Django PBKDF2 password continuity on 2026-06-12" --password-policy legacy-pbkdf2-upgrade`.
- Post-apply auth DB verification:
  - total auth users: `214246`
  - new `speakasap-portal` source users: `214224`
  - `speakasap-portal` source users with null primary email: `192`
  - `speakasap-portal` source users with password set in `users.password`: `0`
  - legacy mappings: `214230`
  - mappings with auth user: `214230`
  - mappings with stored legacy password hash: `214230`
  - mapping statuses: `created=214032`, `created_duplicate_email=192`, `mapped=6`
  - unmapped source users: `0`
- Deployment:
  - deployed image: `localhost:5000/auth-microservice:b616818-20260612093355`
  - namespace: `statex-apps`
  - rollout completed successfully.
  - final pod health returned `{"success":true,"status":"ok","service":"auth-microservice"}`.

Guardrail:

- Password hashes were not printed in reports or status.
- Legacy hashes are stored only in the auth-owned mapping table and are intended to be cleared per user after first successful legacy password login.
- User-service write migration was not executed yet.

Next:

- Goal 4.11: re-run and harden user-service profile migration so it resolves target auth UUIDs from `legacy_identity_mappings` by legacy `auth_user.id`, not email-only matching.

## 2026-06-12 - Goal 4.11 User/Profile Auth Mapping Dry-Run

Status: done

Changed:

- Updated `/home/ssf/Documents/Github/speakasap/user-service/scripts/migrate-user-from-legacy.py`.
- Replaced email-only auth UUID resolution with auth-owned `legacy_identity_mappings` lookup by legacy `auth_user.id`.
- Updated dry-run unresolved-auth reporting to use the same mapping-table identity source.
- Updated future write-mode helpers for `user_identity_mirror`, `students`, `teachers`, `managers`, and `employee_profiles` to resolve by legacy user ID.
- Optimized dry-run reconciliation with temporary-table joins for large auth mapping and target conflict sets.

Evidence:

- `python3 -m py_compile user-service/scripts/migrate-user-from-legacy.py` passed locally and on `alfares`.
- No-write dry-run report: `/tmp/speakasap-user-dry-run-auth-mapping-v3.json`.
- Dry-run summary:
  - `writes=false`
  - `dry_run=true`
  - auth mapping size: `214230`
  - unresolved auth users: `0`
  - unresolved students: `0`
  - unresolved teachers: `0`
  - unresolved managers: `0`
  - unresolved employee profiles: `0`
- Source counts:
  - `auth_user=214230`
  - `students_student=214188`
  - `employees_teacher=380`
  - `employees_manager=3`
  - `employees_employeeprofile=8`
  - `employees_teacher_additional_languages=80`
- Source duplicate-key counts are `0` for user IDs and teacher-language pairs.
- Missing reference counts are `0` for auth users, managers, teacher languages, and teacher additional language references.
- Target user-service tables are currently empty:
  - `user_identity_mirror=0`
  - `students=0`
  - `teachers=0`
  - `managers=0`
  - `employee_profiles=0`
  - `teacher_additional_languages=0`
- Target ID conflicts are `0`.
- Target auth UUID conflicts are `0`.

Guardrail:

- User-service write migration was not executed.
- The user-service script still does not create or mutate auth users; it only references auth UUIDs supplied by `auth-microservice` mappings.

Next:

- Goal 4.12: review the user/profile dry-run evidence and run write-gated user-service apply only after explicit owner approval.

## 2026-06-12 - Goal 4.12 User/Profile Apply Gate Review

Status: awaiting owner approval

Changed:

- Reviewed the user/profile no-write dry-run evidence from `/tmp/speakasap-user-dry-run-auth-mapping-v3.json` on `alfares`.
- Hardened `user-service/scripts/migrate-user-from-legacy.py` so write mode is no longer the default when `--dry-run` is omitted.
- Added explicit write gates: `--apply`, `--confirm-write`, `--approval-note`, and `--rollback-plan`.
- Added pre-apply rollback SQL generation for legacy user/profile rows and optional post-apply JSON reporting.
- Copied the gated script to `/home/ssf/Documents/Github/speakasap/user-service/scripts/migrate-user-from-legacy.py` on `alfares`.

Evidence:

- RAG retrieval from `docs-rag-microservice.statex-apps.svc.cluster.local:3397` was attempted from the local session and timed out, so repository and remote report evidence were used.
- Dry-run report reviewed on `alfares`: `/tmp/speakasap-user-dry-run-auth-mapping-v3.json`.
- Dry-run summary:
  - `writes=false`
  - `auth_mapping_size=214230`
  - unresolved auth counts for auth users, students, teachers, managers, and employee profiles are all `0`
  - missing source references are all `0`
  - target user-service tables are all empty
  - target ID conflicts are all `0`
  - target auth UUID conflicts are all `0`
  - `teacher_additional_languages` replacement scope is `0`
- Remote verification passed:
  - `python3 -m py_compile user-service/scripts/migrate-user-from-legacy.py`
  - `python3 user-service/scripts/migrate-user-from-legacy.py --help` shows `--apply`, `--confirm-write`, `--approval-note`, and `--rollback-plan`
  - default write mode refuses before DB connection: `Refusing to write by default; use --dry-run for reconciliation or --apply with write gates`
  - incomplete apply refuses before DB connection without `--confirm-write`, without `--approval-note`, and without `--rollback-plan`
- A fresh dry run with the gated script was attempted, but `AUTH_DATABASE_URL` currently points to `127.0.0.1:5432` on `alfares` and that connection refused. The existing v3 dry-run remains the reviewed data evidence, and the final pre-apply dry run must be rerun after the auth DB connection is restored.

Guardrail:

- User-service apply was not run in this session because explicit owner approval for the user-service write migration was not provided.
- User-service migration still only reads auth-owned `legacy_identity_mappings`; it does not create or mutate auth users.

Prepared apply command after explicit owner approval and restored DB connectivity:

```bash
cd /home/ssf/Documents/Github/speakasap
set -a && . ./.env && set +a
python3 user-service/scripts/migrate-user-from-legacy.py \
  --apply \
  --confirm-write \
  --approval-note "OWNER_APPROVAL_TEXT_AND_DATE" \
  --rollback-plan /tmp/speakasap-user-profile-rollback-apply-v1.sql \
  --json-report > /tmp/speakasap-user-profile-apply-v1.json
```

Next:

- Get explicit owner approval for the user-service write migration, restore the auth DB connection for the final pre-apply dry run, then run the gated apply and capture post-apply counts.

## 2026-06-12 - Goal 4.12 User/Profile Write Migration Applied

Status: done

Changed:

- Owner explicitly approved the user-service write migration from the legacy SpeakASAP portal to the new `user-service`.
- Preserved the intended two-copy migration state: legacy portal Postgres remains the legacy/reference copy, and `user-service` now owns a migrated profile-domain copy. Auth identities remain owned by `auth-microservice`.
- Hardened `auth-microservice/scripts/bootstrap-speakasap-legacy-users.ts` so catch-up apply skips existing `legacy_identity_mappings` by legacy user ID before creating auth users.
- Ran a targeted auth-owned catch-up for one newly observed legacy user that appeared after the earlier auth bootstrap.
- Ran the write-gated `user-service/scripts/migrate-user-from-legacy.py --apply` with `--confirm-write`, owner approval note, rollback SQL path, and JSON report.

Evidence:

- Final pre-apply user dry-run before auth catch-up: `/tmp/speakasap-user-dry-run-auth-mapping-v5.json`.
  - Found one newly observed unmapped legacy identity: `auth_user.id=314012`, student `215047`.
- Narrow auth check for legacy user `314012`:
  - active end-user
  - `same_normalized_email_count=1`
  - `existing_mapping_count=0`
- Auth catch-up direct verification:
  - `legacy_identity_mappings` has one row for `legacyUserId=314012`
  - catch-up mapping status: `created`
  - total SpeakASAP legacy auth mappings: `214231`
- Final pre-apply user dry-run after auth catch-up: `/tmp/speakasap-user-dry-run-auth-mapping-v6.json`.
  - `writes=false`
  - `auth_mapping_size=214231`
  - unresolved auth counts for auth users, students, teachers, managers, and employee profiles are all `0`
  - missing source references are all `0`
  - target user-service tables were still empty
  - target ID conflicts and target auth UUID conflicts were all `0`
- User-service apply artifacts:
  - apply report: `/tmp/speakasap-user-profile-apply-v1.json`
  - rollback SQL: `/tmp/speakasap-user-profile-rollback-apply-v1.sql`
- User-service apply report:
  - `writes=true`
  - `user_identity_mirror=214231`, skipped `0`
  - `students=214189`, skipped `0`
  - `teachers=380`, skipped `0`
  - `managers=3`, skipped `0`
  - `employee_profiles=8`, skipped `0`
  - `teacher_additional_languages=80`
  - elapsed time `81.9s`
- Direct post-apply DB counts:
  - `user_identity_mirror=214231`
  - `students=214189`
  - `teachers=380`
  - `managers=3`
  - `employee_profiles=8`
  - `teacher_additional_languages=80`
- Post-apply no-write dry-run: `/tmp/speakasap-user-dry-run-post-apply-v1.json`.
  - `writes=false`
  - `auth_mapping_size=214231`
  - unresolved auth counts remain `0`
- Runtime check:
  - `kubectl exec -n statex-apps deploy/speakasap-user -- ... /health` returned `{"status":"ok"}`.

Guardrail:

- No legacy portal rows were deleted or mutated.
- No user-service truncation was used.
- The user-service migration did not create or mutate auth users; the one required auth catch-up was performed through the auth-owned bootstrap path.
- A temporary Kubernetes port-forward was used for DB access and was closed after each command.

Next:

- Goal 4.13: finish education/course apply-gate readiness and capture final pre-apply dry-run reports before any education or course data writes.

## 2026-06-12 - Goal 4.12 User/Profile Apply And Post-Apply Reconciliation

Status: done

Changed:

- Completed the write-gated user-service legacy user/profile import on `alfares`.
- Captured rollback SQL before apply at `/tmp/speakasap-user-profile-rollback-apply-v1.sql`.
- Captured apply evidence at `/tmp/speakasap-user-profile-apply-v1.json`.
- Captured post-apply no-write reconciliation at `/tmp/speakasap-user-dry-run-post-apply-v1.json`.
- Hardened `education-service/scripts/migrate-education-from-legacy.py` and `course-service/scripts/migrate-course-from-legacy.py` so both refuse default writes and require `--apply`, `--confirm-write`, `--approval-note`, and `--rollback-plan`.
- Marked Goal 4.12 complete and moved the active chunk to Goal 4.13 education/course apply-gate readiness.

Evidence:

- RAG retrieval was attempted from the local session and failed with curl exit code 6, so repository and remote runtime evidence were used.
- User-service apply report:
  - `writes=true`
  - approval note recorded in the report: `Owner approved user-service write migration from legacy SpeakASAP portal to new user-service on 2026-06-12`
  - `user_identity_mirror=214231`
  - `students=214189`
  - `teachers=380`
  - `managers=3`
  - `employee_profiles=8`
  - `teacher_additional_languages=80`
  - skipped auth counts for all imported groups are `0`
- Post-apply dry-run report:
  - `writes=false`
  - `auth_mapping_size=214231`
  - unresolved auth counts for auth users, students, teachers, managers, and employee profiles are all `0`
  - target counts match the apply report counts
  - target ID/auth conflict counts now equal imported row counts, which is expected for an idempotent post-apply reconciliation.
- Education/course script verification passed on `alfares`:
  - `python3 -m py_compile education-service/scripts/migrate-education-from-legacy.py course-service/scripts/migrate-course-from-legacy.py`
  - both `--help` outputs show `--apply`, `--confirm-write`, `--approval-note`, and `--rollback-plan`
  - default invocation exits with code `2` and refuses writes before database connection
  - incomplete `--apply` exits with code `2` and refuses before database connection without `--confirm-write`.

Guardrail:

- No education-service or course-service data writes were run in this step.
- The user-service rollback SQL is available but was not executed because post-apply reconciliation is consistent.
- Lesson-recording/private media migration remains pending until education core data is loaded and reconciled.

Next:

- Goal 4.13: run final no-write dry-runs for education and course through a temporary Postgres port-forward, then run their write-gated applies only with matching approval evidence and rollback artifacts.

## 2026-06-12 - Goal 4.13 Course/Education Apply And Lesson-Record Unblocker

Status: done

Changed:

- Ran final no-write pre-apply dry-runs for course and education migrations.
- Ran write-gated course migration apply with rollback artifact `/tmp/speakasap-course-rollback-apply-v1.sql`.
- Ran write-gated education migration apply with rollback artifact `/tmp/speakasap-education-rollback-apply-v1.sql`.
- Captured post-apply no-write reconciliation reports:
  - `/tmp/speakasap-course-dry-run-post-apply-v1.json`
  - `/tmp/speakasap-education-dry-run-post-apply-v1.json`
- Re-ran lesson-record dry-run after education core data was loaded:
  - `/tmp/speakasap-lesson-records-dry-run-post-education-v1.json`
- Marked Goal 4.13 complete and moved active state to Goal 5.

Evidence:

- Pre-apply course dry-run `/tmp/speakasap-course-dry-run-pre-apply-v1.json`:
  - duplicate counts `0`
  - missing reference counts `0`
  - target table counts `0`
  - target key/pair conflicts `0`
- Course apply `/tmp/speakasap-course-apply-v1.log` wrote:
  - `products_category=5`
  - `products_partpaymentcollection=24`
  - `products_partpaymentoption=71`
  - `products_product=238`
  - `products_product_part_payments=108`
  - `offers_extralessonsoffer=994`
  - `offers_offer=1900`
- Post-apply course dry-run target counts match source counts; target conflicts equal imported rows as expected for an idempotent rerun check.
- Pre-apply education dry-run `/tmp/speakasap-education-dry-run-pre-apply-v1.json`:
  - duplicate counts `0`
  - missing reference counts `0`
  - target table counts `0`
  - target key/pair conflicts `0`
- Education apply `/tmp/speakasap-education-apply-v1.log` wrote:
  - `education_group=21476`
  - `education_group_students=21655`
  - `education_studentcourse=20125`
  - `education_lesson=182600`
  - `education_homework=52616`
  - `education_studentcourse.previous_id` patched rows `1883`
- Post-apply education dry-run target counts match source counts; target conflicts equal imported rows as expected for an idempotent rerun check.
- Lesson-record post-education dry-run:
  - `missing_target_lessons=0`
  - `bad_parts_json=0`
  - `duplicate_lesson_records=0`
  - `missing_source_lesson=0`
  - remaining media/key issues: `parts_missing_rows=4080`, `orphan_parts=5781`, `legacy_prefix_keys_without_date=25934`, `record_key_date_mismatch=39477`.

Guardrail:

- No legacy DB writes were performed.
- No object storage writes, deletes, or public recording exposure were performed.
- Rollback SQL artifacts were generated before course and education applies.

Next:

- Goal 5.1: add the target lesson-record schema/write-gated metadata migration and keep all recording object access private.

## 2026-06-12 - User/Profile Migration Batch Hardening

Status: done

Changed:

- Added `--batch-size` to `user-service/scripts/migrate-user-from-legacy.py`.
- Default batch size is `10000` rows.
- Future user/profile applies or idempotent reruns now process the two large write paths in batches:
  - `auth_user -> user_identity_mirror`
  - `students_student -> students`
- Each batch commits independently and logs cumulative migrated/skipped counts.

Evidence:

- No additional user-service write migration was run after this change.
- Local syntax check passed: `python3 -m py_compile user-service/scripts/migrate-user-from-legacy.py`.
- Remote syntax check passed on `alfares`.
- Remote help output shows `--batch-size BATCH_SIZE`.
- Invalid batch size refuses before database connection: `ERROR: --batch-size must be greater than 0`.

Note:

- The already completed Goal 4.12 apply ran before this owner instruction, so that historical run was not batched. The script is now hardened so future reruns use `10000`-row batches by default.

Next:

- Goal 4.13: use explicit batching for any future education/course data writes where table size or server limits make batching necessary.

## 2026-06-12 - Education/Course Apply Process Observed During Batch Hardening

Status: observed

Changed:

- While hardening user/profile batching, a separate remote education/course apply process was already running on `alfares`.
- The process was not started by this batching change.
- It was monitored to completion instead of being interrupted, because it had already written course and education target rows.

Evidence:

- Course apply log: `/tmp/speakasap-course-apply-v1.log`.
- Course rollback SQL: `/tmp/speakasap-course-rollback-apply-v1.sql`.
- Education apply log: `/tmp/speakasap-education-apply-v1.log`.
- Education rollback SQL: `/tmp/speakasap-education-rollback-apply-v1.sql`.
- Course target counts after process exit:
  - `products_category=5`
  - `products_partpaymentcollection=24`
  - `products_partpaymentoption=71`
  - `products_product=238`
  - `products_product_part_payments=108`
  - `offers_extralessonsoffer=994`
  - `offers_offer=1900`
- Education target counts after process exit:
  - `education_group=21476`
  - `education_group_students=21655`
  - `education_studentcourse=20125`
  - `education_lesson=182600`
  - `education_homework=52616`
- No lingering `port-forward`, education migration, or course migration process remained after completion.

Guardrail:

- This observation does not imply that future large migrations should run unbatched. The active owner instruction is to batch large write paths around `10000` rows per batch where server limits matter.

Next:

- Capture post-apply reconciliation for education/course and retrofit batching before any further large write/rerun.

## 2026-06-12 - Education/Course Batch Hardening

Status: done

Changed:

- Added `--batch-size` to `education-service/scripts/migrate-education-from-legacy.py`.
- Added `--batch-size` to `course-service/scripts/migrate-course-from-legacy.py`.
- Default batch size is `10000` rows.
- Future education/course applies or idempotent reruns now stream source rows with server-side cursors and commit per batch instead of loading whole tables with `fetchall()`.
- Education batching covers:
  - `education_group`
  - `education_group_students`
  - `education_studentcourse` phase 1
  - `education_studentcourse.previous_id` patch phase
  - `education_lesson`
  - `education_homework`
- Course batching covers all copied tables:
  - `products_category`
  - `products_partpaymentcollection`
  - `products_partpaymentoption`
  - `products_product`
  - `products_product_part_payments`
  - `offers_extralessonsoffer`
  - `offers_offer`

Evidence:

- No additional education/course write migration was run by this hardening step.
- Remote syntax check passed on `alfares`:
  - `python3 -m py_compile education-service/scripts/migrate-education-from-legacy.py course-service/scripts/migrate-course-from-legacy.py`
- Remote help output for both scripts shows `--batch-size BATCH_SIZE`.
- Invalid batch size refuses before database connection for both scripts:
  - `ERROR: --batch-size must be greater than 0`
- `education-service/scripts/migrate-lesson-records-from-legacy.py` is currently read-only only; it has no lesson-record write/apply path to batch yet.

Guardrail:

- Future large writes should keep the default `--batch-size 10000` unless there is explicit evidence that the server can safely handle a larger batch.
- Existing target conflict guards still run before non-truncating apply, so an idempotent rerun should refuse rather than duplicate rows unless a separately approved path is used.

Next:

- Add batching to the lesson-record metadata write path when that write path is implemented; until then, lesson-record migration remains dry-run/reconciliation only.

## 2026-06-12 - Intent Preservation System Compliance Refresh

Status: done

Changed:

- Added missing root mandatory-reading files: `BUSINESS.md`, `SYSTEM.md`, `TASKS.md`, and `STATE.json`.
- Added `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md` with staged migration checks, implementation prerequisites, write/destructive-action gates, verification gates, rollback expectations, and required commit-message evidence.
- Updated `AGENTS.md`, `MASTER_PROMPT.md`, `IMPLEMENTATION_ORCHESTRATOR.md`, `IMPLEMENTATION_STATE.md`, `INTENT.md`, `GOALS.md`, `PROMPTS.md`, root `PLAN.md`, `docs/orchestrator/PLAN.md`, root `STATE.json`, and `docs/orchestrator/STATE.json` to make the intent-preservation system part of the required workflow.
- Preserved the active roadmap state at Goal 4.13: education/course apply-gate readiness remains blocked on final no-write reports and explicit owner approval before writes.

Evidence:

- Local mandatory reading initially failed for root `BUSINESS.md`, `SYSTEM.md`, `TASKS.md`, and `STATE.json`; those files now exist.
- RAG lookup to `docs-rag-microservice.statex-apps.svc.cluster.local:3397` timed out with curl exit code 28 both sandboxed and with approved network access, so this pass used repository evidence.
- Reviewed current root and orchestrator docs in this checkout, including `AGENTS.md`, root `PLAN.md`, `docs/orchestrator/MASTER_PROMPT.md`, `IMPLEMENTATION_ORCHESTRATOR.md`, `IMPLEMENTATION_STATE.md`, `INTENT.md`, `GOALS.md`, `PLAN.md`, `STATUS.md`, `PROMPTS.md`, `MIGRATION_EVIDENCE.md`, `SOURCE_TARGET_MAPPING.md`, `OBJECTIVE_COMPLETION_AUDIT.md`, and `AUTH_BOOTSTRAP_APPLY_GATE.md`.
- No production code, migration write mode, deployment, or database write was changed by this compliance refresh.
- JSON validation passed for root `STATE.json` and `docs/orchestrator/STATE.json`.

Next:

- Goal 4.13 remains the active migration task: capture final education/course no-write dry-runs before any write-gated apply.

## 2026-06-12 - Goal 4.12 Final Pre-Apply Evidence Restored

Status: done

Changed:

- Restored the final pre-apply DB evidence for the user/profile migration as the authoritative Goal 4.12 pre-write checkpoint.
- Hardened `user-service/scripts/migrate-user-from-legacy.py` so CLI write-gate checks run before database URL checks or DB driver import.
- Copied the hardened script to `/home/ssf/Documents/Github/speakasap/user-service/scripts/migrate-user-from-legacy.py` on `alfares`.
- Reaffirmed that any future user-service write migration, rerun, truncation, rollback execution, or apply against a changed source/target requires fresh explicit owner approval, a current no-write report, an approval note, and rollback artifact.

Evidence:

- RAG retrieval to `docs-rag-microservice.statex-apps.svc.cluster.local:3397` failed with curl exit code `6`, so repository and remote runtime evidence were used.
- Remote artifacts are present on `alfares`:
  - `/tmp/speakasap-user-dry-run-auth-mapping-v6.json`
  - `/tmp/speakasap-user-profile-rollback-apply-v1.sql`
  - `/tmp/speakasap-user-profile-apply-v1.json`
  - `/tmp/speakasap-user-dry-run-post-apply-v1.json`
- Restored final pre-apply report: `/tmp/speakasap-user-dry-run-auth-mapping-v6.json`.
  - `writes=false`
  - `dry_run=true`
  - `auth_mapping_size=214231`
  - source counts: `auth_user=214231`, `students_student=214189`, `employees_teacher=380`, `employees_manager=3`, `employees_employeeprofile=8`, `employees_teacher_additional_languages=80`
  - unresolved auth counts for auth users, students, teachers, managers, and employee profiles are all `0`
  - missing source references are all `0`
  - source duplicate-key counts are all `0`
  - target user-service counts were all `0` before apply
  - target ID conflicts and target auth UUID conflicts were all `0`
  - replacement scope for `teacher_additional_languages` was `0`
- Apply evidence remains unchanged:
  - apply report `/tmp/speakasap-user-profile-apply-v1.json` recorded `writes=true`
  - approval note in the apply report: `Owner approved user-service write migration from legacy SpeakASAP portal to new user-service on 2026-06-12`
  - migrated counts: `user_identity_mirror=214231`, `students=214189`, `teachers=380`, `managers=3`, `employee_profiles=8`, `teacher_additional_languages=80`
  - skipped no-auth counts for imported groups are all `0`
- Post-apply reconciliation remains unchanged:
  - `/tmp/speakasap-user-dry-run-post-apply-v1.json` recorded `writes=false`
  - `auth_mapping_size=214231`
  - unresolved auth counts remain `0`
- Local verification:
  - `python3 -m py_compile user-service/scripts/migrate-user-from-legacy.py` passed
  - `python3 user-service/scripts/migrate-user-from-legacy.py` exits `2` with default write refusal before DB config
  - `python3 user-service/scripts/migrate-user-from-legacy.py --apply` exits `2` without `--confirm-write`
  - `python3 user-service/scripts/migrate-user-from-legacy.py --apply --confirm-write` exits `2` without `--approval-note`
  - `python3 user-service/scripts/migrate-user-from-legacy.py --apply --confirm-write --approval-note test` exits `2` without `--rollback-plan`
- Remote verification on `alfares`:
  - `python3 -m py_compile user-service/scripts/migrate-user-from-legacy.py` passed
  - default invocation exits `2` with write refusal before DB config
  - incomplete `--apply` invocations exit `2` without `--confirm-write`, without `--approval-note`, and without `--rollback-plan`

Guardrail:

- No user-service write migration, rollback, truncation, or deployment was run in this restoration step.
- The existing historical Goal 4.12 apply is not treated as standing approval for future user-service writes.
- Future user-service applies must use `--apply --confirm-write --approval-note ... --rollback-plan ...` after a fresh owner approval and fresh no-write DB evidence.

Next:

- Resume the current data-migration roadmap only after honoring this gate: any future user-service write action requires explicit owner approval; education/course or lesson-record work remains separately gated by its own final dry-runs and approval evidence.

## 2026-06-12 - Goal 5.2 Lesson Recording Metadata Migration Implementation

Status: implemented locally; remote apply/deploy not run

Changed:

- Added `education-service/prisma/schema.prisma` coverage for `LessonRecord` and `LessonRecordPart`.
- Added Prisma migration `education-service/prisma/migrations/20260612120000_lesson_record_metadata/migration.sql`.
- Replaced `education-service/scripts/migrate-lesson-records-from-legacy.py` with a dual-mode migration:
  - `--dry-run` remains no-write reconciliation.
  - `--apply` requires `--confirm-write`, `--approval-note`, and `--rollback-plan`.
  - apply mode refuses if target lesson-record tables are missing.
  - writes are idempotent upserts by preserved legacy UUIDs.
  - rollback SQL is generated before writes.
  - metadata/key references are migrated only; object storage is not read, written, deleted, or made public.

Evidence:

- RAG lookup to `docs-rag-microservice.statex-apps.svc.cluster.local:3397` failed with curl exit code `6`, so repository evidence was used.
- Local verification passed:
  - `python3 -m py_compile education-service/scripts/migrate-lesson-records-from-legacy.py`
  - `python3 education-service/scripts/migrate-lesson-records-from-legacy.py --help`
  - `python3 education-service/scripts/migrate-lesson-records-from-legacy.py --apply` exits `2` before DB access and reports missing write-gate flags.
  - `python3 education-service/scripts/migrate-lesson-records-from-legacy.py --dry-run` exits `1` before DB access and reports missing source DB URL.
- Private media boundary:
  - the schema stores `record` and `part_file` object keys only;
  - no public URL, bucket credential, object copy, object delete, or presigned access behavior was added;
  - old-prefix and key-date mismatches remain reconciliation issues and are not rewritten by the metadata import.
- Blocking apply issues are separated from non-blocking media/key reconciliation:
  - missing target lessons, duplicate lesson records, target UUID/lesson conflicts, bad parts JSON, and multi-record part references block apply;
  - orphan part rows, missing part rows, old-prefix keys, and key-date mismatches remain reported as reconciliation evidence.

Remote blocker:

- Copying the changed artifacts to `alfares` failed because the local SSH config currently resolves `alfares` to `alfares.local`, and DNS lookup for `alfares.local` fails in this session.
- Remote Prisma validation, `npm run build`, DB-backed dry-run, and any write-gated apply were not run.

Approval / rollback:

- No production or target database write was run.
- Future apply still requires a fresh DB-backed no-write report, Prisma migration deploy, explicit owner approval for the exact apply command, and a rollback SQL path.

Next:

- Restore remote `alfares` connectivity, copy the local artifacts, run `education-service` Prisma validation/build, deploy the schema migration, capture a fresh no-write lesson-record report, then request explicit approval before any `--apply`.

## 2026-06-12 - Goal 5.3 Lesson Recording Remote Validation

Status: remote validation and no-write report complete; schema deploy/apply still approval-gated

Changed:

- Copied the local lesson-record schema, migration SQL, and migration script to `/home/ssf/Documents/Github/speakasap` on `alfares`.
- Used direct IPv6 link-local SSH with `HostKeyAlias=alfares.local` because the plain `alfares` alias intermittently failed resolving `alfares.local`.
- Ran remote validation and no-write reconciliation only.

Evidence:

- Remote validation passed:
  - `python3 -m py_compile education-service/scripts/migrate-lesson-records-from-legacy.py`
  - `python3 education-service/scripts/migrate-lesson-records-from-legacy.py --help`
  - `cd education-service && npm run prisma:validate`
  - `cd education-service && npm run build`
- Target DB access required a temporary Kubernetes port-forward to `svc/db-server-postgres` in namespace `statex-apps`; the port-forward was closed after the command.
- Fresh no-write report: `/tmp/speakasap-lesson-records-dry-run-g5-2.json`.
- Dry-run summary:
  - `source_lesson_records=101184`
  - `source_lesson_record_parts=58234`
  - `records_ready=96729`
  - `records_processing=1414`
  - `records_unavailable=2332`
  - `records_none=2`
  - `records_inconsistent=4787`
  - `missing_target_lesson=0`
  - `parts_missing_rows=4080`
  - `parts_orphan_rows=5781`
  - `keys_canonical=71919`
  - `keys_old_prefix_legacy=25934`
  - `keys_empty=3042`
  - `keys_other=289`
  - `would_upsert_lesson_records=101184`
  - `would_upsert_lesson_record_parts=52453`
  - blocking issue counts are zero for bad JSON, missing source lesson, missing target lesson, duplicate lesson records, and multi-record part references.
  - remaining non-blocking reconciliation issues: `legacy_prefix_keys_without_date=25934`, `orphan_parts=5781`, `parts_missing_rows=4080`, `record_key_date_mismatch=39477`.

Approval / rollback:

- No Prisma migration deploy, target schema write, metadata apply, object storage write, or deployment was run.
- Next write step requires explicit owner approval for:
  - `cd education-service && npm run prisma:migrate:deploy`
  - `education-service/scripts/migrate-lesson-records-from-legacy.py --apply --confirm-write --approval-note ... --rollback-plan ...`

Next:

- Request explicit owner approval for the target DB schema migration and the lesson-record metadata apply command, with rollback path recorded before apply.

## 2026-06-12 - Goal 5.4 Lesson Recording Schema Deploy And Metadata Apply

Status: done

Changed:

- Owner approved proceeding with the `education-service` Prisma schema deploy and lesson-record metadata apply on 2026-06-12.
- Recorded owner permission in `AGENTS.md` allowing AI/Codex sessions to create git commits on remote `alfares` only inside `/home/ssf/Documents/Github/speakasap`.
- Applied Prisma migration `20260612120000_lesson_record_metadata` to `speakasap_education_db`.
- Ran the write-gated lesson-record metadata apply with:
  - `--apply`
  - `--confirm-write`
  - `--approval-note "Owner approved lesson-record schema deploy and metadata apply for SpeakASAP on 2026-06-12"`
  - `--rollback-plan /tmp/speakasap-lesson-records-rollback-g5-4.sql`
  - `--json-report /tmp/speakasap-lesson-records-apply-g5-4.json`
- Ran a post-apply no-write reconciliation report at `/tmp/speakasap-lesson-records-post-apply-g5-4.json`.

Evidence:

- Prisma deploy:
  - `cd education-service && npm run prisma:migrate:deploy`
  - migration applied successfully: `20260612120000_lesson_record_metadata`
- Rollback artifact:
  - `/tmp/speakasap-lesson-records-rollback-g5-4.sql`
- Apply report:
  - `/tmp/speakasap-lesson-records-apply-g5-4.json`
  - `writes=true`
  - `source_lesson_records=101184`
  - `source_lesson_record_parts=58234`
  - `would_upsert_lesson_records=101184`
  - `would_upsert_lesson_record_parts=52453`
  - `missing_target_lesson=0`
- Target DB verification after apply:
  - `education_lessonrecord=101184`
  - `education_lessonrecordpart=52453`
  - lesson-record rows missing target lessons: `0`
- Post-apply dry-run report:
  - `/tmp/speakasap-lesson-records-post-apply-g5-4.json`
  - `missing_target_lesson=0`
  - source/state/key counts match the pre-apply evidence
  - remaining reconciliation issues are unchanged media/key inventory: `parts_missing_rows=4080`, `orphan_parts=5781`, `legacy_prefix_keys_without_date=25934`, `record_key_date_mismatch=39477`

Guardrail:

- No object storage read, write, delete, public URL, or presigned access change was performed.
- The apply migrated metadata and private object-key references only.
- Temporary Kubernetes DB port-forwards were closed after the commands.

Next:

- Continue Goal 5 by verifying runtime private access behavior: playback/download must remain scoped, merge/delete behavior must be checked against legacy semantics, and media/key reconciliation issues must remain visible until resolved or explicitly accepted.

## 2026-06-12 - Goal 5.5 Runtime Private Access Verification

Status: active; frontend/gateway cutover blocked

Changed:

- Added `docs/orchestrator/LESSON_RECORDING_RUNTIME_VERIFICATION.md`.
- Verified the current target service/runtime surface before any frontend or gateway cutover.
- Ran a fresh no-write lesson-record metadata/target reconciliation report.

Evidence:

- RAG lookup failed with curl exit code 6, so repository and remote evidence were used.
- Remote repo `/home/ssf/Documents/Github/speakasap` was clean before verification.
- Target runtime search found no implemented `education-service` route/module for lesson-record state, playback, download, presign, commit, scoped media token, merge worker, stuck-record worker, or delete behavior.
- `education-service/src/lessons/lessons.controller.ts` currently exposes only staff-only lesson list/detail routes.
- `api-gateway` docs map `/api/v1/lessons/:lessonUuid/record*` to `education-service`, but no target runtime route exists to receive those requests.
- Legacy evidence reviewed:
  - `speakasap-portal/cabinet/record_playback.py`
  - `speakasap-portal/cabinet/views.py`
  - `speakasap-portal/cabinet/teacher/views/lessons.py`
  - `speakasap-portal/education/tasks.py`
  - `speakasap-portal/education/lesson_records/tests/test_lesson_records.py`
  - `speakasap-portal/portal/utils/records_storage.py`
- Fresh no-write report: `/tmp/speakasap-lesson-records-g5-5-target-verification.json`.
- Report summary:
  - `writes=false`
  - `source_lesson_records=101184`
  - `target_lesson_records_existing=101184`
  - `source_lesson_record_parts=58234`
  - `would_upsert_lesson_record_parts=52453`
  - `missing_target_lesson=0`
  - `duplicate_lesson_records=0`
  - `part_referenced_by_multiple_records=0`
  - `bad_parts_json=0`
  - `records_ready=96729`
  - `records_processing=1414`
  - `records_unavailable=2332`
  - `records_none=2`
  - `records_inconsistent=4787`
  - remaining media/key inventory remains `parts_missing_rows=4080`, `orphan_parts=5781`, `legacy_prefix_keys_without_date=25934`, and `record_key_date_mismatch=39477`.
- Temporary Kubernetes target DB port-forward was closed after the no-write report.

Intent / ownership:

- Lesson-record metadata remains private and key-only in `education-service`.
- No object storage read, write, delete, public URL, presigned access change, deployment, frontend change, or gateway cutover was performed.
- Runtime access still must be owned by `education-service` behind `api-gateway`; object storage remains owned by `minio-microservice`.

Cutover gate:

- Goal 5.5 cannot be marked done yet because target runtime private playback/download, merge/delete, and failure-mode checks do not exist.
- Frontend or gateway cutover for recordings must remain blocked until target runtime endpoints and tests/smoke checks cover unauthorized access, paid/student eligibility, teacher assignment, staff policy, one-hour scoped token/presign expiry, old/new key fallback, helper/storage failures, merge idempotence, and safe part deletion behavior.

Next:

- Implement the target `education-service` lesson-recording runtime module and tests without changing frontend/gateway cutover; defer object deletion or production access changes until explicit owner approval and rollback evidence are recorded.

## 2026-06-12 - Goal 5.5 Lesson Recording Runtime Module Scaffold

Status: in progress; build verified; cutover still blocked

Changed:

- Added `education-service/src/lesson-records/` with a `LessonRecordsModule`.
- Registered the module in `education-service/src/app.module.ts`.
- Added gateway-aligned target routes under `education-service`:
  - `GET /api/v1/lessons/:lessonUuid/record`
  - `GET /api/v1/lessons/:lessonUuid/record/playback`
  - `GET /api/v1/lessons/:lessonUuid/record/download?token=...`
  - `POST /api/v1/lessons/:lessonUuid/record/presign`
  - `POST /api/v1/lessons/:lessonUuid/record/commit`
  - `POST /api/v1/lessons/:lessonUuid/record/merge`
  - `DELETE /api/v1/lessons/:lessonUuid/record`
- Added scoped playback media-token signing/verification with max TTL `3600` seconds.
- Added private helper-proxied download streaming that uses `RECORDS_S3_HELPER_URL` plus `RECORDS_S3_BUCKET`, preserves range headers, and tries key fallback with and without `courses/records/`.
- Added user-service profile lookup for teacher/student legacy IDs via `USER_SERVICE_URL` and bearer token.
- Added `education-service/scripts/verify-lesson-record-runtime-contract.js` and package script `npm run test:lesson-records`.

Intent / ownership:

- Owner replied `agree` on 2026-06-12 to continue the next Goal 5.5 implementation chunk.
- No deployment, gateway/frontend cutover, object storage mutation, object deletion, or public/permanent URL exposure was performed.
- Runtime routes are implemented in `education-service` behind existing `/api/v1/lessons` gateway ownership.
- Identity remains owned by `auth-microservice`; `education-service` resolves domain profile IDs through `user-service` rather than inventing identities.
- Object storage remains private; download is helper-proxied and token-scoped.

Guardrails still active:

- Student playback is deliberately blocked with `Student paid lesson-record access is not implemented in target data yet` because no migrated `StudentAccess`/paid lesson eligibility table exists in the target education schema.
- Presign and commit routes perform JWT and lesson-level teacher/staff authorization, then return service-unavailable until the private upload adapter and object metadata verification are implemented.
- Merge route performs JWT and lesson-level teacher/staff authorization, then returns service-unavailable until the target merge worker is implemented.
- Delete route performs JWT and lesson-level teacher/staff authorization, then refuses with conflict because object deletion requires explicit owner approval and rollback evidence.

Verification:

- `ssh alfares 'cd /home/ssf/Documents/Github/speakasap/education-service && npm run build'` passed.
- `ssh alfares 'cd /home/ssf/Documents/Github/speakasap/education-service && npm run test:lesson-records'` passed.
- Previous fresh no-write DB report remains `/tmp/speakasap-lesson-records-g5-5-target-verification.json` with `writes=false`, `target_lesson_records_existing=101184`, and `missing_target_lesson=0`.

Remaining blockers before cutover:

- Add or map target paid lesson eligibility equivalent to legacy `StudentAccess.is_paid` before student playback can be enabled.
- Implement private upload presign/commit with 900-second PUT expiry, audio content-type/60MB validation, object key validation, and ETag/size verification.
- Implement or explicitly defer target merge worker parity; no part deletion may run until merged output validation is implemented.
- Define owner-approved delete semantics and rollback before any target object deletion is enabled.
- Add runtime smoke tests against deployed service only after deployment approval.

Next:

- Continue Goal 5.5 by resolving paid student eligibility mapping and implementing private upload presign/commit or recording the owner-approved deferral before any frontend/gateway cutover.

## 2026-06-12 - Goal 5.5 Paid Eligibility Mapping And Private Upload Runtime

Status: implementation added; schema/data apply and deployment remain approval-gated

Changed:

- Added target Prisma model `StudentAccess` mapped to `education_studentaccess`.
- Added Prisma migration `20260612143000_student_access`.
- Extended `education-service/scripts/migrate-education-from-legacy.py` to include `education_studentaccess` in:
  - source counts;
  - duplicate UUID checks;
  - duplicate `(lesson_id, student_id)` checks;
  - missing lesson reference checks;
  - target conflict checks;
  - write-gated copy order;
  - rollback/truncate SQL order.
- Updated `education-service/src/lesson-records` so student playback now requires target paid access (`StudentAccess.isPaid`) instead of only group membership.
- Implemented private upload presign:
  - assigned teacher or staff authorization;
  - optional `studentId` group membership validation;
  - `kind=lesson|part`;
  - `contentType` must start with `audio/`;
  - size must be `0..62914560`;
  - legacy-compatible keys `YYYY/MM/DD/lesson_<lesson_uuid>.<ext>` and `YYYY/MM/DD/parts_<part_uuid>.<ext>`;
  - path-style SigV4 PUT URL with 900-second max expiry.
- Implemented private upload commit:
  - assigned teacher or staff authorization;
  - expected-key validation;
  - S3/MinIO HEAD metadata check;
  - optional ETag check;
  - size check;
  - DB metadata update for full lesson recording, part uploads, or unavailable recording.
- Added `USER_SERVICE_URL: "http://speakasap-user:4207"` to `k8s/services/education-service.yaml`.
- Updated `education-service/scripts/verify-lesson-record-runtime-contract.js` to assert paid access mapping and presign/commit storage checks.

Intent / ownership:

- Legacy paid playback behavior maps from `education_studentaccess.is_paid` to target `StudentAccess.isPaid`.
- Auth identity remains owned by `auth-microservice`; teacher/student legacy IDs are resolved via `user-service`.
- Object storage remains owned by MinIO/storage infrastructure; `education-service` only generates scoped private access and verifies object metadata.
- No object deletion, merge worker execution, deployment, frontend cutover, gateway cutover, Prisma migrate deploy, or target data apply was run.

Verification:

- `ssh alfares 'cd /home/ssf/Documents/Github/speakasap/education-service && npm run prisma:validate && npm run build && npm run test:lesson-records'` passed.
- `ssh alfares 'cd /home/ssf/Documents/Github/speakasap && python3 -m py_compile education-service/scripts/migrate-education-from-legacy.py'` passed.
- `ssh alfares 'cd /home/ssf/Documents/Github/speakasap && python3 education-service/scripts/migrate-education-from-legacy.py --help'` passed.
- Default write refusal passed:
  - `python3 education-service/scripts/migrate-education-from-legacy.py`
  - exited `2` with `Refusing to write by default`.
- Source-only dry run for student access passed without target writes:
  - `education_studentaccess=184464`
  - duplicate `education_studentaccess.uuid=0`
  - duplicate `education_studentaccess.lesson_student=0`
  - `student_access_missing_lesson=0`

Approval / rollback:

- Applying `20260612143000_student_access`, importing `education_studentaccess`, deploying `speakasap-education`, or enabling frontend/gateway traffic still requires explicit owner approval and fresh target dry-run evidence.
- Target object deletion remains disabled and still requires a separate owner-approved rollback plan.

Remaining blockers before cutover:

- Run target DB dry-run/check after the new `education_studentaccess` schema migration is approved for deploy.
- Apply/import `education_studentaccess` only after explicit write approval and rollback SQL.
- Add runtime smoke tests after deployment approval for unauthorized playback, unrelated student, unpaid student, paid student, assigned teacher, unassigned teacher, presign invalid content type/size/key, commit ETag/size mismatch, and old/new key fallback.
- Implement or defer merge-worker parity; no source part deletion may be enabled until merged output validation exists.

Next:

- Request approval for `education-service` Prisma migration deploy and write-gated `education_studentaccess` import, backed by a fresh target dry-run and rollback artifact.

## 2026-06-12 - Goal 5.5 Student Access Schema Deploy And Import

Status: done for paid eligibility data apply; deployment/cutover still blocked

Approval:

- Owner replied `I approve.` on 2026-06-12 after the approval request for `education_studentaccess` schema deploy/import.

Changed / applied:

- Applied Prisma migration `20260612143000_student_access` to `speakasap_education_db`.
- Ran a fresh target dry-run before write:
  - report path: `/tmp/speakasap-education-studentaccess-dry-run-g5-5.json`
  - source `education_studentaccess=184464`
  - target `education_studentaccess=0`
  - target UUID conflicts `0`
  - target `(lesson_id, student_id)` conflicts `0`
  - source missing lesson references `0`
  - source duplicate UUIDs `0`
  - source duplicate lesson/student pairs `0`
- Ran write-gated student-access-only import:
  - command class: `migrate-education-from-legacy.py --apply --student-access-only --confirm-write --approval-note ... --rollback-plan ...`
  - approval note: `Owner approved education_studentaccess schema deploy and import for SpeakASAP Goal 5.5 on 2026-06-12`
  - rollback artifact: `/tmp/speakasap-education-studentaccess-rollback-g5-5.sql`
  - rows written before script exit: `184464`
- Fixed the scoped migration function after the first import attempt exited nonzero: it had copied all `education_studentaccess` rows, then attempted a second duplicate copy because the new scoped function accidentally included a second student-access copy. The target was complete and duplicate-free; the script now copies `education_studentaccess` only once and compiles.

Post-apply read-only verification:

- Target `education_studentaccess=184464`
- Target paid rows `184214`
- Source `education_studentaccess=184464`
- Source paid rows `184214`
- Target duplicate UUID groups `0`
- Target duplicate `(lesson_id, student_id)` groups `0`
- Target missing lesson references `0`
- Prisma migration state: `20260612143000_student_access|t`

Verification:

- `python3 -m py_compile education-service/scripts/migrate-education-from-legacy.py` passed after the script fix.
- `git diff --check` passed.
- `STATE.json` and `docs/orchestrator/STATE.json` parse as JSON.
- Temporary Kubernetes DB port-forwards were closed after commands.

Guardrails:

- No `speakasap-education` deployment or rollout was run.
- No frontend/gateway cutover was run.
- No object storage write/delete/merge execution was run.
- Target record deletion remains disabled in code.

Next:

- Rebuild and deploy `speakasap-education` only after deployment approval, then run runtime smoke checks for paid/unpaid playback and presign/commit failure modes before frontend/gateway cutover.

## 2026-06-12 - Goal 5.5 Education Deployment And Runtime Smoke

Status: deployed `speakasap-education`; Goal 5.5 remains active; frontend/gateway cutover still blocked

Approval:

- Owner approval from delegated session: deploy `speakasap-education` and run runtime smoke checks only.
- No approval was inferred for frontend/gateway cutover, object deletion, merge-worker execution, or legacy route retirement.

Session context:

- Required orchestrator files were read from the remote authoritative repo where present.
- `docs/orchestrator/IMPLEMENTATION_ORCHESTRATOR.md` and `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md` are referenced by instructions/state but are not present in the remote repo file list for this session; repository evidence and the available orchestrator docs were used.
- RAG lookup failed with curl exit code `6` (`Could not resolve host: docs-rag-microservice.statex-apps.svc.cluster.local`), so repository and runtime evidence were used.
- Remote worktree before deploy contained the expected uncommitted Goal 5.5 changes on `main`.

Deploy evidence:

- Re-ran `education-service` build and lesson-record contract check before deploy:
  - `npm run build` passed.
  - `npm run test:lesson-records` passed.
- Top-level `scripts/deploy.sh` was not used because it applies gateway manifests and restarts all SpeakASAP services.
- Scoped deploy path used only education service resources:
  - built `localhost:5000/speakasap-education:latest` from `education-service/Dockerfile`.
  - pushed digest `sha256:aac37a909b47872e368a733f973d287e00be35136ff10f423c54bd84c3e5350e`.
  - applied only `k8s/services/education-service.yaml`.
  - restarted only `deployment/speakasap-education -n statex-apps`.
- Rollout evidence:
  - `deployment/speakasap-education` successfully rolled out.
  - ready replicas `1/1`, updated replicas `1`.
  - running pod image ID `localhost:5000/speakasap-education@sha256:aac37a909b47872e368a733f973d287e00be35136ff10f423c54bd84c3e5350e`.
  - restart count `0`, pod ready `true`.
  - `/health` returned `{"status":"ok"}`.

Runtime smoke evidence:

- Deployed HTTP smoke report: `/tmp/speakasap-education-runtime-smoke-g5-5.json`.
- Normal auth smoke user login succeeded through `auth-microservice` and mapped to migrated student profile `333`; the token has no teacher profile and no recorded-lesson `StudentAccess` rows.
- Candidate paid and unpaid `StudentAccess` rows exist in target data, but no safe real tokens were available for those users.
- `RECORDS_S3_*` settings are absent from the running `speakasap-education` pod, so valid object presign/download success paths are blocked by runtime configuration.
- Deployed HTTP checks passed for safe non-mutating cases:
  - state without auth: `401 UNAUTHORIZED`.
  - playback without auth: `401 UNAUTHORIZED`.
  - state with invalid token: `401 UNAUTHORIZED`.
  - download missing token: `403 FORBIDDEN`, no permanent URL in response.
  - download invalid token: `401 UNAUTHORIZED`, no permanent URL in response.
  - download token scoped to the wrong lesson: `401 UNAUTHORIZED`, no permanent URL in response.
  - download with syntactically valid scoped media token: `503` because private record storage helper is not configured; no permanent URL in response.
  - authenticated unrelated student state/playback: `403 FORBIDDEN`.
  - authenticated unrelated student presign/commit/merge/delete attempts: `403 FORBIDDEN` before write/delete/merge behavior.

Service-level smoke evidence:

- Deployed-image service-level mock report: `/tmp/speakasap-education-service-level-smoke-g5-5.json`.
- This used the compiled code inside the deployed pod with mocked Prisma/profile/storage dependencies; no network object storage call and no DB write were performed.
- Service-level checks covered blocked teacher/staff branches safely:
  - presign invalid content type: `400 BadRequestException`.
  - presign oversize: `400 BadRequestException`.
  - valid staff presign shape: method `PUT`, expiresIn `900`, deterministic private key, SigV4-style signature present.
  - commit key mismatch: `400 BadRequestException`.
  - commit ETag mismatch: `400 BadRequestException`.
  - commit size mismatch: `400 BadRequestException`.
  - merge remains disabled: `503 ServiceUnavailableException`.
  - delete remains disabled: `409 ConflictException`.
  - mock counters showed `transactions=0` and `partDeletes=0`.

Guardrails preserved:

- No frontend or gateway deployment/cutover was run.
- No merge worker was executed.
- No object deletion or object write was run.
- No legacy route was retired.
- No rollback SQL was executed.
- `git diff --check` passed after deployment/smoke.

Blockers before Goal 5.5 can be closed:

- Obtain safe real tokens for a paid recorded-lesson student, unpaid recorded-lesson student, assigned teacher, unassigned teacher, and staff user; or add an owner-approved non-production token fixture path.
- Configure `RECORDS_S3_HELPER_URL`, `RECORDS_S3_BUCKET`, `RECORDS_S3_ENDPOINT_URL`, `RECORDS_S3_ACCESS_KEY`, `RECORDS_S3_SECRET_KEY`, and region/SSL settings for `speakasap-education` through Vault/ESO before valid runtime presign/download success can be smoked.
- Re-run deployed HTTP smoke for paid/unpaid playback, teacher/staff presign, commit mismatch after authorization, and valid 900-second private SigV4 PUT after the token and storage blockers are resolved.

Next:

- Continue Goal 5.5 by resolving runtime auth-token fixtures and recording-storage env configuration; keep frontend/gateway cutover, merge execution, object deletion, and legacy retirement blocked until separate approval and evidence exist.

## 2026-06-12 - DocsRAG JWT Runtime Wiring Fixed Across SpeakASAP Services

Current focus:

- Owner-selected operational fix: make DocsRAG usable from SpeakASAP runtime pods after the same JWT_TOKEN issue was fixed for AI, RunLayer, and Leads.
- Runtime source changes: Kubernetes ExternalSecret manifests only; no application code, schema, data migration, object storage mutation, frontend cutover, or gateway route behavior change.

Source context:

- Queried DocsRAG through the already-fixed Leads runtime pod; retrieval returned HTTP 200.
- Compared the existing AI/RunLayer/Leads pattern: .env.example documents JWT_TOKEN and ExternalSecret maps secret/prod service property JWT_TOKEN into the Kubernetes secret.
- Confirmed SpeakASAP root .env.example and k8s/external-secret.yaml already had JWT_TOKEN wiring in the current worktree.
- Confirmed live SpeakASAP ExternalSecrets already mapped JWT_TOKEN for root and service secrets, but most running pods were old and did not expose JWT_TOKEN in process env.
- Added durable JWT_TOKEN mapping to service manifests that were missing it: assessment, certification, content, course, financial, notification, payment, salary, and user. Education already had the mapping; api-gateway consumes speakasap-secret.

Validation evidence:

- Before restart, runtime env checks showed JWT_TOKEN missing from speakasap, api-gateway, assessment, certification, content, course, financial, notification, payment, salary, and user; education already reported present.
- Restarted deployments in statex-apps: speakasap, speakasap-api-gateway, assessment, certification, content, course, education, financial, notification, payment, salary, and user.
- Final rollout status passed for all 12 SpeakASAP deployments.
- Final runtime env checks reported JWT_TOKEN present for speakasap, api-gateway, assessment, certification, content, course, education, notification, payment, salary, and user; financial pod was separately checked and reported JWT_TOKEN_PRESENT with PORT=4213.
- Public health passed: https://speakasap.alfares.cz/health returned {"status":"ok"}.
- DocsRAG retrieval from deployment/speakasap using Node fetch returned HTTP 200 for query Speak ASAP operational constraints.
- Sensitive-data handling: token values were never printed or copied; only presence and HTTP status were recorded.

Gate decision:

- DocsRAG credential blocker is resolved for SpeakASAP runtime pods. Future RAG queries should run from an in-cluster runtime pod or other trusted in-cluster client; a plain SSH shell is not expected to expose runtime secrets.

Next:

- Continue Goal 5.5 by resolving safe real role tokens and RECORDS_S3_* runtime configuration before success-path private media smoke or frontend/gateway cutover.

## 2026-06-12 - Goal 5.5 Runtime Smoke Continued After DocsRAG JWT Fix

Current focus:

- Continued SpeakASAP Goal 5.5 on alfares after DocsRAG JWT became available from runtime pods.
- DocsRAG retrieval from deployment/speakasap returned HTTP 200 using JWT_TOKEN without printing token values.
- Source/deploy work stayed remote-only in /home/ssf/Documents/Github/speakasap.

Changes deployed:

- Updated education-service staff access detection to accept scoped auth roles such as global:superadmin in addition to staff/admin/manager/superadmin.
- Updated lesson-record runtime contract verifier to assert the superadmin staff access mapping.
- Rebuilt and pushed localhost:5000/speakasap-education:latest, then restarted deployment/speakasap-education. Rollout completed successfully.

Validation evidence:

- education-service: node scripts/verify-lesson-record-runtime-contract.js passed.
- education-service: npm run build passed.
- Deployed runtime smoke report: /tmp/speakasap-goal55-runtime-smoke-20260612-v3.json.
- Smoke used short-lived in-memory JWTs signed inside the auth pod; token values and presigned URLs were not printed.
- Auth validation for the staff candidate returned role global:superadmin, explaining the previous staff authorization mismatch.
- Staff paths now pass authorization:
  - staff presign valid: 201 with private SigV4 PUT shape and no permanent URL.
  - staff commit key mismatch: 400 before object mutation.
  - staff merge disabled: 503 target merge worker not implemented.
  - staff delete disabled: 409 deletion disabled until owner-approved object deletion exists.
- Existing paid/unpaid/teacher checks remained aligned:
  - no auth and invalid token rejected.
  - paid student state/playback metadata returned 200 with gateway-download tokenized URL and no permanent URL.
  - unpaid student playback denied with 403.
  - assigned teacher presign valid returned 201; unassigned teacher presign denied with 403.

Remaining blocker:

- Paid student tokenized range download returns 404 in the deployed smoke. Earlier diagnostics showed RECORDS_S3_HELPER_URL resolves to localhost in the education pod and no records_s3_helper is running there; the current remote source also contains a dirty storage.service.ts change that attempts localhost-helper fallback via presigned S3 streaming, but the selected existing record object is still not retrievable.
- Do not close Goal 5.5 until playback download is proven against an owner-approved existing object or a safe uploaded fixture, with no permanent URL exposure.

Next:

- Resolve the private media playback object/helper path for speakasap-education, then rerun /tmp/speakasap_goal55_runtime_smoke.js and record a 200 or 206 tokenized download result before frontend/gateway cutover.

## 2026-06-13 - Goal 5.5 Playback Smoke Unblocked

Current focus:

- Continued Goal 5.5 private lesson-record playback verification on alfares.
- DocsRAG retrieval from deployment/speakasap returned HTTP 200 with runtime JWT_TOKEN; token values were not printed.

Root cause fixed:

- speakasap-education-secret had RECORDS_S3_ACCESS_KEY set to the MinIO root user but RECORDS_S3_SECRET_KEY did not match the MinIO root password.
- Updated k8s/services/education-service.yaml so RECORDS_S3_SECRET_KEY maps from Vault key secret/prod/minio-microservice, property MINIO_ROOT_PASSWORD.
- Applied the education manifest, forced ExternalSecret refresh, verified secret fingerprints matched without printing secret values, and restarted deployment/speakasap-education.

Validation evidence:

- New education pod reports the corrected secret fingerprint matching MinIO; no secret value was printed.
- Direct deployed S3 probe for existing key shape YYYY/MM/DD/lesson_UUID.mp3 returned 206 audio/mpeg, Content-Range: bytes 0-31/11173841.
- Sanitized deployed smoke report: /tmp/speakasap-goal55-runtime-smoke-20260613-v5.json.
- v5 smoke used short-lived in-memory JWTs signed inside the auth pod; token values and presigned URLs were not printed.
- Paid student playback success path now passes:
  - state: 200 ready.
  - playback metadata: 200, mode gateway-download, tokenized URL, no permanent URL.
  - tokenized range download: 206 audio/mpeg, no permanent URL.
- Access controls still hold:
  - no auth and invalid token rejected with 401.
  - unpaid student playback denied with 403.
  - unassigned teacher presign denied with 403.
  - assigned teacher presign returns 201 private SigV4 PUT shape.
  - commit key mismatch returns 400 before mutation.
  - merge remains disabled with 503; delete remains disabled with 409.

Gate decision:

- Goal 5.5 private playback, paid access, denied access, teacher/staff presign, commit mismatch, merge-disabled, and delete-disabled runtime checks are now validated against deployed services.
- Frontend/gateway cutover, merge worker execution, object deletion, and legacy retirement remain blocked until owner-selected follow-up scope.

Next:

- Prepare the next owner-approved Goal 5 follow-up: frontend/gateway integration or merge/delete implementation scope, without changing legacy routing yet.


## 2026-06-13 - Goal 5 Follow-up Gateway Integration And Merge/Delete Confirmation Gates

Current focus:

- Owner approved merging the Goal 5 follow-up work and proceeding with frontend/gateway integration.
- Checked the coordinator-maintained Active Agents marker before continuing; AGENTS.md still reports None.
- Work stayed remote-only in /home/ssf/Documents/Github/speakasap.
- DocsRAG retrieval from deployment/speakasap returned HTTP 200 for the Goal 5 follow-up query after pod-side JWT expansion was corrected; token values were not printed.

Changes deployed:

- api-gateway now streams proxied upstream bodies instead of buffering media responses, preserving range/media behavior for lesson-record downloads.
- api-gateway auth guard now allows unauthenticated GET /api/v1/lessons/:lessonUuid/record/download when the scoped media token is present in the query string; other lesson-record routes still require bearer auth.
- education-service now includes S3 object helpers for merge/delete storage operations and explicit confirmation gates for destructive operations: confirmMerge and confirmDelete must match the lesson UUID before execution.
- frontend learner and teacher pages now call gateway lesson-record endpoints for state, playback, tokenized range checks, teacher/staff presign, merge, and delete; teacher merge/delete send the explicit confirmation body.
- Rebuilt and pushed localhost:5000/speakasap-education:latest digest sha256:776f5086ccf2d578f4de84ac34b7bde7a051890ac0c26287471e78842d6371f1.
- Rebuilt and pushed localhost:5000/speakasap-api-gateway:latest digest sha256:d5568fd64226473d7474089030104bb3161b8d2803993ded799e530db3ac9763.
- Applied education and api-gateway manifests and restarted deployment/speakasap-education and deployment/speakasap-api-gateway; both rollouts completed successfully.

Validation evidence:

- education-service: npm run test:lesson-records passed.
- education-service: npm run build passed.
- api-gateway: npm run build passed.
- frontend: npm run build passed. No frontend Dockerfile or Kubernetes frontend deploy target was found in this repository, so frontend code is built but not deployed from this repo.
- Gateway smoke report: /tmp/speakasap-goal55-gateway-smoke-20260613-v2.json.
- v2 smoke used short-lived in-memory JWTs signed inside the auth pod; token values and presigned URLs were not printed.
- Gateway smoke passed auth and access-control checks: no auth 401, invalid token 401, paid state/playback 200, unpaid playback 403, unassigned teacher presign 403, teacher/staff presign 201, commit key mismatch 400, delete without confirmDelete 400.
- Gateway smoke confirms no permanent URL exposure in response summaries.

Important incident and blocker:

- Earlier gateway smoke report /tmp/speakasap-goal55-gateway-smoke-20260613-v1.json used stale delete-disabled expectations after delete had been enabled in the first deployment attempt and deleted the paid fixture metadata/object for lesson 7d870263-bdcb-4bba-b25e-1f6b40402411.
- The lesson-record metadata was restored by Prisma upsert to uuid 8c0da4cd-5a21-4e8a-bcc9-d137ec80adab and key 2018/07/10/lesson_7d870263-bdcb-4bba-b25e-1f6b40402411.mp3.
- The object itself is still missing: the post-redeploy gateway range check returns 404 for paid_student_token_download_range, while playback metadata still returns 200 and issues a tokenized URL.
- No exact source MP3 was found under /home/ssf/Documents/Github, and no replacement audio was fabricated. Restoring the original object or selecting/uploading an owner-approved fixture is required before closing this follow-up.

Gate decision:

- Backend gateway integration and confirmation-gated merge/delete code are deployed.
- Frontend gateway integration code builds but is not deployed from this repository because no frontend deploy target exists here.
- Goal 5 cannot be closed after this follow-up until the missing paid fixture object is restored and gateway tokenized range download returns 206 again.

Next:

- Restore the original paid fixture object or provide an owner-approved safe replacement fixture, then rerun gateway smoke and update the evidence before any commit or cutover.


Focused fresh-fixture addendum:

- Read-only candidate search found ready lesson d7d708dc-8c89-496f-a5b6-af30ed6db104 with an existing private object; the check read only bytes 0-31.
- Focused deployed gateway smoke report /tmp/speakasap-goal55-focused-gateway-smoke-20260613-v1.json verified staff playback 200 with gateway-download tokenized URL, gateway range download 206 audio/mpeg with Content-Range bytes 0-31/7407935 and 32 bytes, already-ready merge idempotent noop, and delete without confirmDelete blocked with 400.
- This focused smoke is the current successful media playback evidence while the older paid fixture object remains missing.


## 2026-06-13 - Goal 5 Gateway Smoke Restored After Owner-Approved Fixture Replacement

Current focus:

- Owner approved restoring the missing paid lesson recording with an approved replacement fixture so Goal 5 gateway validation could continue.
- Checked AGENTS.md before proceeding; Active Agents still reported None.

Restoration:

- Used legacy portal fixture /home/ssf/Documents/Github/speakasap-portal/education/lesson_records/tests/example.mp3 as the owner-approved replacement audio.
- Uploaded it through the running speakasap-education pod to the original private object key 2018/07/10/lesson_7d870263-bdcb-4bba-b25e-1f6b40402411.mp3, preserving the target lesson-record metadata and gateway URL shape.
- The custom follow-up HEAD helper returned a generic metadata check failure, so validation used the production gateway playback/download path instead.

Validation evidence:

- Gateway smoke report: /tmp/speakasap-goal55-gateway-smoke-20260613-v5.json.
- v5 smoke used short-lived in-memory JWTs signed inside the auth pod; token values and presigned URLs were not printed.
- Paid student state/playback metadata returned 200/200 with gateway-download tokenized URL and no permanent URL.
- Paid student tokenized range download returned 206 audio/mpeg with 32-byte range body and no permanent URL.
- Access controls still hold: no auth 401, invalid token 401, unpaid playback 403, unassigned teacher presign 403, teacher/staff presign 201, commit key mismatch 400, already-ready merge noop 201, delete without confirmDelete 400.

Gate decision:

- The prior missing-object blocker is resolved with owner-approved replacement fixture evidence.
- Backend gateway integration and confirmation-gated merge/delete are deployed and smoke-validated.
- Frontend gateway integration code builds, but no frontend deployment target exists in this repository.

Next:

- Prepare the intent-preservation commit or locate the frontend deployment path before cutover, keeping confirmed destructive merge/delete usage out of smoke tests unless explicitly scoped.


## 2026-06-13 - Goal 6 Frontend Deployment Path Discovery

Current focus:

- Owner requested locating the frontend deployment path before cutover and clarified it should be in the same remote/server context.
- Checked AGENTS.md before discovery; Active Agents reported None.
- Discovery was read-only against /home/ssf/Documents/Github/speakasap, sibling deployment examples, and Kubernetes state.
- DocsRAG retrieval from deployment/speakasap returned HTTP 200 for the frontend deployment path query; token values were not printed.

Located source and live route:

- Frontend source path exists in this repository: /home/ssf/Documents/Github/speakasap/frontend.
- The frontend is a Next.js app with package scripts dev/build/start in frontend/package.json.
- Public host speakasap.alfares.cz routes through ingress speakasap to service speakasap port 3000.
- The live root deployment is deployment/speakasap in namespace statex-apps using image localhost:5000/speakasap:latest.

Deployment gap:

- Root Dockerfile currently builds api-gateway from api-gateway/package*.json and api-gateway/src, not frontend/.
- The running speakasap pod contains an api-gateway package and returns Express JSON 404 for GET /; it is not serving the Next frontend.
- No speakasap-frontend deployment, service, ingress, frontend Dockerfile, or deploy-frontend script exists in the SpeakASAP repository.
- Sibling repositories show the expected pattern for frontend deployment: a dedicated frontend image, deployment, service, and deploy script. SpeakASAP has not implemented that path yet.

Cutover implication:

- The frontend deployment path is only partially present: source is /home/ssf/Documents/Github/speakasap/frontend, and the public route currently points at deployment/speakasap, but that deployment image is not the frontend.
- Before cutover, create or adapt a frontend deployment path for the Next app, then decide whether speakasap.alfares.cz should route directly to a frontend service or whether the root speakasap image should be rebuilt to contain the frontend.

Next:

- Implement the missing SpeakASAP frontend deployment path: Dockerfile for frontend, Kubernetes deployment/service and ingress routing decision, deploy script, build/rollout/smoke evidence.
