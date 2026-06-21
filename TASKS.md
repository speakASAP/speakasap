# SpeakASAP Orchestrator Tasks

This file is the root task index for the SpeakASAP master orchestrator. Detailed goals and chunk status live in `docs/orchestrator/GOALS.md`; runtime state lives in `docs/orchestrator/IMPLEMENTATION_STATE.md`, `docs/orchestrator/STATE.json`, and root `STATE.json`.

## Active Task

- Goal 9.6: review draft salary calculation run V2; payout/payment/finalize gates remain closed.

Current gate:

- Owner-approved Goal 9.6 Option A duration apply is complete: 2 probe-successful `education_lessonrecord.duration_seconds` rows were updated with rollback SQL captured, and post-apply no-write evidence leaves 7 payroll-impacting `http_404` private media rows in recovery.

- Draft salary calculation run V2 `b5d47fb3-e366-4c04-8683-37a51b3c45bf` was created after owner approval; 14 lines, totals CZK 29035 and EUR 21858, zero payout runs, rollback SQL captured. Finalize/payout/payment/rollback remain separately gated.

- Broader salary calculation enablement packet is prepared at `docs/orchestrator/SALARY_BROADER_CALCULATION_ENABLEMENT_APPROVAL.md`; no additional calculation run has been created.

- Post-deploy salary preview on 2026-06-15 recorded 14/14 lines using imported legacy lesson salary hours, 6/6 short-record blockers covered by imported expenses, no new calculation run, and zero payout runs. Broader calculation enablement still needs a separate owner decision and approval packet.
- Education ExternalSecret still lacks `LESSON_RECORD_MEDIA_TOKEN_SECRET`; private media token smoke remains blocked separately from salary.

- Draft salary smoke review on 2026-06-14 accepted run `6576ac90-526e-47c6-8755-9631a4fb3149` only as scoped evidence: 14 draft lines, totals EUR 21858 and CZK 29035, no payout run, no payment disbursement, rollback SQL available but not executed.
- Source salary duration tolerance is now fixed to the documented five-minute rule and guarded by `npm run test:lesson-records`; deploy/rollout was not run and needs owner approval before runtime readiness can be trusted.

- Owner explicitly reprioritized salary after Goal 9 had been paused for Seven; existing Seven work remains preserved and must not be reverted.
- Education salary aggregates now expose demo unpaid/payable counters, readiness metadata, and blocker samples for missing `duration_seconds`, short records, and missing teacher mappings.
- Salary calculation run creation is disabled unless `SALARY_CALCULATION_RUNS_ENABLED=true` and education aggregate readiness has no missing-duration, short-record, teacher-mapping, or dependency-warning blockers.
- Salary payout create/commit is disabled unless `SALARY_PAYOUT_FLOWS_ENABLED=true`.
- No-write readiness command exists: `cd salary-service && npm run check:salary-readiness -- --period <YYYY-MM> --json-report /tmp/speakasap-salary-readiness-<period>.json`.
- Report `/tmp/speakasap-salary-readiness-2026-05.json` recorded `writes=false`, `salaryCalculationReady=false`, `missingDurationCount=0`, `shortRecordCount=6`, `teacherMappingMissingCount=0`, `demoLessonCount=1`, `demoUnpaidLessonCount=0`, and `demoPayableLessonCount=1`.
- The six short-record blocker lesson UUIDs are `d3e59e96-d010-4040-baae-0518e3838dce`, `7355b9de-dbdd-4089-ac8e-ac862b512a64`, `a0508fd4-5195-40eb-9eb7-49daa2348dd7`, `9169ce77-4167-48e6-bb11-d1579964b11a`, `9630fdfc-2c57-4c08-822f-ba85ed339527`, and `4668280d-468c-49a4-b135-91bfbc15fb16`.
- Reconciliation report `/tmp/speakasap-salary-short-record-reconciliation-2026-05.json` recorded `writes=false`: all six short-record rows have legacy/imported salary expense `qty=1.00`, while current target duration recalculation would pay less than one hour.
- The remaining blocker is historical parity policy/implementation, not missing data: calculation previews/runs must preserve imported historical `salary_expenses.qty` for imported lesson salary rows, or owner approval is required to recompute historical salary from MP3 duration.
- Historical imported lesson salary quantity preservation is now implemented in `salary-service/src/calculation-runs/calculation-runs.service.ts`: calculation lines use imported lesson salary expense `qty` hour sums for historical profile/month rows when present and keep the env gate disabled until fresh parity evidence passes.
- No-write preview report `/tmp/speakasap-salary-calculation-preview-2026-05.json` recorded `writes=false`, `profiles=14`, `lines=14`, `linesUsingImportedLessonSalary=14`, and `blockerSamplesCoveredByImportedSalaryExpenses=6`.
- Owner-approved draft calculation smoke created calculation run `6576ac90-526e-47c6-8755-9631a4fb3149` with `14` lines for period `2026-05`.
- Draft calculation report: `/tmp/speakasap-salary-calculation-run-2026-05-v1.json`.
- Rollback SQL: `/tmp/speakasap-salary-calculation-run-rollback-2026-05-v1.sql`.
- Payout runs for the draft calculation: `0`; `SALARY_PAYOUT_FLOWS_ENABLED` remains disabled.
- Do not enable salary calculation runs, payout flows, payment execution, salary writes, destructive operations, or legacy retirement before the readiness report isolates and reconciles the remaining blocker rows and owner approval is recorded.

Paused Seven gate:

- Goal 10.1 content-service schema/API and Goal 10.2 dry-run importer are implemented and statically verified.
- Frontend public routes `/<languageCode>/seven` and `/<languageCode>/seven/<order>` are implemented with legacy typography CSS and gateway-only data loading.
- Current authoritative dry-run `/tmp/speakasap-seven-dry-run-v20.json` recorded `writes=false`, payload `languages=19`, `courses=19`, `lessons=136`, `exercises=429`, no blocking issues, HTML safety ok, and media refs `audio=1076`, `pdf=136`, `video=133`.
- Legacy ordering audit confirmed three courses have 8 rows (`en`, `de`, `cn`) but no duplicate `(course, order)` values; the new schema unique key is compatible with source fixture order.
- Importer exercise ordering now uses numeric filename parsing and `--apply` without gates refuses with status `2` before any DB action.
- Importer payload now stamps course/lesson/exercise metadata with migration batch `seven-content-legacy-20260613`; generated rollback SQL includes the same batch note.
- DB-backed target report now returns planned legacy ID/key counts and will include target ID samples after schema migration creates the seven tables.
- No-write Browser preview QA passed against a temporary mock gateway: course and lesson pages rendered, answer disclosure worked, PDF link was present, reading indicator updated on scroll, and console warnings/errors were empty. Screenshots: /tmp/speakasap-seven-course-preview.png and /tmp/speakasap-seven-lesson-preview.png.
- Seven lesson API payloads now include `pdfHref`, so the frontend consumes the content-service media reference and keeps a fallback only for mock/older payloads.
- Seven lesson detail API payloads now include `previousLesson` and `nextLesson`, and frontend navigation prefers API-owned adjacent lesson summaries with computed fallback.
- Seven course and lesson pages now generate Next metadata from migrated SEO fields with SpeakASAP default fallbacks.
- Seven migration payload/API/frontend types now carry structured `mediaRefs`; dry-run v11 recorded 136 lesson rows, 408 exercise rows, and 1104 unique media refs without writes.
- Seven course and lesson pages now include the legacy app-promo copy block when `appPackage` is present; frontend build passed without writes/deploy.
- Seven importer now migrates legacy Android/iOS app URLs into course metadata; dry-run v12 recorded 18 Android and 17 iOS app URL rows without writes.
- No-write Browser QA verified the app promo render and links on `/en/seven` and `/en/seven/1`; screenshots are `/tmp/speakasap-seven-app-promo-course.png` and `/tmp/speakasap-seven-app-promo-lesson.png`.
- Fresh DB-backed target reconciliation v12 confirmed target DB reachability and expected missing seven tables before schema migration; no writes ran.
- The older `docs/orchestrator/SEVEN_SCHEMA_MIGRATION_APPROVAL.md` packet is superseded; use only `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` for the active base-schema-plus-seven schema approval wording.
- Target reconciliation now uses full `COUNT(*)` planned-match queries instead of sample-sized counts, so post-data evidence can prove all `19/136/429` imported rows.
- Current pre-schema target reconciliation `/tmp/speakasap-seven-post-schema-reconciliation-fresh-v1.json` correctly fails schema acceptance before approval: seven tables and base `Language` are not queryable, while planned counts remain `19/136/429`.
- Base content schema approval packet is documented in `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`; it covers pending content-service Prisma migrations for schema readiness only, then DB-backed no-write seven reconciliation. The approval action is now `scripts/apply-seven-schema-approved.sh --execute` gated by an exact `SEVEN_SCHEMA_APPROVAL_TEXT` match and it records `/tmp/speakasap-seven-schema-apply-execution-v1.json` after successful schema-only execution. Aggregate readiness `/tmp/speakasap-seven-apply-readiness-v14.json` is `ok=true`, `complete=false`, with schema approval ready, hardened direct Prisma execution contract, clean data apply contract, media approval contract, frontend route contract, content API contract, gateway public access contract, and data/cutover not ready. Schema approval packet freshness is verified by `/tmp/speakasap-seven-schema-migration-plan-v10.json`, `/tmp/speakasap-seven-next-gate-v1.json`, and `/tmp/speakasap-seven-no-write-suite-v20.json`.
- Importer course metadata now includes `legacyLanguageCaseGent` for all 19 seven courses so frontend promo copy can preserve Russian grammatical wording after data apply.
- Salary Goal 9 remains paused, not reverted; existing dirty checkout changes must be preserved.
- Do not run content-service schema migration, seven content data apply, frontend/content deployment, destructive operations, or legacy route retirement without dry-run evidence, build evidence, rollback plan, and explicit owner approval. The importer apply path is implemented but must not be used before the schema migration exists and owner approval is recorded.
- Operator refusal gate: `scripts/check-seven-operator-refusal.py` verifies all runtime operators refuse without `--execute` before external actions.
- No-write validation suite: `scripts/check-seven-no-write-suite.py --json-report /tmp/speakasap-seven-no-write-suite-v22.json` regenerates local contract/readiness/completion reports without DB, network, media, kubectl, build, deploy, or route mutation.
- Runtime approval sequence: `docs/orchestrator/SEVEN_RUNTIME_APPROVAL_SEQUENCE.md` and `/tmp/speakasap-seven-approval-sequence-v1.json` enforce the only valid order: schema -> data -> media -> deploy -> visual QA -> runtime evidence.
- Next-gate preflight: `/tmp/speakasap-seven-next-gate-v1.json` records the next requestable gate and blocks later gates until prior runtime evidence exists.

## Required Task Flow

1. Read `AGENTS.md`, `BUSINESS.md`, `SYSTEM.md`, `docs/orchestrator/MASTER_PROMPT.md`, `docs/orchestrator/IMPLEMENTATION_ORCHESTRATOR.md`, `docs/orchestrator/INTENT.md`, `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md`, `docs/orchestrator/GOALS.md`, `docs/orchestrator/PLAN.md`, `docs/orchestrator/IMPLEMENTATION_STATE.md`, `docs/orchestrator/STATE.json`, `docs/orchestrator/STATUS.md`, this file, and root `STATE.json`.
2. Query RAG if reachable; otherwise record repository-evidence fallback in `docs/orchestrator/STATUS.md`.
3. Select the earliest active or pending chunk unless the owner explicitly redirects.
4. Restate the preserved business intent, service owner, data owner, auth boundary, storage boundary, and rollback boundary.
5. Implement only the selected chunk.
6. Run the documented verification commands or record why they could not run.
7. Complete the intent-preservation checklist in `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md`.
8. Append evidence to `docs/orchestrator/STATUS.md`.
9. Commit only after the pre-commit intent gate passes.

## Queue

1. Goal 9.6: continue read-only recovery investigation for the 7 remaining salary-scoped `http_404` private media rows; object restore/copy, fallback DB writes, salary finalization, payouts, payments, deployment, and rollback execution remain separately approval-gated.
2. Goal 9.6: keep `SALARY_PAYOUT_FLOWS_ENABLED` disabled; do not run payouts before separate payment-boundary approval.
3. Resume Goal 10.3 only after owner redirects back to Seven: content-service base schema readiness plus seven schema creation using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, then rerun DB-backed no-write report.
4. Goal 10.4: apply seven content data migration only after post-schema no-write reconciliation, explicit owner approval, and rollback SQL generation through `scripts/apply-seven-data-approved.sh`.

## Task Rules

- The master orchestrator chooses the next task from state and goals; worker agents do not choose roadmap order.
- Every task must preserve SpeakASAP intent, service ownership, private data boundaries, and legacy behavior parity.
- Coding tasks require a scoped execution plan, verification evidence, and a status entry before completion.
- Migration commits require the `Intent`, `Scope`, `Evidence`, `Verification`, `Approval`, and `Rollback` commit-message block defined in `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md`.
- Owner questions are reserved for approval gates, destructive operations, unclear scope, or true blockers.

- 2026-06-13: Goal 10 language seed readiness completed no-write; importer payload now includes 19 legacy Language rows and write-gated `--include-languages`, with schema approval still required before any data apply.

- 2026-06-13: Goal 10 media readiness completed no-write; seven dry-run now reports 1373 media refs and sample public checks show `/media` assets still return 404 pending source-location/copy/routing approval.

- 2026-06-13: Goal 10 media source discovery completed read-only; after the `ml='fr'` audio fix, `https://speakasap.com` covers 1212/1212 internal media refs with 0 missing.

- 2026-06-13: Goal 10 media copy manifest prepared no-write; `/tmp/speakasap-seven-media-copy-manifest-v3.json` lists 1212 available candidates and 0 unresolved refs.

- 2026-06-13: Goal 10 deployment readiness prepared no-write; `/tmp/speakasap-seven-deployment-readiness-v3.json` is `ok=true`, scoped deployment approval readiness is true, and cutover remains false until schema/data/media/deploy gates complete.

- 2026-06-13: Goal 10 media copy operator prepared no-write; `scripts/copy-seven-media-approved.sh` is gated by exact media approval, manifest v3, and explicit `MEDIA_TARGET_ROOT`.

- 2026-06-13: Goal 10 rendered HTML safety gate added no-write; `/tmp/speakasap-seven-dry-run-v19.json` checked 993 rendered fragments with zero tracked HTML safety issues.
- 2026-06-13: Goal 10 runtime approval sequence added no-write; `/tmp/speakasap-seven-approval-sequence-v1.json` will verify the schema -> data -> media -> deploy -> visual QA -> runtime evidence order, and suite v18 includes that checker.
- 2026-06-13: Goal 10 next-gate preflight added no-write; `/tmp/speakasap-seven-next-gate-v1.json` will report the next requestable gate from current artifacts, and suite v19 includes that checker.
- 2026-06-13: Goal 10 schema approval evidence freshness hardened no-write; active schema approval now references next-gate v1 and no-write suite v19, and schema plan v10 verifies these references.
- 2026-06-13: Goal 10 intent/commit readiness gate added no-write; `/tmp/speakasap-seven-intent-commit-readiness-v1.json` verifies intent-preservation evidence and required migration commit block.
- 2026-06-13: Goal 10 worker evidence gate added no-write; `/tmp/speakasap-seven-worker-evidence-v1.json` verifies read-only sub-agent findings and boundaries.
- 2026-06-13: Goal 10 schema and data gates executed under owner approval; `/tmp/speakasap-seven-content-post-apply-v1.json` proves 19/136/429 planned matches and next gate is media.
