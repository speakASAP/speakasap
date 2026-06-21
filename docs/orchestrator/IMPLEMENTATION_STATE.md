# SpeakASAP Implementation State

Last updated: 2026-06-17.

## Orchestrator Command

```text
SPEAKASAP ORCHESTRATOR: continue implementation
```

English continuation command:

```text
Continue implementation of this project.
```

## Current Status

- Active goal: Goal 9 - Salary And Recording-Duration Payroll Migration
- Active chunk: 9.6 draft review completed; finalize/payout/payment-boundary gate
- Active branch: not recorded in this checkout
- Current wave: Wave 9 - Salary And Recording-Duration Payroll Migration
- Completed goals: Goal 1 Intent Preservation And Refactor Governance; Goal 2 Legacy Portal Inventory And Parity Map; Goal 3 Service Ownership And API Contract Mapping; Goal 4 Data Migration And Reconciliation; Goal 5 Lesson Recording And Private Media Migration; Goal 6 Gateway, Auth, And Frontend Parity; Goal 7 Operational Cutover Readiness; Goal 8 Controlled Cutover Validation With Legacy Retained As Fallback
- Running worker threads: none
- Blocked chunks: finalize, payout, payment execution, rollback, and broad/persistent enablement remain blocked pending separate approval; payout flows remain blocked by `SALARY_PAYOUT_FLOWS_ENABLED=true` plus separate payment-boundary approval
- Approval gates currently active: any future lesson-record rerun, rollback execution, object-storage mutation, public/private access behavior change, or deployment requires fresh evidence and explicit owner approval where applicable; any future user-service write migration/rerun/rollback/truncation requires fresh no-write DB evidence, rollback artifact, and explicit owner approval
- State source: this file plus `docs/orchestrator/STATE.json` and root `STATE.json`
- Evidence log: `docs/orchestrator/STATUS.md`
- Roadmap source: `docs/orchestrator/GOALS.md`
- Active plan source: `docs/orchestrator/PLAN.md`

## Goal Roadmap

| Goal | Status | Current Notes |
|---|---|---|
| Goal 1 - Intent Preservation And Refactor Governance | done | Orchestrator pack exists and root agent instructions point to it. |
| Goal 2 - Legacy Portal Inventory And Parity Map | done | Portal surface and lesson-recording inventory are recorded. |
| Goal 3 - Service Ownership And API Contract Mapping | done | Gateway, auth, route ownership, and workflow mapping docs exist. |
| Goal 4 - Data Migration And Reconciliation | done | Education/course/user target data exists; lesson-record dry-run reports missing target lessons as zero. |
| Goal 5 - Lesson Recording And Private Media Migration | done | Private playback/download, access denial, presign, gateway streaming, frontend route, and selected merge/delete gates are verified. |
| Goal 6 - Gateway, Auth, And Frontend Parity | done | Gateway/frontend route checks and authorized learner/teacher/staff parity checks are recorded. |
| Goal 7 - Operational Cutover Readiness | done | Manifests, secrets, health, logging, OpenSSL runtime, smoke URLs, rollback, and cutover checklist are recorded. |
| Goal 8 - Controlled Cutover And Legacy Decommission | done | Controlled cutover validation passed; owner selected legacy retention as fallback/reference. |
| Goal 9 - Salary And Recording-Duration Payroll Migration | active | Owner reprioritized salary. Demo salary aggregate counters, readiness blocker samples, calculation-run disabled gate, payout disabled gate, no-write readiness command, and historical imported lesson salary quantity preservation are implemented. Report `/tmp/speakasap-salary-readiness-2026-05.json` recorded `writes=false`, `missingDurationCount=0`, `shortRecordCount=6`, `teacherMappingMissingCount=0`, and `demoPayableLessonCount=1`. Reconciliation report `/tmp/speakasap-salary-short-record-reconciliation-2026-05.json` showed all six short rows have legacy/imported salary expense `qty=1.00`; target duration recalculation would underpay by `0.08` to `0.98` hours. Preview report `/tmp/speakasap-salary-calculation-preview-2026-05.json` showed `14/14` lines use imported lesson salary hours and `6/6` blockers are covered by exact imported `salary_expenses.lesson_uuid`. Owner-approved draft calculation smoke created run `6576ac90-526e-47c6-8755-9631a4fb3149` with 14 lines and rollback `/tmp/speakasap-salary-calculation-run-rollback-2026-05-v1.sql`. Draft review is complete at scoped-smoke level; next gate is owner-approved education-service deploy and no-write readiness/preview rerun. Payout env gate remains separate. |
| Goal 10 - Seven-Lesson Course Frontend Migration | paused | Paused by explicit owner salary reprioritization. Existing Seven work remains preserved and should not be reverted. |

## Execution Waves

| Wave | Goals | Mode | Gate Before Next Wave |
|---|---|---|---|
| 1 | Goal 1 | sequential | Orchestrator docs and root instructions exist. |
| 2 | Goal 2 | sequential | Legacy parity inventory exists. |
| 3 | Goal 3 | sequential with read-only mapping splits | Service ownership and auth boundaries documented. |
| 4 | Goal 4 | sequential, write-gated | Dry-run/reconciliation evidence and owner approvals captured. |
| 5 | Goal 5 | sequential unless storage and API work are disjoint | Private media access verified. |
| 6 | Goal 6 | sequential with validator split allowed | Gateway/frontend parity and RBAC evidence recorded. |
| 7 | Goal 7 | sequential | Cutover runbook, smoke checks, rollback, and health evidence ready. |
| 8 | Goal 8 | owner-approved production sequence | Cutover complete, monitored, and reversible during rollback window. |

## Worker Threads

None.

When workers are used, record compressed summaries here:

```text
Worker Newton:
Goal/chunk: 10.1 content-service seven schema/API contract
Write ownership: content-service/prisma/schema.prisma; content-service/src/seven/*; content-service/src/app.module.ts; api-gateway/src/proxy/upstream-resolve.ts only if needed
Status: completed
Summary: Added public seven content schema/API, gateway route, and public GET auth exception; no migrated data writes or deploy.
Validation: content-service prisma validate/build passed; api-gateway build passed.
Risks: DB schema migration is not applied yet; content tables do not exist in target DB.
Changed files: content-service/prisma/schema.prisma; content-service/prisma/migrations/20260613110000_seven_content/migration.sql; content-service/src/seven/*; content-service/src/app.module.ts; api-gateway/src/proxy/upstream-resolve.ts; api-gateway/src/proxy/gateway-auth.guard.ts

Explorer A:
Goal/chunk: 10.0 legacy seven discovery
Write ownership: none, read-only
Status: completed
Summary: Legacy seven consists of DB models, Django templates, template tags, CSS, media, app materials, and separate seven_test scope; fixture has 19 courses and 136 lessons, with German 8-row edge case.
Validation: repository evidence; no file changes
Risks: DB-backed ORM inspection blocked by missing Django dependencies; reconcile against production DB before writes.
Changed files: none

Explorer B:
Goal/chunk: 10.0 target platform discovery
Write ownership: none, read-only
Status: completed
Summary: New frontend is shell + lesson-record routes; content-service is recommended owner for public seven content; frontend needs preserved legacy typography.
Validation: repository evidence; RAG unavailable because JWT_TOKEN was not set
Risks: existing dirty checkout from salary work; do not overwrite.
Changed files: none

Worker:
Goal/chunk:
Write ownership:
Status:
Summary:
Validation:
Risks:
Changed files:
```

```text
Worker Language Seed Readiness:
Goal/chunk: 10.2/10.4 seven data migration readiness
Write ownership: content-service/scripts/migrate-seven-from-legacy.py; docs/orchestrator/SEVEN_DATA_MIGRATION_APPROVAL.md; seven approval/status docs
Status: completed no-write implementation
Summary: Added planned legacy Language rows to the seven payload, PyYAML parsing for exact Russian language names/speakers, and write-gated --include-languages for later approved apply.
Validation: py_compile passed; dry-run v16 writes=false payload 19 languages / 19 courses / 136 lessons / 429 exercises; target v16 still blocks on missing Language table before schema readiness.
Risks: Target content DB remains empty; schema-only approval is still required before any data apply approval can be considered.
Changed files: content-service/scripts/migrate-seven-from-legacy.py; docs/orchestrator/SEVEN_DATA_MIGRATION_APPROVAL.md; docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md; docs/orchestrator/SEVEN_LESSON_FRONTEND_MIGRATION_PLAN.md; docs/orchestrator/STATUS.md
```

```text
Worker Media Readiness:
Goal/chunk: 10.4 seven media/data readiness
Write ownership: content-service/scripts/migrate-seven-from-legacy.py; content-service/scripts/check-seven-media-availability.py; docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md; seven plan/status docs
Status: completed no-write implementation
Summary: Added full media ref inventory to seven dry-run reports, YouTube ref extraction, planned PDF refs, and a no-write public availability checker.
Validation: py_compile passed; dry-run v18 reports 1373 refs (1104 audio, 136 pdf, 133 video); sample checks against speakasap.alfares.cz and assets.alfares.cz returned 404 for 6/6 refs.
Risks: Legacy media source path is not present in the checkout; /media routing/assets remain incomplete for production frontend parity.
Changed files: content-service/scripts/migrate-seven-from-legacy.py; content-service/scripts/check-seven-media-availability.py; docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md; docs/orchestrator/SEVEN_LESSON_FRONTEND_MIGRATION_PLAN.md; docs/orchestrator/STATUS.md
```


```text
Worker Media Source Discovery:
Goal/chunk: 10.4 seven media source readiness
Write ownership: docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md; seven plan/status/state docs
Status: completed read-only investigation
Summary: Verified https://speakasap.com as source candidate for seven media: 1212/1240 internal refs return HTTP 200, all PDFs are available, and missing refs are limited to 28 media/audio/ru audio files.
Validation: /tmp/speakasap-seven-media-check-legacy-source-v1.json; direct HEAD samples for en audio, en PDF, cn audio returned HTTP 200; filesystem searches did not find local media samples.
Risks: 28 Russian audio refs remain missing from the source candidate; media copy/routing remains owner-approval gated.
Changed files: docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md; docs/orchestrator/SEVEN_LESSON_FRONTEND_MIGRATION_PLAN.md; docs/orchestrator/STATUS.md; docs/orchestrator/IMPLEMENTATION_STATE.md
```


```text
Worker Media Copy Manifest:
Goal/chunk: 10.4 seven media copy readiness
Write ownership: content-service/scripts/prepare-seven-media-manifest.py; docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md; seven plan/status/state docs
Status: completed no-write implementation
Summary: Added manifest generator and produced JSON/CSV copy-review artifacts from legacy source availability evidence.
Validation: py_compile passed; manifest v1 reports 1212 available copy candidates, 28 missing refs, audio bytes 3229902938, PDF bytes 11240877.
Risks: Media copy/routing still requires explicit owner approval; 28 media/audio/ru refs remain unresolved.
Changed files: content-service/scripts/prepare-seven-media-manifest.py; docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md; docs/orchestrator/SEVEN_LESSON_FRONTEND_MIGRATION_PLAN.md; docs/orchestrator/STATUS.md; docs/orchestrator/IMPLEMENTATION_STATE.md
```

```text
Worker Deployment Readiness:
Goal/chunk: 10.5 seven deployment/cutover readiness
Write ownership: scripts/check-seven-deployment-smoke.py; docs/orchestrator/SEVEN_DEPLOYMENT_APPROVAL.md; seven plan/status/state docs
Status: completed no-write implementation
Summary: Added scoped deployment approval packet and no-write deployed-route smoke checker for seven API/pages/media.
Validation: py_compile passed; current baseline smoke reports health 200 with seven API 401 and pages/media 404 before deployment/data/media gates.
Risks: Root scripts/deploy.sh restarts all services and should not be used for this slice without separate approval; browser typography QA remains required after real deploy.
Changed files: scripts/check-seven-deployment-smoke.py; docs/orchestrator/SEVEN_DEPLOYMENT_APPROVAL.md; docs/orchestrator/SEVEN_LESSON_FRONTEND_MIGRATION_PLAN.md; docs/orchestrator/STATUS.md; docs/orchestrator/IMPLEMENTATION_STATE.md
```


```text
Worker Rendered HTML Safety:
Goal/chunk: 10.2 seven importer/frontend safety readiness
Write ownership: content-service/scripts/migrate-seven-from-legacy.py; seven plan/status/state docs
Status: completed no-write implementation
Summary: Added htmlSafety dry-run gate for unresolved Django syntax, scripts, forms, inline handlers, and javascript URLs in rendered lesson/exercise/answer HTML.
Validation: py_compile passed; /tmp/speakasap-seven-dry-run-v19.json checked 993 fragments with zero issues and no blocking issues.
Risks: This is static HTML safety evidence; browser QA remains required after real data/deploy.
Changed files: content-service/scripts/migrate-seven-from-legacy.py; docs/orchestrator/SEVEN_LESSON_FRONTEND_MIGRATION_PLAN.md; docs/orchestrator/STATUS.md; docs/orchestrator/IMPLEMENTATION_STATE.md
```

## State Update Rules

At the end of every implementation session, update:

- active goal and chunk;
- goal/chunk status;
- worker thread summaries;
- approval gates and blockers;
- validation evidence summary;
- changed file list when useful;
- next action.

Do not paste full logs. Keep each session summary short enough to guide the next orchestrator session without depending on chat history.

## Recent Evidence Summary
- 2026-06-21: Goal 9.6 approved read-only media recovery report completed. `/tmp/speakasap-salary-scoped-media-recovery-readonly-goal9-v1.json` recorded `writes=false`, 7 checked records, 0 reachable records, and 7 unresolved records. All 40 candidate object probes returned `http_404` across current keys, legacy-prefixed current keys, canonical mp3/webm/m4a, and legacy-prefixed canonical mp3 shapes. All seven rows have no parts JSON entries and no `education_lessonrecordpart` rows. No object mutation, fallback DB write, salary finalization, payout, payment execution, deployment, rollback execution, legacy mutation, or destructive action ran.
- 2026-06-21: Goal 9.6 Option A duration apply completed after owner approval. `/tmp/speakasap-salary-scoped-duration-apply-goal9-v1.json` recorded `writes=true`, 9 candidates, 2 successful probes, 7 `http_404` failures, and `updated=2`; rollback SQL is `/tmp/speakasap-salary-scoped-duration-apply-goal9-v1-rollback.sql`. Post-apply no-write probe `/tmp/speakasap-salary-scoped-duration-post-apply-probe-goal9-v1.json` recorded `writes=false`, 7 candidates, 0 successes, and 7 `http_404` failures. No object mutation, salary finalization, payout, payment execution, deployment, rollback execution, legacy mutation, fallback write, or destructive action ran.
- 2026-06-21: Goal 9.6 full salary-scoped duration probe completed. `/tmp/speakasap-salary-scoped-duration-full-probe-goal9-v1.json` recorded `writes=false`, 9 candidates, 2 successful measurements (`9s`, `30s`), and 7 private media `http_404` failures. Candidate metadata is `/tmp/speakasap-salary-scoped-duration-candidates-goal9-v1.json`. Added `docs/orchestrator/SALARY_DURATION_RECOVERY_APPROVAL.md`; next decision is whether to approve applying the two probe-successful `duration_seconds` rows with rollback SQL while keeping seven missing-media rows in read-only recovery. No apply/deploy/finalize/payout/payment/rollback/object mutation ran.
- 2026-06-21: Goal 9.6 salary-scoped duration targeting prepared. Added read-only salary lesson UUID export and education duration backfill `--lesson-uuid-report` filtering. Read-only export `/tmp/speakasap-salary-lesson-uuids-2025-07_2026-06-goal9.json` found 2687/2687 imported lesson salary rows with lesson UUIDs across 26 legacy users. Salary-scoped duration dry-run smoke `/tmp/speakasap-salary-scoped-duration-backfill-smoke-goal9.json` narrowed education missing-duration candidates to 9 and selected 1 without writes; sampled host-bucket-root probe returned `object_missing`, so media recovery remains a no-write/full-probe next step. Builds passed for education-service and salary-service; no apply/deploy/finalize/payout/payment/rollback/object mutation ran.
- 2026-06-17: Reviewed V2 draft salary calculation run `b5d47fb3-e366-4c04-8683-37a51b3c45bf` and accepted it only as scoped draft evidence. `/tmp/speakasap-salary-calculation-run-2026-05-v2.json` confirms `status=draft`, `lineCount=14`, totals `CZK=29035` and `EUR=21858`, `payoutRunCount=0`, and `paymentDisbursementCreated=false`. `/tmp/speakasap-salary-status-after-calculation-v2.json` confirms `calculationRuns=2` and `payoutRuns=0`; rollback remains isolated in `/tmp/speakasap-salary-calculation-run-rollback-2026-05-v2.sql`. No finalize/payout/payment/deploy/rollback/destructive action ran.


- 2026-06-15: Owner approved the broader calculation packet and one additional draft calculation run was created for period 2026-05. Report `/tmp/speakasap-salary-calculation-run-2026-05-v2.json` records run `b5d47fb3-e366-4c04-8683-37a51b3c45bf`, status draft, 14 lines, totals CZK 29035 and EUR 21858, `payoutRunCount=0`, and `paymentDisbursementCreated=false`. Rollback SQL is `/tmp/speakasap-salary-calculation-run-rollback-2026-05-v2.sql`; rollback was not executed. Post-run status `/tmp/speakasap-salary-status-after-calculation-v2.json` shows 2 calculation runs and 0 payout runs. No payout/payment/finalize/persistent env/deploy/destructive action ran.

- 2026-06-15: Prepared `docs/orchestrator/SALARY_BROADER_CALCULATION_ENABLEMENT_APPROVAL.md` for a possible second draft salary calculation run for period 2026-05. The packet references post-deploy readiness/preview/status evidence, scopes any future write to one draft calculation run, and excludes payouts, payment disbursement, persistent env changes, unrelated deploys, rollback execution, and destructive operations. No new calculation run or data mutation was executed.

- 2026-06-15: Goal 9.6 scoped education deploy completed after owner approval. Built/pushed only `localhost:5000/speakasap-education@sha256:264330e6f1dcfcc590593e5981ed1f8609ab2e020a3800ad4b9e1037c81c3fbd`, applied only `k8s/services/education-service.yaml`, restarted only `deployment/speakasap-education`, rollout reached generation 20 with 1/1 ready, and pod health returned ok. Post-deploy salary readiness `/tmp/speakasap-salary-readiness-2026-05-postdeploy-v1.json` recorded fixed five-minute rule with six short-record blockers; no-write preview `/tmp/speakasap-salary-calculation-preview-2026-05-postdeploy-v1.json` showed 14/14 lines use imported legacy lesson salary hours and 6/6 blockers are covered, with no calculation run created. Salary status shows one prior draft calculation run and zero payout runs. ExternalSecret for `LESSON_RECORD_MEDIA_TOKEN_SECRET` remains unsynced and blocks private media token smoke, not salary evidence.

- 2026-06-14: Goal 9 draft salary calculation smoke reviewed and accepted only as scoped evidence: run `6576ac90-526e-47c6-8755-9631a4fb3149`, 14 draft lines, totals EUR 21858 and CZK 29035, no payout run and no payment disbursement. Fresh no-write readiness report `/tmp/speakasap-salary-readiness-2026-05-current-review.json` cleared missing-duration, short-record, and teacher-mapping blockers but still reports readiness false until patched education runtime is deployed. Fixed source salary duration tolerance from the stale 95% expression to the documented fixed five-minute tolerance and added a verifier guard; education lesson-record contract test and build passed. No deploy, rollback, payout, payment, or destructive operation ran.

- 2026-06-13: Goal 9 owner-approved draft calculation smoke completed. Approval packet `docs/orchestrator/SALARY_CALCULATION_RUN_APPROVAL.md`; report `/tmp/speakasap-salary-calculation-run-2026-05-v1.json`; rollback SQL `/tmp/speakasap-salary-calculation-run-rollback-2026-05-v1.sql`; calculation run `6576ac90-526e-47c6-8755-9631a4fb3149` is `draft` with 14 lines and 0 payout runs. Temporary local education service and port-forwards were stopped. No payout/payment/deploy/destructive action ran.
- 2026-06-13: Goal 9 no-write calculation preview report `/tmp/speakasap-salary-calculation-preview-2026-05.json` recorded `writes=false`, `profiles=14`, `lines=14`, `linesUsingImportedLessonSalary=14`, and `blockerSamplesCoveredByImportedSalaryExpenses=6/6`. No calculation run was created. Calculation and payout env gates remain disabled.
- 2026-06-13: Goal 9 historical imported salary quantity preservation implemented in `salary-service/src/calculation-runs/calculation-runs.service.ts`. Calculation lines now use imported lesson salary expense `qty` hour sums for historical profile/month rows when present and record both imported and aggregate hour sources in breakdown. Aggregate readiness can clear short-record/missing-duration blockers only when exact blocker lesson UUIDs are covered by imported `salary_expenses.lesson_uuid`; teacher mapping and dependency warnings remain hard blockers. `cd salary-service && npm run build` passed. No calculation/payout/write/deploy ran.
- 2026-06-13: Goal 9 short-record reconciliation report `/tmp/speakasap-salary-short-record-reconciliation-2026-05.json` recorded `writes=false`. All six short-record blockers have legacy lesson salary expenses and imported target salary expenses with `qty=1.00`. Current target aggregate duration recalculation would pay `0.02` to `0.92` hours, under legacy/imported qty by `0.08` to `0.98` hours. The remaining gate is a historical parity policy/implementation: calculation previews/runs must preserve imported historical lesson salary quantities, or the owner must explicitly approve recomputing historical salary from MP3 duration.
- 2026-06-13: Goal 9 salary gate resumed by explicit owner request. Education salary aggregates now expose demo unpaid/payable counters plus readiness metadata and blocker samples for missing duration, short recordings, and missing teacher mappings. Salary calculation run creation now requires `SALARY_CALCULATION_RUNS_ENABLED=true` and clean aggregate readiness; payout create/commit now require `SALARY_PAYOUT_FLOWS_ENABLED=true`. `salary-service` and `education-service` builds passed. No-write readiness report `/tmp/speakasap-salary-readiness-2026-05.json` used a temporary local education-service process and port-forwards, recorded `writes=false`, and isolated `0` missing-duration rows, `6` short-record rows, `0` missing teacher mappings, and one payable demo lesson. Temporary ports were closed.
- 2026-06-13: Goal 10 operator refusal gate added. `scripts/check-seven-operator-refusal.py` runs schema/data/media/deployment operators without `--execute` and verifies code 2, approval usage text, and no external-action output. `/tmp/speakasap-seven-operator-refusal-v1.json` and `/tmp/speakasap-seven-no-write-suite-v17.json` are no-write ok. No schema/data/media-copy/deploy/browser production action ran.
- 2026-06-13: Goal 10 runtime evidence chain auditor added. `scripts/check-seven-runtime-evidence.py` aggregates schema/data/media/deploy/smoke/visual execution artifacts into one final no-write completion gate. `/tmp/speakasap-seven-runtime-evidence-v1.json` is ok and complete=false with runtime artifacts missing as expected; `/tmp/speakasap-seven-no-write-suite-v17.json` is no-write ok. Completion now requires `runtimeEvidenceChainComplete`. No schema/data/media-copy/deploy/browser production action ran.
- 2026-06-13: Goal 10 post-deploy visual QA gate added. `scripts/check-seven-postdeploy-visual-qa.js` will run Playwright desktop/mobile rendered checks for course and lesson pages after deployment; `scripts/check-seven-visual-qa-contract.py` verifies the QA script without browser/network. `/tmp/speakasap-seven-visual-qa-contract-v1.json` and `/tmp/speakasap-seven-no-write-suite-v17.json` are no-write ok; completion now also requires `postDeployVisualQaPassed`. No schema/data/media-copy/deploy/browser production action ran.
- 2026-06-13: Goal 10 gated deployment operator script added. `scripts/deploy-seven-approved.sh` refuses without `--execute`, exact `SEVEN_DEPLOY_APPROVAL_TEXT`, and ok schema/data/media execution reports; it builds/pushes only content, api-gateway, and frontend images, applies only scoped manifests plus ingress, restarts/status-checks only scoped deployments, runs smoke, and writes an execution report. `/tmp/speakasap-seven-deployment-readiness-v3.json` and `/tmp/speakasap-seven-no-write-suite-v17.json` are no-write ok; completion remains pending runtime gates. No schema/data/media-copy/deploy action ran.
- 2026-06-13: Goal 10 gated media copy operator script added. `scripts/copy-seven-media-approved.sh` refuses without `--execute`, exact `SEVEN_MEDIA_APPROVAL_TEXT`, manifest v3 with 1212 available/0 missing refs, and explicit `MEDIA_TARGET_ROOT`; it copies only audio/PDF `media/...` keys and runs post-copy availability. `/tmp/speakasap-seven-media-approval-contract-v2.json` and `/tmp/speakasap-seven-no-write-suite-v17.json` are no-write ok; completion remains pending runtime gates. No schema/data/media-copy/deploy action ran.
- 2026-06-13: Goal 10 gated data apply operator script added. `scripts/apply-seven-data-approved.sh` refuses without `--execute`, exact `SEVEN_DATA_APPROVAL_TEXT`, a passing schema reconciliation report, and rollback SQL path; it runs the importer with `--check-target --apply --include-languages --confirm-write`, then post-apply no-write reconciliation and an execution report. `/tmp/speakasap-seven-data-apply-contract-v10.json` and `/tmp/speakasap-seven-no-write-suite-v17.json` are no-write ok; completion remains pending runtime gates. No schema/data/media-copy/deploy action ran.
- 2026-06-13: Goal 10 schema operator execution report contract added. After a future approved schema-only run, `scripts/apply-seven-schema-approved.sh` writes `/tmp/speakasap-seven-schema-apply-execution-v1.json` with approval hash, migration log, target/reconciliation reports, schema/data readiness, and false flags for later approvals. `/tmp/speakasap-seven-schema-migration-plan-v9.json` and `/tmp/speakasap-seven-no-write-suite-v17.json` are no-write ok; completion remains pending runtime gates. No schema/data/media-copy/deploy action ran.
- 2026-06-13: Goal 10 gated schema operator script added. `scripts/apply-seven-schema-approved.sh` is executable, refuses without `--execute` and exact `SEVEN_SCHEMA_APPROVAL_TEXT`, runs direct Prisma migrate deploy from the Kubernetes secret-derived content DB URL, and immediately runs post-schema no-write reconciliation. `/tmp/speakasap-seven-schema-migration-plan-v9.json` reports `operatorScriptContractSafe=true`; `/tmp/speakasap-seven-no-write-suite-v17.json` remains no-write ok and incomplete only for runtime gates. No schema/data/media-copy/deploy action ran.
- 2026-06-13: Goal 10 fresh baseline no-write suite passed. `/tmp/speakasap-seven-schema-migration-plan-v9.json` reports `writes=false`, `ok=true`, `approvalEvidenceReferencesCurrent=true`; `/tmp/speakasap-seven-no-write-suite-v17.json` reports `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`. Remaining completion gaps are runtime-only: schema reconciliation, data readiness, deployed smoke, and cutover. No schema/data/media-copy/deploy action ran.
- 2026-06-13: Goal 10 fresh target DB baseline confirmed the schema gate remains pending. `/tmp/speakasap-seven-dry-run-target-fresh-v1.json` reports `writes=false`, `target.checked=true`, `TARGET_LANGUAGE_TABLE_UNAVAILABLE`; `/tmp/speakasap-seven-post-schema-reconciliation-fresh-v1.json` reports `writes=false`, `ok=false`, `schemaReady=false`, `dataReady=false`, with planned counts still matching. No schema/data/media-copy/deploy action ran.
- 2026-06-13: Goal 10 schema approval packet freshness gate passed. `/tmp/speakasap-seven-schema-migration-plan-v9.json` reports `writes=false`, `ok=true`, `approvalEvidenceReferencesCurrent=true`, and the active schema-only approval packet now points to current post-schema baseline plus schema-plan v4+/no-write-suite v3+ evidence. `/tmp/speakasap-seven-no-write-suite-v17.json` reports `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, `complete=false`; only runtime gates remain missing. No schema/data/media-copy/deploy action ran.
- 2026-06-13: Goal 10 readiness checker now requires post-schema reconciliation for data approval. `/tmp/speakasap-seven-apply-readiness-v7.json` reports `writes=false`, `ok=true`, `complete=false`, schema gate ready, post-schema reconciliation not ready, data approval not ready, media source ready, and deploy not ready. No schema/data/media-copy/deploy action ran.
- 2026-06-13: Goal 10 post-schema reconciliation checker added. `/tmp/speakasap-seven-post-schema-reconciliation-fresh-v1.json` reports `writes=false`, `ok=false`, `schemaReady=false` against current pre-schema target, as expected; planned counts still match. After schema approval/apply, rerun target dry-run and this checker before data approval. No schema/data/media-copy/deploy action ran.
- 2026-06-13: Goal 10 completion audit checker added. `/tmp/speakasap-seven-goal-completion-audit-v1.json` reports `writes=false`, `ok=false`, `complete=false`; proven pieces include frontend routes, content API, typography contract, intent docs, approval packets, schema approval readiness, and media source readiness; missing pieces are schema applied/reconciled, data readiness, deployed smoke, and cutover readiness. No schema/data/media-copy/deploy action ran.
- 2026-06-13: Goal 10 consolidated no-write validation passed. content-service build, api-gateway build, frontend build, Python compile for seven scripts, schema-plan/data-contract/typography/readiness reports, and `git diff --check` all passed. `/tmp/speakasap-seven-apply-readiness-v6.json` remains `complete=false` because schema/data/deploy are not applied. No schema/data/media-copy/deploy action ran.
- 2026-06-13: Goal 10 data apply rollback contract hardened. Fixed importer rollback call to pass language scope and added `/tmp/speakasap-seven-data-apply-contract-v2.json`, which reports `writes=false`, `ok=true`, write gates present, rollback/upsert scope present, payload counts match, and language-scope signatures correct. `/tmp/speakasap-seven-apply-readiness-v6.json` now requires this contract and keeps schema approval ready while data remains not ready until post-schema DB reconciliation. No schema/data/media-copy/deploy action ran.
- 2026-06-13: Goal 10 schema migration plan verifier added. `/tmp/speakasap-seven-schema-migration-plan-v2.json` reports `writes=false`, `ok=true`, expected init/seven migrations present, schema scopes ok, and required Prisma models/relations present. `/tmp/speakasap-seven-apply-readiness-v5.json` now requires this report and keeps schema approval ready while data remains not ready until post-schema DB reconciliation. No schema/data/media-copy/deploy action ran.
- 2026-06-13: Goal 10 readiness checker extended with media source/copy-manifest gate. `/tmp/speakasap-seven-apply-readiness-v4.json` reports `writes=false`, `ok=true`, `complete=false`, schema gate ready, data/deploy gates not ready, and media source gate ready with availability checked `1212`, missing `0`, manifest total `1212`, available `1212`, missing refs `0`. No schema/data/media-copy/deploy action ran.
- 2026-06-13: Goal 10 typography preservation contract checker added. `/tmp/speakasap-seven-typography-contract-v2.json` reports `writes=false`, `ok=true`, font files present, CSS contract ok, and required frontend route snippets present for course/lesson pages, reading indicator, PDF link, and legacy lesson wrapper. No schema/data/media/deploy action ran.
- 2026-06-13: Goal 10 readiness checker hardened with approval-packet consistency validation. `/tmp/speakasap-seven-apply-readiness-v2.json` reports `ok=true`, `complete=false`, `approvalDocsConsistent=true`, active schema approval text present, superseded schema doc marked, stale seven-only schema approval wording absent, schema gate ready, and data gate not ready until post-schema DB reconciliation. No schema/data/media/deploy action ran.
- 2026-06-13: Goal 10 intent-preservation evidence restored. `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md` and `docs/orchestrator/SEVEN_INTENT_PRESERVATION_EVIDENCE.md` now record the seven-course legacy evidence, style-preservation intent, ownership boundaries, no-write evidence, approval status, rollback expectations, and commit-message block. No schema/data/media/deploy/legacy-retirement action ran; next gate remains explicit schema-only approval.
- 2026-06-12: Intent-preservation compliance refreshed. Root `BUSINESS.md`, `SYSTEM.md`, `TASKS.md`, and `STATE.json` are present; `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md` defines staged context, ownership, approval, verification, rollback, and commit-message gates. RAG lookup timed out, so repository evidence was used and recorded in `STATUS.md`.
- 2026-06-12: Goal 5.2 local implementation added lesson-record Prisma schema/migration and a write-gated metadata migration script. Local syntax/help/gate checks passed. No object storage access or target DB write was run. Remote copy/validation is blocked because `alfares` resolves to `alfares.local`, which does not resolve from this session.
- 2026-06-12: Goal 5.3 remote validation completed. Artifacts were copied to `alfares` through direct IPv6 link-local SSH after alias DNS proved intermittent. Remote `prisma:validate`, `npm run build`, script compile/help, and DB-backed no-write report passed. `/tmp/speakasap-lesson-records-dry-run-g5-2.json` reports `missing_target_lesson=0`, `would_upsert_lesson_records=101184`, `would_upsert_lesson_record_parts=52453`, and only non-blocking media/key reconciliation issues remain. No target DB write was run.
- 2026-06-12: Goal 5.4 completed after owner approval. Prisma migration `20260612120000_lesson_record_metadata` applied to `speakasap_education_db`; lesson-record metadata apply wrote/upserted `101184` records and `52453` referenced part rows. Rollback SQL is `/tmp/speakasap-lesson-records-rollback-g5-4.sql`; apply report is `/tmp/speakasap-lesson-records-apply-g5-4.json`; post-apply dry-run is `/tmp/speakasap-lesson-records-post-apply-g5-4.json`; target verification showed `0` lesson-record rows missing target lessons. No object storage mutation or access exposure was performed.
- 2026-06-12: Goal 5.5 runtime verification recorded in `LESSON_RECORDING_RUNTIME_VERIFICATION.md`. Fresh no-write report `/tmp/speakasap-lesson-records-g5-5-target-verification.json` showed `writes=false`, `source_lesson_records=101184`, `target_lesson_records_existing=101184`, `missing_target_lesson=0`, duplicate/multi-reference/bad-JSON blocking issues `0`, and unchanged media/key inventory. Runtime route search found no target private playback/download, presign/commit, scoped media token, merge worker, stuck-record worker, or delete implementation; frontend/gateway cutover remains blocked.
- 2026-06-12: Goal 5.5 runtime module scaffold added under `education-service/src/lesson-records`. Build and `npm run test:lesson-records` passed on `alfares`. Routes now exist for state, playback token issuance, token download, presign, commit, merge, and delete. Guardrails remain: student playback blocked until paid eligibility mapping exists; presign/commit and merge are authorized but not implemented; delete refuses until owner-approved object deletion/rollback evidence exists; no deployment or cutover ran.
- 2026-06-12: Goal 5.5 paid eligibility mapping and private upload runtime implemented in code. Added target `StudentAccess` schema/migration and extended education migration dry-run/apply logic for `education_studentaccess`. Source-only dry run showed `education_studentaccess=184464`, duplicate UUIDs `0`, duplicate lesson/student pairs `0`, and missing lesson references `0`. Student playback now requires target paid access. Presign/commit now validate teacher/staff access, audio type/60MB size, deterministic keys, S3 HEAD metadata, ETag, and size. Prisma validate/build/contract test and Python compile/help/write-refusal checks passed. No schema deploy, data apply, object mutation, deployment, or cutover ran.
- 2026-06-12: Owner approved `education_studentaccess` schema deploy/import. Prisma migration `20260612143000_student_access` applied. Fresh target dry-run `/tmp/speakasap-education-studentaccess-dry-run-g5-5.json` showed source rows `184464`, target rows `0`, and no UUID/pair conflicts or missing lesson references. Write-gated student-access-only import wrote `184464` rows; rollback SQL is `/tmp/speakasap-education-studentaccess-rollback-g5-5.sql`. First import command exited nonzero after all rows were written because the scoped function attempted a duplicate second copy; target post-checks showed target/source rows `184464`, paid rows `184214`, duplicate groups `0`, missing lesson refs `0`, and the script was fixed/compiled. No deployment, frontend/gateway cutover, object storage mutation, or merge/delete ran.
- 2026-06-12: Goal 4.12 final pre-apply evidence was restored. `/tmp/speakasap-user-dry-run-auth-mapping-v6.json` is the authoritative final pre-apply user/profile DB report: `writes=false`, `auth_mapping_size=214231`, unresolved auth counts `0`, missing references `0`, target user-service counts `0`, and target conflicts `0`. The user-service migration script now enforces mode and write-approval flags before DB config/driver import, and this was verified locally and on `alfares`. No new user-service writes were run.
- 2026-06-12: Goal 4.12 completed. User/profile write-gated apply ran with owner approval; rollback SQL, apply report, and post-apply reconciliation were captured. Goal 4.13 is active for education/course apply-gate readiness.
- 2026-06-12: Goal 4.11 completed. User/profile migration resolves auth UUIDs from auth-owned `legacy_identity_mappings`; dry-run report `/tmp/speakasap-user-dry-run-auth-mapping-v3.json` showed `auth_mapping_size=214230`, unresolved auth counts `0`, target user-service tables empty, and target conflicts `0`.
- 2026-06-12: Auth bootstrap was applied after explicit owner approval. `214230` legacy users mapped; `214224` auth users created; `192` duplicate-email identities preserved as separate null-email auth users; auth deployment health check passed after rollout.
- 2026-06-12: Goals 1-3 completed and Goal 4 active. Full evidence remains in `docs/orchestrator/STATUS.md`.

- 2026-06-12: Goal 5.5 `speakasap-education` deployment completed after owner approval. Built and pushed `localhost:5000/speakasap-education:latest` digest `sha256:aac37a909b47872e368a733f973d287e00be35136ff10f423c54bd84c3e5350e`, applied only `k8s/services/education-service.yaml`, restarted only `deployment/speakasap-education`, and health passed with `1/1` ready and `0` restarts. Runtime smoke report `/tmp/speakasap-education-runtime-smoke-g5-5.json` verified unauthenticated rejection, invalid/mismatched media-token rejection, unrelated-student rejection, and no permanent URL exposure. Service-level deployed-image mock report `/tmp/speakasap-education-service-level-smoke-g5-5.json` verified presign invalid type/oversize, 900-second PUT shape, commit key/ETag/size mismatch, merge disabled, and delete disabled without DB writes or object mutation. Remaining blockers: no safe real paid/unpaid/teacher/staff tokens and no `RECORDS_S3_*` runtime config in the education pod.

- 2026-06-12: DocsRAG JWT runtime wiring fixed across SpeakASAP services. Added durable JWT_TOKEN ExternalSecret mapping to assessment, certification, content, course, financial, notification, payment, salary, and user manifests; root and education mappings already existed, and api-gateway consumes the root secret. Restarted all 12 SpeakASAP deployments; rollout status passed for all, public health returned ok, and DocsRAG retrieval from deployment/speakasap returned HTTP 200 without printing token values.


- 2026-06-13: Owner approved Goal 5 follow-up merge/delete and frontend/gateway integration; Active Agents marker checked and reported None. Deployed confirmation-gated education-service and api-gateway revisions: education digest sha256:776f5086ccf2d578f4de84ac34b7bde7a051890ac0c26287471e78842d6371f1, api-gateway digest sha256:d5568fd64226473d7474089030104bb3161b8d2803993ded799e530db3ac9763. Builds passed for education-service, api-gateway, and frontend. Gateway smoke /tmp/speakasap-goal55-gateway-smoke-20260613-v2.json confirms auth/access controls and delete without confirmDelete is blocked, but paid fixture tokenized range download now returns 404 because an earlier stale smoke deleted the object; metadata was restored, original object still requires restoration before closing Goal 5 follow-up.


- 2026-06-13: Owner approved replacing the missing paid lesson-record object with legacy portal fixture education/lesson_records/tests/example.mp3. Uploaded the fixture through the education pod to key 2018/07/10/lesson_7d870263-bdcb-4bba-b25e-1f6b40402411.mp3. Gateway smoke /tmp/speakasap-goal55-gateway-smoke-20260613-v5.json now confirms paid tokenized range download returns 206 audio/mpeg, access denials still hold, and delete without confirmDelete returns 400. Goal 5 gateway follow-up backend validation is restored; frontend code builds but deployment target is not present in this repo.


- 2026-06-13: Goal 6 frontend deployment path discovery completed read-only. Frontend source is in /home/ssf/Documents/Github/speakasap/frontend, but no frontend Dockerfile, speakasap-frontend Kubernetes deployment/service, or deploy-frontend script exists. Public speakasap.alfares.cz ingress currently routes to deployment/speakasap image localhost:5000/speakasap:latest, whose root Dockerfile builds api-gateway and whose live pod returns Express JSON 404 for /. Cutover requires creating/adapting a real Next frontend deployment path before routing traffic.

- 2026-06-13: Goal 6.1 frontend deployment path implemented and deployed. Added standalone Next frontend image, `speakasap-frontend` Kubernetes Deployment/Service/ConfigMap, ingress split preserving `/health` and `/api` on `speakasap-api-gateway`, and `scripts/deploy-frontend.sh`. Image digest `sha256:97b3d7069530433ee65b165e5f0c33ba31acd79525939a5b4296d9973f3d35e8`; deployment `1/1` ready with `0` restarts; public root returned Next.js `HTTP/2 200`, gateway health returned `HTTP/2 200`, and protected `/api/v1/lessons` returned gateway `HTTP/2 401`.
- 2026-06-13: Goal 6.2 frontend deployment path implemented and deployed. Added learner and teacher dynamic routes under `/learner/lessons/[lessonUuid]/record` and `/teacher/lessons/[lessonUuid]/record`, gateway-only state/playback/range/presign controls, destructive-action exclusion, and responsive overflow fixes. Build passed; final frontend image digest `sha256:d1c0c00fb01cf82a1355b72dc8ddedc5c2aec0c1d1cd910fadf68937e09ef402`; pod `1/1` ready with `0` restarts; delayed public route smoke returned `200` for learner/teacher dynamic routes and `401` for protected gateway API; browser QA passed desktop learner/teacher interactions and mobile layout.

- 2026-06-13: Goal 6.3 authorized frontend lesson-recording parity passed through the deployed frontend and public gateway with fresh short-lived JWTs generated inside the auth runtime. Sanitized report `/tmp/speakasap-goal63-frontend-parity-browser-report.json` records paid learner state/playback/range `200/200/206`, unpaid playback `403`, assigned teacher presign `201`, unassigned teacher presign `403`, staff presign `201`, no permanent URL exposure, no framework overlay, and zero console warnings/errors. Redacted screenshots are stored under `/tmp/speakasap-goal63-*.png`. No code, deployment, DB write, object mutation, upload PUT, commit, merge, delete, rollback, or cutover was run.

- 2026-06-13: Goal 7.1 operational cutover readiness completed. Added `docs/orchestrator/GOAL_7_CUTOVER_READINESS.md`; `/tmp/speakasap-goal7-operational-readiness.json` records frontend/api-gateway/education rollouts ready, zero restarts, ingress routing, ExternalSecrets synced, public smoke `200/200/401/200/200`, zero sampled warning/error/fatal log matches, and OpenSSL 3.x runtime versions. No cutover, deployment, DB write, object mutation, merge/delete, rollback, or legacy retirement was run.

- 2026-06-13: Goal 8.1 controlled cutover validation passed after owner approval. Added `docs/orchestrator/GOAL_8_CONTROLLED_CUTOVER.md`; `/tmp/speakasap-goal8-cutover-smoke.json` records expected workflow statuses `401/200/200/206/403/201/403/201/400`; `/tmp/speakasap-goal8-cutover-monitoring.json` records public smoke `200/200/200/200`, affected deployments rolled out, current pods `1/1` with zero restarts, and zero last-hour warning/error/exception/fatal log matches. No traffic change was required, and no deployment, DB write, object mutation, merge/delete, rollback, DNS change, or legacy freeze was executed.

- 2026-06-13: Owner selected legacy lesson recordings to remain available as fallback/reference and selected salary as the next migration target. Added `docs/orchestrator/SALARY_MIGRATION_GOAL.md`; legacy evidence shows salary expense quantity is derived from `LessonRecord.get_record_length()`, demo/no-record/record-unavailable fallback, 95% full-lesson threshold, scheduled-duration cap, quantization, and monthly salary tasks with hourly/fixed lower-upper-bound logic. Target evidence shows salary-service has profiles/expenses/calculation/payout models and an education aggregate client, but education-service lacks `/api/v1/internal/salary/period-aggregates` and persisted recording duration. No salary code, DB write, payout, payment, object mutation, or legacy retirement was run.

## Next Action

Create `docs/orchestrator/SALARY_MIGRATION_INVENTORY.md` with legacy salary behavior, source-to-target mapping, education aggregate contract, dry-run report format, and verification commands.

- 2026-06-13: Owner redirected active work to Goal 10 seven-lesson frontend/content migration. Created `docs/orchestrator/SEVEN_LESSON_FRONTEND_MIGRATION_PLAN.md`; launched and received read-only sub-agent discovery for legacy and target surfaces; RAG unavailable because `JWT_TOKEN` was not set; no DB write, deployment, object mutation, or legacy retirement ran.

- 2026-06-13: Goal 10.1/10.2/10.5 implementation progress: content-service SevenCourse/SevenLesson/SevenExercise schema, API module, Prisma migration SQL, gateway route, public GET `/api/v1/seven` auth exception, dry-run importer, and Next.js public seven course/lesson pages were added. Verification passed: `cd content-service && npm run prisma:validate && npm run build`, `cd api-gateway && npm run build`, `cd frontend && npm run build`, and `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py`. Dry-run reports `/tmp/speakasap-seven-dry-run-v1.json` and `/tmp/speakasap-seven-dry-run-target-v4.json` recorded `writes=false`, `sevenCourses=19`, `sevenLessons=136`, no blocking issues, 4 warnings, and target tables missing before schema migration. No DB write, deploy, object mutation, destructive operation, or legacy retirement ran.

- 2026-06-13: Goal 10 write-gated seven apply path added. `content-service/scripts/migrate-seven-from-legacy.py` now supports `--apply --confirm-write --approval-note --rollback-plan`, generates rollback SQL before writes, refuses apply when dry-run blocking issues exist, and statically renders common legacy Django tags (`title`, `audio`, `video`, `url`, `load`, `hg/endhg`) into stored HTML. Verification passed: `python3 -m py_compile`, `--help`, apply-without-gates refusal (`status=2`), dry-run `/tmp/speakasap-seven-dry-run-v2.json` (`writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`), and DB-backed target dry-run `/tmp/speakasap-seven-dry-run-target-v5.json` (`writes=false`, target checked, target seven tables missing before schema migration). No schema migration, data apply, deployment, object mutation, destructive operation, or legacy retirement ran.
- 2026-06-13: Goal 10 schema/importer audit completed. Legacy `seven.xml` ordering audit confirmed only `en`, `de`, and `cn` have 8 lesson rows and all use unique order values `1..8`, so the `SevenLesson(courseId, order)` unique key matches source evidence. Importer exercise ordering now parses `lessonNexM.html` numerically; verified with `lesson12ex3.html -> (12, 3, ...)` and `lesson1ex10.html -> (1, 10, ...)`. Verification passed: `python3 -m py_compile`, dry-run `/tmp/speakasap-seven-dry-run-v6.json` (`writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, no blocking issues, 4 warnings), apply-without-gates refusal (`status=2`), `cd content-service && npm run prisma:validate`, `cd content-service && npm run build`, `cd api-gateway && npm run build`, and `cd frontend && npm run build`. No schema migration, data apply, deployment, object mutation, destructive operation, or legacy retirement ran.
- 2026-06-13: Goal 10 reconciliation hardening completed without writes. `content-service/scripts/migrate-seven-from-legacy.py` now stamps course/lesson/exercise metadata with migration batch `seven-content-legacy-20260613`; generated rollback SQL includes the same batch note; DB-backed target reconciliation now reports planned legacy course IDs, lesson IDs, and exercise keys and will return target ID samples after schema migration creates the seven tables. Verification passed: `/tmp/speakasap-seven-dry-run-v7.json` (`writes=false`, payload `19/136/429`, no blocking issues, batch metadata verified), `/tmp/speakasap-seven-dry-run-target-v8.json` (`writes=false`, `target.checked=true`, planned counts `19/136/429`, expected missing seven tables), apply-without-gates refusal (`status=2`), `python3 -m py_compile`, `cd content-service && npm run prisma:validate`, `cd content-service && npm run build`, and `cd frontend && npm run build`. No schema migration, data apply, deployment, object mutation, destructive operation, or legacy retirement ran.
- 2026-06-13: Goal 10 frontend preview parity improved and Browser-verified without writes/deploy. Added seven lesson reading indicator, PDF link generation, shared promo description helper, and lesson-page promo block. Temporary mock gateway/Next preview QA passed: /en/seven rendered two cards, grammar-safe promo text, no overlay, no console warnings/errors; /en/seven/1 rendered PDF link /media/pdf/en/lesson1.pdf, legacy text style 16px/30px/rgb(66,66,66), PT Mono heading 32px/40px/rgb(44,150,255), answer disclosure opened, and reading indicator reached width: 100% after scroll. Screenshots are /tmp/speakasap-seven-course-preview.png and /tmp/speakasap-seven-lesson-preview.png. Temporary processes were stopped. No schema migration, data apply, deployment, object mutation, destructive operation, or legacy retirement ran.
- 2026-06-13: Goal 10 seven media contract tightened without writes/deploy. `content-service` lesson summary/detail payloads now include `pdfHref` using the legacy PDF path shape `/media/pdf/<languageCode>/lesson<order>.pdf`; frontend types accept `pdfHref` and lesson pages prefer the API value with a fallback for mock/older payloads. Verification passed: `cd content-service && npm run build` and `cd frontend && npm run build`. No schema migration, data apply, deployment, object mutation, destructive operation, or legacy retirement ran.
- 2026-06-13: Goal 10 importer language-case metadata completed without writes/deploy. `content-service/scripts/migrate-seven-from-legacy.py` now writes `legacyLanguageCaseGent` into course metadata for all 19 seven courses, matching the frontend promo helper and avoiding raw language-name grammar regressions after data apply. Verification passed: `python3 -m py_compile`, `/tmp/speakasap-seven-dry-run-v10.json` (`writes=false`, payload `19/136/429`, no blocking issues, 4 expected warnings), explicit metadata audit showed missing genitive cases `[]`, apply-without-gates refusal (`status=2`), and `cd frontend && npm run build`. No schema migration, data apply, deployment, object mutation, destructive operation, or legacy retirement ran.
- 2026-06-13: Goal 10 lesson navigation API contract tightened without writes/deploy. `content-service` lesson detail payloads now include `previousLesson` and `nextLesson` summary objects, matching the legacy `lesson.next_lesson` navigation behavior and reducing frontend-only derivation. Frontend lesson pages prefer API-provided adjacent lessons and keep the existing computed fallback for mock/older payloads. Verification passed: `cd content-service && npm run build` and `cd frontend && npm run build`. No schema migration, data apply, deployment, object mutation, destructive operation, or legacy retirement ran.

### 2026-06-13 - Goal 10 Next Metadata Parity

- Added `generateMetadata` to the seven course route and seven lesson route so migrated SEO title/description/keywords are used by Next pages when the content-service data is available.
- Kept SpeakASAP default SEO description fallback for unavailable content.
- Verification: `cd frontend && npm run build` passed; dynamic routes `/[languageCode]/seven` and `/[languageCode]/seven/[order]` remain server-rendered on demand.
- Boundary: no schema migration, data apply, deploy, object mutation, destructive command, or legacy route retirement ran.

### 2026-06-13 - Goal 10 Structured Media References

- Added structured `mediaRefs` extraction to migration metadata for lessons, exercises, and answers after static legacy tag rendering.
- Added `migrationMediaRefs` summary counts to no-write reports and exposed `mediaRefs` on content-service/API/frontend seven types for later media reconciliation and production QA.
- Verification: `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py`, `cd content-service && npm run build`, `cd frontend && npm run build`, and `/tmp/speakasap-seven-dry-run-v11.json` passed with `writes=false`, payload `19/136/429`, media refs `136/408/1104`, no blocking issues, and 4 expected warnings.
- Boundary: no schema migration, data apply, deploy, object mutation, destructive command, or legacy route retirement ran.

### 2026-06-13 - Goal 10 App Promo Frontend Parity

- Added `SevenAppPromo` and rendered it on seven course/lesson pages when `appPackage` is present, preserving the legacy app section headline and four learner-facing bullet points.
- Used only migrated/current data for actions: Google Play link is derived from `appPackage`; iOS URL remains omitted until represented by data evidence.
- Verification: `cd frontend && npm run build` passed; `rg` confirmed route wiring.
- Boundary: no schema migration, data apply, deploy, object mutation, destructive command, or legacy route retirement ran.

### 2026-06-13 - Goal 10 Legacy App URL Metadata

- Added AST-based extraction of legacy `Language.ANDROID_URLS` and `Language.IOS_URLS` into seven course metadata as `legacyAndroidUrl` and `legacyIosUrl`.
- Frontend app promo now uses migrated app URLs from metadata, with `appPackage` retained only as a Google Play fallback.
- Verification: `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py`, `/tmp/speakasap-seven-dry-run-v12.json` (`writes=false`, payload `19/136/429`, app URL coverage `18/17`, no blocking issues), and `cd frontend && npm run build` passed.
- Boundary: no schema migration, data apply, deploy, object mutation, destructive command, or legacy route retirement ran.

### 2026-06-13 - Goal 10 App Promo Rendered QA

- Browser QA against temporary mock gateway and Next preview verified `/en/seven` and `/en/seven/1` render the app promo with real course title and both legacy app links.
- Lesson QA also verified PDF href, answer disclosure interaction, empty console warnings/errors, no framework overlay, and legacy typography values `16px/30px/rgb(66,66,66)` for paragraph text plus `PT Mono 32px/40px/rgb(44,150,255)` for heading text.
- Screenshots saved outside the repo at `/tmp/speakasap-seven-app-promo-course.png` and `/tmp/speakasap-seven-app-promo-lesson.png`.
- Mobile viewport resize was not available in the Browser runtime and remains for post-data/deploy QA.
- Boundary: no schema migration, data apply, deploy, object mutation, destructive command, or legacy route retirement ran.

### 2026-06-13 - Goal 10 Fresh Target Reconciliation V12

- Re-ran DB-backed no-write target reconciliation with the v12 seven payload against the Kubernetes content database through a temporary remote Postgres port-forward.
- Verification: `/tmp/speakasap-seven-dry-run-target-v12.json` recorded `writes=false`, payload `19/136/429`, media refs `136/408/1104`, app URL coverage `18/17`, `target.checked=true`, planned IDs/keys `19/136/429`, no blocking issues, and expected missing-table errors for `SevenCourse`, `SevenLesson`, and `SevenExercise` before schema migration.
- Boundary: no schema migration, data apply, deploy, object mutation, destructive command, or legacy route retirement ran; the temporary port-forward was not left listening.

### 2026-06-13 - Goal 10 Schema Migration Approval Packet

- Added `docs/orchestrator/SEVEN_SCHEMA_MIGRATION_APPROVAL.md` to make the next owner gate precise: schema-only migration for empty seven tables, then DB-backed no-write reconciliation, with no data apply/deploy/object mutation/legacy retirement approved.
- Verification: `cd content-service && npm run prisma:validate` and `cd content-service && npm run build` passed.
- Boundary: no schema migration, data apply, deploy, object mutation, destructive command, or legacy route retirement ran.

### 2026-06-13 - Goal 10 Full Planned-Match Reconciliation Counts

- Hardened seven importer target reconciliation to count full planned matches with `COUNT(*)` queries, while keeping sample rows limited for readable reports.
- Verification: `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py`, `/tmp/speakasap-seven-dry-run-v13.json`, and `/tmp/speakasap-seven-dry-run-target-v13.json` passed with `writes=false`, planned IDs/keys `19/136/429`, no blocking issues, and expected missing-table errors before schema migration.
- Boundary: no schema migration, data apply, deploy, object mutation, destructive command, or legacy route retirement ran; temporary port-forward `15437` was stopped.

### 2026-06-13 - Goal 10 Target Base Content Schema Readiness

- Added target `Language` readiness checks to the seven importer so DB-backed dry-runs block schema/data progress when the base content schema is absent.
- Verification: `/tmp/speakasap-seven-dry-run-target-v14.json` returned `writes=false`, `target.checked=true`, blocking issue `TARGET_LANGUAGE_TABLE_UNAVAILABLE`, and planned language codes `19`; read-only information_schema inventory returned public tables `[]` and no `_prisma_migrations` table.
- Updated `docs/orchestrator/SEVEN_SCHEMA_MIGRATION_APPROVAL.md`; the next approval must cover base content schema readiness before seven schema migration. Seven data apply remains unapproved.
- Boundary: no schema migration, data apply, deploy, object mutation, destructive command, or legacy route retirement ran; temporary port-forwards were stopped.

### 2026-06-13 - Goal 10 Content Base Schema Approval Packet

- Added `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` to make the new approval gate explicit: apply pending content-service schema migrations for base readiness and seven schema only, then rerun DB-backed no-write seven reconciliation.
- Verification: `cd content-service && npm run prisma:validate` and `cd content-service && npm run build` passed.
- Boundary: no schema migration, data apply, deploy, object mutation, destructive command, or legacy route retirement ran.
## 2026-06-13 - Goal 10 Seven Contract And Smoke Hardening

Status: no-write contract hardening completed; no schema migration, seven data apply, media copy, deployment, object mutation, destructive operation, or legacy retirement ran.

Changed:

- Spawned read-only sub-agent Huygens to validate current seven frontend/API/gateway contracts on alfares; it made no edits and reported rollout risks around media routing, deployed gateway auth, partial API failure handling, and legacy 8-row courses.
- Hardened scripts/check-seven-deployment-smoke.py so the no-write deployment smoke now checks API payload shape, lesson body presence, PDF/media refs, absence of unresolved legacy template syntax, and frontend page markers: seven-page, seven-lessons-grid, seven-page--lesson, lesson__content--seven, and lesson-wrapper.
- Hardened frontend/lib/seven.ts to settle course, lessons, and lesson-detail API calls independently. A neighbor-list or metadata failure no longer discards successfully fetched lesson content.
- Verified legacy preservation for non-7 row courses: legacy speakasap_site/templates/site/seven/index.html renders course.get_lessons without a hard limit, and fixtures show EN course 1, DE course 4, and CN course 18 have 8 visible rows. The target should preserve those rows rather than truncate to exactly seven DB rows.

Verification:

- cd frontend && npm run build passed after the frontend/lib/seven.ts hardening and still lists dynamic routes /[languageCode]/seven and /[languageCode]/seven/[order].
- python3 -m py_compile scripts/check-seven-deployment-smoke.py passed.
- Current production baseline remains expected-failing before deploy/data/media: /tmp/speakasap-seven-deployment-smoke-current-v2.json recorded writes=false, health 200, seven APIs 401, seven pages 404, PDF/audio 404, and explicit failed assertions for API/page/media contracts.
- Legacy fixture evidence for the 8-row courses was printed from portal/fixtures/seven.xml: EN order 8 7 Keys to study English, DE split lesson 1 into parts 1/2 plus lessons 2-7, and CN order 8 Чтение и аудирование на китайском языке.

Boundary:

- No target DB schema or data write ran.
- No media copy or static route change ran.
- No Kubernetes deploy or rollout restart ran.
- Legacy portal remains the behavior/style fallback.

Next:

- Approval is still required for the schema-only content DB migration from docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md; after that, rerun DB-backed no-write reconciliation and keep media/deploy approvals separate.
## 2026-06-13 - Goal 10 Seven Assets Base Media Contract

Status: code contract aligned with existing platform assets host; no schema migration, seven data apply, media copy, deployment, object mutation, destructive operation, or legacy retirement ran.

Changed:

- Aligned seven public media URLs with the existing new-platform ASSETS_BASE_URL contract already used by content-service language icon responses and Kubernetes service config.
- Updated content-service/src/seven/seven.service.ts so pdfHref, mediaRefs, and /media/... links inside lesson/exercise/answer HTML are rewritten at response time to ASSETS_BASE_URL + /media/... when ASSETS_BASE_URL is configured. Without the env var, the API keeps the legacy relative /media/... shape.
- Updated scripts/check-seven-deployment-smoke.py with --assets-base-url defaulting to https://assets.alfares.cz, so deployment smoke validates the same public media base that content-service will emit.

Verification:

- cd content-service && npm run build passed.
- python3 -m py_compile scripts/check-seven-deployment-smoke.py passed.
- /tmp/speakasap-seven-deployment-smoke-current-v3.json recorded writes=false, assetsBaseUrl=https://assets.alfares.cz, expected PDF href https://assets.alfares.cz/media/pdf/en/lesson1.pdf, and current expected failures before rollout/media copy: seven APIs 401, pages 404, PDF/audio 404.

Boundary:

- No files were copied to assets.alfares.cz.
- No /media route, ingress, or object storage mutation ran.
- No target DB schema/data write or Kubernetes deploy ran.

Next:

- Keep schema-only approval first. Media approval later should copy the approved manifest to the asset host path that serves https://assets.alfares.cz/media/..., then rerun the smoke checker against the same assets base.
## 2026-06-13 - Goal 10 Seven Assets Contract Checker

Status: no-write verifier added for seven media URL mapping; no schema migration, seven data apply, media copy, deployment, object mutation, destructive operation, or legacy retirement ran.

Changed:

- Added content-service/scripts/check-seven-assets-contract.py to validate the dry-run media refs against the chosen ASSETS_BASE_URL public URL contract without network calls or data writes.
- The checker verifies that legacy /media/... refs map to the asset host while preserving /media path suffixes, external video refs remain external, duplicate mapping does not occur, and the planned PDF count matches PDF refs in the migration report.
- Normalized indentation in content-service/src/seven/seven.service.ts around exercise response serialization after the media rewrite change.

Verification:

- python3 -m py_compile content-service/scripts/check-seven-assets-contract.py passed.
- content-service/scripts/check-seven-assets-contract.py --input-report /tmp/speakasap-seven-dry-run-v19.json --assets-base-url https://assets.alfares.cz --json-report /tmp/speakasap-seven-assets-contract-v1.json passed with ok=true.
- /tmp/speakasap-seven-assets-contract-v1.json counted refs=1373, internalRefs=1240, externalRefs=133, audio=1104, pdf=136, video=133, plannedPdfRefCount=136, failed assertions=[]; sample mapping /media/audio/cn/lesson1.mp3 -> https://assets.alfares.cz/media/audio/cn/lesson1.mp3.

Boundary:

- This proves URL mapping only. It does not prove asset availability; copy/availability remains blocked on separate media approval.
- No target DB schema/data write or Kubernetes deploy ran.

Next:

- After schema-only approval and DB-backed no-write reconciliation, keep using /tmp/speakasap-seven-assets-contract-v1.json plus the availability checker as media-copy acceptance evidence.
## 2026-06-13 - Goal 10 Seven Apply Readiness Aggregator

Status: no-write readiness aggregator added; no schema migration, seven data apply, media copy, deployment, object mutation, destructive operation, or legacy retirement ran.

Changed:

- Added content-service/scripts/check-seven-apply-readiness.py to aggregate dry-run, assets-contract, deployment-smoke, and approval-packet evidence into one gate report.
- The checker reports separate source, assets, schema, data, and deploy gates so owner approval can be scoped to the next safe action instead of implying full cutover readiness.

Verification:

- python3 -m py_compile content-service/scripts/check-seven-apply-readiness.py passed.
- /tmp/speakasap-seven-apply-readiness-v1.json was generated from dry-run v19, assets-contract v1, and deployment-smoke current v3.
- Readiness v1 recorded ok=true for owner schema approval readiness and complete=false for the full migration. Schema gate: approvalDocsPresent=true, sourceDryRunReady=true, assetsContractReady=true, readyForOwnerSchemaApproval=true. Data gate: targetChecked=false, readyForOwnerDataApproval=false. Next action: get explicit schema-only approval, apply content-service schema migrations, then rerun DB-backed no-write reconciliation.

Boundary:

- The readiness checker does not connect to the DB, call the network, copy media, or deploy. It only aggregates existing no-write evidence.
- The goal remains incomplete until schema/data/media/deploy are applied with separate approvals and production smoke/browser QA passes.

Next:

- Use /tmp/speakasap-seven-apply-readiness-v1.json as the current evidence that the next valid owner decision is CONTENT_BASE_SCHEMA_APPROVAL.md only.
- 2026-06-13: Goal 10 completion audit hardened no-write. `/tmp/speakasap-seven-goal-completion-audit-v9.json` reports explicit contract gates passing for frontend route, content API, gateway public access, data apply, media approval, deployment readiness, and typography; remaining missing gates are schema reconciliation, data readiness, deployment smoke, and cutover readiness. No schema/data/media/deploy action ran.
- 2026-06-13: Goal 10 no-write validation suite added. `/tmp/speakasap-seven-no-write-suite-v1.json` reports `writes=false`, `network=false`, `database=false`, `deployment=false`, `ok=true`, and `complete=false`; remaining runtime gates are schema reconciliation, data readiness, deployment smoke, and cutover readiness. No schema/data/media/deploy action ran.
- 2026-06-13: Goal 10 fresh build and suite validation passed. content-service, api-gateway, and frontend builds passed; frontend build listed dynamic seven routes; `/tmp/speakasap-seven-no-write-suite-v2.json` reports `ok=true`, `complete=false`, and no DB/network/deployment action. Remaining runtime gates are schema reconciliation, data readiness, deployment smoke, and cutover readiness.

### 2026-06-13 - Goal 10 Runtime Approval Sequence

- Added canonical runtime approval runbook `docs/orchestrator/SEVEN_RUNTIME_APPROVAL_SEQUENCE.md` and no-write checker `scripts/check-seven-approval-sequence.py`.
- Wired the checker into `scripts/check-seven-no-write-suite.py`; suite v18 is the next evidence target.
- Boundary: no target DB/schema/data/media/deploy/route/rollback action ran; next real action remains owner-approved schema-only gate.

### 2026-06-13 - Goal 10 Next-Gate Preflight

- Added no-write checker `scripts/check-seven-next-gate.py` to report the next requestable runtime gate from readiness, approval sequence, and runtime evidence artifacts.
- Wired the checker into `scripts/check-seven-no-write-suite.py`; suite v19 is the next evidence target.
- Boundary: no target DB/schema/data/media/deploy/route/rollback action ran; next real action remains owner-approved schema-only gate.

### 2026-06-13 - Goal 10 Schema Approval Evidence Freshness

- Updated active schema approval packet to reference current next-gate v1 and no-write suite v19 evidence instead of stale suite v7 evidence.
- Hardened `content-service/scripts/check-seven-schema-migration-plan.py` to require next-gate schema requestability and no-write suite v19+ references in the approval packet.
- Boundary: no target DB/schema/data/media/deploy/route/rollback action ran; next real action remains owner-approved schema-only gate.

### 2026-06-13 - Goal 10 Intent Commit Readiness Gate

- Added no-write checker `scripts/check-seven-intent-commit-readiness.py` for seven intent evidence and required migration commit block completeness.
- Wired the checker into `scripts/check-seven-no-write-suite.py`; suite v21 is the next evidence target.
- Boundary: no target DB/schema/data/media/deploy/route/rollback action ran; next real action remains owner-approved schema-only gate.

### 2026-06-13 - Goal 10 Worker Evidence Gate

- Added no-write checker `scripts/check-seven-worker-evidence.py` for recorded Anscombe/McClintock/Huygens read-only worker evidence and boundaries.
- Wired the checker into `scripts/check-seven-no-write-suite.py`; suite v22 is the next evidence target.
- Boundary: no target DB/schema/data/media/deploy/route/rollback action ran; next real action remains owner-approved schema-only gate.


### 2026-06-13 - Goal 10 Schema And Data Gates Executed

- Applied content-service schema migrations and recorded `/tmp/speakasap-seven-schema-apply-execution-v1.json`.
- Applied seven public content data with `--include-languages`; rollback SQL is `/tmp/speakasap-seven-content-rollback-v1.sql`.
- Post-apply reconciliation `/tmp/speakasap-seven-content-post-apply-v1.json` shows planned matches 19 courses, 136 lessons, and 429 exercises with no blocking issues.
- Runtime evidence after data remains complete=false until media, deploy, smoke, and visual QA gates run.
- Boundary: no media copy/object mutation, deployment, public cutover, rollback, or legacy route retirement ran.

- 2026-06-21: Goal 9.6 Option B missing-media salary fallback policy approved. Owner selected imported legacy `LessonSalaryExpense.qty` as the authoritative salary quantity for the seven unresolved salary-scoped private media rows. Read-only coverage confirmed all seven unresolved lesson UUIDs are present in `/tmp/speakasap-salary-lesson-uuids-2025-07_2026-06-goal9.json`. No `duration_seconds` synthesis/write, object-storage mutation, fallback DB write, salary finalization, payout, payment execution, deployment, rollback execution, legacy mutation, or destructive action ran. Next gate is no-write salary readiness/preview before any separately approved draft calculation run.

- 2026-06-21: Goal 9.6 Option B no-write coverage validation completed. `/tmp/speakasap-salary-readiness-2026-05-option2-v1.json` recorded `writes=false`, `missingDurationCount=0`, `shortRecordCount=6`, `teacherMappingMissingCount=0`, and no aggregate warnings. `/tmp/speakasap-salary-option2-import-coverage-v1.json` recorded `durationBlockers=6`, `coveredByImportedLessonSalary=6`, `unresolvedRows=7`, `coveredByImportedLessonSalary=7`, and `safeForDraftCalculationApprovalPacket=true`. No salary calculation run, payout, payment execution, deployment, rollback execution, object mutation, fallback DB write, legacy mutation, or destructive action ran. Next gate is a separate draft salary calculation approval packet.

- 2026-06-21: Goal 9 Option B draft salary calculation approval packet prepared in `docs/orchestrator/SALARY_DRAFT_CALCULATION_APPROVAL_OPTION2.md`. The packet uses `/tmp/speakasap-salary-option2-import-coverage-v1.json`, which recorded `safeForDraftCalculationApprovalPacket=true`, `durationBlockers=6`, `coveredByImportedLessonSalary=6`, `unresolvedRows=7`, and `coveredByImportedLessonSalary=7`. No salary calculation run, payout, payment execution, deployment, rollback execution, object mutation, fallback DB write, legacy mutation, or destructive action ran. Await owner approval/rejection/scope change.
- 2026-06-21: Goal 9 Option B owner-approved draft salary calculation completed. `/tmp/speakasap-salary-calculation-run-2026-05-option2-v1.json` recorded `writes=true`, draft run `849b766d-90d4-415d-8e59-86fca05128d5`, period `2026-05`, `lineCount=14`, `linesUsingImportedLessonSalary=14`, totals `EUR=21858` and `CZK=29035`, and `payoutRunCountForCreatedRun=0`. Post-run status `/tmp/speakasap-salary-status-after-calculation-option2-v1.json` recorded `payoutRuns=0`, `payoutLines=0`, and `paymentDisbursementCreated=false`. Rollback SQL is `/tmp/speakasap-salary-calculation-run-rollback-2026-05-option2-v1.sql`; rollback was not executed. No salary finalization, payout creation, payout commit, payment execution, persistent env change, deployment, object mutation, fallback DB write, legacy mutation, or destructive action ran. Next gate is owner review of the draft run and separate explicit approval for any finalization or payout/payment step.

- 2026-06-21: Goal 9 Option B finalization and payout-preparation approval packet prepared in `docs/orchestrator/SALARY_FINALIZATION_PAYOUT_PREPARATION_APPROVAL_OPTION2.md`. The packet is scoped to finalizing draft calculation run `849b766d-90d4-415d-8e59-86fca05128d5` and creating exactly one draft payout run with draft payout lines. It explicitly excludes payout commit, payment-service disbursement, external money movement, persistent env changes, additional calculation runs, deployment, rollback execution, object mutation, fallback DB write, legacy mutation, and destructive actions. No salary finalization, payout run creation, payout commit, payment execution, deployment, rollback execution, object mutation, fallback DB write, legacy mutation, or destructive action ran.

- 2026-06-21: Goal 9 Option B owner-approved finalization and draft payout preparation completed. `/tmp/speakasap-salary-finalization-payout-prep-2026-05-option2-v1.json` recorded `writes=true`, calculation run `849b766d-90d4-415d-8e59-86fca05128d5` changed from `draft` to `finalized`, and draft payout run `ffefafe8-c2f7-4b76-8da6-3efbd5d707d1` was created with 14 draft payout lines. Post-run status `/tmp/speakasap-salary-status-after-payout-prep-option2-v1.json` recorded `paymentRefs=0`, `payoutCommitCalled=false`, and `paymentDisbursementCreated=false`. Rollback SQL is `/tmp/speakasap-salary-finalization-payout-prep-rollback-2026-05-option2-v1.sql`; rollback was not executed. No payout commit, payment-service disbursement, external money movement, persistent env change, deployment, object mutation, fallback DB write, legacy mutation, or destructive action ran. Next gate is owner review of the draft payout run and a separate explicit approval packet for payout commit/payment execution.

- 2026-06-21: Goal 9 Option B payout commit/payment execution approval packet prepared in `docs/orchestrator/SALARY_PAYOUT_COMMIT_PAYMENT_EXECUTION_APPROVAL_OPTION2.md`. The packet is scoped to committing draft payout run `ffefafe8-c2f7-4b76-8da6-3efbd5d707d1` and executing payment-service salary disbursement for 14 draft payout lines. It explicitly marks this as the money-movement gate and excludes additional payout runs, additional calculation runs, salary recalculation, persistent env changes, deployment, rollback execution, object mutation, fallback DB write, legacy mutation, and destructive actions. No payout commit, payment-service disbursement, external money movement, deployment, rollback execution, object mutation, fallback DB write, legacy mutation, or destructive action ran.
