#!/usr/bin/env bash
set -euo pipefail

EXPECTED_APPROVAL='Approved to apply pending content-service Prisma migrations to the Kubernetes content database for base schema readiness and seven schema creation only, then run DB-backed no-write reconciliation. No seven data apply, deploy, object mutation, or legacy route retirement is approved.'
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_PREFIX="${REPORT_PREFIX:-/tmp/speakasap-seven}"
PORT="${CONTENT_DB_LOCAL_PORT:-15436}"

usage() {
  cat <<USAGE
Usage:
  SEVEN_SCHEMA_APPROVAL_TEXT="$EXPECTED_APPROVAL" $0 --execute

This script is intentionally write-gated. It refuses to run unless:
  - --execute is passed
  - SEVEN_SCHEMA_APPROVAL_TEXT exactly matches the expected schema-only approval wording

Scope:
  - apply pending content-service Prisma migrations to the Kubernetes content DB
  - run DB-backed no-write seven reconciliation immediately after schema apply
  - do not import seven rows, copy media, deploy services, change traffic, or retire legacy routes
USAGE
}

if [[ "${1:-}" != "--execute" ]]; then
  usage >&2
  exit 2
fi

if [[ "${SEVEN_SCHEMA_APPROVAL_TEXT:-}" != "$EXPECTED_APPROVAL" ]]; then
  echo "ERROR: SEVEN_SCHEMA_APPROVAL_TEXT does not exactly match the required schema-only approval wording." >&2
  usage >&2
  exit 2
fi

PF_LOG="${REPORT_PREFIX}-content-db-port-forward.log"
MIGRATE_LOG="${REPORT_PREFIX}-schema-migrate-deploy.log"
TARGET_REPORT="${REPORT_PREFIX}-dry-run-target-post-schema-v1.json"
RECONCILIATION_REPORT="${REPORT_PREFIX}-post-schema-reconciliation-v1.json"
EXECUTION_REPORT="${REPORT_PREFIX}-schema-apply-execution-v1.json"
APPROVAL_SHA256="$(printf '%s' "$SEVEN_SCHEMA_APPROVAL_TEXT" | sha256sum | awk '{print $1}')"
rm -f "$PF_LOG" "$MIGRATE_LOG" "$EXECUTION_REPORT"

kubectl -n statex-apps port-forward svc/db-server-postgres "${PORT}:5432" >"$PF_LOG" 2>&1 &
PF_PID=$!
cleanup() {
  kill "$PF_PID" >/dev/null 2>&1 || true
  wait "$PF_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for _ in $(seq 1 30); do
  if grep -q "Forwarding from" "$PF_LOG"; then
    break
  fi
  sleep 0.5
done

if ! grep -q "Forwarding from" "$PF_LOG"; then
  echo "ERROR: content DB port-forward did not become ready." >&2
  sed -n '1,120p' "$PF_LOG" >&2 || true
  exit 1
fi

DATABASE_URL="$(
  kubectl get secret speakasap-content-secret -n statex-apps -o jsonpath='{.data.DATABASE_URL}' \
    | base64 -d \
    | sed "s/@db-server-postgres:5432/@127.0.0.1:${PORT}/"
)"
export DATABASE_URL

cd "$ROOT_DIR/content-service"
npx prisma migrate deploy --schema prisma/schema.prisma 2>&1 | tee "$MIGRATE_LOG"

cd "$ROOT_DIR"
set +e
CONTENT_TARGET_DATABASE_URL="$DATABASE_URL" \
  content-service/scripts/migrate-seven-from-legacy.py \
  --check-target \
  --json-report "$TARGET_REPORT"
TARGET_REPORT_STATUS=$?
set -e
if [[ "$TARGET_REPORT_STATUS" -ne 0 && ! -s "$TARGET_REPORT" ]]; then
  echo "ERROR: post-schema target report failed before writing $TARGET_REPORT." >&2
  exit "$TARGET_REPORT_STATUS"
fi

content-service/scripts/check-seven-post-schema-reconciliation.py \
  --target-report "$TARGET_REPORT" \
  --json-report "$RECONCILIATION_REPORT"

export APPROVAL_SHA256 MIGRATE_LOG TARGET_REPORT RECONCILIATION_REPORT EXECUTION_REPORT
python3 -c 'import json, os
from datetime import datetime, timezone
from pathlib import Path
reconciliation_path = Path(os.environ["RECONCILIATION_REPORT"])
reconciliation = json.loads(reconciliation_path.read_text(encoding="utf-8"))
report = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "writes": True,
    "scope": "content-service schema migrations only",
    "approvalSha256": os.environ["APPROVAL_SHA256"],
    "migrateLog": os.environ["MIGRATE_LOG"],
    "targetReport": os.environ["TARGET_REPORT"],
    "reconciliationReport": os.environ["RECONCILIATION_REPORT"],
    "schemaReady": reconciliation.get("schemaReady"),
    "dataReady": reconciliation.get("dataReady"),
    "ok": reconciliation.get("ok") is True,
    "dataApplyApproved": False,
    "mediaMutationApproved": False,
    "deploymentApproved": False,
    "legacyRetirementApproved": False,
}
Path(os.environ["EXECUTION_REPORT"]).write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")'

echo "Schema apply and post-schema no-write reconciliation complete:"
echo "  migration log: $MIGRATE_LOG"
echo "  target report: $TARGET_REPORT"
echo "  reconciliation report: $RECONCILIATION_REPORT"
echo "  execution report: $EXECUTION_REPORT"
