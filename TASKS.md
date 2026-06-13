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
- Paid eligibility mapping is implemented and applied via target `StudentAccess` / `education_studentaccess`; source and target now both have `184464` rows, including `184214` paid rows, with no duplicate groups or missing lesson references.
- Owner approved and the `education_studentaccess` schema/import was applied: target/source rows `184464`, paid rows `184214`, duplicate groups `0`, missing lesson refs `0`; rollback SQL is `/tmp/speakasap-education-studentaccess-rollback-g5-5.sql`.
- Private upload presign/commit is implemented and deployed in `speakasap-education` with teacher/staff authorization, 900-second SigV4 PUT presign, audio/60MB validation, deterministic keys, and S3 HEAD ETag/size verification.
- Scoped `speakasap-education` deploy completed after owner approval: image digest `sha256:aac37a909b47872e368a733f973d287e00be35136ff10f423c54bd84c3e5350e`, deployment `1/1` ready, restart count `0`, health `ok`.
- Runtime smoke report `/tmp/speakasap-education-runtime-smoke-g5-5.json` verifies unauthenticated rejection, invalid/mismatched media-token rejection, unrelated-student rejection, and no permanent URL exposure.
- Service-level deployed-image mock report `/tmp/speakasap-education-service-level-smoke-g5-5.json` verifies presign invalid content type/oversize, 900-second signed PUT shape, commit key/ETag/size mismatch, merge disabled, and delete disabled without DB writes or object mutation.
- Goal 5.5 deployed smoke `/tmp/speakasap-goal55-runtime-smoke-20260613-v5.json` verifies paid student state/playback, tokenized 206 audio/mpeg range download, unpaid playback denial, unassigned teacher denial, teacher/staff private SigV4 presign, commit mismatch rejection, merge disabled, delete disabled, and no permanent URL exposure.

- Owner approved Goal 5 follow-up merge/delete and frontend/gateway integration; Active Agents marker was checked first and reports None.
- Confirmation-gated education-service and streaming api-gateway revisions were deployed: education sha256:776f5086ccf2d578f4de84ac34b7bde7a051890ac0c26287471e78842d6371f1, api-gateway sha256:d5568fd64226473d7474089030104bb3161b8d2803993ded799e530db3ac9763.
- Gateway smoke /tmp/speakasap-goal55-gateway-smoke-20260613-v5.json confirms gateway auth/access controls, paid tokenized 206 audio/mpeg range download, already-ready merge noop 201, and delete without confirmDelete blocked with 400.
- Owner approved replacement of the missing paid fixture object with legacy portal education/lesson_records/tests/example.mp3; gateway smoke /tmp/speakasap-goal55-gateway-smoke-20260613-v5.json now returns 206 audio/mpeg for tokenized range download and 400 for delete without confirmDelete.
- Do not run future lesson-record reruns, rollback execution, object-storage mutation, merge execution, frontend/gateway cutover, legacy retirement, or access behavior changes without fresh evidence and explicit approval where applicable.
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
