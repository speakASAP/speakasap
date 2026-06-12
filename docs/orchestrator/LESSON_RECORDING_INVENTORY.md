# Lesson Recording Workflow Inventory

Date: 2026-06-12

Status: Goal 2 partial inventory complete for selected first target.

## Preserved Intent

Lesson recordings preserve teacher/student learning evidence. The migration must keep recordings private, keep student access paid and lesson-scoped, keep teacher access assignment-scoped, and preserve the ability to upload, merge, mark unavailable, notify students, and play recordings without exposing permanent public media URLs.

## Legacy Data Model

Source: `speakasap-portal/education/lesson_records/models.py`

| Model | Key fields | Behavior |
|---|---|---|
| `LessonRecord` | `lesson` one-to-one, `record`, `created`, `processed`, `record_unavailable`, `parts` JSON | Sends `lesson_record_updated`, triggers `education.merge_records` on save unless `prevent_merge=True`, exposes `student_url`, derives state as `processing`, `ready`, or `unavailable`. |
| `LessonRecordPart` | `part_file` | Stores uploaded part files for later merge. |

Key naming:

- Full recording key: `YYYY/MM/DD/lesson_<lesson_uuid>.<ext>`.
- Part key: `YYYY/MM/DD/parts_<part_uuid>.<ext>`.
- Date comes from lesson start when possible; otherwise current date.

## Legacy Upload And Commit Routes

Source: `speakasap-portal/cabinet/teacher/urls.py`

| Route | View | Access |
|---|---|---|
| `/students/<student_pk>/lessons/<lesson_uuid>/record/presign/` | `lesson_record_presign` | `teacher_required()` |
| `/students/<student_pk>/lessons/<lesson_uuid>/record/commit/` | `lesson_record_commit` | `teacher_required()` |
| `/materials/records/<uuid>.mp3` and `/materials/records/<uuid>.(mp3|ogg)` | `RecordMaterial` | `teacher_required()` |

Source: `speakasap-portal/cabinet/teacher/views/lessons.py`

Presign behavior:

- Validates JSON payload, filename, `kind` (`lesson` or `part`), `audio/*` content type, and size.
- Enforces `RecordForm.MAX_RECORD_SIZE` of 60MB.
- Requires the lesson to belong to the teacher and student via `_teacher_lesson_or_404`.
- Generates a SigV4 path-style MinIO presigned PUT URL with 900 second expiry.
- Returns method, URL, object key, content-type header, and optional part UUID.

Commit behavior:

- Validates uploaded item list, kind, key, ETag, size, filename, and part UUID.
- Confirms object existence via S3 `head_object`.
- Verifies remote ETag and content length.
- Creates or updates `LessonRecord`.
- For single full recording: calls `update_record(key)`, clears parts, sets processed.
- For parts: creates `LessonRecordPart` rows, clears full record, stores part UUID list, marks unprocessed, and triggers merge through save.
- For unavailable recording: stores `record_unavailable`, clears files/parts, marks processed.
- Saves `recommendation` and `to_manager` through `FinishLessonForm`.
- Returns `{"status": "ok", "lesson_record_uuid": ...}`.

## Legacy Playback Routes

Sources:

- `speakasap-portal/cabinet/student/urls.py`
- `speakasap-portal/cabinet/teacher/urls.py`
- `speakasap-portal/cabinet/record_playback.py`
- `speakasap-portal/cabinet/views.py`

Student routes:

- `/materials/records/<lesson_uuid>.(mp3|ogg)`
- `/materials/records/<lesson_uuid>.mp3`
- Wrapped by `student_or_record_token_required`.

Playback rules:

- Teacher playback checks lesson ownership or part ownership.
- Student playback requires `lessonrecord__processed=True`, `studentaccess__student=student`, `studentaccess__is_paid=True`, and `lesson.is_available_for_student(student)`.
- Token playback uses signed timestamp payload with `pk`, `scope`, and `user_pk`; max age is one hour.
- Manager-style lookup can resolve by lesson UUID and fallback to `LessonRecord.pk`.
- If `LessonRecord.record` is empty, code checks canonical key fallback `YYYY/MM/DD/lesson_<lesson_uuid>.mp3`.

Streaming behavior:

- `MediaDownload` streams through the portal when storage has no local path.
- It prefers `RECORDS_S3_HELPER_URL` download helper.
- It supports range requests and `Accept-Ranges`.
- It tries old/new key fallback: with and without `courses/records/` prefix.
- If helper is configured and fails, it does not fall back to direct S3.
- Direct S3 fallback avoids unsafe `HeadObject` assumptions and can use `get_object`.

## Legacy Background Work

Source: `speakasap-portal/education/tasks.py`

| Task | Queue | Behavior |
|---|---|---|
| `education.merge_records` | `high_priority` | Merges part uploads into one MP3, uploads to S3 when configured, verifies merged output, updates `LessonRecord`, then deletes original parts only after validation. |
| `merge_stuck_records_task` | not fully inventoried yet | Finds unprocessed records with parts and requeues merge jobs. |

Important parity behaviors:

- `merge_records` is idempotent when record is missing or already processed.
- It logs detailed step evidence.
- It avoids deleting parts if merged file validation fails.
- It uses helper download checks for S3 existence.
- It handles old/new object key formats during playback and merge checks.

## Legacy Notification Behavior

Source: `speakasap-portal/education/signals/handlers.py`

When a lesson is finished, `send_notification_on_record_upload` sends notification template `student/record_uploaded` to each lesson student with lesson ID, teacher ID, and lesson date.

## Legacy API Surface

Sources:

- `speakasap-portal/education/api/teacher/urls.py`
- `speakasap-portal/education/api/teacher/serializers/records.py`
- `speakasap-portal/education/api/teacher/views/records.py`

DRF routes:

- `records` -> `LessonRecordViewSet`
- `record_parts` -> `LessonRecordPartViewSet`

Rules:

- `LessonRecordViewSet` allows `post`, `get`, and `delete`.
- `LessonRecordPartViewSet` allows `post` with multipart parser.
- `TeacherRequired` permission is required.
- Serializer enforces teacher assignment and requires either uploaded parts or `record_unavailable`.

## Legacy Tests

Source: `speakasap-portal/education/lesson_records/tests/test_lesson_records.py`

Covered behaviors:

- Merge two part files into a processed lesson record.
- Treat deleted/already-processed records as terminal/idempotent.
- Student lesson API exposes record state `none`, `processing`, and `ready`.
- Ready record URL ends with `/materials/records/<lesson_uuid>.mp3`.

## Storage Configuration

Sources:

- `speakasap-portal/portal/utils/common.py`
- `speakasap-portal/portal/utils/records_storage.py`

Rules:

- `records_fs` uses local `materials_fs` unless records S3 endpoint is configured and `RECORDS_USE_NFS` is false.
- `RecordsS3Storage` requires `RECORDS_S3_ENDPOINT_URL`, `RECORDS_S3_ACCESS_KEY`, and `RECORDS_S3_SECRET_KEY`.
- MinIO requests use SigV4 and path-style addressing.
- Presigned expiry defaults to `RECORDS_PRESIGNED_EXPIRY_SECONDS` or 900 seconds.
- Uploads can go through `RECORDS_S3_HELPER_URL`.
- Secrets are masked in logs.

## New Platform Current State

Sources:

- `speakasap/education-service/prisma/schema.prisma`
- `speakasap/education-service/scripts/migrate-education-from-legacy.py`
- `speakasap/education-service/src/app.module.ts`
- `speakasap/api-gateway/src/proxy/gateway-proxy.controller.ts`
- `speakasap/frontend/lib/gateway.ts`

Observed:

- `education-service` has `Group`, `GroupStudent`, `StudentCourse`, `Lesson`, and `Homework`.
- The education migration script copies `education_group`, `education_group_students`, `education_studentcourse`, `education_lesson`, and `education_homework`.
- There is no `LessonRecord` or `LessonRecordPart` Prisma model in the current education schema.
- `education-service` imports `LessonsModule` and `HomeworksModule`, but no recording module was found.
- Repository search did not find an existing recording/presign/MinIO implementation under `education-service`, `api-gateway`, or `frontend`.
- `api-gateway` has a generic authenticated `/api/v1/*` proxy.
- `frontend/lib/gateway.ts` only exposes the configured gateway base URL.

## Initial Parity Decision

Decision: `migrate`.

Target placement:

- Metadata and state: `education-service`.
- Upload/presign/commit API: `education-service` behind `api-gateway`.
- Playback: gateway route backed by `education-service` or storage adapter that streams/private-presigns without public permanent URLs.
- Object storage: `minio-microservice`.
- Notifications: event/intent emitted to notification boundary after lesson record is ready or lesson is finished, preserving current notification semantics.

## Required New-Platform Capabilities

1. Add lesson-record and lesson-record-part persistence in `education-service`.
2. Add teacher-scoped presign endpoint with 60MB limit, audio content-type validation, 900 second expiry, and deterministic object keys.
3. Add commit endpoint that verifies object key, ETag/size or equivalent object metadata, and updates lesson record state.
4. Add merge worker or job integration for multi-part recordings, with idempotent terminal behavior and no part deletion before merged output validation.
5. Add student playback endpoint that enforces paid lesson access and lesson availability.
6. Add teacher playback endpoint that enforces teacher assignment.
7. Preserve tokenized playback or provide an equivalent scoped one-hour media access mechanism.
8. Preserve old/new object-key fallback during transition.
9. Add migration dry-run/reconciliation for existing `education_lessonrecord` and `education_lessonrecordpart` rows and object keys.
10. Add tests or smoke checks for unauthorized playback, authorized teacher upload/commit, student states, and private media access.

## Open Questions For Goal 2.2 / Goal 3

- Should new playback stream through `education-service` or return short-lived presigned GET URLs through gateway?
- Is the existing records S3 helper still required in the new platform, or can the new Node service talk directly to MinIO with SigV4 path-style requests?
- Which notification event should replace `student/record_uploaded`: direct notification template call, domain event, or notification-service API contract?
- Should `record_unavailable` be modeled as a terminal processed state or a separate enum in the new schema?
- How long must old `courses/records/` object-key fallback remain after cutover?

## Verification Evidence

Commands used:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap-portal && rg -n "lesson_record|LessonRecord|recording|record|mp3|presign|presigned|s3|S3|minio|Minio" education courses cabinet students notifications orders portal -g "*.py" | head -n 260'
ssh alfares 'cd /home/ssf/Documents/Github/speakasap && rg -n "LessonRecord|lesson record|recording|record_|MinIO|minio|presign|presigned|S3|mp3" education-service course-service content-service api-gateway frontend -g "*.ts" -g "*.tsx" -g "*.prisma" -g "*.js" | head -n 220'
```

Result:

- Legacy workflow surface found across `education`, `cabinet`, and `portal/utils`.
- No corresponding new-platform lesson recording implementation found in the searched services.
