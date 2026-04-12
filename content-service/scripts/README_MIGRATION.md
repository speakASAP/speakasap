# Content Data Migration Guide

## Overview

This guide explains how to migrate content data from the legacy Django database (`speakasap-portal`) to the new Content Service Prisma database.

## Two repositories, two servers

| Piece | Host | Repository / path | Update with `git pull` |
|--------|------|-------------------|-------------------------|
| **New stack** (content-service, Prisma, Docker deploy) | **alfares** | `speakasap` monorepo (e.g. `~/Documents/Github/speakasap` or `cd speakasap` from your layout) | `ssh alfares` → `cd <speakasap-repo>` → `git pull` |
| **Legacy portal** (Django 1.11, legacy Postgres) | **speakasap** | `speakasap-portal` (e.g. `/home/portal_db/speakasap-portal`) | `ssh speakasap` → `cd speakasap-portal` → `git pull` |

**Migration script source of truth:** `speakasap/content-service/scripts/migrate-content-data.py` lives only in the **speakasap** repo. It is **not** part of `speakasap-portal`. After pulling `speakasap` on alfares, sync the script to the legacy server for `--export-dir` / `--dry-run`:

```bash
# Example: from your laptop (paths match your alfares layout)
scp alfares:~/Documents/Github/speakasap/content-service/scripts/migrate-content-data.py \
  speakasap:/home/portal_db/speakasap-portal/migrate-content-data.py
```

On **alfares**, `--import-dir` and live migration use the copy inside the cloned `speakasap` repo (same path after `git pull`). No copy into `speakasap-portal` is needed there.

## Prerequisites

1. **Legacy Database Access:**
   - Access to `speakasap-portal` PostgreSQL database
   - Django environment configured for `speakasap-portal`

2. **New Database Setup:**
   - Content Service database created (`speakasap_content_db`)
   - Prisma migrations applied (`npx prisma migrate deploy`)
   - Database connection string available in `DATABASE_URL` environment variable

3. **Python environment (legacy portal):**
   - Django 1.11 + Python 3.4–3.6 (as used by `speakasap-portal`). Python 3.12+ typically fails Django 1.11 import.
   - Dependencies: `psycopg2-binary`, portal’s `requirements` / venv.

4. **Optional:** `SPEAKASAP_PORTAL_ROOT` if `speakasap-portal` is not the default sibling of the GitHub root (see script bootstrap).

5. **Target DB URL:** Prefer `NEW_DATABASE_URL` for the Prisma DB when `DATABASE_URL` is already set for Django in the same shell.

## File-based migration (no DB link between legacy and new)

Use when the legacy host cannot reach the Prisma Postgres (e.g. speakasap → alfares).

0. **Sync the script** from the `speakasap` repo (alfares or local clone) to `speakasap-portal` on speakasap — see [Two repositories, two servers](#two-repositories-two-servers).

1. **On speakasap (legacy):** run export **inside** `speakasap-portal` so Django settings resolve:

   ```bash
   ssh speakasap
   cd /home/portal_db/speakasap-portal
   /usr/bin/python3 migrate-content-data.py --export-dir /home/portal_db/speakasap-content-export
   ```

2. **Archive and copy via your laptop:**

   ```bash
   # On speakasap
   tar czf /tmp/speakasap-content-export.tgz -C /home/portal_db speakasap-content-export

   # Laptop
   scp speakasap:/tmp/speakasap-content-export.tgz .
   scp speakasap-content-export.tgz alfares:/tmp/
   ```

3. **On alfares:** `git pull` the **speakasap** repo first so the import script matches the export format. Extract the archive, install `psycopg2` for system Python if needed (`pip3 install --user psycopg2-binary`), set `DATABASE_URL` to the **host** URL for `speakasap_content_db` (see `speakasap/.env` at repo root: host `127.0.0.1`, port `5432`, user `dbadmin`, database `speakasap_content_db`). Then:

   ```bash
   ssh alfares
   cd ~/Documents/Github/speakasap   # or: cd speakasap
   git pull
   cd /tmp
   tar xzf speakasap-content-export.tgz
   export DATABASE_URL='postgresql://dbadmin:PASSWORD@127.0.0.1:5432/speakasap_content_db'
   python3 ~/Documents/Github/speakasap/content-service/scripts/migrate-content-data.py \
     --import-dir /tmp/speakasap-content-export \
     --truncate-first
   ```

   `--truncate-first` clears existing content tables before load (recommended for a clean run).

4. **Verify:** `curl` the content API (e.g. host port mapped to content service) and compare counts in Postgres.

`manifest.json` + `*.json` must stay together; `format_version` in the manifest must match the script.

---

## Migration Process

### Step 1: Prepare Environment

1. **Set up Django environment** on **speakasap** in `speakasap-portal`:

   ```bash
   ssh speakasap
   cd ~/speakasap-portal
   export DJANGO_SETTINGS_MODULE=portal.settings
   # Or activate your virtual environment if using one
   ```

2. **Set target (Prisma) database URL:**

   ```bash
   export DATABASE_URL="postgresql://user:password@host:5432/speakasap_content_db"
   # Or, if DATABASE_URL is used by Django in the same shell:
   # export NEW_DATABASE_URL="postgresql://..."
   ```

### Step 2: Dry Run (Recommended)

Always perform a dry run first to verify the migration script works correctly:

```bash
ssh speakasap
cd ~/speakasap-portal
# Script must be the copy from speakasap repo (see "Two repositories" above)
python3 migrate-content-data.py --dry-run
```

This will:

- Connect to legacy database
- Read all data
- Show what would be migrated
- **Not write anything to the new database**

### Step 3: Execute Migration

Once dry run is successful, execute the actual migration:

```bash
ssh speakasap
cd ~/speakasap-portal
export DATABASE_URL='postgresql://...speakasap_content_db...'
python3 migrate-content-data.py
```

The script will:

1. Migrate Languages (must be first)
2. Migrate Courses (Grammar, Phonetics, Songs)
3. Migrate Lessons (Grammar, Phonetics, Songs)
4. Migrate Dictionary data (Words, Themes, Relations)
5. Validate migration by comparing counts

### Step 4: Validate Migration

After migration completes:

1. **Check migration log:**

   ```bash
   cat migration.log
   ```

2. **Verify record counts:**
   The script outputs a summary showing legacy vs new counts for each table.

3. **Test API endpoints:**

   ```bash
   curl http://localhost:4201/api/v1/languages
   curl http://localhost:4201/api/v1/grammar
   curl http://localhost:4201/api/v1/phonetics
   curl http://localhost:4201/api/v1/songs
   curl http://localhost:4201/api/v1/dictionary
   ```

4. **Manual validation:**
   - Compare sample records from legacy vs new database
   - Verify relationships are preserved
   - Check for any data discrepancies

## Migration Order

The migration follows this order to preserve referential integrity:

1. **Languages** (no dependencies)
2. **Courses** (depends on Languages)
   - GrammarCourse
   - PhoneticsCourse
   - SongsCourse
3. **Lessons** (depends on Courses)
   - GrammarLesson
   - PhoneticsLesson
   - SongsLesson
4. **Dictionary** (depends on Languages)
   - Word
   - WordTheme
   - WordThemeRelation (depends on Word and WordTheme)

## Data Transformations

The migration script handles the following transformations:

- **Field name mapping:** snake_case → camelCase (e.g., `machine_name` → `machineName`)
- **ImageField → String:** Django `ImageField` converted to relative path string
- **Foreign keys:** `language_id` → `languageId`, `course_id` → `courseId`
- **Null handling:** Empty strings converted to `None` for nullable fields
- **Default values:** Material language defaults to `'ru'` if not set

## Error Handling

The script includes comprehensive error handling:

- **Transaction rollback:** If any step fails, all changes are rolled back
- **Duplicate handling:** Unique constraint violations are logged and skipped (for Words and WordThemeRelations)
- **Missing references:** Records with missing foreign keys are skipped with warnings
- **Detailed logging:** All operations logged to `migration.log` and console

## Rollback

If migration fails or issues are found:

1. **Stop the script** (Ctrl+C if still running)

2. **Automated reset (target DB only):** `scripts/rollback-content-migration.sh` (requires `DATABASE_URL`, confirms before `DROP SCHEMA`).

3. **Manual drop and recreate database:**

   ```bash
   # Connect to database
   psql -U user -d speakasap_content_db
   
   # Drop all tables
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   
   # Re-run Prisma migrations (alfares, speakasap repo)
   ssh alfares
   cd ~/Documents/Github/speakasap/content-service
   npx prisma migrate deploy
   ```

4. **Re-run migration** after fixing issues

## Troubleshooting

### Django Setup Issues

If you get Django setup errors:

```bash
# On speakasap, legacy repo
ssh speakasap
cd ~/speakasap-portal

export DJANGO_SETTINGS_MODULE=portal.settings

# Prefer running the script directly (not via shell redirect)
python3 migrate-content-data.py --dry-run
```

### Database Connection Issues

If connection fails:

- Verify `DATABASE_URL` is set correctly
- Check database credentials
- Ensure database exists and migrations are applied

### Foreign Key Violations

If you see foreign key violations:

- Check that Languages were migrated first
- Verify ID mappings are correct
- Check for orphaned records in legacy database

### Unique Constraint Violations

For Words and WordThemeRelations:

- Duplicates are automatically skipped
- Check migration log for skipped count
- This is expected if data already exists

## Migration Log

The script creates a detailed log file (`migration.log`) with:

- All operations performed
- Record counts for each table
- Errors encountered
- Validation results

## Related Documentation

- Data Mapping: `docs/refactoring/CONTENT_DATA_MAPPING.md`
- Migration Log Template: `docs/refactoring/CONTENT_DATA_MIGRATION_LOG.md`
- Validation Template: `docs/refactoring/CONTENT_DATA_VALIDATION.md`
- Agent Prompt: `docs/agents/AGENT14_CONTENT_MIGRATION.md`
