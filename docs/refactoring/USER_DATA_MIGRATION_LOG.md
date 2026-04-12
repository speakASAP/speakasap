# User data migration log (TASK-32)

**Tool:** `user-service/scripts/migrate-user-from-legacy.py`  
**Mapping:** `USER_DATA_MAPPING.md`  
**Target DB:** `speakasap_user_db` (Prisma tables under `user-service/prisma/schema.prisma`)

## Preconditions

1. `npx prisma migrate deploy` applied on target (`user-service` migration `20260412190000_init_user_tables`).
2. `SOURCE_DATABASE_URL` — legacy speakasap-portal Postgres (read-only recommended).
3. `TARGET_DATABASE_URL` — user-service `DATABASE_URL` pointing at `speakasap_user_db`.
4. `AUTH_DATABASE_URL` — auth-microservice Postgres containing table `users` (email → UUID `id`).
5. Python 3 + `psycopg2-binary`.

## Identity resolution (cause)

Target rows require **`auth_user_id` (UUID)** = auth `users.id`. Legacy portal uses integer `auth_user.id`. The script resolves **email** (case-insensitive, trimmed) between `auth_user` and `users`. Rows with no match are **skipped** with timestamped logs (no fabricated UUIDs).

## Procedure (operator)

```bash
cd speakasap/user-service
export SOURCE_DATABASE_URL='postgresql://.../legacy_portal_db'
export TARGET_DATABASE_URL='postgresql://.../speakasap_user_db'
export AUTH_DATABASE_URL='postgresql://.../auth_db'

python3 scripts/migrate-user-from-legacy.py --dry-run
python3 scripts/migrate-user-from-legacy.py --truncate-first   # destructive: clears user-domain tables on target
python3 scripts/migrate-user-from-legacy.py
```

Stdout lines are **ISO-8601 UTC timestamps**; redirect to a run artifact (e.g. `/tmp/user-migrate.log`).

## Scope imported

| Legacy (Django defaults) | Target table |
|---------------------------|--------------|
| `auth_user` (subset) | `user_identity_mirror` |
| `employees_manager` | `managers` |
| `employees_teacher` + `language_language` | `teachers` |
| `employees_teacher_additional_languages` | `teacher_additional_languages` |
| `students_student` | `students` |
| `employees_employeeprofile` | `employee_profiles` |

**Not imported:** contracts/salary (`EmployeeContract`, `SalaryProfile`), Django groups, apps outside user wave.

## Rollback / re-run

- Re-run without `--truncate-first`: upserts on `auth_user_id` refresh rows; teacher M2M table is **cleared and rebuilt** each import pass after teacher upserts.
- Full rollback: restore target snapshot taken before `--truncate-first`, or truncate domain tables and re-import.

## M2M column note

If legacy `employees_teacher_additional_languages` uses a non-standard FK column name (not `teacher_id`), adjust the `m2m_sql` in the script after `\d employees_teacher_additional_languages` on the legacy DB.

## Execution record

| Field | Value |
|-------|--------|
| When (UTC) | *(operator fills)* |
| Operator | *(operator fills)* |
| Dry-run | *(counts / auth index size)* |
| Rows upserted (mirror / managers / teachers / langs / students / profiles) | *(script summary lines)* |
| Skipped (no auth UUID) | *(per-entity skip counts)* |
| Errors / warnings | *(paste tail of log)* |
