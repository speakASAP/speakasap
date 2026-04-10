#!/usr/bin/env bash
# Destructive: drops all objects in the target Postgres public schema and reapplies Prisma migrations.
# Does not touch the legacy speakasap-portal database.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${SERVICE_ROOT}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL must be set (target content DB)." >&2
  exit 1
fi

read -r -p "Drop public schema on target DB and run prisma migrate deploy? [y/N] " confirm
if [[ "${confirm}" != "y" && "${confirm}" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npx prisma migrate deploy

echo "Rollback complete: empty schema + migrations reapplied."
