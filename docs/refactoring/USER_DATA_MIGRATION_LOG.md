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
| When (UTC) | **2026-04-12** — validation + repeat live import (~22s); second pass after `INTERNAL_API_TOKEN` + ETL keys in `speakasap/.env`, logging **alias** `logging-microservice` on logging backend compose |
| Operator | Agent on host **alfares** (`hostname` = alfares) |
| Target DB | **`speakasap_user_db`** on `db-server-postgres` (host `127.0.0.1:5432` from alfares). |
| Prisma | Migration **`20260412190000_init_user_tables`** already applied before this run. |
| SSH / tunnel | `Host speakasap` -> `136.243.102.222`, user **`portal_db`**, key `~/.ssh/speakasap_ed25519`. Tunnel: `ssh -f -N -L 15432:127.0.0.1:5432 speakasap`. |
| Env (no secrets in git) | `SOURCE_*` -> `portal_db` @ `127.0.0.1:15432/portal_db`; `TARGET_*` -> `speakasap_user_db` @ `127.0.0.1:5432`; `AUTH_*` -> `auth` @ `127.0.0.1:5432`. `dbadmin` password from `database-server/.env` (`DB_SERVER_ADMIN_PASSWORD`), URL-encoded in the URL if needed. |
| Log artifact | `/tmp/user-migrate-final-20260412T100359Z.log`; additional stdout logs under `/tmp/user-migrate-20260412T*.log` |
| Auth index | **`auth.users` = 2 rows** at import time; almost all legacy rows skipped (no email UUID). |
| Upsert summary | `user_identity_mirror` **2** / skipped_no_auth **214099**; `managers` **1** / skipped **2**; `teachers` **1** / skipped **379**; `teacher_additional_languages` **2**; `students` **2** / skipped **214057**; `employee_profiles` **1** / skipped **7**. |
| Script fixes | M2M step uses a dedicated tuple cursor; `students.manager_id` nulled when target manager missing; student skip log summarized. |

### Operator follow-up (legacy → alfares)

1. **SSH config:** `Host speakasap` -> `136.243.102.222`, user **`portal_db`**, `IdentityFile ~/.ssh/speakasap_ed25519` (or your speakasap key).
2. **Tunnel legacy Postgres** (from docs pattern used for certification):

   ```bash
   ssh -N -L 15432:127.0.0.1:5432 speakasap
   ```

3. **Tunnel or use Docker network** for alfares Postgres from laptop: e.g. `ssh -N -L 25432:127.0.0.1:5432 alfares` (if Postgres listens on alfares loopback), or run the Python script **on alfares** with `SOURCE_DATABASE_URL=...@127.0.0.1:15432/portal_db` while the speakasap tunnel runs from the **same** machine that has both forwards.
4. **Auth DB:** `AUTH_DATABASE_URL` must reach **`auth`** (`public.users`). **Backfill/sync auth users** before expecting target row counts near legacy; the 2026-04-12 run had only **2** `users` rows.

5. Run (example paths on alfares after `git pull`):

   ```bash
   cd /home/ssf/Documents/Github/speakasap/user-service
   export SOURCE_DATABASE_URL='postgresql://portal_db:***@127.0.0.1:15432/portal_db'
   export TARGET_DATABASE_URL='postgresql://dbadmin:***@127.0.0.1:5432/speakasap_user_db'
   export AUTH_DATABASE_URL='postgresql://dbadmin:***@127.0.0.1:5432/auth'
   python3 scripts/migrate-user-from-legacy.py --dry-run
   python3 scripts/migrate-user-from-legacy.py --truncate-first
   python3 scripts/migrate-user-from-legacy.py
   ```
