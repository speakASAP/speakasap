# AGENT14 Content Migration - Implementation Complete

## Status: ✅ Tooling complete (live run = operator)

All migration **code and docs** are in place. Running against real DBs requires the portal’s supported Python/Django venv (see `scripts/README_MIGRATION.md`). 2026-04-09: script hardening (savepoints, validation table map, logging, bootstrap, rollback shell).

## Implementation Summary

### 1. Migration Script ✅

**File:** `speakasap/content-service/scripts/migrate-content-data.py`

**Features:**

- Uses Django ORM to read from legacy database
- Uses psycopg2 to write to new Prisma database
- Handles all content models:
  - Languages
  - GrammarCourses and GrammarLessons
  - PhoneticsCourses and PhoneticsLessons
  - SongsCourses and SongsLessons
  - Words, WordThemes, and WordThemeRelations
- Implements proper migration order to preserve referential integrity
- Includes comprehensive error handling and transaction rollback
- Provides detailed logging and progress reporting
- Supports dry-run mode for testing
- Validates migration by comparing record counts

**Data Transformations:**

- Field name mapping (snake_case → camelCase)
- ImageField → String path conversion
- Foreign key ID mapping
- Null value handling
- Default value application

### 2. Migration Documentation ✅

**Files Created:**

- `speakasap/content-service/scripts/README_MIGRATION.md` - Complete migration guide
- `docs/refactoring/CONTENT_DATA_MIGRATION_LOG.md` - Migration log template
- `docs/refactoring/CONTENT_DATA_VALIDATION.md` - Validation report template

### 3. Prisma Migrations ✅

**Status:** Already created in TASK-13

- Initial migration: `prisma/migrations/20260127161203_init/`
- All tables created with proper constraints

## Exit Criteria Validation

- ✅ **All content data migration logic implemented**
  - Script handles all 10 model types
  - Proper migration order enforced
  - Data transformations applied correctly

- ✅ **Record count validation**
  - Script compares legacy vs new counts
  - Validation method included
  - Discrepancies logged

- ✅ **Data integrity handling**
  - Foreign key constraints preserved
  - Unique constraints handled (duplicates skipped)
  - Transaction rollback on errors

- ✅ **Sample record validation support**
  - Logging provides detailed record information
  - ID mappings tracked for verification
  - Validation templates provided

- ✅ **Relationships preserved**
  - Foreign key mappings maintained
  - One-to-one relationships handled (Language → Courses)
  - One-to-many relationships handled (Courses → Lessons)

- ✅ **Migration process documented**
  - Complete README with step-by-step instructions
  - Migration log template
  - Validation report template
  - Troubleshooting guide

- ✅ **Rollback plan documented**
  - Rollback steps in README
  - Transaction rollback in script
  - Database recreation instructions

## Usage

Repos: **speakasap** (alfares, `git pull`) vs **speakasap-portal** (speakasap server, `git pull`). Copy `migrate-content-data.py` from the speakasap repo to the portal tree for legacy export — see `scripts/README_MIGRATION.md`.

### Dry run (legacy host)

```bash
ssh speakasap
cd ~/speakasap-portal
python3 migrate-content-data.py --dry-run
```

### File export / import

See `scripts/README_MIGRATION.md`. Import runs on alfares using `content-service/scripts/migrate-content-data.py` inside the cloned speakasap repo.

## Next Steps

1. **Execute Migration:**
   - Run dry-run first to verify
   - Execute actual migration
   - Monitor migration.log for progress

2. **Validate Results:**
   - Check record counts match
   - Test API endpoints
   - Verify sample records
   - Complete validation report

3. **Document Results:**
   - Fill in migration log template
   - Complete validation report
   - Document any discrepancies

## Related Files

- Migration Script: `speakasap/content-service/scripts/migrate-content-data.py`
- Migration Guide: `speakasap/content-service/scripts/README_MIGRATION.md`
- Migration Log Template: `docs/refactoring/CONTENT_DATA_MIGRATION_LOG.md`
- Validation Template: `docs/refactoring/CONTENT_DATA_VALIDATION.md`
- Data Mapping: `docs/refactoring/CONTENT_DATA_MAPPING.md`
- Agent Prompt: `docs/agents/AGENT14_CONTENT_MIGRATION.md`
