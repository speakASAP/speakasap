# Lesson Recording Service Contract

Date: 2026-06-12

Status: Goal 3.1 complete. This is a contract document only; no application code has been changed.

## Inputs

This contract is derived from:

- `docs/orchestrator/FIRST_MIGRATION_TARGET.md`
- `docs/orchestrator/LESSON_RECORDING_INVENTORY.md`
- `docs/orchestrator/PORTAL_SURFACE_INVENTORY.md`
- `speakasap/education-service/prisma/schema.prisma`
- `speakasap/education-service/src/lessons/*`
- `speakasap/api-gateway/src/proxy/upstream-resolve.ts`
- `speakasap/api-gateway/src/proxy/gateway-auth.guard.ts`

## Preserved Intent

Teacher-uploaded lesson recordings must remain private learning artifacts. The new platform must preserve upload, commit, merge, unavailable-state, playback, and notification semantics without public object exposure or ownership drift.

## Ownership

| Concern | Owner | Rule |
|---|---|---|
| Lesson record metadata | `education-service` | Owns `LessonRecord` and `LessonRecordPart` state tied to `Lesson.uuid`. |
| Gateway exposure | `api-gateway` | All frontend/browser calls use `/api/v1/...` gateway routes. |
| Identity and role validation | `auth-microservice` | Gateway/service validate bearer token; service enforces domain access. |
| Object storage | `minio-microservice` | Stores private audio objects; no permanent public URLs. |
| Notification delivery | `notifications-microservice` | SpeakASAP emits notification intent; shared service delivers. |
| Frontend UX | `frontend` | Calls gateway contracts and presents states/errors. |

## Data Model Contract

Add to `education-service/prisma/schema.prisma`.

### `LessonRecord`

Target table: preserve legacy-compatible name unless a migration plan explicitly renames it.

Recommended Prisma fields:

- `uuid String @id @default(uuid()) @db.Uuid`
- `lessonUuid String @unique @map("lesson_id") @db.Uuid`
- `recordKey String? @map("record") @db.Text`
- `processed Boolean @default(false)`
- `recordUnavailable String @default("") @map("record_unavailable") @db.Text`
- `parts Json @default("[]")`
- `createdAt DateTime @default(now()) @map("created")`
- `updatedAt DateTime @updatedAt @map("updated")`
- relation to `Lesson`

State rules:

- `unavailable`: no `recordKey`, no parts, `processed=true`, non-empty `recordUnavailable`.
- `processing`: parts exist or record key exists and `processed=false`.
- `ready`: `recordKey` exists and `processed=true`.
- `none`: no record row, or empty row without unavailable reason.

### `LessonRecordPart`

Recommended fields:

- `uuid String @id @default(uuid()) @db.Uuid`
- `lessonRecordUuid String @map("lesson_record_id") @db.Uuid`
- `partKey String @map("part_file") @db.Text`
- `createdAt DateTime @default(now()) @map("created")`
- relation to `LessonRecord`

Transition note:

- Legacy stores part UUIDs in a JSON `parts` field and part file paths in `LessonRecordPart.part_file`. Migration can preserve `parts` JSON first, then normalize if needed after reconciliation.

## Object Key Contract

Preserve deterministic keys:

- Full recording: `YYYY/MM/DD/lesson_<lesson_uuid>.mp3`
- Part: `YYYY/MM/DD/parts_<part_uuid>.<ext>`

Rules:

- Use lesson start date when available.
- Fall back to current date only for new uploads when lesson start is absent.
- During migration/playback, support old/new key fallback with and without `courses/records/` prefix until cutover evidence proves it is no longer needed.
- Strip trailing slashes from stored keys.

## API Contract

Routes are external/gateway routes. Because `education-service` has global prefix `api/v1` and gateway upstream already maps `/api/v1/lessons` to `EDUCATION_SERVICE_URL`, no new gateway prefix is required for these routes unless a separate `/lesson-records` route is later chosen.

### Get Record State

`GET /api/v1/lessons/:lessonUuid/record`

Allowed:

- assigned teacher
- paid/eligible student for their own lesson
- staff/manager/admin

Response:

```json
{
  "lessonUuid": "uuid",
  "lessonRecordUuid": "uuid-or-null",
  "state": "none|processing|ready|unavailable",
  "recordUnavailable": "",
  "recordKey": "redacted-or-null",
  "playbackUrl": "optional gateway URL when ready",
  "durationSeconds": null,
  "updatedAt": "iso-or-null"
}
```

Do not expose raw MinIO URLs or credentials.

### Presign Teacher Upload

`POST /api/v1/lessons/:lessonUuid/record/presign`

Allowed:

- assigned teacher
- staff/admin only if explicitly acting with staff role

Request:

```json
{
  "studentId": 123,
  "filename": "record.mp3",
  "contentType": "audio/mpeg",
  "kind": "lesson|part",
  "size": 123456
}
```

Rules:

- `filename` required.
- `kind` must be `lesson` or `part`.
- `contentType` must start with `audio/`.
- `size` must be integer bytes, `0 <= size <= 62914560`.
- Teacher must be assigned to lesson and lesson/student relation must match.
- Return 900-second presigned PUT or a gateway upload session that has equivalent scope and expiry.

Response:

```json
{
  "method": "PUT",
  "url": "short-lived-private-upload-url",
  "key": "YYYY/MM/DD/lesson_<lesson_uuid>.mp3",
  "headers": { "Content-Type": "audio/mpeg" },
  "partUuid": "uuid-or-null",
  "expiresIn": 900
}
```

### Commit Teacher Upload

`POST /api/v1/lessons/:lessonUuid/record/commit`

Allowed:

- assigned teacher
- staff/admin only if explicitly acting with staff role

Request:

```json
{
  "studentId": 123,
  "items": [
    {
      "kind": "lesson|part",
      "key": "YYYY/MM/DD/lesson_<lesson_uuid>.mp3",
      "etag": "optional",
      "filename": "record.mp3",
      "size": 123456,
      "partUuid": "uuid-for-part"
    }
  ],
  "recommendation": "",
  "toManager": "",
  "recordUnavailable": ""
}
```

Rules:

- Empty `items` is valid only when `recordUnavailable` is non-empty.
- Verify object metadata before saving committed state. ETag verification is required when supplied; size verification is required.
- Full lesson item updates `recordKey`, clears parts, sets `processed=true`.
- Part items create/update part records, clear full record, set `processed=false`, and enqueue merge.
- Unavailable state clears file/part references, stores `recordUnavailable`, and sets `processed=true`.
- Recommendation and manager note update `Lesson.recommendation` and `Lesson.toManager`.

Response:

```json
{
  "status": "ok",
  "lessonRecordUuid": "uuid",
  "state": "ready|processing|unavailable"
}
```

### Playback

Preferred external route:

`GET /api/v1/lessons/:lessonUuid/record/playback`

Allowed:

- student with paid access and lesson availability
- assigned teacher
- staff/manager/admin
- optional signed playback token scoped to `lessonUuid`, user, role/scope, and one-hour maximum age

Rules:

- Return a stream through service/gateway or a short-lived presigned GET URL. The implementation choice must still prevent permanent public URLs.
- Support range requests for audio playback if streaming.
- Do not expose raw bucket credentials.
- Preserve fallback key lookup during migration.

## Auth/RBAC Contract

Current `education-service` only has `isStaffUser`. Implementation must add domain guards or service checks:

- `isTeacherAssignedToLesson(user, lessonUuid, studentId?)`
- `isStudentAllowedForLessonRecord(user, lessonUuid)`
- `isManagerOrStaff(user)`
- `verifyPlaybackToken(token, lessonUuid, scope)`

Required denial behavior:

- Missing bearer token: `401`.
- Valid user without lesson access: `403`.
- Unknown lesson/record: `404` without leaking private object details.
- Invalid upload/commit payload: `400`.

## Storage Contract

Required env/config additions for `education-service`:

- `RECORDS_S3_ENDPOINT_URL`
- `RECORDS_S3_BUCKET`
- `RECORDS_S3_REGION_NAME`
- `RECORDS_S3_ACCESS_KEY`
- `RECORDS_S3_SECRET_KEY`
- `RECORDS_S3_VERIFY_SSL`
- `RECORDS_PRESIGNED_EXPIRY_SECONDS`

Rules:

- Use SigV4.
- Use path-style addressing.
- Normalize endpoint by stripping `/minio` suffix if needed.
- Mask secrets in logs.
- Log key, bucket, action, duration, request ID, and actor, but not presigned URLs or secrets.
- Part deletion happens only after merged file validation.

## Merge Contract

Implementation options:

- Node worker inside `education-service`.
- Dedicated job/worker service.
- Transitional call to legacy helper only if explicitly approved and isolated.

Required behavior:

- Idempotent terminal response when record is missing or already processed.
- Sort parts deterministically by captured creation time or commit order if ID3/mtime is unavailable.
- Convert non-MP3 only if current business behavior requires it.
- Merge parts into one MP3.
- Verify merged object exists and size is not below expected minimum before deleting parts.
- Requeue stuck records through an explicit admin/internal endpoint or job command.

## Notification Contract

Legacy behavior sends template `student/record_uploaded` on lesson-finished signal.

New behavior:

- After a record becomes `ready` or lesson finish is committed, emit SpeakASAP notification intent to `notification-service`.
- `notification-service` then calls or delegates to `notifications-microservice` for delivery.
- Payload must include student user ID(s), lesson UUID, teacher ID, lesson date, and template/key.
- Notification failures must not roll back record commit, but must be logged and retryable.

## Gateway Contract

Existing gateway resolver already maps `/api/v1/lessons` to `EDUCATION_SERVICE_URL`.

Required gateway checks:

- Keep bearer validation in `GatewayAuthGuard`.
- Forward `Authorization`, `x-request-id`, and actor context headers.
- Do not add a direct MinIO route in gateway.
- If streaming through gateway, verify the proxy path supports streaming/range without buffering large files. If not, use short-lived presigned GET returned by education-service.

## Frontend Contract

Frontend must call gateway routes only:

- Fetch record state for lesson page.
- Request presign for teacher uploads.
- Upload directly to scoped URL when presigned.
- Commit uploaded items.
- Display `none`, `processing`, `ready`, and `unavailable` states.
- Use playback route or short-lived URL without storing permanent URLs.

## Verification Commands For Implementation Chunks

Before code changes:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap && rg -n "lessons|EDUCATION_SERVICE_URL|GatewayAuthGuard" api-gateway/src education-service/src'
```

After schema/service changes:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap/education-service && npm run build'
ssh alfares 'cd /home/ssf/Documents/Github/speakasap/api-gateway && npm run build'
```

After deployment:

```bash
ssh alfares 'kubectl rollout status deployment/speakasap-education -n statex-apps'
ssh alfares 'kubectl rollout status deployment/speakasap-api-gateway -n statex-apps'
```

Runtime smoke checks must include:

- Unauthorized presign returns `401`.
- Unassigned teacher presign returns `403`.
- Assigned teacher presign returns a 900-second scoped upload target.
- Commit rejects key mismatch, size mismatch, and invalid content type.
- Student without paid access cannot play.
- Paid student can play a processed record.
- Ready/unavailable/processing states match legacy semantics.

## Next Implementation Chunks

1. Recreate gateway route ownership/API docs referenced by historical `TASKS.md`.
2. Add Prisma schema migration for lesson records and parts.
3. Add MinIO config validation and storage adapter.
4. Add auth helper checks for teacher/student/manager access.
5. Add controller/service endpoints behind existing `/api/v1/lessons` route.
6. Add migration dry-run for legacy lesson record rows and object keys.
