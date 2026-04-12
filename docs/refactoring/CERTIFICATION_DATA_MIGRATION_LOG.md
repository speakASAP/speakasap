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

**Environment:** alfares (`ssh alfares`), Postgres via `db-server-postgres` (CLI used `DATABASE_URL` with host `db-server-postgres` → `127.0.0.1` for host-side `npx` / `python3`).

| Field | Value |
|-------|--------|
| When (UTC) | 2026-04-11T21:17Z (approx.; server UTC) |
| Operator | Lead orchestrator (SSH alfares) |
| `git pull` (speakasap) | **Yes** — repo was **behind 2** on `origin/main`; pulled to obtain ETL scripts + Prisma migration `20260411203000_student_course_uuid_string`. |
| `npx prisma migrate deploy` | **Applied** pending migration `20260411203000_student_course_uuid_string` on `speakasap_certification_db` (after pull). Earlier state: no pending migrations. |
| Dry-run counts captured? | **No** (historical) — ETL URLs not set in monorepo root **`speakasap/.env`**. Use **`CERTIFICATION_SOURCE_DATABASE_URL`** / **`CERTIFICATION_TARGET_DATABASE_URL`** (or legacy `SOURCE_*` / `TARGET_*`). Smoke dry-run with wrong source/target failed: `relation "certificates_certificate" does not exist` (expected: legacy tables not on certification target). |
| Rows upserted (script summary lines) | **Not run** — blocked until read-only legacy portal Postgres URL is available on this host (legacy monolith DB not present in `db-server-postgres` database list; likely on **speakasap** server per ecosystem docs). |
| Errors / warnings | Host-side Prisma without `127.0.0.1` substitution: **P1001** to `db-server-postgres:5432`. Use localhost port-forward or substitution when running CLI from alfares shell. |

### 2026-04-12 — full ETL (Mac operator host)

- **Connectivity:** `ssh -N -L 15432:127.0.0.1:5432 speakasap` and `ssh -N -L 25432:127.0.0.1:5432 alfares` (Postgres on alfares published at `127.0.0.1:5432`). `TARGET_DATABASE_URL` overridden at runtime: `db-server-postgres:5432` → `127.0.0.1:25432` (same credentials as `DATABASE_URL`).
- **Dry-run:** legacy row counts matched expectations (e.g. `certificates_certificate=1695`).
- **Import:** script completed; `CourseCertificate` 1695, `EducationCertificate` 2985, `QuestInstance` 704, questionnaire graph migrated.
- **Script fixes (root cause):** `CourseCertificate` source SQL — legacy `certificates_certificate.course_id` FK targets `courses_studentcourse` / `courses_basestudentcourse` (not `education_studentcourse`); `studentCourseId` uses `courses_basestudentcourse.uuid`. `user_quest_question` SELECT aliases `COALESCE(q.header,'') AS header` for `RealDictCursor`.
