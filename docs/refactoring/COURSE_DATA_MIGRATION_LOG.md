# Course data migration log (TASK-37)

**Tool:** `course-service/scripts/migrate-course-from-legacy.py`  
**Target DB:** `speakasap_course_db` (Prisma migration `20260412220000_init_course_tables`)

## Preconditions

1. Apply schema on target: `cd course-service && npm run prisma:migrate:deploy` (uses `../.env` and `COURSE_DATABASE_URL`).
2. Set **`COURSE_SOURCE_DATABASE_URL`** (legacy portal Postgres) and **`COURSE_TARGET_DATABASE_URL`** (same as `COURSE_DATABASE_URL` for containers; on alfares host ETL may use `127.0.0.1:5432` for target like user ETL).

## Operator steps

```bash
cd /home/ssf/Documents/Github/speakasap/course-service
# Counts only
COURSE_SOURCE_DATABASE_URL="..." COURSE_TARGET_DATABASE_URL="..." \
  python3 scripts/migrate-course-from-legacy.py --dry-run

# Full reload (destructive on target course tables)
COURSE_SOURCE_DATABASE_URL="..." COURSE_TARGET_DATABASE_URL="..." \
  python3 scripts/migrate-course-from-legacy.py --truncate-first
```

## Execution record

| Step | When | Who | Result |
|------|------|-----|--------|
| dry-run | — | — | Pending operator |
| truncate + migrate | — | — | Pending operator |

## Notes

- Script assumes legacy table/column names match Django defaults (`products_*`, `offers_*`). If legacy differs, adjust column lists in the script after verifying `\d products_product` on legacy.
- STI-only columns on `products_product` child tables are **not** copied (Wave 2 scope: base product row only).
