# AGENT14: Content Data Migration

## Role

Data Migration Agent responsible for migrating content data from legacy Django models to new Prisma schema.

## Objective

Migrate all content data (grammar, phonetics, dictionary, songs, language) from legacy Django database to new Content Service Prisma database, ensuring data integrity and completeness.

---

## Inputs

- Legacy database (speakasap-portal PostgreSQL)
- Legacy Django models: `grammar`, `phonetics`, `dictionary`, `songs`, `language` apps
- `docs/refactoring/CONTENT_DATA_MAPPING.md` - Data mapping document (from TASK-12)
- `speakasap/content-service/prisma/schema.prisma` - Target Prisma schema (from TASK-12)
- Content service implementation: `speakasap/content-service/` (from TASK-13)

## Scope

- Create Prisma migrations
- Write data migration scripts (Python/Django)
- Extract data from legacy database
- Transform data according to mapping document
- Load data into new database
- Validate data integrity
- Document migration process
- Create rollback script (if needed)

## Do

- **Create Prisma Migrations:**
  - Generate initial migration from schema
  - Apply migration to new database
  - Verify schema matches Prisma schema

- **Write Migration Scripts:**
  - Create Python script using Django ORM to read legacy data
  - Script location: `speakasap/content-service/scripts/migrate-content-data.py`
  - Extract data from each legacy app:
    - Grammar rules
    - Phonetic rules
    - Dictionary entries
    - Songs
    - Languages
  - Transform data according to mapping document:
    - Field name mappings
    - Type conversions
    - Relationship mappings
    - URL transformations
    - Timestamp conversions

- **Data Extraction:**
  - Connect to legacy database
  - Read all records from legacy models
  - Handle relationships (foreign keys)
  - Preserve data integrity

- **Data Transformation:**
  - Apply field mappings from `CONTENT_DATA_MAPPING.md`
  - Convert data types (Django → Prisma)
  - Transform URLs (if needed)
  - Handle null values appropriately
  - Preserve relationships

- **Data Loading:**
  - Connect to new database
  - Insert transformed data
  - Handle duplicates (if any)
  - Preserve referential integrity
  - Use transactions for atomicity

- **Validation:**
  - Count records: legacy vs new
  - Sample record comparison
  - Relationship validation
  - Data integrity checks
  - Document any discrepancies

- **Documentation:**
  - Migration execution log
  - Record counts (before/after)
  - Any issues encountered
  - Data validation results
  - Rollback procedure

## Do Not

- Do not modify legacy database
- Do not delete legacy data
- Do not create automated tests
- Do not modify service code (TASK-13)
- Do not skip data validation
- Do not hardcode database credentials

## Outputs

### Required Files

1. **`speakasap/content-service/prisma/migrations/`**
   - Initial migration (if not already created)
   - Any additional migrations needed

2. **`speakasap/content-service/scripts/migrate-content-data.py`**
   - Python script using Django ORM
   - Extracts data from legacy database
   - Transforms data according to mapping
   - Loads data into new database
   - Includes error handling
   - Includes progress logging

3. **`docs/refactoring/CONTENT_DATA_MIGRATION_LOG.md`**
   - Migration execution log
   - Record counts per table
   - Execution time
   - Any errors encountered
   - Validation results

4. **`docs/refactoring/CONTENT_DATA_VALIDATION.md`**
   - Data validation report
   - Record count comparison
   - Sample record validation
   - Relationship validation
   - Data integrity checks
   - Any discrepancies found

### Optional Files

- `speakasap/content-service/scripts/rollback-migration.sh` - Rollback script (if needed)

## Exit Criteria

- ✅ All content data migrated
- ✅ Record counts match (or discrepancies documented)
- ✅ Data integrity validated
- ✅ Sample records verified
- ✅ Relationships preserved
- ✅ Migration process documented
- ✅ Rollback plan documented (if needed)

## Verification Steps

1. **Count Records:**

   ```python
   # Legacy
   Grammar.objects.count()
   # New
   prisma.grammar.count()
   # Should match (or discrepancies documented)
   ```

2. **Sample Validation:**
   - Compare sample records from legacy vs new
   - Verify field mappings correct
   - Verify relationships preserved

3. **Test Service:**

   ```bash
   curl http://localhost:4201/api/v1/languages
   # Should return migrated languages
   ```

## Migration Strategy

1. **Preparation:**
   - Verify legacy database accessible
   - Verify new database created and migrated
   - Review data mapping document

2. **Execution:**
   - Run migration script
   - Monitor progress
   - Handle errors
   - Log all operations

3. **Validation:**
   - Compare record counts
   - Validate sample records
   - Check relationships
   - Test API endpoints

4. **Documentation:**
   - Document migration results
   - Document any issues
   - Create validation report

## Rollback Plan

If migration fails or data issues found:

1. **Immediate:**
   - Stop migration script
   - Document failure point
   - Preserve legacy data (not modified)

2. **Recovery:**
   - Drop new database tables (if needed)
   - Re-run migrations
   - Re-execute migration script
   - Validate again

3. **Documentation:**
   - Document failure reason
   - Document recovery steps
   - Update migration script if needed

## Related

- Design task: `docs/agents/AGENT12_CONTENT_DESIGN.md` (TASK-12)
- Implementation task: `docs/agents/AGENT13_CONTENT_IMPLEMENTATION.md` (TASK-13)
- Phase 1 task: `docs/refactoring/PHASE1_TASK_DECOMPOSITION.md` (TASK-14)
- Data mapping: `docs/refactoring/CONTENT_DATA_MAPPING.md`
- Tasks index: `docs/refactoring/SPEAKASAP_REFACTORING_TASKS_INDEX.md`
