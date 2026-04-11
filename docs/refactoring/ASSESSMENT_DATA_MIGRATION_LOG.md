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

| Field | Value |
|-------|--------|
| When (UTC) | |
| Operator | |
| Dry-run counts | |
| Script completion | |
| M2M table name verified? | |
