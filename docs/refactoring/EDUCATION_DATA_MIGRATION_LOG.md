# Education Data Migration Log

**Script:** `education-service/scripts/migrate-education-from-legacy.py`  
**Mapping:** `EDUCATION_DATA_MAPPING.md`

## Environment (repo root `speakasap/.env`)

| Variable | Purpose |
| -------- | ------- |
| `EDUCATION_SOURCE_DATABASE_URL` | Legacy Django Postgres (read-only recommended) |
| `EDUCATION_TARGET_DATABASE_URL` | Target `speakasap_education_db` (`EDUCATION_DATABASE_URL` compose value) |

Fallback: `SOURCE_DATABASE_URL` / `TARGET_DATABASE_URL` if prefixed vars unset.

## Operator steps

1. Ensure target DB exists and `npm run prisma:migrate:deploy` ran in `education-service/` against target.
2. Dry-run: `python3 education-service/scripts/migrate-education-from-legacy.py --dry-run`
3. Snapshot / backup target DB if re-importing.
4. Full import: `python3 education-service/scripts/migrate-education-from-legacy.py --truncate-first` (destructive on target education tables only).

## Timestamped logging

Script prints **ISO 8601 UTC** lines per step (`log()`). Use these timestamps to correlate long phases; do not raise DB client timeouts to mask stalls—fix blocking queries.

## Student course `previous_id`

Import uses two phases: insert rows with `previous_id` NULL, then patch from legacy source so self-FK order is satisfied.
