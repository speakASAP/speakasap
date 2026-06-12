# SpeakASAP Orchestrator Tasks

This file is the root task index for the SpeakASAP master orchestrator. Detailed goals and chunk status live in `docs/orchestrator/GOALS.md`; runtime state lives in `docs/orchestrator/IMPLEMENTATION_STATE.md`, `docs/orchestrator/STATE.json`, and root `STATE.json`.

## Active Task

- Goal 5.5: verify runtime private access, playback/download, merge, delete, and failure modes for migrated lesson recordings.

Current gate:

- Lesson-record schema migration and write-gated metadata apply completed on `alfares` after owner approval.
- Applied counts: `education_lessonrecord=101184`, `education_lessonrecordpart=52453`, missing target lessons `0`.
- Goal 5.5 runtime verification found no target private playback/download, presign/commit, scoped media token, merge worker, stuck-record worker, or delete implementation; frontend/gateway cutover remains blocked.
- Fresh no-write report `/tmp/speakasap-lesson-records-g5-5-target-verification.json` recorded `writes=false`, `target_lesson_records_existing=101184`, `missing_target_lesson=0`, and unchanged media/key reconciliation inventory.
- Runtime scaffold now exists in `education-service/src/lesson-records`; build and `npm run test:lesson-records` passed. Student playback, upload presign/commit, merge worker, and delete remain gated as recorded in `STATUS.md`.
- Do not run future lesson-record reruns, rollback execution, object-storage mutation, or access behavior changes without fresh evidence and explicit approval where applicable.
- Preserve dry-run reports, apply commands, approval notes, rollback evidence, and post-apply verification in `docs/orchestrator/STATUS.md`.

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

1. Finish Goal 4 data migration and reconciliation gates.
2. Start Goal 5 lesson recording and private media migration.
3. Verify Goal 6 gateway, auth, and frontend parity.
4. Prepare Goal 7 operational cutover readiness.
5. Execute Goal 8 controlled cutover and legacy decommission only after owner approval.

## Task Rules

- The master orchestrator chooses the next task from state and goals; worker agents do not choose roadmap order.
- Every task must preserve SpeakASAP intent, service ownership, private data boundaries, and legacy behavior parity.
- Coding tasks require a scoped execution plan, verification evidence, and a status entry before completion.
- Migration commits require the `Intent`, `Scope`, `Evidence`, `Verification`, `Approval`, and `Rollback` commit-message block defined in `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md`.
- Owner questions are reserved for approval gates, destructive operations, unclear scope, or true blockers.
