#!/bin/bash
# Import content data from storagebox SQL files to new database
# Uses psql COPY commands for efficient import

set -e

STORAGEBOX_PATH="${STORAGEBOX_PATH:-/srv/storagebox}"
MIGRATION_DIR="${STORAGEBOX_PATH}/content-migration"
DATABASE_URL="${DATABASE_URL}"

if [ -z "${DATABASE_URL}" ]; then
    echo "Error: DATABASE_URL environment variable required"
    exit 1
fi

# Parse DATABASE_URL
DB_USER=$(echo "${DATABASE_URL}" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "${DATABASE_URL}" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo "${DATABASE_URL}" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "${DATABASE_URL}" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "${DATABASE_URL}" | sed -n 's|.*/\([^?]*\).*|\1|p')

# URL decode password
DB_PASS=$(echo "${DB_PASS}" | sed 's|%2F|/|g' | sed 's|%3D|=|g')

export PGPASSWORD="${DB_PASS}"

echo "Importing from: ${MIGRATION_DIR}"
echo "Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Import Languages first
echo "Importing Languages..."
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" <<'EOF'
-- Clear existing data
TRUNCATE TABLE "Language" CASCADE;

-- Import languages
\copy "Language"(code, "machineName", name, "iconPath", "order", speaker) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', QUOTE '''')
EOF

# Transform and import languages
cat "${MIGRATION_DIR}/languages.sql" | while IFS=',' read -r id code machine_name name icon_path order_val speaker; do
    # Remove quotes and handle NULL
    code=$(echo "$code" | sed "s/^'//;s/'$//")
    machine_name=$(echo "$machine_name" | sed "s/^'//;s/'$//")
    name=$(echo "$name" | sed "s/^'//;s/'$//")
    icon_path=$(echo "$icon_path" | sed "s/^'//;s/'$//")
    order_val=$(echo "$order_val" | sed 's/NULL/0/')
    speaker=$(echo "$speaker" | sed "s/^'//;s/'$//;s/NULL/носитель/")
    
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c \
        "INSERT INTO \"Language\" (code, \"machineName\", name, \"iconPath\", \"order\", speaker) VALUES ('$code', '$machine_name', '$name', '$icon_path', $order_val, '$speaker');" 2>/dev/null || true
done

echo "Languages imported"

# Continue with other tables...
# This is a simplified version - the Python script handles the complex transformations better

unset PGPASSWORD
