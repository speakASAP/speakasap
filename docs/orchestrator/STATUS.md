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
