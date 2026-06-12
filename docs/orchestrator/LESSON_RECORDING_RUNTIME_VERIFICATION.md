# Lesson Recording Runtime Verification

Date: 2026-06-12

Goal: 5.5 - verify private playback/download access, merge/delete behavior, and failure modes before frontend or gateway cutover.

## Verdict

Cutover is blocked.

The target `education-service` currently contains migrated lesson-record metadata and private object-key references, but no runtime lesson-recording access implementation was found. Because no target playback/download, presign/commit, merge worker, delete endpoint, scoped media token, or storage adapter route is registered, runtime private access and failure modes cannot be accepted for frontend or gateway cutover.

## Preserved Intent

Lesson recordings are private learning artifacts. Students, teachers, and staff must retain legacy-equivalent access without exposing public permanent object URLs, deleting source parts prematurely, or changing paid/student lesson access semantics.

## Ownership Boundary

| Area | Owner / boundary |
| --- | --- |
| Runtime lesson-record contract | `education-service` behind `api-gateway` |
| Bearer validation | `api-gateway` plus `auth-microservice` |
| Domain access checks | `education-service` teacher/student/staff lesson ownership |
| Object storage | `minio-microservice`; SpeakASAP stores private keys and requests scoped access only |
| Frontend cutover | Not allowed until backend runtime checks pass |
| Rollback | Keep legacy portal playback active; do not expose target runtime routes yet |

## Legacy Behavior To Preserve

Evidence reviewed on `alfares:/home/ssf/Documents/Github/speakasap-portal`:

- `cabinet/record_playback.py`
  - student playback requires processed record, paid `StudentAccess`, and lesson availability;
  - teacher playback requires assigned lesson teacher or part ownership;
  - token playback is signed, scoped, and expires after one hour;
  - empty record fields can fall back to canonical dated keys.
- `cabinet/views.py`
  - media download streams through the records helper when configured;
  - old/new key fallback is attempted with and without `courses/records/`;
  - helper failure does not silently fall back to direct S3 when helper use is configured.
- `cabinet/teacher/views/lessons.py`
  - presigned PUT expiry is 900 seconds;
  - upload content type must start with `audio/`;
  - upload size limit is 60 MB;
  - commit verifies object metadata and key/ETag/size before DB state changes.
- `education/tasks.py`
  - merge is idempotent when the record is missing or already processed;
  - merged output is verified before original parts are deleted;
  - S3 part delete failures are logged and do not hide merge validation failures.
- `education/lesson_records/tests/test_lesson_records.py`
  - legacy tests cover merge, deleted/already-processed idempotence, and student-facing record state/url.

## Target Runtime Findings

Evidence reviewed on `alfares:/home/ssf/Documents/Github/speakasap`:

- `education-service/src/app.module.ts` imports only `GroupsModule`, `StudentCoursesModule`, `LessonsModule`, and `HomeworksModule`.
- `education-service/src/lessons/lessons.controller.ts` exposes only staff-only `GET /api/v1/lessons` and `GET /api/v1/lessons/:uuid`.
- Repository search found no target implementation for:
  - `GET /api/v1/lessons/:lessonUuid/record`;
  - `GET /api/v1/lessons/:lessonUuid/record/playback`;
  - recording download/streaming;
  - teacher presign/commit;
  - scoped one-hour media token verification;
  - MinIO/S3 private playback adapter;
  - merge worker/stuck-record worker;
  - delete behavior for target lesson records or parts.
- `api-gateway` route ownership docs map `/api/v1/lessons/:lessonUuid/record*` to `education-service`, but the target routes are not implemented.
- `frontend` has no lesson-recording playback/download cutover path.

## Metadata Verification

Fresh no-write report:

```text
/tmp/speakasap-lesson-records-g5-5-target-verification.json
```

Command class:

```text
education-service/scripts/migrate-lesson-records-from-legacy.py --dry-run --check-target --json-report ...
```

Runtime setup:

- RAG lookup failed with curl exit code 6; repository and remote evidence were used.
- Target DB required a temporary local-only Kubernetes port-forward on `alfares`; the port-forward was closed after the report.
- No target writes, object-storage reads/writes/deletes, deployment, frontend change, or gateway cutover ran.

Report summary:

| Check | Result |
| --- | ---: |
| writes | `false` |
| source lesson records | `101184` |
| target lesson records existing | `101184` |
| source lesson record parts | `58234` |
| target/importable referenced parts | `52453` |
| missing target lessons | `0` |
| duplicate lesson records | `0` |
| part referenced by multiple records | `0` |
| bad parts JSON | `0` |
| records ready | `96729` |
| records processing | `1414` |
| records unavailable | `2332` |
| records none | `2` |
| records inconsistent | `4787` |
| canonical keys | `71919` |
| old-prefix legacy keys | `25934` |
| empty keys | `3042` |
| other keys | `289` |

Remaining media/key reconciliation inventory:

- `parts_missing_rows=4080`
- `orphan_parts=5781`
- `legacy_prefix_keys_without_date=25934`
- `record_key_date_mismatch=39477`

These issues were already non-blocking for metadata import, but they remain relevant for playback, merge, and delete behavior because runtime storage access must preserve old/new key fallback and must not delete parts before merged-output validation.

## Failure Modes Still Required

Before frontend or gateway cutover, target runtime checks must cover:

- unauthenticated playback/download rejected;
- authenticated but unrelated student rejected;
- unpaid student or unavailable lesson rejected;
- eligible paid student can access only a scoped, expiring stream or presigned URL;
- assigned teacher can access their lesson/part recording;
- unrelated teacher rejected;
- staff/admin access allowed only through explicit role policy;
- token scope mismatch rejected;
- expired token rejected;
- missing metadata returns `none` or 404 as appropriate;
- empty record with legacy canonical fallback works where object exists;
- old `courses/records/` and modern key fallback behavior is preserved;
- helper/storage failure returns a controlled 404/5xx without public URL leakage;
- merge missing/deleted/already-processed record is idempotent;
- merge validates merged object before part deletion;
- merge failure does not delete source parts;
- delete behavior is either deliberately unsupported before cutover or implemented with explicit owner approval and rollback evidence.

## Next Runtime Implementation Boundary

The next implementation chunk should add target-only runtime support in `education-service` without changing frontend or gateway cutover:

1. Add a lesson-recording module with state and playback/download endpoints.
2. Add teacher/student/staff domain access helpers using migrated education/user data.
3. Add a private storage adapter that streams or returns scoped short-lived presigned GET URLs; no permanent public URLs.
4. Add unit/integration tests for the failure modes above.
5. Defer merge/delete object mutation until explicit implementation and owner approval are recorded.

