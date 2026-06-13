# SpeakASAP Orchestrator Tasks

This file is the root task index for the SpeakASAP master orchestrator. Detailed goals and chunk status live in `docs/orchestrator/GOALS.md`; runtime state lives in `docs/orchestrator/IMPLEMENTATION_STATE.md`, `docs/orchestrator/STATE.json`, and root `STATE.json`.

## Active Task

- Goal 10.3: owner-approved content-service base schema readiness, then seven schema migration, then no-write report rerun.

Current gate:

- Goal 10.1 content-service schema/API and Goal 10.2 dry-run importer are implemented and statically verified.
- Frontend public routes `/<languageCode>/seven` and `/<languageCode>/seven/<order>` are implemented with legacy typography CSS and gateway-only data loading.
- Dry-run reports through `/tmp/speakasap-seven-dry-run-v13.json` and DB-backed `/tmp/speakasap-seven-dry-run-target-v13.json` recorded `writes=false`, 19 courses, 136 lessons, 429 exercises in the migration payload, no blocking issues, full target planned ID/key count support, app URL/media-ref metadata, and target seven tables missing before schema migration.
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
- Schema-only approval packet is now documented in `docs/orchestrator/SEVEN_SCHEMA_MIGRATION_APPROVAL.md` with exact scope, command, post-apply no-write check, rollback SQL, and approval wording.
- Target reconciliation now uses full `COUNT(*)` planned-match queries instead of sample-sized counts, so post-data evidence can prove all `19/136/429` imported rows.
- Fresh target dry-run v14 found `TARGET_LANGUAGE_TABLE_UNAVAILABLE`; target `speakasap_content_db` currently has no public tables or Prisma migration history, so seven schema cannot be applied safely until base content schema readiness is approved and verified.
- Base content schema approval packet is documented in `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`; it covers pending content-service Prisma migrations for schema readiness only, then DB-backed no-write seven reconciliation.
- Importer course metadata now includes `legacyLanguageCaseGent` for all 19 seven courses so frontend promo copy can preserve Russian grammatical wording after data apply.
- Salary Goal 9 remains paused, not reverted; existing dirty checkout changes must be preserved.
- Do not run content-service schema migration, seven content data apply, frontend/content deployment, destructive operations, or legacy route retirement without dry-run evidence, build evidence, rollback plan, and explicit owner approval. The importer apply path is implemented but must not be used before the schema migration exists and owner approval is recorded.

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

1. Goal 10.3: owner-approved content-service seven schema migration, then rerun DB-backed no-write report.
2. Goal 10.4: apply seven content migration only after explicit owner approval and rollback SQL generation.
3. Goal 10.6: visual parity and deploy verification after data apply.
4. Resume Goal 9 salary migration after owner confirms seven frontend slice is stable or explicitly reprioritizes.

## Task Rules

- The master orchestrator chooses the next task from state and goals; worker agents do not choose roadmap order.
- Every task must preserve SpeakASAP intent, service ownership, private data boundaries, and legacy behavior parity.
- Coding tasks require a scoped execution plan, verification evidence, and a status entry before completion.
- Migration commits require the `Intent`, `Scope`, `Evidence`, `Verification`, `Approval`, and `Rollback` commit-message block defined in `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md`.
- Owner questions are reserved for approval gates, destructive operations, unclear scope, or true blockers.

- 2026-06-13: Goal 10 language seed readiness completed no-write; importer payload now includes 19 legacy Language rows and write-gated `--include-languages`, with schema approval still required before any data apply.

- 2026-06-13: Goal 10 media readiness completed no-write; seven dry-run now reports 1373 media refs and sample public checks show `/media` assets still return 404 pending source-location/copy/routing approval.

- 2026-06-13: Goal 10 media source discovery completed read-only; `https://speakasap.com` covers 1212/1240 internal media refs, all PDFs are available, and 28 `media/audio/ru` refs remain unresolved.

- 2026-06-13: Goal 10 media copy manifest prepared no-write; `/tmp/speakasap-seven-media-copy-manifest-v1.json` lists 1212 available candidates and 28 unresolved `media/audio/ru` refs.
