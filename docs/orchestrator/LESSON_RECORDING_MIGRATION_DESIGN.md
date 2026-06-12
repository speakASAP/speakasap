# Lesson Recording Migration Design

Date: 2026-06-12

Status: Goal 4.1 complete as a design artifact. No schema, data, or object storage changes have been made.

## Intent

Move legacy lesson-record metadata into `education-service` without losing private media access, breaking playback, deleting objects, or changing teacher/student authorization. The first implementation must be dry-run and reconciliation-first.

## Source Evidence

Legacy repo: `/home/ssf/Documents/Github/speakasap-portal`

Reviewed:

- `education/lesson_records/models.py`
- `education/migrations/0004_lessonrecord_lessonrecordpart.py`
- `education/migrations/0006_auto_20170724_0101.py`
- `education/migrations/0008_auto_20170724_0119.py`
- `education/migrations/0016_auto_20170920_1032.py`
- `education/migrations/0024_auto_20250320_2036.py`
- `education/management/commands/migrate_records_s3_keys.py`
- `education/management/commands/show_record_storage.py`
- `education/management/commands/update_lesson_record_key.py`
- `education/tasks.py`

New repo: `/home/ssf/Documents/Github/speakasap`

Reviewed:

- `education-service/prisma/schema.prisma`
- `education-service/prisma/migrations/20260412120000_init_education_core/migration.sql`
- `education-service/scripts/migrate-education-from-legacy.py`
- `docs/orchestrator/LESSON_RECORDING_CONTRACT.md`

## Source Tables

Current legacy model shape:

| Legacy table/model | Relevant fields | Notes |
|---|---|---|
| `education_lessonrecord` / `LessonRecord` | `uuid`, `lesson_id`, `record`, `created`, `processed`, `record_unavailable`, `parts` | One row per lesson. `parts` is JSONB in current model. |
| `education_lessonrecordpart` / `LessonRecordPart` | `uuid`, `part_file` | Part rows are not FK-owned in the current model; `LessonRecord.parts` stores UUIDs. |
| `education_lesson` / `Lesson` | `uuid`, `start`, `teacher_id`, `student_course_id` | Needed for canonical keys and target relation. |

Legacy migration notes:

- Initial 2017 migration had `ready`, `order`, and FK `record` fields.
- `0006_auto_20170724_0101.py` removed `ready`, `order`, and part FK, then added JSON `parts`.
- `0016_auto_20170920_1032.py` changed `parts` to JSONB with `blank=True, default=dict`.
- Current code treats `parts` as a list of UUID strings despite historical default quirks, so migration must normalize JSON carefully.

## Target Tables

Target schema is defined in `LESSON_RECORDING_CONTRACT.md` and should be implemented in `education-service`.

Minimum target:

- `education_lessonrecord`
- `education_lessonrecordpart`

Target field mapping:

| Source | Target | Transform |
|---|---|---|
| `education_lessonrecord.uuid` | `LessonRecord.uuid` | preserve UUID. |
| `education_lessonrecord.lesson_id` | `LessonRecord.lessonUuid` | must match existing target `education_lesson.uuid`. |
| `education_lessonrecord.record` | `LessonRecord.recordKey` | strip whitespace/trailing slash; store null when empty. |
| `education_lessonrecord.created` | `LessonRecord.createdAt` | preserve timestamp. |
| no legacy updated field | `LessonRecord.updatedAt` | set to import timestamp or schema default; dry-run must report this. |
| `education_lessonrecord.processed` | `LessonRecord.processed` | preserve boolean. |
| `education_lessonrecord.record_unavailable` | `LessonRecord.recordUnavailable` | preserve text, default empty string. |
| `education_lessonrecord.parts` | `LessonRecord.parts` | normalize to JSON array of UUID strings. |
| `education_lessonrecordpart.uuid` | `LessonRecordPart.uuid` | preserve UUID. |
| `education_lessonrecordpart.part_file` | `LessonRecordPart.partKey` | strip whitespace/trailing slash. |
| source membership via `LessonRecord.parts` | `LessonRecordPart.lessonRecordUuid` | derive by finding the record whose `parts` contains part UUID. |

## State Derivation

Dry-run and reconciliation must classify every record:

- `none`: no row for a lesson.
- `ready`: `record` non-empty and `processed=true`.
- `processing`: `processed=false` and `parts` contains at least one part UUID, or record exists with unprocessed file.
- `unavailable`: `processed=true`, empty `record`, empty/no parts, non-empty `record_unavailable`.
- `inconsistent`: any invalid combination, missing lesson, bad JSON, missing part row, duplicate lesson row, missing target lesson, or object-key mismatch.

## Object Key Handling

Key normalization:

1. Trim whitespace.
2. Strip trailing slash.
3. Preserve stored key as source evidence.
4. Compute canonical key from lesson start when available:
   - `YYYY/MM/DD/lesson_<lesson_uuid>.mp3`
   - `YYYY/MM/DD/parts_<part_uuid>.<ext>`
5. Detect old prefix format:
   - `courses/records/YYYY/MM/DD/...`
6. Do not update DB keys during first dry-run.

Dry-run report must count:

- empty record keys
- keys already canonical
- keys with `courses/records/` prefix and modern date path
- keys with `courses/records/` prefix but no date path
- keys with trailing slash
- keys whose lesson date does not match canonical date
- part keys not referenced by any `LessonRecord.parts`
- `LessonRecord.parts` entries with no `LessonRecordPart` row

## Dry-Run Command Design

Add or extend a script in `education-service/scripts/`, preferably:

```bash
python3 scripts/migrate-lesson-records-from-legacy.py --dry-run
```

Environment:

- `EDUCATION_SOURCE_DATABASE_URL` or `SOURCE_DATABASE_URL`
- `EDUCATION_TARGET_DATABASE_URL` or `TARGET_DATABASE_URL`
- optional object check settings for MinIO only when explicitly requested

Required modes:

- `--dry-run`: source/target counts and mapping validation; no writes.
- `--check-target`: also verifies target lesson UUIDs exist; no writes.
- `--check-objects`: optionally checks object existence through a safe helper or S3 `GetObject`/range check; no deletes.
- `--limit N`: bounded investigation.
- `--json-report <path>`: write machine-readable reconciliation report.
- `--write`: later implementation only, must require explicit flag; not part of first dry-run goal.

## Dry-Run Output Contract

Human output must include:

- `source lesson_records=<n>`
- `source lesson_record_parts=<n>`
- `target lessons=<n>`
- `records_ready=<n>`
- `records_processing=<n>`
- `records_unavailable=<n>`
- `records_inconsistent=<n>`
- `missing_target_lesson=<n>`
- `parts_missing_rows=<n>`
- `parts_orphan_rows=<n>`
- `keys_canonical=<n>`
- `keys_old_prefix_modern=<n>`
- `keys_old_prefix_legacy=<n>`
- `keys_empty=<n>`

JSON report must include arrays of exact IDs for:

- `missing_target_lessons`
- `bad_parts_json`
- `parts_missing_rows`
- `orphan_parts`
- `duplicate_or_conflicting_records`
- `old_prefix_keys`
- `legacy_prefix_keys_without_date`
- `object_missing` when `--check-objects` is used
- `would_insert_lesson_records`
- `would_insert_lesson_record_parts`
- `would_update_existing`

## Write Strategy For Later Goal

Only after dry-run is accepted:

1. Add Prisma schema and migration for target lesson-record tables.
2. Run dry-run with `--check-target`.
3. Fix missing target lessons before record import.
4. Run write in upsert mode, not truncate mode.
5. Preserve UUIDs and source keys.
6. Re-run dry-run after write and require zero unexplained deltas.

Write safety rules:

- No target truncation.
- No legacy DB writes.
- No object deletion.
- No key rewriting during record import.
- Idempotent upsert by UUID and lesson UUID.
- Conflicts stop the write unless `--allow-known-conflicts <report>` is explicitly provided in a later approved goal.

## Reconciliation Checks

Before import:

- Every `lesson_id` exists in target `education_lesson`.
- Every part UUID in `LessonRecord.parts` has a source `LessonRecordPart`.
- Every `LessonRecordPart` is referenced by at most one `LessonRecord`.
- No duplicate `LessonRecord.lesson_id`.

After import:

- Source and target `LessonRecord` counts match for selected scope.
- Source and target `LessonRecordPart` counts match for referenced parts.
- State classification counts match.
- Record keys match normalized source keys.
- No target row lacks a target lesson relation.

Optional object reconciliation:

- Check merged record object exists for `ready` rows.
- Check part objects exist for `processing` rows.
- Use range/GET-style check where `HeadObject` is known to be unreliable behind proxy.
- Never delete source parts in reconciliation mode.

## Rollback

Until cutover:

- Legacy portal remains behavior source of truth.
- Target import rows can be removed by UUID scope only if owner approves rollback.
- Object storage is not modified by migration.
- Gateway/frontend must remain pointed at legacy behavior until parity smoke checks pass.

## Verification Commands

Static/design verification:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap-portal && rg -n "class LessonRecord|class LessonRecordPart|parts|record_unavailable|migrate_records_s3_keys|update_lesson_record_key" education -g "*.py"'
ssh alfares 'cd /home/ssf/Documents/Github/speakasap && rg -n "LessonRecord|lesson recording|migrate-lesson-records" docs/orchestrator education-service'
```

Future build verification after schema/script implementation:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap/education-service && npm run build'
python3 education-service/scripts/migrate-lesson-records-from-legacy.py --dry-run
```

## Next Implementation Chunk

Goal 4.2 should add the dry-run script only. It should not add Prisma schema or write mode until the dry-run report shape is validated.
