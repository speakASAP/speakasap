## 2026-06-13 - Salary Lesson UUID Backfill Implementation

Status: code implementation complete; DB-backed backfill report blocked by target DB connectivity; no salary writes ran.

Changed:

- Enhanced `salary-service/scripts/migrate-salary-data.ts` with `--lesson-uuid-backfill-only` mode.
- The migration now derives imported lesson salary expense mappings from the existing joined `education_lessonsalaryexpense.lesson_id` data and can populate `SalaryExpense.lessonUuid` for future full imports.
- Added dry-run report fields for lesson UUID backfill: source mappings, education verification status, missing target lesson UUID samples, imported lesson rows with/without UUIDs, and candidate update samples.
- Added write-gated apply behavior that updates only existing imported `salary_expenses.lesson_uuid` rows when `--apply --lesson-uuid-backfill-only --confirm-write --approval-note ... --rollback-plan ...` is supplied.
- Added rollback SQL generation for the lesson UUID backfill-only mode.
- Updated `docs/orchestrator/SALARY_MIGRATION_INVENTORY.md` to mark code support present and keep DB-backed report/apply as the next gated step.

Evidence:

- RAG lookup from the local session failed with curl exit code `6`, so repository and remote evidence were used.
- Reviewed remote salary migration code and schema in `/home/ssf/Documents/Github/speakasap/salary-service` and education lesson schema in `education-service/prisma/schema.prisma`.
- `cd salary-service && npm run build` passed after the change.
- `cd salary-service && npm run migrate:salary-data -- --help` shows `--lesson-uuid-backfill-only` dry-run and apply commands.
- `cd salary-service && npm run migrate:salary-data -- --apply --lesson-uuid-backfill-only --confirm-write --approval-note test` refused before any DB write because `--rollback-plan` was absent.
- DB-backed dry-run attempts were no-write but blocked before report creation: with all DB URLs rewritten to `127.0.0.1:15434`, education verification failed with `ECONNREFUSED`; without rewriting `EDUCATION_DATABASE_URL`, cluster DNS failed with `EAI_AGAIN db-server-postgres`. `ss -ltn | grep 15434` showed no active listener on `alfares`.

Boundaries:

- No salary profile, salary expense, employee contract, calculation run, payout run, payment, education, or legacy data write was run.
- No payout/disbursement, deployment, destructive action, or legacy retirement ran.
- Existing unrelated remote worktree changes were preserved and not reverted.

Next:

- Restore target salary/education DB connectivity on `alfares`, run the no-write `--dry-run --lesson-uuid-backfill-only --json-report /tmp/speakasap-salary-lesson-uuid-backfill-dry-run-v1.json`, then request explicit owner approval before any backfill apply.


## 2026-06-13 - Goal 10 Seven Write-Gated Apply Path

Status: apply path implemented and verified in no-write mode; no schema migration, data apply, deployment, object mutation, destructive operation, or legacy retirement ran.

Changed:

- Extended `content-service/scripts/migrate-seven-from-legacy.py` from dry-run-only to a write-gated importer.
- Apply mode now requires `--apply --confirm-write --approval-note ... --rollback-plan ...`.
- Apply mode generates rollback SQL before writes and refuses to run when dry-run blocking issues exist.
- Added static rendering for common legacy Django tags: `title`, `audio`, `video`, `url`, `load`, and `hg/endhg`, so migrated HTML is closer to legacy learner-visible output and does not expose common template syntax.

Verification:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `content-service/scripts/migrate-seven-from-legacy.py --help` showed the write gates.
- `content-service/scripts/migrate-seven-from-legacy.py --apply` refused before any connection/write with `ERROR: --apply requires --confirm-write` and exit status `2`.
- `/tmp/speakasap-seven-dry-run-v2.json` recorded `writes=false`, `applySupported=true`, source counts `sevenCourses=19`, `sevenLessons=136`, and migration payload `courses=19`, `lessons=136`, `exercises=429`.
- `/tmp/speakasap-seven-dry-run-target-v5.json` used the runtime `speakasap-content-secret` database URL through a temporary port-forward and recorded `writes=false`, target checked, no blocking issues, and target `SevenCourse`, `SevenLesson`, and `SevenExercise` tables missing before schema migration.

Boundaries:

- No content-service schema migration was applied.
- No seven content data was written.
- No frontend/content/gateway deployment was run.
- No legacy route was retired.
- Legacy `speakasap-portal` remains the behavior/style reference and fallback.

Next:

- Get owner approval to apply only `content-service/prisma/migrations/20260613110000_seven_content/migration.sql`, then rerun the DB-backed no-write seven report before any data apply approval is considered.


## 2026-06-13 - Goal 10 Seven Schema/API, Dry-Run Importer, And Frontend Routes

Status: partial implementation complete; no DB write, deployment, object mutation, destructive operation, or legacy route retirement ran.

Changed:

- Added content-service Prisma models `SevenCourse`, `SevenLesson`, and `SevenExercise`, plus migration SQL `content-service/prisma/migrations/20260613110000_seven_content/migration.sql`.
- Added content-service `seven` module with public read endpoints for courses, lessons, and lesson details.
- Added api-gateway upstream route `/api/v1/seven -> CONTENT_SERVICE_URL`.
- Added a narrow anonymous gateway exception for `GET /api/v1/seven...`; non-GET API requests still require bearer auth.
- Added `content-service/scripts/migrate-seven-from-legacy.py`, a dry-run-first inventory/reconciliation report; apply mode is intentionally blocked.
- Added frontend public routes `/<languageCode>/seven` and `/<languageCode>/seven/<order>`, gateway-only data loading in `frontend/lib/seven.ts`, and legacy typography CSS/font assets for `PT Mono` and `Open Sans`.

Verification:

- `cd content-service && npm run prisma:validate` passed.
- `cd content-service && npm run build` passed.
- `cd api-gateway && npm run build` passed.
- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `cd frontend && npm run build` passed; Next listed dynamic routes `/(languageCode)/seven` and `/(languageCode)/seven/[order]`.

Dry-run evidence:

- `/tmp/speakasap-seven-dry-run-v1.json`: `writes=false`, `sevenCourses=19`, `sevenLessons=136`, no blocking issues.
- `/tmp/speakasap-seven-dry-run-target-v4.json`: used the runtime `speakasap-content-secret` database URL through temporary port-forward; `writes=false`, `sevenCourses=19`, `sevenLessons=136`, no blocking issues, `warnings=4`, and target `SevenCourse`, `SevenLesson`, and `SevenExercise` tables do not exist yet.
- Template inventory from the report: `lessonRowsWithExistingTemplate=136`, `exerciseHtmlFiles=429`, `answerHtmlFiles=428`, `missingLessonTemplates=0`.
- Expected warnings include non-7 row courses: English `8`, German `8`, Chinese `8`, plus missing media root in the checkout. This confirms the importer must not truncate all languages to exactly seven DB rows.

Intent / ownership:

- Public seven-course content is owned by `content-service`; frontend calls through `api-gateway`.
- `course-service` remains owner for paid products/offers; `education-service` remains owner for private progress/access; `seven_test` remains later assessment/certification scope.
- Legacy `speakasap-portal` remains the behavior/style reference and fallback.

Next:

- Get owner approval to apply only the content-service seven schema migration, then rerun DB-backed no-write report before any seven content data apply.


## 2026-06-13 - Goal 10 Seven-Lesson Frontend Migration Plan

Status: active planning; no DB write, deployment, object mutation, destructive operation, or legacy retirement ran.

Owner request:

- Migrate only the old `speakasap-portal` seven-lesson course frontend/content into the new `speakasap` server/platform.
- Move all data for the seven lessons to the new server/database.
- Preserve the learner-visible text style because it is intentionally readable for the audience.

Changed:

- Added `docs/orchestrator/SEVEN_LESSON_FRONTEND_MIGRATION_PLAN.md`.
- Added Goal 10 to `docs/orchestrator/GOALS.md`.
- Updated `TASKS.md`, `docs/orchestrator/IMPLEMENTATION_STATE.md`, `docs/orchestrator/STATE.json`, and root `STATE.json` to make Goal 10 active and pause Goal 9 without reverting existing salary changes.

Evidence:

- RAG was unavailable in the remote shell because `JWT_TOKEN` was not set, so this planning pass used repository evidence.
- Legacy `seven` evidence includes `seven/models.py`, `seven/urls.py`, `seven/api_views.py`, `portal/fixtures/seven.xml`, `seven/templates/seven/*`, `speakasap_site/templates/site/seven/base.html`, `speakasap_site/templates/site/seven/index.html`, `speakasap_site/static/css/speakasap.css`, `speakasap_site/static/css/site.css`, and `speakasap_site/static/scss/_seven.scss`.
- Target evidence includes `content-service/prisma/schema.prisma`, `content-service/src/grammar/*`, `frontend/app/*`, `frontend/lib/api-client.ts`, and `api-gateway/src/proxy/upstream-resolve.ts`.
- Read-only sub-agents completed legacy seven discovery and target platform discovery.

Intent / ownership:

- Public seven-course content belongs in `content-service`; frontend must call through `api-gateway`.
- `course-service` remains owner for paid products/offers, `education-service` for private progress/access, and assessment/certification for final tests.
- Legacy portal remains the behavior/style reference and fallback.

Next:

- Goal 10.1: implement the content-service seven-course schema/API contract without writing migrated data, then run build/static validation.

# SpeakASAP Orchestrator Status

## 2026-06-13 - Salary Migration Apply To Kubernetes DB

Status: done; salary data stored in the existing Kubernetes-backed `speakasap_salary_db` through a temporary Postgres port-forward.

Owner approval:

- User instructed: "Use existing database on the SpikaSub, which is running on the Kubernetes, and use the SpikaSub database to store it." This was treated as approval to apply salary migration data to the existing SpeakASAP Kubernetes salary database after a clean no-write report.

Commands and reports:

- Temporary DB path: `kubectl -n statex-apps port-forward svc/db-server-postgres 15434:5432` on `alfares`.
- Pre-apply no-write report: `/tmp/speakasap-salary-dry-run-k8s-v1.json`.
- Apply report: `/tmp/speakasap-salary-apply-k8s-v1.json`.
- Rollback SQL: `/tmp/speakasap-salary-rollback-k8s-v1.sql`.
- Post-apply no-write report: `/tmp/speakasap-salary-post-apply-k8s-v1.json`.

Evidence:

- Pre-apply target counts were empty: salary profiles `0`, salary expenses `0`, employee contracts `0`, calculation runs `0`, payout runs `0`.
- Pre-apply conflicts were empty for legacy profile IDs, legacy expense IDs, and legacy contract IDs.
- Apply completed with `load_complete`; no payout, deployment, or payment-service disbursement was run.
- Applied target counts from post-apply dry-run: `salary_profiles=386`, `salary_expenses=103983`, `employee_contracts=632`, `calculation_runs=0`, `payout_runs=0`.
- Legacy source counts in the report: `salaryProfiles=386`, `salaryExpenseBaseRows=105321`, `lessonSalaryExpenseRows=99820`, `supportBonusRows=179`, `employeeContracts=632`, `expensesUserWithoutProfile=1338`, `lessonExpenseMissingLesson=0`, `courseSingleLessonSalaryRows=24152`, `courseGroupLessonSalaryRows=1250`.
- Expected skips/gaps remain: `1338` salary expenses without a salary profile were not imported; `SalaryProfile.authUserId` remains null for imported profiles; lesson salary rows keep `lessonUuid` null until education-service backfill/aggregate parity is completed.

Validation:

- Post-apply dry-run completed with `writes=false`.
- Post-apply conflicts now list imported legacy IDs, which is expected evidence that rerun/apply would duplicate existing imported rows unless handled by idempotent skip/update logic.

Next:

- Deploy the new user-service/education-service salary aggregate endpoints when approved, then reconcile salary calculation lines against the migrated salary expenses and education aggregates before any payout run.

## 2026-06-13 - Salary Migration Implementation Hardening

Status: partial; code implemented, runtime DB-backed salary dry-run blocked by target DB reachability.

Changed:

- Added `user-service` internal `GET /api/v1/internal/teachers/legacy-user-map` to map legacy portal user IDs to legacy teacher IDs for cross-service salary aggregation.
- Added `education-service` internal `GET /api/v1/internal/salary/period-aggregates` guarded by `X-Internal-Token`.
- Added education salary aggregate module/service and wired it into `education-service/src/app.module.ts`.
- Hardened `salary-service/scripts/migrate-salary-data.ts` with `--json-report`, `--apply`, `--confirm-write`, `--approval-note`, and `--rollback-plan` gates; legacy `--load` is now treated as write mode and requires the same gates.
- Copied/updated `docs/orchestrator/SALARY_MIGRATION_INVENTORY.md` in the authoritative remote checkout.

Intent and ownership:

- Preserves legacy teacher salary behavior as a gated migration path.
- `salary-service` remains salary owner; `education-service` supplies lesson aggregates; `user-service` supplies teacher identity mapping; payment execution remains outside scope and still requires owner approval through the payment boundary.
- No salary load, payout, deployment, DB write, or payment action was run.

Verification:

- `cd user-service && npm run build` passed.
- `cd education-service && npm run build` passed.
- `cd salary-service && npm run build` passed.
- `cd salary-service && npm run migrate:salary-data -- --help` passed and showed the new dry-run/apply gate usage.
- `cd salary-service && npm run migrate:salary-data -- --apply` failed before DB setup with the expected write-gate error.
- Read-only DB-backed salary dry-run command `cd salary-service && npm run migrate:salary-data -- --dry-run --json-report /tmp/speakasap-salary-dry-run-implementation-v1.json` reached the legacy DB and reported source counts, then failed when target Prisma could not reach `db-server-postgres:5432` from the remote shell.

Evidence:

- Legacy source counts observed before the target DB failure: `salaryProfiles=386`, `salaryExpenseBaseRows=105321`, `lessonSalaryExpenseRows=99820`, `supportBonusRows=179`, `employeeContracts=632`, `expensesUserWithoutProfile=1338`, `lessonExpenseMissingLesson=0`, `courseSingleLessonSalaryRows=24152`, `courseGroupLessonSalaryRows=1250`.
- Target DB blocker: `PrismaClientInitializationError: Can't reach database server at db-server-postgres:5432`.

Next:

- Provide a reachable target salary database connection or port-forward for the remote shell, then rerun the no-write salary JSON report before any apply approval is considered.

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
## 2026-06-13 - Goal 6.1 Frontend Deployment Path Implemented

Status: done for deployment path and smoke evidence

Changed:

- Added `frontend/Dockerfile` for a Next.js standalone production image on port `4211`.
- Enabled `output: "standalone"` in `frontend/next.config.ts`.
- Added `k8s/services/frontend.yaml` with `speakasap-frontend` Deployment, Service, and ConfigMap.
- Updated `k8s/ingress.yaml` to route `/health` and `/api` to `speakasap-api-gateway:4210`, and `/` to `speakasap-frontend:4211`.
- Added `scripts/deploy-frontend.sh` as the scoped deploy command for build, push, manifest apply, rollout, and smoke checks.
- Added `speakasap-frontend` to the full-platform rollout list in `scripts/deploy.sh`.
- Added `docs/orchestrator/FRONTEND_DEPLOYMENT_PATH.md` with routing decision, deploy command, rollback, and smoke evidence.

Evidence:

- RAG query for frontend deployment context failed with curl exit code 6, so repository/runtime evidence was used.
- `cd frontend && npm run build` passed before deployment.
- `./scripts/deploy-frontend.sh` built and pushed `localhost:5000/speakasap-frontend:latest` with digest `sha256:97b3d7069530433ee65b165e5f0c33ba31acd79525939a5b4296d9973f3d35e8`.
- `deployment/speakasap-frontend` rolled out successfully in `statex-apps`; final pod `speakasap-frontend-788dbfc4b5-9s66h` was `1/1 Running` with `0` restarts.
- Ingress evidence after deploy: `/health -> speakasap-api-gateway:4210`, `/api -> speakasap-api-gateway:4210`, `/ -> speakasap-frontend:4211`.
- Public smoke: `https://speakasap.alfares.cz/` returned `HTTP/2 200` with `content-type: text/html; charset=utf-8` and `x-powered-by: Next.js`.
- Gateway health smoke: `https://speakasap.alfares.cz/health` returned `HTTP/2 200` with Express JSON headers.
- Protected API smoke: `https://speakasap.alfares.cz/api/v1/lessons` returned `HTTP/2 401`, confirming gateway auth remains enforced for protected routes.

Boundaries:

- No database writes, object-storage mutation, lesson-record rerun, rollback execution, legacy retirement, or payment/notification ownership change was performed.
- Frontend browser API ownership remains gateway-first; service-owned APIs still route through `speakasap-api-gateway`.
- Docker build reported existing frontend dependency audit findings: `3 vulnerabilities (2 moderate, 1 high)`; remediation is deferred to a dependency/security chunk.

Next:

- Continue Goal 6 by implementing or verifying frontend routes for selected migrated workflows, starting with lesson-recording playback/upload UX against the gateway contracts.
## 2026-06-13 - Goal 6.2 Frontend Routes For Lesson Recording

Status: done for unauthenticated/dummy-token route implementation and rendered verification

Changed:

- Added shared `LessonRecordWorkspace` client component for learner/teacher lesson-recording route checks.
- Added `/learner/lessons/[lessonUuid]/record` and `/teacher/lessons/[lessonUuid]/record`.
- Updated `/learner` and `/teacher` shell pages to open the dynamic lesson-record route for a supplied lesson UUID.
- Hardened `frontend/lib/api-client.ts` so gateway calls normalize relative paths and tolerate absolute scoped URLs.
- Removed direct clickable merge/delete behavior from the route UI; destructive actions are explicitly excluded from frontend verification controls.
- Fixed mobile horizontal overflow found during browser QA.
- Updated `scripts/deploy-frontend.sh` with retrying smoke checks because immediate Cloudflare/root smoke can transiently return `502` during endpoint propagation.
- Added `docs/orchestrator/FRONTEND_ROUTE_VERIFICATION.md`.

Evidence:

- RAG query failed with curl exit code 6, so repository/runtime evidence was used.
- `cd frontend && npm run build` passed and listed dynamic routes `/learner/lessons/[lessonUuid]/record` and `/teacher/lessons/[lessonUuid]/record`.
- Final deployed frontend image digest: `sha256:d1c0c00fb01cf82a1355b72dc8ddedc5c2aec0c1d1cd910fadf68937e09ef402`.
- Final frontend pod `speakasap-frontend-868bcd6458-zwh5l` was `1/1 Running`, restarts `0`; logs showed Next.js ready.
- Delayed public smoke after rollout returned `HTTP/2 200` for `/`, `/learner/lessons/test-lesson/record`, and `/teacher/lessons/test-lesson/record`.
- Protected gateway smoke returned `HTTP/2 401` for `/api/v1/lessons/test-lesson/record`.
- Browser QA desktop learner route: page identity matched, rendered nonblank, console errors/warnings empty, missing-token validation appeared, and dummy-token gateway state check returned `401 Invalid token`.
- Browser QA desktop teacher route: page identity matched, rendered nonblank, console errors/warnings empty, upload presign control rendered, destructive-action exclusion note rendered, and dummy-token presign returned `401 Invalid token`.
- Browser QA mobile `390x844`: initial horizontal clipping was found and fixed; recheck rendered without clipping and with no console errors/warnings.

Boundaries:

- No real user token was used in browser QA.
- No database writes, object-storage mutation, upload, commit, merge, delete, rollback execution, legacy retirement, or payment/notification ownership change was performed.
- Frontend still calls the API gateway only; education-service remains behind `speakasap-api-gateway`.

Next:

- Continue Goal 6 with authorized frontend parity checks when fresh learner/teacher/staff JWTs are available, or move to broader protected route parity cases if owner provides test credentials.


## 2026-06-13 - Goal 6.3 Authorized Frontend Lesson-Recording Parity Checks

Status: done for authorized learner/teacher/staff frontend parity checks

Current focus:

- Ran authorized rendered frontend checks for migrated lesson-recording workflows after fresh short-lived JWTs were generated inside the auth runtime.
- Work stayed remote-only against `/home/ssf/Documents/Github/speakasap`; no local Documents source edits were made.
- DocsRAG retrieval from deployment/speakasap returned HTTP 200 for the Goal 6.3 context query; token values were not printed.

Validation evidence:

- Sanitized browser report: `/tmp/speakasap-goal63-frontend-parity-browser-report.json`.
- Redacted screenshots: `/tmp/speakasap-goal63-learner-paid-state.png`, `/tmp/speakasap-goal63-learner-unpaid-denied.png`, `/tmp/speakasap-goal63-teacher-unassigned-denied.png`.
- Browser route identity/nonblank checks passed for:
  - `https://speakasap.alfares.cz/learner/lessons/7d870263-bdcb-4bba-b25e-1f6b40402411/record`
  - `https://speakasap.alfares.cz/learner/lessons/852c4cdd-9c44-47e4-b57f-e101ae9f3f0a/record`
  - `https://speakasap.alfares.cz/teacher/lessons/7d870263-bdcb-4bba-b25e-1f6b40402411/record`
- Console warning/error count was `0`; no framework overlay was present.
- Paid learner state returned `200` with `state=ready` and no permanent URL.
- Paid learner playback returned `200`, `mode=gateway-download`, `method=GET`, `expiresIn=3600`, and a scoped tokenized URL; sanitized range verification returned `206 audio/mpeg` for 32 bytes.
- Unpaid learner playback returned `403 FORBIDDEN` with `Lesson record access denied`.
- Assigned teacher presign returned `201`, `method=PUT`, `expiresIn=900`, private key prefix `2018/07/10`, MinIO host, and SigV4 signature present.
- Unassigned teacher presign returned `403 FORBIDDEN` with `Assigned teacher or staff access required`.
- Staff presign returned `201`, `method=PUT`, `expiresIn=900`, private key prefix `2018/07/10`, MinIO host, and SigV4 signature present.
- Report and screenshots are sanitized: JWT values, scoped media tokens, and signed URLs are omitted or redacted.

Boundaries:

- No code changes, deployment, database write, object-storage mutation, upload PUT, commit, merge, delete, rollback execution, legacy retirement, payment change, or notification delivery change was performed.
- Frontend calls stayed gateway-first; private media remained behind scoped tokenized gateway download or short-lived SigV4 PUT presign.

Gate decision:

- Goal 6 authorized frontend parity for the migrated lesson-recording workflow is complete for the selected learner, teacher, and staff cases.
- Cutover is not approved by this check; Goal 7 still needs operational cutover readiness, rollback/runbook, manifests/secrets/health/logging review, and owner approval before any legacy traffic retirement.

Next:

- Start Goal 7 operational cutover readiness: verify Kubernetes manifests, secrets, health checks, logging, smoke URLs, and rollback/cutover runbook for the lesson-recording path before any cutover approval.


## 2026-06-13 - Goal 7.1 Operational Cutover Readiness

Status: done for readiness evidence and runbook; cutover not approved or executed

Current focus:

- Prepared operational cutover readiness for the migrated lesson-recording workflow.
- Work stayed remote-only in `/home/ssf/Documents/Github/speakasap`.
- DocsRAG retrieval from deployment/speakasap returned HTTP 200 for the Goal 7.1 context query; token values were not printed.

Changed:

- Added `docs/orchestrator/GOAL_7_CUTOVER_READINESS.md` with scope, ownership boundaries, live evidence, public smoke URLs, secret/runtime checks, logging/events, cutover checklist, post-cutover smoke list, rollback commands, and approval gate.

Validation evidence:

- Operational report: `/tmp/speakasap-goal7-operational-readiness.json`.
- Affected deployments rolled out successfully: `speakasap-frontend`, `speakasap-api-gateway`, and `speakasap-education`.
- Current pods are `1/1 Running` with `0` restarts for the affected deployments.
- Current image digests:
  - frontend `sha256:d1c0c00fb01cf82a1355b72dc8ddedc5c2aec0c1d1cd910fadf68937e09ef402`
  - api-gateway `sha256:d5568fd64226473d7474089030104bb3161b8d2803993ded799e530db3ac9763`
  - education `sha256:776f5086ccf2d578f4de84ac34b7bde7a051890ac0c26287471e78842d6371f1`
- Ingress routing verified: `/health` and `/api` route to `speakasap-api-gateway:4210`; `/` routes to `speakasap-frontend:4211`.
- ExternalSecrets `speakasap-education-secret` and `speakasap-secret` are `SecretSynced=True`; required key names are present without printing values.
- Public smoke results:
  - `/` -> `200 text/html; charset=utf-8`
  - `/health` -> `200 application/json; charset=utf-8`
  - protected record API without bearer -> `401 application/json; charset=utf-8`
  - learner record route -> `200 text/html; charset=utf-8`
  - teacher record route -> `200 text/html; charset=utf-8`
- Sampled logs from frontend, api-gateway, and education had `0` warning/error/exception/fatal matches.
- Runtime OpenSSL versions are 3.x: frontend `3.5.5`, api-gateway `3.5.5`, education `3.5.4`.
- SpeakASAP-specific events show normal frontend rollout activity plus one transient readiness probe failure on an old frontend pod during replacement; current affected pods are ready.

Boundaries:

- No cutover, legacy retirement, DNS change, deployment, database write, object-storage mutation, upload PUT, commit, merge, delete, rollback execution, payment change, or notification delivery change was performed.
- Cutover remains blocked until owner approval records exact traffic/legacy-route change, rollback window, monitoring commands, acceptance smoke list, date, and approver.

Gate decision:

- Goal 7 operational cutover readiness is complete for the selected lesson-recording workflow.
- Goal 8 controlled cutover and legacy decommission is owner-approval gated.

Next:

- Request explicit owner approval for the exact Goal 8 cutover action, rollback window, monitoring plan, and acceptance smoke list before changing traffic or retiring legacy routes.


## 2026-06-13 - Goal 8.1 Controlled Cutover Validation

Status: done for controlled cutover validation; legacy freeze/decommission not executed

Approval:

- Owner approved continuation in the Codex thread on 2026-06-13: `You have my approval. Continue.`
- Approval was applied to the Goal 8 controlled cutover validation for the already-routed migrated lesson-recording workflow on `https://speakasap.alfares.cz`.
- No approval was inferred for destructive operations, object deletion, migration reruns, legacy shutdown, DNS change, or irreversible decommission.

Changed:

- Added `docs/orchestrator/GOAL_8_CONTROLLED_CUTOVER.md` with approval record, cutover action, smoke evidence, monitoring evidence, rollback availability, and legacy freeze/decommission gate.

Validation evidence:

- Cutover smoke report: `/tmp/speakasap-goal8-cutover-smoke.json`.
- Cutover monitoring report: `/tmp/speakasap-goal8-cutover-monitoring.json`.
- Public smoke after approval:
  - root -> `200 text/html; charset=utf-8`
  - health -> `200 application/json; charset=utf-8`
  - learner route -> `200 text/html; charset=utf-8`
  - teacher route -> `200 text/html; charset=utf-8`
- Authenticated workflow smoke used fresh short-lived JWTs generated inside the auth runtime; token values were not printed.
- Workflow smoke passed expected statuses: no-auth state `401`, paid learner state `200`, paid learner playback `200`, tokenized range download `206`, unpaid playback denial `403`, assigned teacher presign `201`, unassigned teacher presign `403`, staff presign `201`, delete without confirmation `400`.
- No checked response exposed a permanent public recording URL.
- Affected deployments remained rolled out: `speakasap-frontend`, `speakasap-api-gateway`, and `speakasap-education`.
- Current affected pods remained `1/1 Running` with `0` restarts.
- Last-hour log scan for warning/error/exception/fatal terms returned `0` matches for frontend, api-gateway, and education.

Boundaries:

- No traffic change was required because ingress already routed the migrated frontend/gateway path.
- No deployment, database write, object-storage mutation, upload PUT, commit, merge, delete, rollback execution, legacy route freeze, DNS change, payment change, or notification delivery change was performed.
- Legacy portal remains available as rollback/reference.

Gate decision:

- Controlled cutover validation for the migrated lesson-recording workflow is clean.
- Goal 8 remains active for a separate owner-selected legacy freeze/decommission target because no exact legacy route, DNS target, nginx rule, feature flag, or repository path was named for freeze.

Next:

- Select the exact reversible legacy freeze/decommission target for lesson recordings, or close the migration wave with legacy retained as rollback/reference until a later owner-approved retirement window.


## 2026-06-13 - Goal 8 Legacy Fallback Decision And Goal 9 Salary Migration Setup

Status: Goal 8 closed with legacy retained as fallback; Goal 9 salary migration created

Owner direction:

- Keep the legacy lesson-recording path available as fallback/reference if the new service is not running or a migrated workflow regresses.
- Start the next migration target: salary, because teacher salary/payments depend on lesson-recording duration once a lesson is recorded and saved.

Legacy salary evidence reviewed:

- `speakasap-portal/education/lesson_records/models.py`: `LessonRecord.get_record_length()` reads MP3 duration through `mutagen.mp3.MP3` from local or storage-backed file.
- `speakasap-portal/expenses/salary/utils.py`: `get_record_length_in_hours()` implements demo/no-record/record-unavailable fallback, 95% full-lesson threshold, scheduled-duration cap, and quantization; `get_real_lessons_duration()` sums recording-derived hours for finished lessons.
- `speakasap-portal/expenses/signals/handlers.py`: lesson finish creates `LessonSalaryExpense`; lesson-record update calls `check_lesson_expense()` to sync salary quantity.
- `speakasap-portal/expenses/tasks.py`: monthly `calculate_salary()` creates salary rows from real recording-derived duration, hourly rates, fixed salary, and lower/upper work-duration bounds.
- `speakasap-portal/expenses/management/commands/add_lessons_to_expenses.py`: monthly/teacher backfill updates missing or stale lesson salary expenses.
- `speakasap-portal/administrator/views/salary.py`: admin salary list/detail views aggregate teacher/other profiles, totals, subtotals, and expected vs real lesson duration.
- `speakasap-portal/expenses/tests/test_common.py`: legacy tests show finished lessons create salary expenses; example MP3 changes qty from `0` to `0.01`; only finished lessons are included by backfill/check commands.

Target evidence reviewed:

- `salary-service/prisma/schema.prisma` already has salary profiles, salary expenses, calculation runs, payout runs, and payout lines.
- `salary-service/scripts/migrate-salary-data.ts` already reads legacy salary profiles/expenses and has dry-run/load modes, but needs updated reconciliation gates for recording-duration parity and payment safety.
- `salary-service/src/calculation-runs/calculation-runs.service.ts` already depends on `EducationClientService.fetchPeriodAggregates()`.
- `salary-service/src/deps/education-client.service.ts` expects `/api/v1/internal/salary/period-aggregates`, but education-service does not yet expose it.
- `education-service` migrated lesson records store private object keys/state, but `LessonRecordsService.getState()` still returns `durationSeconds: null` and no persisted MP3 duration exists yet.

Changed:

- Added `docs/orchestrator/SALARY_MIGRATION_GOAL.md`.
- Updated roadmap/state to make Goal 9 the active migration target.
- Goal 8 remains complete for controlled cutover validation with legacy retained as fallback/reference; no freeze/decommission was executed.

Boundaries:

- No code changes, database writes, salary calculations, payout creation, payment execution, object-storage mutation, deployment, rollback, or legacy retirement were performed.
- Future salary work must stay dry-run/reconciliation-first and cannot bypass `payments-microservice` for real payouts.

Next:

- Goal 9.1: create `docs/orchestrator/SALARY_MIGRATION_INVENTORY.md` with source-to-target salary mapping, recording-duration payroll parity rules, education aggregate contract, dry-run report format, and verification commands.

## 2026-06-13 - Salary Migration Deploy And CLI

Status: deployed internal salary dependencies and added read-only salary CLI; payout/calculation flows not executed

Approval:

- Owner approved deployment and CLI continuation in the Codex thread on 2026-06-13: `I approve. Go ahead, deploy, and proceed with the next step with the implementation of the CLI.`

Changed:

- Deployed `speakasap-user` with the internal teacher legacy-user mapping endpoint.
- Deployed `speakasap-education` with the internal salary period aggregate endpoint.
- Added `salary-service` CLI script `npm run salary:cli -- ...` for read-only target salary database inspection.
- Updated `docs/orchestrator/SALARY_MIGRATION_INVENTORY.md` with deployed aggregate status and salary CLI verification commands.

Deployment evidence:

- Built and pushed `localhost:5000/speakasap-user:latest` and `localhost:5000/speakasap-education:latest`.
- Applied `k8s/services/user-service.yaml` and `k8s/services/education-service.yaml` in namespace `statex-apps`.
- Rollouts completed for deployments `speakasap-user` and `speakasap-education`.
- Health checks returned `{"status":"ok"}` for both services.
- Internal salary aggregate smoke returned valid JSON for period `2026-05`; sampled legacy user had warning `no_teacher_mapping_for_requested_legacy_users`.

CLI verification evidence:

- `cd salary-service && npm run salary:cli -- --help` passed.
- `cd salary-service && npm run build` passed.
- Against the existing Kubernetes Postgres service through temporary remote port-forward `127.0.0.1:15434`, `npm run salary:cli -- status --json-report /tmp/speakasap-salary-cli-status-v1.json` returned read-only counts: salary profiles `386`, salary expenses `103983`, employee contracts `632`, calculation runs `0`, payout runs `0`, imported lesson expenses `98753`, imported support bonuses `176`.
- Status warnings are expected for current migration state: all `386` profiles lack `authUserId`, and all `98753` lesson salary expenses lack `lessonUuid`.
- `npm run salary:cli -- period-summary --period 2026-05 --json-report /tmp/speakasap-salary-cli-period-2026-05-v1.json` returned grouped totals for CZK/EUR generic and lesson rows.
- Temporary port-forward was stopped and `15434` had no remaining listener.

Boundaries:

- No salary calculation run, payout run, payment-service disbursement, object-storage mutation, source legacy mutation, rollback execution, merge, or destructive cleanup was performed.
- The CLI is read-only by implementation and only reports existing target salary database state.

Next:

- Implement auth legacy identity mapping resolution for salary profiles, then backfill lesson UUID references for imported lesson salary expenses once the education lesson mapping is available.

## 2026-06-13 - Salary Profile Auth Mapping

Status: done; imported salary profiles now resolve to target auth user IDs

Approval:

- Owner approved continuing the next salary implementation step in the Codex thread on 2026-06-13: `Agree, go ahead.`

Changed:

- Enhanced `salary-service/scripts/migrate-salary-data.ts` to load `legacy_portal_user_id -> auth_user_id` from `user-service.user_identity_mirror` using `USER_DATABASE_URL`.
- Future profile imports now set `SalaryProfile.authUserId` when a migrated user identity mirror exists.
- Added `--auth-map-only` write mode so existing salary profiles can be updated without creating salary expenses, employee contracts, calculation runs, payout runs, or payment disbursements.
- Added auth-specific rollback SQL generation that only nulls `salary_profiles.auth_user_id` for imported salary profiles.
- Updated `docs/orchestrator/SALARY_MIGRATION_INVENTORY.md` to close the salary profile auth mapping gap.

Verification evidence:

- RAG retrieval was skipped because `JWT_TOKEN` was unavailable in the remote shell; repository evidence was used instead.
- `cd salary-service && npm run build` passed after implementation.
- `cd salary-service && npm run migrate:salary-data -- --help` passed and showed `--auth-map-only`.
- Dry-run report `/tmp/speakasap-salary-auth-map-dry-run-v1.json` resolved `386/386` salary profile legacy users from `user_identity_mirror`, with `profiles_missing_auth_uuid.count=0`.
- First auth-only apply attempt wrote `/tmp/speakasap-salary-auth-map-apply-v1.json` but stopped before writes because the auth rollback helper was missing; no `profile_auth_users_updated` log occurred.
- Second auth-only apply report `/tmp/speakasap-salary-auth-map-apply-v2.json` completed with `authProfilesUpdated=386`.
- Auth rollback SQL: `/tmp/speakasap-salary-auth-map-rollback-v1.sql`; it only sets imported salary profile `auth_user_id` values back to null.
- Post-apply read-only CLI report `/tmp/speakasap-salary-cli-status-after-auth-map-v1.json` returned `profilesWithoutAuth=0`, `salaryProfiles=386`, `salaryExpenses=103983`, `employeeContracts=632`, `calculationRuns=0`, and `payoutRuns=0`.
- Temporary Postgres port-forward was stopped; remote `15434` had no remaining listener.

Boundaries:

- No salary calculation run, payout run, payment-service disbursement, salary expense creation, employee contract creation, legacy source mutation, object-storage mutation, deployment, rollback execution, or destructive cleanup was performed.
- Remaining migration warning is expected: `98753` imported lesson salary expenses still have null `lessonUuid` until education lesson UUID backfill is implemented.

Next:

- Implement salary lesson UUID backfill by mapping legacy lesson salary expense lesson IDs to target education lesson UUIDs, then rerun read-only reconciliation before any salary calculation or payout flow.


## 2026-06-13 - Goal 10.1 Worker 10.1 Seven Content Schema/API Contract

Status: implemented and statically verified; no data migration write, deployment, frontend change, object mutation, or legacy route retirement ran.

Changed by Worker 10.1:

- Added content-service Prisma schema models for SevenCourse, SevenLesson, and SevenExercise with legacy course/lesson IDs, language relation, material language, metadata, app package, materialsChanged-derived API version support, rendered lesson/exercise/answer HTML fields, and duplicate guards.
- Added content-service public read module under content-service/src/seven for /api/v1/seven/courses, /api/v1/seven/courses/:languageCode, /api/v1/seven/courses/:languageCode/lessons, and /api/v1/seven/courses/:languageCode/lessons/:order.
- Wired SevenModule into content-service AppModule.
- Added api-gateway upstream routing for /api/v1/seven to CONTENT_SERVICE_URL.

Evidence:

- RAG was unavailable in the remote shell because JWT_TOKEN was not set; implementation used repository evidence from the mandatory Goal 10 docs plus legacy seven models/API/views/serializers and existing content-service grammar/languages patterns.
- docs/orchestrator/IMPLEMENTATION_ORCHESTRATOR.md and docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md are referenced by task docs but absent in this remote checkout, so the available intent rules were followed from MASTER_PROMPT.md, INTENT.md, GOALS.md, PLAN.md, TASKS.md, and STATE.json.
- cd content-service && npm run prisma:validate passed.
- cd content-service && npm run prisma:generate passed.
- cd content-service && npm run build passed.
- cd api-gateway && npm run build passed.

Notes:

- Gateway upstream routing now resolves /api/v1/seven to content-service, but api-gateway/src/proxy/gateway-auth.guard.ts still requires bearer auth for general /api/v1 routes. Anonymous gateway access for public seven content remains a separate gateway-auth ownership decision unless the master assigns that file.
- An untracked content-service/prisma/migrations/20260613110000_seven_content/migration.sql directory is present in the shared worktree and matches the seven schema, but Worker 10.1 did not run prisma migrate and did not remove shared untracked work.

Next:

- Goal 10.2: add the dry-run-first legacy seven content importer and reconciliation report without target DB writes.

## 2026-06-13 - Goal 10 Seven Schema/Importer Audit

Status: implemented and verified through no-write evidence; approval gate remains before schema/data writes.

Changed:

- Audited legacy `seven.xml` lesson order assumptions before any schema migration.
- Confirmed `en`, `de`, and `cn` have 8 legacy rows, but no duplicate `(course, order)` values; source order is compatible with the new `SevenLesson(courseId, order)` unique key.
- Updated `content-service/scripts/migrate-seven-from-legacy.py` so exercise files are ordered by parsed lesson/exercise numbers instead of lexicographic filename order.

Verification evidence:

- Numeric order helper returned `(12, 3, lesson12ex3.html)` and `(1, 10, lesson1ex10.html)` for sample filenames.
- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `/tmp/speakasap-seven-dry-run-v6.json` recorded `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, no blocking issues, and 4 expected warnings: media root absent from checkout plus 8-row course warnings for `en`, `de`, and `cn`.
- `content-service/scripts/migrate-seven-from-legacy.py --apply` refused with status `2` because `--confirm-write` was missing; no DB action was attempted.
- `cd content-service && npm run prisma:validate` passed.
- `cd content-service && npm run build` passed.
- `cd api-gateway && npm run build` passed.
- `cd frontend && npm run build` passed and included dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.

Boundaries:

- No content-service schema migration, seven data apply, deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval for applying only the content-service seven schema migration, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Reconciliation Hardening

Status: implemented and verified through no-write evidence; approval gate remains before schema/data writes.

Changed:

- Added migration batch marker `seven-content-legacy-20260613` to course, lesson, and exercise payload metadata.
- Added the same batch note to generated rollback SQL.
- Strengthened DB-backed target reconciliation so reports include planned legacy course ID, lesson ID, and exercise key counts, and target ID samples once the seven tables exist.

Verification evidence:

- `/tmp/speakasap-seven-dry-run-v7.json` recorded `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, no blocking issues, and 4 expected warnings.
- Sample payload metadata verified batch marker on one course, one lesson, and one exercise.
- `/tmp/speakasap-seven-dry-run-target-v8.json` recorded `writes=false`, `target.checked=true`, planned counts `19/136/429`, and expected missing-table errors for `SevenCourse`, `SevenLesson`, and `SevenExercise` before schema migration.
- `content-service/scripts/migrate-seven-from-legacy.py --apply` refused with status `2` because `--confirm-write` was missing; no DB action was attempted.
- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `cd content-service && npm run prisma:validate` passed.
- `cd content-service && npm run build` passed.
- `cd frontend && npm run build` passed and retained dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.

Boundaries:

- No content-service schema migration, seven data apply, deployment, object mutation, destructive operation, or legacy route retirement ran.
- Temporary Postgres port-forward for the read-only target check was stopped.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval for applying only the content-service seven schema migration, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Frontend Preview Parity

Status: implemented and Browser-verified against a no-write mock gateway; production visual gate remains open until data apply/deploy.

Changed:

- Added frontend/app/components/seven-reading-indicator.tsx for lesson reading progress.
- Added seven promo/PDF helpers in frontend/lib/seven.ts.
- Updated seven course and lesson pages to reuse promo copy, show the lesson PDF link, render a lesson-page course promo block, and include the reading indicator.
- Added CSS for the reading indicator, PDF link area, and lesson-page promo block while preserving legacy typography colors and sizing.

Verification evidence:

- cd frontend && npm run build passed and retained dynamic routes /[languageCode]/seven and /[languageCode]/seven/[order].
- In-app Browser QA used temporary mock gateway 127.0.0.1:4310 and temporary Next preview 127.0.0.1:4311; no target DB, deployment, or object storage writes were run.
- Course page /en/seven rendered two lesson cards, grammar-safe promo text, header font Open Sans Legacy 44px/52.8px, promo text 18px/27.9px/700, no framework overlay, and zero console warnings/errors.
- Lesson page /en/seven/1 rendered PDF link /media/pdf/en/lesson1.pdf, paragraph style 16px/30px/rgb(66, 66, 66), heading style PT Mono 32px/40px/rgb(44, 150, 255), answer disclosure opened, reading indicator reached width: 100% after scroll, no framework overlay, and zero console warnings/errors.
- Screenshots: /tmp/speakasap-seven-course-preview.png and /tmp/speakasap-seven-lesson-preview.png.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Temporary mock gateway, Next preview, and SSH port-forward processes were stopped after QA.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval for applying only the content-service seven schema migration, then rerun DB-backed no-write reconciliation before any seven data apply. Full desktop/mobile production visual QA remains after real data apply and deployment.

## 2026-06-13 - Goal 10 Seven Media Contract

Status: implemented and statically verified; approval gate remains before schema/data writes.

Changed:

- Added `pdfHref` to `content-service` seven lesson summary/detail API payloads using the legacy PDF path shape `/media/pdf/<languageCode>/lesson<order>.pdf`.
- Updated frontend seven lesson types and lesson page to prefer API-provided `pdfHref`, keeping the existing helper as a fallback for mock or older payloads.

Verification evidence:

- `cd content-service && npm run build` passed.
- `cd frontend && npm run build` passed and retained dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval for applying only the content-service seven schema migration, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Language Case Metadata

Status: implemented and verified through no-write evidence; approval gate remains before schema/data writes.

Changed:

- Added `legacyLanguageCaseGent` to seven course migration metadata so frontend promo text can use migrated content metadata instead of only a frontend fallback map.
- Completed genitive mappings for all 19 seven course language codes present in legacy `seven.xml`, including legacy codes `se`, `dk`, `sk`, and `ru`.
- Kept frontend fallback mappings aligned with importer mappings.

Verification evidence:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `/tmp/speakasap-seven-dry-run-v10.json` recorded `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, no blocking issues, and 4 expected warnings.
- Explicit payload audit printed genitive metadata for all 19 courses and `missing []`.
- `content-service/scripts/migrate-seven-from-legacy.py --apply` refused with status `2` because `--confirm-write` was missing; no DB action was attempted.
- `cd frontend && npm run build` passed and retained dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval for applying only the content-service seven schema migration, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Lesson Navigation Contract

Status: implemented and statically verified; approval gate remains before schema/data writes.

Changed:

- Added `previousLesson` and `nextLesson` summary objects to `content-service` seven lesson detail payloads.
- Updated frontend lesson page navigation to prefer API-provided adjacent lesson summaries, while preserving the computed fallback for mock or older payloads.

Verification evidence:

- `cd content-service && npm run build` passed.
- `cd frontend && npm run build` passed and retained dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval for applying only the content-service seven schema migration, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Next Metadata Parity

Status: implemented and statically verified; approval gate remains before schema/data writes.

Changed:

- Added Next metadata generation to seven course and seven lesson routes so page title, description, keywords, and Open Graph fields come from migrated course/lesson SEO fields when available.
- Kept the existing SpeakASAP default description fallback for unavailable or incomplete seven content.

Verification evidence:

- `cd frontend && npm run build` passed and retained dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval for applying only the content-service seven schema migration, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Structured Media References

Status: implemented and verified through no-write evidence; approval gate remains before schema/data writes.

Changed:

- Added structured `mediaRefs` extraction to the seven migration payload metadata for lesson, exercise, and answer HTML after static legacy tag rendering.
- Added `migrationMediaRefs` summary counts to the dry-run report so media reconciliation can be checked before apply.
- Added `mediaRefs` to content-service seven lesson/exercise API response types and frontend seven data types, with lesson payloads including the PDF fallback reference.

Verification evidence:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `cd content-service && npm run build` passed.
- `cd frontend && npm run build` passed and retained dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.
- `/tmp/speakasap-seven-dry-run-v11.json` recorded `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, `migrationMediaRefs.lessonRowsWithRefs=136`, `migrationMediaRefs.exerciseRowsWithRefs=408`, `migrationMediaRefs.uniqueRefs=1104`, no blocking issues, and 4 expected warnings.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval for applying only the content-service seven schema migration, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 App Promo Frontend Parity

Status: implemented and statically verified; approval gate remains before schema/data writes.

Changed:

- Added a shared seven app promo component for the legacy visible block: "Полная версия курса ... в бесплатных приложениях для iOS и Android" with the four learner-facing bullet points from the legacy templates.
- Rendered the app promo on both seven course and seven lesson pages when migrated course data has `appPackage`.
- Added restrained CSS for the app promo block using the existing seven typography palette and a green action button.
- Kept iOS URL out of the UI until it is represented by migrated data; the current safe action derives only the Google Play URL from `appPackage`.

Verification evidence:

- `cd frontend && npm run build` passed and retained dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.
- `rg` confirmed `SevenAppPromo` is wired into `frontend/app/[languageCode]/seven/page.tsx` and `frontend/app/[languageCode]/seven/[order]/page.tsx`.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval for applying only the content-service seven schema migration, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Legacy App URL Metadata

Status: implemented and verified through no-write evidence; approval gate remains before schema/data writes.

Changed:

- Extended the seven importer to read legacy `Language.ANDROID_URLS` and `Language.IOS_URLS` from `speakasap-portal/language/models.py` via AST and store `legacyAndroidUrl` / `legacyIosUrl` in course metadata.
- Added `legacyAppUrls` counts to the seven dry-run report so app-link coverage is visible before data apply.
- Updated frontend app promo links to use migrated legacy app URLs from course metadata, falling back to `appPackage` only for Google Play when metadata is missing.

Verification evidence:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `/tmp/speakasap-seven-dry-run-v12.json` recorded `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, `legacyAppUrls.android=18`, `legacyAppUrls.ios=17`, `courseRowsWithAndroidUrl=18`, `courseRowsWithIosUrl=17`, no blocking issues, and 4 expected warnings.
- `cd frontend && npm run build` passed and retained dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]`.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval for applying only the content-service seven schema migration, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 App Promo Rendered QA

Status: Browser-verified against temporary mock data; approval gate remains before schema/data writes.

Rendered QA environment:

- Temporary mock gateway: remote `127.0.0.1:4320`.
- Temporary Next preview: remote `127.0.0.1:4321`, forwarded to local `http://127.0.0.1:4321`.
- Browser plugin path: in-app Browser; desktop viewport width reported as `1280`.
- Mobile viewport check was attempted but Browser runtime did not expose `setViewportSize`, so mobile app-promo QA remains for the post-data/deploy visual pass.

Verification evidence:

- `/en/seven` rendered the app promo with heading `Полная версия курса «Английский язык за 7 уроков» в бесплатных приложениях для iOS и Android`.
- `/en/seven` exposed both legacy app links: Google Play `https://play.google.com/store/apps/details?id=ru.ookamikb.speakasapen` and App Store `https://itunes.apple.com/us/app/anglijskij-azyk-za-7-urokov/id1002144129`.
- `/en/seven/1` retained the app links, PDF href `/media/pdf/en/lesson1.pdf`, and answer disclosure interaction opened successfully.
- Computed lesson typography remained aligned with legacy evidence: paragraph `16px/30px/rgb(66, 66, 66)` and heading `PT Mono 32px/40px/rgb(44, 150, 255)`.
- Browser console warning/error logs were empty for course and lesson pages; framework overlay checks were false.
- Screenshots saved locally outside the repo: `/tmp/speakasap-seven-app-promo-course.png` and `/tmp/speakasap-seven-app-promo-lesson.png`.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Temporary mock gateway, Next preview, and SSH port-forward were used only for no-write QA and must be stopped after validation.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval for applying only the content-service seven schema migration, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Fresh Target Reconciliation V12

Status: DB-backed no-write reconciliation completed; approval gate remains before schema/data writes.

Changed:

- Re-ran the seven importer with `--check-target` against the Kubernetes-backed content database using the fresh v12 payload that includes structured media refs and legacy Android/iOS app URL metadata.
- Used a temporary remote Postgres port-forward only for read-only target inspection; it had no remaining listener after the check.

Verification evidence:

- `/tmp/speakasap-seven-dry-run-target-v12.json` recorded `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, `blockingIssues=[]`, and 4 expected warnings.
- The report recorded `legacyAppUrls.android=18`, `legacyAppUrls.ios=17`, `courseRowsWithAndroidUrl=18`, and `courseRowsWithIosUrl=17`.
- The report recorded `migrationMediaRefs.lessonRowsWithRefs=136`, `migrationMediaRefs.exerciseRowsWithRefs=408`, and `migrationMediaRefs.uniqueRefs=1104`.
- Target DB was reachable with `target.checked=true` and planned IDs/keys `19/136/429`.
- Target table errors remain expected before owner-approved schema migration: `SevenCourse`, `SevenLesson`, and `SevenExercise` do not exist yet.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Temporary DB port-forward was stopped/no longer listening after the report.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval for applying only the content-service seven schema migration, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Schema Migration Approval Packet

Status: approval packet prepared; no schema migration, data apply, deployment, object mutation, destructive operation, or legacy retirement ran.

Changed:

- Added `docs/orchestrator/SEVEN_SCHEMA_MIGRATION_APPROVAL.md` with the exact schema-only approval scope, preserved intent, proposed command, required post-apply no-write reconciliation, rollback SQL for empty seven tables, and explicit approval wording.
- Bound the approval request to current evidence from `/tmp/speakasap-seven-dry-run-v12.json` and `/tmp/speakasap-seven-dry-run-target-v12.json`.

Verification evidence:

- `cd content-service && npm run prisma:validate` passed.
- `cd content-service && npm run build` passed.
- Approval packet confirms the next approval is only for creating empty `SevenCourse`, `SevenLesson`, and `SevenExercise` schema objects and does not approve data apply or deploy.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using the wording in `docs/orchestrator/SEVEN_SCHEMA_MIGRATION_APPROVAL.md`, then apply only the schema migration and rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Full Planned-Match Reconciliation Counts

Status: implemented and verified in no-write mode; approval gate remains before schema/data writes.

Changed:

- Hardened `content-service/scripts/migrate-seven-from-legacy.py` target reconciliation so planned target matches are counted with full `COUNT(*)` queries, while samples remain limited separately.
- This prevents post-data reconciliation from reporting only the sample size for `SevenLesson` or `SevenExercise` when more than the sample limit exists.

Verification evidence:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `/tmp/speakasap-seven-dry-run-v13.json` recorded `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, app URL coverage `18/17`, media refs `136/408/1104`, no blocking issues, and 4 expected warnings.
- `/tmp/speakasap-seven-dry-run-target-v13.json` recorded `writes=false`, target checked, planned IDs/keys `19/136/429`, no blocking issues, and expected missing-table errors for `SevenCourse`, `SevenLesson`, and `SevenExercise` before schema migration.
- Temporary DB port-forward `15437` was stopped and had no remaining listener.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using `docs/orchestrator/SEVEN_SCHEMA_MIGRATION_APPROVAL.md`, then apply only the schema migration and rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Target Base Content Schema Readiness

Status: no-write target check found a pre-schema blocker; approval gate updated.

Changed:

- Hardened the seven target dry-run to check `Language` table/code readiness before schema or data apply.
- Updated `docs/orchestrator/SEVEN_SCHEMA_MIGRATION_APPROVAL.md` with the target base schema finding.

Verification evidence:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `/tmp/speakasap-seven-dry-run-v14.json` recorded `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, no blocking issues, and 4 expected warnings.
- `/tmp/speakasap-seven-dry-run-target-v14.json` recorded `writes=false`, `target.checked=true`, blocking issue `TARGET_LANGUAGE_TABLE_UNAVAILABLE`, and planned language codes `19`.
- Read-only information_schema inventory through temporary remote port-forward `15440` returned public tables `[]` and no `_prisma_migrations` table for `speakasap_content_db`.
- Temporary port-forwards `15439` and `15440` were stopped and had no remaining listeners.

Implication:

- Applying only the seven schema migration would currently fail because `SevenCourse.languageId` references missing table `Language`.
- The next owner approval must first cover content-service base schema readiness/apply, then seven schema migration, still with no seven data apply or deployment.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval for content-service base schema readiness followed by seven schema migration, then rerun DB-backed no-write reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Content Base Schema Approval Packet

Status: approval packet prepared; no schema migration, data apply, deployment, object mutation, destructive operation, or legacy retirement ran.

Changed:

- Added `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` documenting why the target content DB needs base schema readiness before seven schema/data work.
- The packet scopes owner approval to applying pending content-service Prisma migrations for empty schema creation only, then DB-backed no-write seven reconciliation.
- The packet records rollback boundaries for empty schema objects and keeps seven data apply, deploy, object mutation, and legacy retirement out of scope.

Verification evidence:

- `cd content-service && npm run prisma:validate` passed.
- `cd content-service && npm run build` passed.
- Existing no-write target evidence remains `/tmp/speakasap-seven-dry-run-target-v14.json` with `TARGET_LANGUAGE_TABLE_UNAVAILABLE` and public tables `[]` in the content DB.

Boundaries:

- No content-service schema migration, seven data apply, production deployment, object mutation, destructive operation, or legacy route retirement ran.
- Existing unrelated salary/education/user worktree changes were preserved and not reverted.

Next:

- Request explicit owner approval using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, then apply pending content-service schema migrations and rerun DB-backed no-write seven reconciliation before any seven data apply.

## 2026-06-13 - Goal 10 Language Seed Readiness For Seven Data Migration

Status: no-write implementation complete; target content DB still awaits owner-approved schema readiness.

Changed:

- Extended `content-service/scripts/migrate-seven-from-legacy.py` to include planned legacy `Language` rows in the seven migration payload.
- Added write-gated `--include-languages` support so an approved later data apply can seed/update only the 19 language rows required by seven courses before importing `SevenCourse`, `SevenLesson`, and `SevenExercise` rows.
- Replaced ad hoc YAML regex parsing with PyYAML parsing to preserve Russian language `name` and `speaker` text exactly.
- Added `docs/orchestrator/SEVEN_DATA_MIGRATION_APPROVAL.md` and updated the schema approval packet to keep schema readiness separate from data apply.

Verification:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `content-service/scripts/migrate-seven-from-legacy.py --help` shows `--include-languages`.
- `/tmp/speakasap-seven-dry-run-v16.json` recorded `writes=false`, payload `languages=19`, `courses=19`, `lessons=136`, `exercises=429`, no blocking issues, and corrected language names/speakers.
- `content-service/scripts/migrate-seven-from-legacy.py --apply` still refuses before any connection/write without `--confirm-write`.
- `/tmp/speakasap-seven-dry-run-target-v16.json` recorded `writes=false`, `target.checked=true`, payload `19/19/136/429`, and expected blocker `TARGET_LANGUAGE_TABLE_UNAVAILABLE` because the target DB still lacks the base schema.

Boundary:

- No content-service schema migration was applied.
- No language or seven content rows were written.
- No frontend/content/gateway deployment, object mutation, media copy, final test migration, private progress migration, paid-product change, destructive operation, or legacy route retirement ran.

Next:

- Get owner approval for `CONTENT_BASE_SCHEMA_APPROVAL.md`, apply pending content-service schema migrations only, rerun DB-backed no-write reconciliation, then request the separate `SEVEN_DATA_MIGRATION_APPROVAL.md` data apply approval if the no-write evidence is clean.

## 2026-06-13 - Goal 10 Seven Media Readiness Inventory

Status: no-write media readiness added; public media serving remains incomplete.

Changed:

- Extended `content-service/scripts/migrate-seven-from-legacy.py` to report all unique media refs, planned PDF refs, counts by kind/prefix, and YouTube refs from rendered legacy video tags.
- Added `content-service/scripts/check-seven-media-availability.py` for no-write public availability checks of reported media refs.
- Added `docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md` for the later media copy/routing approval gate.

Verification:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py content-service/scripts/check-seven-media-availability.py` passed.
- `/tmp/speakasap-seven-dry-run-v18.json` recorded `writes=false`, payload `languages=19`, `courses=19`, `lessons=136`, `exercises=429`, media refs `audio=1104`, `pdf=136`, `video=133`, and total unique refs `1373`.
- `/tmp/speakasap-seven-dry-run-target-v17.json` recorded `writes=false`, `target.checked=true`, payload `19/19/136/429`, media refs `audio=1104`, `pdf=136`, `video=133`, and expected blocker `TARGET_LANGUAGE_TABLE_UNAVAILABLE`.
- Public sample checks showed current media gap: `/tmp/speakasap-seven-media-check-sample-v18.json` against `https://speakasap.alfares.cz` returned `6/6` missing with HTTP `404`; `/tmp/speakasap-seven-media-check-assets-sample-v18.json` against `https://assets.alfares.cz` also returned `6/6` missing with HTTP `404`.
- RAG retrieval was attempted first but unavailable in the remote shell because no `JWT_TOKEN` was available from the checked runtime secret path; repository and live route evidence were used.

Boundary:

- No media copy, object mutation, route change, deployment, schema migration, data apply, destructive operation, private media migration, paid-product change, final test migration, or legacy route retirement ran.

Next:

- Keep the immediate gate on `CONTENT_BASE_SCHEMA_APPROVAL.md`; in parallel, locate authoritative legacy `/media/audio` and `/media/pdf` source storage before requesting `SEVEN_MEDIA_MIGRATION_APPROVAL.md`.


## 2026-06-13 - Goal 10 Seven Media Source Discovery

Status: read-only source discovery completed; media copy/routing remains approval-gated.

Evidence:

- `https://speakasap.com` was tested as a legacy production source candidate using no-write HEAD checks.
- `/tmp/speakasap-seven-media-check-legacy-source-v1.json` checked `1240` internal `/media` refs from `/tmp/speakasap-seven-dry-run-v18-final.json`: `1212` returned HTTP `200`, `28` returned HTTP `404`.
- All `136/136` PDF refs returned HTTP `200`; `1076/1104` audio refs returned HTTP `200`.
- Missing refs are limited to `media/audio/ru` (`28` refs), including `lesson1..lesson7` mp3/ogg and `lesson*_answer1` mp3/ogg.
- Direct sample checks returned HTTP `200` for `https://speakasap.com/media/audio/en/lesson1.mp3`, `https://speakasap.com/media/pdf/en/lesson1.pdf`, and `https://speakasap.com/media/audio/cn/lesson1.mp3`.
- Read-only filesystem searches did not find matching sample source files under `/home/ssf/Documents/Github`, `/srv`, `/mnt`, `/opt`, or `/var/www`; `speakasap-portal/media` remains absent in the checkout.

Boundary:

- No media copy, download/archive creation, object mutation, route change, deployment, schema migration, data apply, destructive operation, private media migration, paid-product change, final test migration, or legacy route retirement ran.

Next:

- Treat `https://speakasap.com` as the current source candidate for approved media migration, but resolve or explicitly document the `media/audio/ru` gap before claiming complete media parity.


## 2026-06-13 - Goal 10 Seven Media Copy Manifest

Status: no-write copy manifest prepared; media copy/routing remains approval-gated.

Changed:

- Added `content-service/scripts/prepare-seven-media-manifest.py`, which reads the no-write availability report and emits JSON/CSV copy-review artifacts only.
- Updated `docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md` with copy manifest evidence and scope.

Verification:

- `python3 -m py_compile content-service/scripts/prepare-seven-media-manifest.py` passed.
- `/tmp/speakasap-seven-media-copy-manifest-v1.json` was generated from `/tmp/speakasap-seven-media-check-legacy-source-v1.json` and recorded `writes=false`, `1240` total internal refs, `1212` available copy candidates, and `28` missing refs.
- Available candidates by kind: `audio=1076`, `pdf=136`; missing by kind: `audio=28`; missing by prefix: `media/audio/ru=28`.
- Available source-header sizes: audio `3229902938` bytes and PDF `11240877` bytes.
- CSV artifacts: `/tmp/speakasap-seven-media-copy-manifest-v1.csv` and `/tmp/speakasap-seven-media-missing-v1.csv`.

Boundary:

- No media download, media copy, object mutation, route change, deployment, schema migration, data apply, destructive operation, private media migration, paid-product change, final test migration, or legacy route retirement ran.

Next:

- Use `/tmp/speakasap-seven-media-copy-manifest-v1.json` as the candidate list for a future owner-approved media copy/routing step, after deciding how to handle the 28 missing `media/audio/ru` refs.
