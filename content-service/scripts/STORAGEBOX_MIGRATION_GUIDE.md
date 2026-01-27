# Content Data Migration via Storagebox Guide

## Overview

This guide explains how to migrate content data from the legacy Django database (`speakasap-portal`) to the new Content Service Prisma database using storagebox as intermediate storage. This approach avoids transferring large amounts of data directly between servers.

## Prerequisites

1. **Storagebox Access:**
   - Storagebox mounted on both servers
   - speakasap: `/srv/storagebox` (may require sudo for write access)
   - statex: `/srv/storagebox` (writable by statex user)

2. **Database Access:**
   - Legacy database accessible from speakasap server
   - New database accessible from statex server

3. **Tools:**
   - `pg_dump` and `psql` installed on both servers
   - Python 3.4+ with Django and psycopg2 on speakasap server

## Migration Strategy

The migration is performed in two steps:

1. **Export** (run on speakasap server): Export data from legacy database to SQL files on storagebox
2. **Import** (run on statex server): Import data from storagebox SQL files to new database

## Step 1: Export Data (speakasap server)

### On speakasap server:

```bash
cd /home/portal_db/speakasap-portal

# Set environment variables
export STORAGEBOX_PATH=/srv/storagebox
export LEGACY_DB_NAME=portal_db
export LEGACY_DB_USER=portal_db

# Run export
./migrate-via-storagebox.sh export
```

**What it does:**
- Exports 10 content tables to SQL files
- Saves files to `/tmp/content-migration-<PID>/` first
- Attempts to copy to `/srv/storagebox/content-migration/`
- If storagebox copy fails (permission denied), files remain in `/tmp/` and you'll need to copy manually with sudo

**If storagebox copy fails:**
```bash
# Copy files manually with sudo
sudo mkdir -p /srv/storagebox/content-migration
sudo cp -r /tmp/content-migration-*/ /srv/storagebox/content-migration/
sudo chown -R statex:statex /srv/storagebox/content-migration
```

**Expected output:**
```
[INFO] Exporting content data to storagebox...
[INFO] Exporting 10 tables...
[INFO] Exporting language_language...
[INFO]   ✓ Exported language_language (XXM)
[INFO] Exporting grammar_grammarcourse...
...
[INFO] Export completed. Files saved to: /srv/storagebox/content-migration
```

**Time estimate:** Depends on database size. For ~20K words + relations, expect 5-15 minutes.

## Step 2: Import Data (statex server)

### On statex server:

```bash
cd /home/statex/speakasap

# Set environment variables
export STORAGEBOX_PATH=/srv/storagebox
export DATABASE_URL="postgresql://dbadmin:password@db-server-postgres:5432/speakasap_content_db"

# Run import
./migrate-via-storagebox.sh import
```

**What it does:**
- Reads SQL files from `/srv/storagebox/content-migration/`
- Transforms table/column names from Django format to Prisma format
- Imports data in correct dependency order
- Validates import by counting records

**Expected output:**
```
[INFO] Importing content data from storagebox...
[INFO] Importing 10 tables...
[INFO] Importing language_language...
[INFO]   ✓ Imported language_language
...
[INFO] Import completed!
[INFO] Validating import...
 table_name        | count 
-------------------+-------
 Language          |    19
 GrammarCourse     |    19
 GrammarLesson     |   522
 ...
```

## Troubleshooting

### Export Issues

**Permission denied on storagebox:**
- Files are exported to `/tmp/content-migration-<PID>/`
- Copy manually: `sudo cp -r /tmp/content-migration-*/ /srv/storagebox/content-migration/`

**pg_dump fails:**
- Check database connection: `psql -U portal_db -d portal_db -c "SELECT 1;"`
- Verify table names exist: `psql -U portal_db -d portal_db -c "\dt" | grep -E "language|grammar|phonetics|songs|dictionary"`

### Import Issues

**Storagebox files not found:**
- Verify files exist: `ls -lh /srv/storagebox/content-migration/`
- Check storagebox is mounted: `df -h | grep storagebox`

**Database connection fails:**
- Verify DATABASE_URL is set correctly
- Test connection: `psql $DATABASE_URL -c "SELECT 1;"`

**Table/column name mismatches:**
- The script performs basic transformations, but you may need to adjust based on actual schema
- Check Prisma schema: `cat content-service/prisma/schema.prisma`
- Compare with exported SQL files

**Foreign key violations:**
- Ensure data is imported in correct order (script handles this)
- Check ID mappings are correct

## Alternative: Python Script Approach

If the shell script approach has issues, you can use the Python script:

### Export (speakasap):
```bash
cd /home/portal_db/speakasap-portal
export DJANGO_SETTINGS_MODULE=portal.settings
export STORAGEBOX_PATH=/srv/storagebox
python3.4 migrate-content-data-via-storagebox.py --dry-run  # Test first
python3.4 migrate-content-data-via-storagebox.py  # Actual export
```

### Import (statex):
```bash
cd /home/statex/speakasap
export DATABASE_URL="postgresql://..."
export STORAGEBOX_PATH=/srv/storagebox
python3 migrate-content-data-via-storagebox.py --dry-run  # Test first
python3 migrate-content-data-via-storagebox.py  # Actual import
```

## Data Validation

After import, validate the migration:

```bash
# On statex server
psql $DATABASE_URL <<EOF
SELECT 
    'Language' as table_name, COUNT(*) as count FROM "Language"
UNION ALL SELECT 'GrammarCourse', COUNT(*) FROM "GrammarCourse"
UNION ALL SELECT 'GrammarLesson', COUNT(*) FROM "GrammarLesson"
UNION ALL SELECT 'PhoneticsCourse', COUNT(*) FROM "PhoneticsCourse"
UNION ALL SELECT 'PhoneticsLesson', COUNT(*) FROM "PhoneticsLesson"
UNION ALL SELECT 'SongsCourse', COUNT(*) FROM "SongsCourse"
UNION ALL SELECT 'SongsLesson', COUNT(*) FROM "SongsLesson"
UNION ALL SELECT 'Word', COUNT(*) FROM "Word"
UNION ALL SELECT 'WordTheme', COUNT(*) FROM "WordTheme"
UNION ALL SELECT 'WordThemeRelation', COUNT(*) FROM "WordThemeRelation"
ORDER BY table_name;
EOF
```

Compare counts with legacy database:

```bash
# On speakasap server
psql -U portal_db -d portal_db <<EOF
SELECT 'language_language' as table_name, COUNT(*) FROM language_language
UNION ALL SELECT 'grammar_grammarcourse', COUNT(*) FROM grammar_grammarcourse
UNION ALL SELECT 'grammar_grammarlesson', COUNT(*) FROM grammar_grammarlesson
UNION ALL SELECT 'phonetics_phoneticscourse', COUNT(*) FROM phonetics_phoneticscourse
UNION ALL SELECT 'phonetics_phoneticslesson', COUNT(*) FROM phonetics_phoneticslesson
UNION ALL SELECT 'songs_songscourse', COUNT(*) FROM songs_songscourse
UNION ALL SELECT 'songs_songslesson', COUNT(*) FROM songs_songslesson
UNION ALL SELECT 'dictionary_word', COUNT(*) FROM dictionary_word
UNION ALL SELECT 'dictionary_wordtheme', COUNT(*) FROM dictionary_wordtheme
UNION ALL SELECT 'dictionary_wordthemerelation', COUNT(*) FROM dictionary_wordthemerelation
ORDER BY table_name;
EOF
```

## Cleanup

After successful migration:

```bash
# Remove temporary files
rm -rf /tmp/content-migration-*

# Optionally remove storagebox files (after verifying migration)
# rm -rf /srv/storagebox/content-migration
```

## Files Created

- `migrate-via-storagebox.sh` - Shell script for pg_dump/pg_restore approach
- `migrate-content-data-via-storagebox.py` - Python script for Django ORM approach
- `STORAGEBOX_MIGRATION_GUIDE.md` - This guide
