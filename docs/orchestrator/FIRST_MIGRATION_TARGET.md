# First Migration Target

Date: 2026-06-12

## Selected Target

Lesson workflow recordings: teacher upload, upload commit, merge, private playback, student/teacher access checks, and record-unavailable state.

## Why This Target First

Lesson recordings are explicitly called out in the legacy portal business/system docs and are privacy-sensitive. They cross the most important migration boundaries at once: education data, teacher/student authorization, private MinIO storage, background merging, notifications, and playback. Preserving this workflow first reduces the risk of moving the portal as a shallow UI rewrite while losing protected learning evidence.

## Owner And Repository Boundaries

| Boundary | Decision |
|---|---|
| Legacy behavior reference | `/home/ssf/Documents/Github/speakasap-portal` |
| New implementation repo | `/home/ssf/Documents/Github/speakasap` |
| Target domain service | `education-service` owns lesson record metadata and lesson state. |
| Gateway boundary | `api-gateway` must expose role-protected upload/commit/playback contracts. |
| Frontend boundary | `frontend` must call gateway contracts, not legacy portal URLs directly. |
| Auth boundary | `auth-microservice` remains identity/JWT authority; new service must enforce teacher/student access. |
| Storage boundary | `minio-microservice` remains object storage; recordings stay private and are accessed only through scoped presigned or streamed paths. |
| Notification boundary | Notification delivery remains with `notifications-microservice`; SpeakASAP records only domain-specific event intent. |

## Data Boundary

New-platform state must represent:

- One lesson record per lesson.
- Merged record object key.
- Parts list or part metadata for multi-part upload.
- `processed` state.
- `record_unavailable` reason.
- Created/updated timestamps.
- Link to `education-service` `Lesson.uuid`.

The current `education-service` Prisma schema has `Lesson` and `Homework`, but no `LessonRecord` or `LessonRecordPart` model yet.

## Auth Boundary

Minimum parity:

- Teacher can presign/commit recordings only for assigned lessons and students.
- Student can play only paid, available, processed lesson recordings that belong to the student.
- Tokenized playback must remain scoped and time-limited if used to support media requests without session cookies.
- Manager/admin playback must not become an unaudited public path.

## Storage Boundary

Minimum parity:

- Upload uses scoped, expiring presigned PUT or equivalent controlled upload.
- Playback never exposes a permanent public URL.
- MinIO/S3 path-style SigV4 behavior must be preserved.
- Existing old/new object-key fallback must be handled intentionally during migration.

## Rollback Boundary

Until cutover:

- Legacy portal remains the source of truth for recording playback behavior.
- New code must be deployable behind gateway routes without disabling legacy routes.
- Data migration must support dry-run and reconciliation before writing.
- No legacy object deletion runs until merged-object existence and playback are verified.

## First Acceptance Criteria

- Legacy workflow inventory exists and names files, routes, models, tasks, storage, tests, and known issues.
- New-platform gap is documented.
- Target service and gateway/auth/storage boundaries are explicit.
- No production behavior is changed during inventory.

## Verification Commands For This Target

Use repository/static verification first:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap-portal && rg -n "LessonRecord|lesson_record_presign|lesson_record_commit|RecordMaterial|merge_records|RecordsS3Storage" education cabinet portal -g "*.py"'
ssh alfares 'cd /home/ssf/Documents/Github/speakasap && rg -n "LessonRecord|lesson record|recording|presign|MinIO|S3" education-service api-gateway frontend -g "*.ts" -g "*.tsx" -g "*.prisma"'
```

Build/runtime verification comes after a code-bearing goal is selected.
