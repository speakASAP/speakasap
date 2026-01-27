#!/bin/bash
# Content Data Migration via Storagebox
# 
# This script migrates content data from legacy Django database to new Prisma database
# using storagebox as intermediate storage to avoid transferring large amounts of data
# directly between servers.
#
# Strategy:
# 1. Export specific tables from legacy database to SQL files on storagebox (run on speakasap)
# 2. Transform and import SQL files from storagebox to new database (run on statex)
#
# Usage:
#   On speakasap server: ./migrate-via-storagebox.sh export
#   On statex server: ./migrate-via-storagebox.sh import

set -e

STORAGEBOX_PATH="${STORAGEBOX_PATH:-/srv/storagebox}"
# Use /tmp first, then copy to storagebox (to avoid permission issues)
TEMP_DIR="/tmp/content-migration-$$"
MIGRATION_DIR="${STORAGEBOX_PATH}/content-migration"
LEGACY_DB_NAME="${LEGACY_DB_NAME:-portal_db}"
LEGACY_DB_USER="${LEGACY_DB_USER:-portal_db}"
NEW_DB_URL="${DATABASE_URL}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

export_data() {
    log_info "Exporting content data to storagebox..."
    log_info "Storagebox path: ${STORAGEBOX_PATH}"
    log_info "Migration directory: ${MIGRATION_DIR}"
    
    # Check storagebox is accessible
    if [ ! -d "${STORAGEBOX_PATH}" ]; then
        log_error "Storagebox path does not exist: ${STORAGEBOX_PATH}"
        exit 1
    fi
    
    # Create temp directory (will copy to storagebox after export)
    mkdir -p "${TEMP_DIR}"
    
    # Tables to export (in dependency order)
    TABLES=(
        "language_language"
        "grammar_grammarcourse"
        "grammar_grammarlesson"
        "phonetics_phoneticscourse"
        "phonetics_phoneticslesson"
        "songs_songscourse"
        "songs_songslesson"
        "dictionary_word"
        "dictionary_wordtheme"
        "dictionary_wordthemerelation"
    )
    
    log_info "Exporting ${#TABLES[@]} tables..."
    
    for table in "${TABLES[@]}"; do
        log_info "Exporting ${table}..."
        pg_dump -U "${LEGACY_DB_USER}" -d "${LEGACY_DB_NAME}" \
            --table="${table}" \
            --data-only \
            --column-inserts \
            --no-owner \
            --no-privileges \
            > "${TEMP_DIR}/${table}.sql" 2>&1
        
        if [ $? -eq 0 ]; then
            SIZE=$(du -h "${TEMP_DIR}/${table}.sql" | cut -f1)
            log_info "  ✓ Exported ${table} (${SIZE})"
        else
            log_error "  ✗ Failed to export ${table}"
            exit 1
        fi
    done
    
    # Copy to storagebox (try with sudo if needed)
    log_info "Copying files to storagebox..."
    if mkdir -p "${MIGRATION_DIR}" 2>/dev/null; then
        cp -r "${TEMP_DIR}"/* "${MIGRATION_DIR}/"
        log_info "  ✓ Copied to ${MIGRATION_DIR}"
    else
        log_warn "  ⚠ Cannot write to ${MIGRATION_DIR} (permission denied)"
        log_warn "  Files are in ${TEMP_DIR}"
        log_warn "  Please copy manually or run with sudo"
        log_info "  To copy manually: sudo cp -r ${TEMP_DIR}/* ${MIGRATION_DIR}/"
    fi
    
    log_info "Export completed. Files saved to: ${MIGRATION_DIR}"
    log_info "Total size: $(du -sh ${TEMP_DIR} | cut -f1)"
}

import_data() {
    log_info "Importing content data from storagebox..."
    log_info "Storagebox path: ${STORAGEBOX_PATH}"
    log_info "Migration directory: ${MIGRATION_DIR}"
    
    if [ -z "${NEW_DB_URL}" ]; then
        log_error "DATABASE_URL environment variable required"
        exit 1
    fi
    
    # Check migration directory exists
    if [ ! -d "${MIGRATION_DIR}" ]; then
        log_error "Migration directory does not exist: ${MIGRATION_DIR}"
        log_error "Please run export step first on speakasap server"
        exit 1
    fi
    
    # Parse DATABASE_URL
    # Format: postgresql://user:password@host:port/database
    DB_USER=$(echo "${NEW_DB_URL}" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_PASS=$(echo "${NEW_DB_URL}" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    DB_HOST=$(echo "${NEW_DB_URL}" | sed -n 's|.*@\([^:]*\):.*|\1|p')
    DB_PORT=$(echo "${NEW_DB_URL}" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
    DB_NAME=$(echo "${NEW_DB_URL}" | sed -n 's|.*/\([^?]*\).*|\1|p')
    
    # URL decode password if needed
    DB_PASS=$(echo "${DB_PASS}" | sed 's|%2F|/|g' | sed 's|%3D|=|g')
    
    log_info "Connecting to database: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
    
    # Import in correct order to preserve referential integrity
    IMPORT_ORDER=(
        "language_language"
        "grammar_grammarcourse"
        "grammar_grammarlesson"
        "phonetics_phoneticscourse"
        "phonetics_phoneticslesson"
        "songs_songscourse"
        "songs_songslesson"
        "dictionary_word"
        "dictionary_wordtheme"
        "dictionary_wordthemerelation"
    )
    
    # Set PGPASSWORD for psql
    export PGPASSWORD="${DB_PASS}"
    
    log_info "Importing ${#IMPORT_ORDER[@]} tables..."
    
    for table in "${IMPORT_ORDER[@]}"; do
        SQL_FILE="${MIGRATION_DIR}/${table}.sql"
        
        if [ ! -f "${SQL_FILE}" ]; then
            log_warn "  ⚠ SQL file not found: ${SQL_FILE}"
            continue
        fi
        
        log_info "Importing ${table}..."
        
        # Transform table name and column names from Django to Prisma format
        # This is a simplified transformation - you may need to adjust based on actual schema
        TEMP_FILE=$(mktemp)
        
        # Basic transformations
        sed -e 's/language_language/"Language"/g' \
            -e 's/grammar_grammarcourse/"GrammarCourse"/g' \
            -e 's/grammar_grammarlesson/"GrammarLesson"/g' \
            -e 's/phonetics_phoneticscourse/"PhoneticsCourse"/g' \
            -e 's/phonetics_phoneticslesson/"PhoneticsLesson"/g' \
            -e 's/songs_songscourse/"SongsCourse"/g' \
            -e 's/songs_songslesson/"SongsLesson"/g' \
            -e 's/dictionary_word/"Word"/g' \
            -e 's/dictionary_wordtheme/"WordTheme"/g' \
            -e 's/dictionary_wordthemerelation/"WordThemeRelation"/g' \
            "${SQL_FILE}" > "${TEMP_FILE}"
        
        # Import using psql
        psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
            -f "${TEMP_FILE}" > /dev/null 2>&1
        
        if [ $? -eq 0 ]; then
            log_info "  ✓ Imported ${table}"
        else
            log_error "  ✗ Failed to import ${table}"
            # Continue with other tables
        fi
        
        rm -f "${TEMP_FILE}"
    done
    
    log_info "Import completed!"
    
    # Validate import
    log_info "Validating import..."
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" <<EOF
SELECT 
    'Language' as table_name, COUNT(*) as count FROM "Language"
UNION ALL
SELECT 'GrammarCourse', COUNT(*) FROM "GrammarCourse"
UNION ALL
SELECT 'GrammarLesson', COUNT(*) FROM "GrammarLesson"
UNION ALL
SELECT 'PhoneticsCourse', COUNT(*) FROM "PhoneticsCourse"
UNION ALL
SELECT 'PhoneticsLesson', COUNT(*) FROM "PhoneticsLesson"
UNION ALL
SELECT 'SongsCourse', COUNT(*) FROM "SongsCourse"
UNION ALL
SELECT 'SongsLesson', COUNT(*) FROM "SongsLesson"
UNION ALL
SELECT 'Word', COUNT(*) FROM "Word"
UNION ALL
SELECT 'WordTheme', COUNT(*) FROM "WordTheme"
UNION ALL
SELECT 'WordThemeRelation', COUNT(*) FROM "WordThemeRelation"
ORDER BY table_name;
EOF
    
    unset PGPASSWORD
}

case "${1}" in
    export)
        export_data
        ;;
    import)
        import_data
        ;;
    *)
        echo "Usage: $0 {export|import}"
        echo ""
        echo "  export  - Export data from legacy database to storagebox (run on speakasap)"
        echo "  import  - Import data from storagebox to new database (run on statex)"
        echo ""
        echo "Environment variables:"
        echo "  STORAGEBOX_PATH  - Path to storagebox mount (default: /srv/storagebox)"
        echo "  LEGACY_DB_NAME   - Legacy database name (default: portal_db)"
        echo "  LEGACY_DB_USER   - Legacy database user (default: portal_db)"
        echo "  DATABASE_URL     - New database connection string (required for import)"
        exit 1
        ;;
esac
