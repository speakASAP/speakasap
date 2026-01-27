# Content Migration via Storagebox - Status

## Implementation Complete ✅

Two migration approaches have been implemented to handle large database migration via storagebox:

### 1. Shell Script Approach (`migrate-via-storagebox.sh`)

**Status:** ✅ Created, needs authentication setup

**Location:**
- speakasap: `/home/portal_db/speakasap-portal/migrate-via-storagebox.sh`
- statex: `/home/statex/speakasap/migrate-via-storagebox.sh`

**Usage:**
```bash
# On speakasap (export)
./migrate-via-storagebox.sh export

# On statex (import)
export DATABASE_URL="postgresql://..."
./migrate-via-storagebox.sh import
```

**Issue:** pg_dump requires password authentication. Need to set up `.pgpass` file or use peer authentication.

**Fix needed:**
```bash
# On speakasap, create .pgpass file
echo "localhost:5432:portal_db:portal_db:password" > ~/.pgpass
chmod 600 ~/.pgpass
```

### 2. Python Script Approach (`migrate-content-data-via-storagebox.py`)

**Status:** ✅ Created, ready to use

**Location:** `speakasap/content-service/scripts/migrate-content-data-via-storagebox.py`

**Usage:**
```bash
# On speakasap (export)
cd /home/portal_db/speakasap-portal
export DJANGO_SETTINGS_MODULE=portal.settings
export STORAGEBOX_PATH=/srv/storagebox
python3.4 migrate-content-data-via-storagebox.py --dry-run  # Test first
python3.4 migrate-content-data-via-storagebox.py  # Actual export

# On statex (import)
cd /home/statex/speakasap
export DATABASE_URL="postgresql://..."
export STORAGEBOX_PATH=/srv/storagebox
python3 migrate-content-data-via-storagebox.py --dry-run  # Test first
python3 migrate-content-data-via-storagebox.py  # Actual import
```

**Advantages:**
- Uses Django ORM (no password needed for legacy DB)
- Handles data transformation automatically
- Better error handling and logging

## Recommended Approach

**Use Python script approach** (`migrate-content-data-via-storagebox.py`) because:
1. ✅ No password authentication needed (uses Django settings)
2. ✅ Handles data transformation (Django → Prisma format)
3. ✅ Better error handling
4. ✅ More detailed logging

## Next Steps

1. **Copy Python script to speakasap server:**
   ```bash
   scp migrate-content-data-via-storagebox.py speakasap:/home/portal_db/speakasap-portal/
   ```

2. **Run export on speakasap:**
   ```bash
   ssh speakasap
   cd speakasap-portal
   export DJANGO_SETTINGS_MODULE=portal.settings
   export STORAGEBOX_PATH=/srv/storagebox
   python3.4 migrate-content-data-via-storagebox.py --dry-run
   python3.4 migrate-content-data-via-storagebox.py
   ```

3. **Copy Python script to statex server:**
   ```bash
   scp migrate-content-data-via-storagebox.py statex:/home/statex/speakasap/
   ```

4. **Run import on statex:**
   ```bash
   ssh statex
   cd speakasap
   export DATABASE_URL="postgresql://dbadmin:...@db-server-postgres:5432/speakasap_content_db"
   export STORAGEBOX_PATH=/srv/storagebox
   python3 migrate-content-data-via-storagebox.py --dry-run
   python3 migrate-content-data-via-storagebox.py
   ```

## Files Created

- ✅ `migrate-via-storagebox.sh` - Shell script (needs .pgpass setup)
- ✅ `migrate-content-data-via-storagebox.py` - Python script (recommended)
- ✅ `STORAGEBOX_MIGRATION_GUIDE.md` - Complete guide
- ✅ `migrate-content-data.py` - Original direct migration script (for reference)

## Storagebox Paths

- **speakasap:** `/srv/storagebox` (may need sudo for write)
- **statex:** `/srv/storagebox` (writable by statex user)
- **Migration directory:** `/srv/storagebox/content-migration/`

## Data Size Estimate

Based on dry-run:
- Languages: 19 records
- Grammar Courses: 19 records
- Grammar Lessons: 522 records
- Phonetics Courses: 2 records
- Phonetics Lessons: 20 records
- Songs Courses: 8 records
- Songs Lessons: 137 records
- Words: 20,878 records
- Word Themes: 1,138 records
- Word Theme Relations: 32,716 records

**Total:** ~55,000 records

**Estimated export size:** 50-200 MB (depending on text content)
