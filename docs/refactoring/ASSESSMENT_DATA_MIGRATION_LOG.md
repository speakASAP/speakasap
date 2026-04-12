# Assessment data migration log (TASK-27)

**Tool:** `assessment-service/scripts/migrate-assessment-from-legacy.py`  
**Mapping:** `ASSESSMENT_DATA_MAPPING.md`  
**Target DB:** `speakasap_assessment_db`

## Preconditions

1. `npx prisma migrate deploy` on assessment target.
2. `SOURCE_DATABASE_URL`, `TARGET_DATABASE_URL` set (same pattern as certification).
3. `psycopg2-binary` installed.

## Procedure

```bash
cd speakasap/assessment-service
export SOURCE_DATABASE_URL='postgresql://.../legacy_portal_db'
export TARGET_DATABASE_URL='postgresql://.../speakasap_assessment_db'
python3 scripts/migrate-assessment-from-legacy.py --dry-run
python3 scripts/migrate-assessment-from-legacy.py --truncate-first
python3 scripts/migrate-assessment-from-legacy.py
```

## Scope

Imports **`language_tests_*`** and **`user_tests_usertest`** only.

**Explicitly not imported:** `teacher_tests` (obsolete). No certification tables.

## M2M table name

Script expects Django default `language_tests_usertestquestion_answers`. If your deployment differs, run `\dt *usertestquestion*` on legacy Postgres and adjust the constant in the script.

## Rollback

Restore DB snapshot taken before `--truncate-first`, or truncate all assessment tables and re-run import.

## Execution record

**Environment:** alfares (`ssh alfares`), same `127.0.0.1` substitution for host-side CLI vs `db-server-postgres`.

| Field | Value |
|-------|--------|
| When (UTC) | 2026-04-11T21:16Z (approx.; server UTC) |
| Operator | Lead orchestrator (SSH alfares) |
| `npx prisma migrate deploy` | **Applied** `20260411120000_init` — database `speakasap_assessment_db` was created and migration applied (first-time setup). |
| `. ./.env` warning | `./.env: line 30: HH:mm:ss: command not found` — unquoted `LOG_TIMESTAMP_FORMAT` (or similar) with a space; Prisma still loaded `.env` and succeeded. **Fix:** quote the value in `assessment-service/.env` (e.g. `LOG_TIMESTAMP_FORMAT='...'`). |
| Dry-run counts | **Not run** — `SOURCE_DATABASE_URL` / `TARGET_DATABASE_URL` not configured in `assessment-service/.env`. |
| Script completion | **Not run** (blocked: no legacy `SOURCE_DATABASE_URL` on alfares; same as certification log). |
| M2M table name verified? | **Pending** (requires live legacy DB). |

### 2026-04-12 — full ETL (Mac operator host)

- **Connectivity:** same tunnel pattern as `CERTIFICATION_DATA_MIGRATION_LOG.md` (legacy `15432`, alfares Postgres `25432`); runtime `TARGET_DATABASE_URL` host substitution for host-side Python.
- **Dry-run:** legacy counts (e.g. `language_tests_usertestquestion=116087`, `language_tests_usertest=9669`) captured.
- **Import:** completed in one run; `languageUserTestQuestionAnswer=106324` (M2M table `language_tests_usertestquestion_answers` confirmed).
- **Performance fix:** `migrate_utq_answers` used per-row `execute()` (~106k round-trips over SSH) and stalled; replaced with `psycopg2.extras.execute_batch` (`page_size=2000`).
