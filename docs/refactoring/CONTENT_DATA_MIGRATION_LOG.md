# Content Data Migration Log

## Latest maintenance (AGENT14 tooling)

**Date:** 2026-04-09  
**Executor:** Cursor / AGENT14  
**Dry Run:** Not executed on this host (Django 1.11 requires portal Python 3.4–3.6 venv; local `python3` is 3.12).  
**Status:** Script and docs updated; **production migration still operator-run** with portal venv + `NEW_DATABASE_URL` or `DATABASE_URL`.

Changes: `migrate-content-data.py` — Django path bootstrap (`SPEAKASAP_PORTAL_ROOT`), savepoints for duplicate `Word` / `WordThemeRelation`, fixed validation table names (`STAT_KEY_TO_PRISMA_TABLE`), fixed logging format bugs, removed unused `--legacy-db-url`. Added `scripts/rollback-content-migration.sh`.

---

## Migration Execution Summary

**Date:** [Date of migration]  
**Executor:** [Name/Agent]  
**Dry Run:** [Yes/No]  
**Status:** [In Progress/Completed/Failed]

## Environment

- **Legacy Database:** [Database name/URL]
- **New Database:** [Database name/URL]
- **Migration Script:** `speakasap/content-service/scripts/migrate-content-data.py`

## Execution Steps

### 1. Preparation

- [ ] Legacy database accessible
- [ ] New database created and migrated (Prisma migrations applied)
- [ ] Data mapping document reviewed
- [ ] Migration script tested with dry-run

### 2. Execution

**Start Time:** [Timestamp]

#### Languages

- Legacy Count: [Number]
- New Count: [Number]
- Status: [Success/Failed]
- Notes: [Any issues encountered]

#### Grammar Courses

- Legacy Count: [Number]
- New Count: [Number]
- Status: [Success/Failed]

- Notes: [Any issues encountered]

#### Grammar Lessons

- Legacy Count: [Number]
- New Count: [Number]

- Status: [Success/Failed]
- Notes: [Any issues encountered]

#### Phonetics Courses

- Legacy Count: [Number]

- New Count: [Number]
- Status: [Success/Failed]
- Notes: [Any issues encountered]

#### Phonetics Lessons

- Legacy Count: [Number]
- New Count: [Number]
- Status: [Success/Failed]
- Notes: [Any issues encountered]

#### Songs Courses

- Legacy Count: [Number]
- New Count: [Number]
- Status: [Success/Failed]
- Notes: [Any issues encountered]

#### Songs Lessons

- Legacy Count: [Number]
- New Count: [Number]
- Status: [Success/Failed]
- Notes: [Any issues encountered]

#### Words

- Legacy Count: [Number]
- New Count: [Number]
- Duplicates Skipped: [Number]
- Status: [Success/Failed]

- Notes: [Any issues encountered]

#### Word Themes

- Legacy Count: [Number]
- New Count: [Number]
- Status: [Success/Failed]
- Notes: [Any issues encountered]

#### Word Theme Relations

- Legacy Count: [Number]
- New Count: [Number]
- Duplicates Skipped: [Number]
- Status: [Success/Failed]
- Notes: [Any issues encountered]

**End Time:** [Timestamp]
**Duration:** [Duration]

## Errors Encountered

[List any errors encountered during migration]

## Rollback Actions

[If rollback was needed, document steps taken]

## Next Steps

- [ ] Validate data integrity
- [ ] Test API endpoints
- [ ] Verify relationships
- [ ] Document any discrepancies
