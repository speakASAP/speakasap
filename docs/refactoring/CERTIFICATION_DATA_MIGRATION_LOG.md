# Certification data migration log (TASK-24)

**Tool:** `certification-service/scripts/migrate-certification-from-legacy.py`  
**Mapping:** `CERTIFICATION_DATA_MAPPING.md`  
**Target DB:** `speakasap_certification_db` (Prisma models under `certification-service/prisma/schema.prisma`)

## Parallelism (P2-D)

TASK-24 ran in parallel with TASK-27 per `PHASE2_TASK_DECOMPOSITION.md` gate: separate source/target databases, no shared migration runner process, validators AGENT23V + AGENT26V previously PASS. Recorded in `PHASE2_ORCHESTRATION_SUMMARY.md`.

## Preconditions

1. `npx prisma migrate deploy` applied on target (includes `studentCourseId` VARCHAR migration for legacy UUID PKs).
2. `SOURCE_DATABASE_URL` — read-only legacy portal Postgres recommended.
3. `TARGET_DATABASE_URL` — certification service `DATABASE_URL`.
4. Python 3 + `psycopg2-binary`.

## Procedure (operator)

```bash
cd speakasap/certification-service
export SOURCE_DATABASE_URL='postgresql://.../legacy_portal_db'
export TARGET_DATABASE_URL='postgresql://.../speakasap_certification_db'
python3 scripts/migrate-certification-from-legacy.py --dry-run   # optional counts
python3 scripts/migrate-certification-from-legacy.py --truncate-first  # destructive reset of cert tables
python3 scripts/migrate-certification-from-legacy.py
```

Logs are **stdout** with ISO timestamps; redirect to your run artifact (e.g. `/tmp/cert-migrate-20260411.log`).

## Scope imported

| Legacy (Django default table names) | Target Prisma table |
|-------------------------------------|---------------------|
| `certificates_certificate` | `CourseCertificate` |
| `education_certificates_certificate` | `EducationCertificate` |
| `quests_quest` | `QuestInstance` |
| `user_quest_*` | `Questionnaire`, `QuestionnaireQuestion`, `UserQuestionnaire`, `UserQuestionnaireAnswer` |

**Not imported:** `language_tests`, `user_tests`, `teacher_tests` (assessment domain).

## Rollback / re-run

- Re-run: script uses `ON CONFLICT` upserts on natural keys (`studentCourseId`, composite education key, quest UUID, questionnaire PKs).
- Full rollback: restore target DB from snapshot taken **before** `--truncate-first`, or truncate domain tables and re-import from legacy snapshot.

## Schema correction (cause)

Legacy `StudentCourse` PK is UUID; certification persistence was updated to `VARCHAR(36)` for `studentCourseId` (see Prisma migration `20260411203000_student_course_uuid_string`). API contract and mapping docs aligned accordingly.

## Execution record

Fill after production/staging run:

| Field | Value |
|-------|--------|
| When (UTC) | |
| Operator | |
| Dry-run counts captured? | yes / no |
| Rows upserted (script summary lines) | |
| Errors / warnings | |
