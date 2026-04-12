# User data validation (TASK-32)

Run against **target** `speakasap_user_db` after migration. Replace URLs with your admin connection strings.

## 1. Row counts (manual)

### 1a. Recorded run (2026-04-12 UTC, alfares)

Counts below are from **legacy** `portal_db` on speakasap (dry-run in `migrate-user-from-legacy.py`) and **target** `speakasap_user_db` on `db-server-postgres` (`docker exec db-server-postgres psql -U dbadmin -d speakasap_user_db`).

| Entity (legacy → target) | Legacy rows | Target rows | Notes |
|--------------------------|------------:|-------------:|-------|
| students_student → students | 214059 | 2 | `skipped_no_auth=214057` (auth `users` email map size **2**) |
| employees_teacher → teachers | 380 | 1 | `skipped=379` |
| employees_teacher_additional_languages → teacher_additional_languages | 80 | 2 | M2M only for teachers present on target |
| employees_manager → managers | 3 | 1 | `skipped=2` |
| employees_employeeprofile → employee_profiles | 8 | 1 | `skipped=7` |
| auth_user → user_identity_mirror | 214101 | 2 | `skipped_no_auth=214099` |

**Blocker for full parity:** `auth` database `public.users` on alfares had **2** rows at import time (`SELECT COUNT(*) FROM users` = 2). Until portal users exist in auth with matching **emails**, the script correctly skips rows (no fabricated UUIDs). Re-run ETL after auth backfill/sync.

**Legacy** (portal DB):

```sql
SELECT 'students_student' AS t, COUNT(*) FROM students_student
UNION ALL SELECT 'employees_teacher', COUNT(*) FROM employees_teacher
UNION ALL SELECT 'employees_teacher_additional_languages', COUNT(*) FROM employees_teacher_additional_languages
UNION ALL SELECT 'employees_manager', COUNT(*) FROM employees_manager
UNION ALL SELECT 'employees_employeeprofile', COUNT(*) FROM employees_employeeprofile
UNION ALL SELECT 'auth_user', COUNT(*) FROM auth_user;
```

**Target** (speakasap_user_db):

```sql
SELECT 'students' AS t, COUNT(*) FROM students
UNION ALL SELECT 'teachers', COUNT(*) FROM teachers
UNION ALL SELECT 'teacher_additional_languages', COUNT(*) FROM teacher_additional_languages
UNION ALL SELECT 'managers', COUNT(*) FROM managers
UNION ALL SELECT 'employee_profiles', COUNT(*) FROM employee_profiles
UNION ALL SELECT 'user_identity_mirror', COUNT(*) FROM user_identity_mirror;
```

**Acceptance:** target counts **≤** legacy per entity where email could not be mapped to auth UUID (skipped rows). Document skip totals from migration log.

## 2. Orphan checks (target)

```sql
SELECT COUNT(*) FROM students s
  LEFT JOIN managers m ON m.id = s.manager_id
 WHERE s.manager_id IS NOT NULL AND m.id IS NULL;

SELECT COUNT(*) FROM teacher_additional_languages x
  LEFT JOIN teachers t ON t.id = x.teacher_id
 WHERE t.id IS NULL;
```

**Acceptance:** both counts **0**.

## 3. Auth linkage

```sql
SELECT COUNT(*) FROM students WHERE auth_user_id IS NULL;
SELECT COUNT(*) FROM teachers WHERE auth_user_id IS NULL;
```

**Acceptance:** both **0** (schema requires UUID; import should not insert nulls).

## 4. Verdict checklist (AGENT32V)

| Check | Result |
|-------|--------|
| Counts / explained skips | **PASS (2026-04-12)** — §1a table; skips match `auth.users` size **2** (see `USER_DATA_MIGRATION_LOG.md`). |
| Orphan queries | **PASS** — §2 both **0** after import (`students`→`managers` FK: absent legacy managers now stored as `manager_id` **NULL** when the manager row was not imported). |
| Auth UUID presence | **PASS** — §3 both **0** on imported `students` / `teachers`. |

## 5. AGENT32V outcome (2026-04-12)

**PASS** per `AGENT32V_USER_SERVICE_MIGRATION_VALIDATE.md`: `migrate-user-from-legacy.py` matches `USER_DATA_MAPPING.md` (sources, email→UUID rule, FK order, M2M rebuild). Live operator run from **alfares**: `ssh -N -L 15432:127.0.0.1:5432 speakasap` + env-only `SOURCE_*` / `TARGET_*` / `AUTH_*` (credentials not in repo). Artifact: `/tmp/user-migrate-final-20260412T100359Z.log` on alfares.

**Script fixes in this cycle:** M2M pass used a tuple cursor (was mixing `RealDictCursor` with `rel[0]` / `rel[1]`); `students.manager_id` cleared when the legacy FK points at a manager not present on target; student skip lines reduced to one summary to avoid multi-hundred-megabyte logs.

**Data follow-up:** Re-run import after **`auth.users` is populated** for portal emails; expect target counts to approach legacy counts.

**Meta (AGENT33V, 2026-04-12):** `PHASE3_USER_VALIDATION_REPORT.md` + `PHASE3_USER_CUTOVER_CHECKLIST.md` reviewed for consistency with frozen contracts and deferred items — **PASS** (program gate **P3-UE**).
