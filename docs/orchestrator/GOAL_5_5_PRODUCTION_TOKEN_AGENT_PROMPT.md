# SpeakASAP Goal 5.5 Production Token And Storage Smoke Prompt

You are continuing SpeakASAP Goal 5.5 on the production server.

Authoritative repository: `/home/ssf/Documents/Github/speakasap` on `alfares`.
Legacy reference repository: `/home/ssf/Documents/Github/speakasap-portal` on `alfares`.
Namespace: `statex-apps`.
Target service only: `speakasap-education`.

## Required Reading

Before making changes or running smoke checks, read the SpeakASAP orchestrator pack from the remote repo in the order required by `AGENTS.md`:

1. `BUSINESS.md`
2. `SYSTEM.md`
3. `docs/orchestrator/MASTER_PROMPT.md`
4. `docs/orchestrator/IMPLEMENTATION_ORCHESTRATOR.md` if present
5. `docs/orchestrator/INTENT.md`
6. `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md` if present
7. `docs/orchestrator/GOALS.md`
8. `docs/orchestrator/PLAN.md`
9. `docs/orchestrator/IMPLEMENTATION_STATE.md`
10. `docs/orchestrator/STATE.json`
11. `docs/orchestrator/STATUS.md`
12. `TASKS.md`
13. root `STATE.json`

Attempt RAG lookup first if reachable. If RAG is unreachable, continue from repo/runtime evidence and record the fallback in `docs/orchestrator/STATUS.md`.

## Current State

Goal 5.5 is active: runtime private access, playback/download, merge, and delete verification for lesson recordings.

Already completed:

- `speakasap-education` was deployed after owner approval.
- Only `speakasap-education` was deployed; no gateway/frontend cutover happened.
- Image digest deployed: `sha256:aac37a909b47872e368a733f973d287e00be35136ff10f423c54bd84c3e5350e`.
- Deployment state was `1/1` ready, updated replicas `1`, restart count `0`, and `/health` returned `{"status":"ok"}`.
- Runtime smoke report exists at `/tmp/speakasap-education-runtime-smoke-g5-5.json`.
- Service-level deployed-image smoke report exists at `/tmp/speakasap-education-service-level-smoke-g5-5.json`.
- `education_studentaccess` has been imported: target/source rows `184464`, paid rows `184214`, duplicate groups `0`, missing lesson refs `0`.
- Rollback SQL for student access import: `/tmp/speakasap-education-studentaccess-rollback-g5-5.sql`.

Known blockers from the last session:

- No safe real runtime tokens were available for:
  - paid recorded-lesson student;
  - unpaid recorded-lesson student;
  - unrelated student beyond the normal test student;
  - assigned teacher;
  - unassigned teacher;
  - staff/admin.
- The running `speakasap-education` pod did not have `RECORDS_S3_*` configuration, so valid presign and object download success paths could not be smoked.

## Your Mission

Use your production-server/token access to resolve the token and storage-config blockers, then run deployed HTTP smoke checks against `speakasap-education`.

Do not run frontend/gateway cutover. Do not execute merge workers. Do not delete or mutate existing recording objects. Do not retire legacy routes. Do not execute rollback SQL.

## Storage Configuration To Verify

Check whether these are configured for the running `speakasap-education` pod through Vault/ESO/Kubernetes secrets/config:

- `RECORDS_S3_HELPER_URL`
- `RECORDS_S3_BUCKET`
- `RECORDS_S3_ENDPOINT_URL`
- `RECORDS_S3_ACCESS_KEY`
- `RECORDS_S3_SECRET_KEY`
- `RECORDS_S3_REGION_NAME`
- `RECORDS_S3_VERIFY_SSL` if used by the environment

If they are missing, configure them using the approved production secret path. Do not paste secret values into logs, docs, or chat. Record only key presence, source path, and rollout evidence.

After changing runtime env, restart only `deployment/speakasap-education -n statex-apps`, then verify:

- rollout succeeds;
- pod ready `1/1`;
- restart count is acceptable and not looping;
- `/health` returns ok;
- image remains the intended `speakasap-education` image or a newly built approved image if code changed.

## Token Requirements

Use real, safe production tokens or approved test/fixture tokens for these roles/users:

1. Paid student with `education_studentaccess.is_paid = true` for a recorded lesson.
2. Unpaid student with `education_studentaccess.is_paid = false` for a recorded lesson.
3. Student unrelated to the lesson.
4. Assigned teacher for a recorded lesson.
5. Unassigned teacher for another recorded lesson.
6. Staff/admin token.

Do not disclose token values. Record only anonymized auth role/profile evidence such as `studentId`, `teacherId`, `userType`, role class, and lesson UUIDs used.

## Required Deployed HTTP Smoke Checks

Run these against the deployed `speakasap-education` service, preferably from inside the cluster or pod network.

### Auth And Student Access

- `GET /api/v1/lessons/:lessonUuid/record` without bearer token returns `401`.
- `GET /api/v1/lessons/:lessonUuid/record/playback` without bearer token returns `401`.
- Invalid bearer token returns `401`.
- Paid student can access state for their lesson.
- Paid student can request playback token for a ready recording.
- Unpaid student is denied playback for the same or equivalent recorded lesson.
- Unrelated student is denied state/playback.
- Playback response must not expose a permanent public object URL.

### Teacher And Staff Access

- Assigned teacher can access state/playback for their lesson.
- Unassigned teacher is denied for another teacher's lesson.
- Staff/admin can access state/playback according to the current staff policy.

### Download Token Behavior

- `GET /api/v1/lessons/:lessonUuid/record/download` without token is rejected.
- Invalid token is rejected.
- Token scoped to a different lesson is rejected.
- Valid playback token downloads or streams through the private helper path.
- Response must not contain permanent public URLs or raw credentials.
- Range request behavior should be checked if safe and supported.

### Presign And Commit

- Presign rejects invalid content type.
- Presign rejects oversize payload over `62914560` bytes.
- Valid teacher/staff presign returns:
  - method `PUT`;
  - deterministic private key under the expected date prefix;
  - `expiresIn = 900`;
  - SigV4-style signed private PUT URL;
  - no permanent public URL.
- Do not upload a real object unless the owner explicitly approved object mutation for this check.
- Commit rejects key mismatch without changing DB/object storage.
- Commit rejects ETag mismatch without changing DB/object storage.
- Commit rejects size mismatch without changing DB/object storage.

### Merge And Delete Guardrails

- Merge remains disabled or service-unavailable unless a separate owner approval explicitly authorizes merge-worker implementation/execution.
- Delete remains disabled with conflict unless a separate owner approval explicitly authorizes object deletion semantics and rollback evidence.
- Confirm no object deletion occurred.

## Existing Service-Level Evidence

The previous session used deployed-image mocks to verify these code paths without object storage or DB writes:

- presign invalid content type -> `400`;
- presign oversize -> `400`;
- valid staff presign shape -> `PUT`, `expiresIn=900`, deterministic key, signature present;
- commit key mismatch -> `400`;
- commit ETag mismatch -> `400`;
- commit size mismatch -> `400`;
- merge disabled -> `503`;
- delete disabled -> `409`;
- mock counters: `transactions=0`, `partDeletes=0`.

Use deployed HTTP checks to replace or complement this evidence once real tokens/storage config are available.

## Documentation Updates Required

Append evidence to:

- `docs/orchestrator/STATUS.md`

Update:

- `docs/orchestrator/IMPLEMENTATION_STATE.md`
- `docs/orchestrator/STATE.json`
- root `STATE.json`
- `TASKS.md`

Keep Goal 5.5 active until all required runtime success and failure paths are verified or explicitly deferred by the owner.

## Guardrails

Do not do any of the following without fresh explicit owner approval:

- frontend/gateway cutover;
- object deletion;
- object mutation/upload for smoke checks;
- merge-worker execution;
- rollback SQL execution;
- legacy route retirement;
- user/profile/auth data mutation;
- broad `scripts/deploy.sh` all-service deployment.

If runtime env changes are required, apply only the minimal approved secret/config changes and restart only `speakasap-education`.

## Final Report Format

End with:

- Goal
- Chunk
- Changed files
- Intent compliance
- Validation
- Blockers
- Next action

Final line must begin exactly with:

`Next step:`
