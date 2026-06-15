#!/usr/bin/env bash
set -euo pipefail

EXPECTED_APPROVAL='Approved to run the seven content data apply against the Kubernetes content database with `--include-languages`, importing only the 19 language rows, 19 seven courses, 136 seven lessons, and 429 seven exercises from the legacy portal evidence. No deployment, object mutation, media copy, final test migration, private progress migration, paid-product change, or legacy route retirement is approved.'
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_PREFIX="${REPORT_PREFIX:-/tmp/speakasap-seven-content}"
PORT="${CONTENT_DB_LOCAL_PORT:-15442}"
SCHEMA_RECONCILIATION_REPORT="${SCHEMA_RECONCILIATION_REPORT:-/tmp/speakasap-seven-post-schema-reconciliation-v1.json}"
ROLLBACK_PLAN="${ROLLBACK_PLAN:-/tmp/speakasap-seven-content-rollback-v1.sql}"

usage() {
  cat <<USAGE
Usage:
  SEVEN_DATA_APPROVAL_TEXT="$EXPECTED_APPROVAL" \\
  SCHEMA_RECONCILIATION_REPORT=/tmp/speakasap-seven-post-schema-reconciliation-v1.json \\
  ROLLBACK_PLAN=/tmp/speakasap-seven-content-rollback-v1.sql \\
  $0 --execute

This script is intentionally write-gated. It refuses to run unless:
  - --execute is passed
  - SEVEN_DATA_APPROVAL_TEXT exactly matches the required data-only approval wording
  - SCHEMA_RECONCILIATION_REPORT exists and has schemaReady=true
  - ROLLBACK_PLAN is set

Scope:
  - apply only the seven public content rows with --include-languages
  - generate rollback SQL before writes
  - run DB-backed no-write reconciliation after apply
  - do not deploy, copy media, change traffic, migrate private progress, alter paid products, or retire legacy routes
USAGE
}

if [[ "${1:-}" != "--execute" ]]; then
  usage >&2
  exit 2
fi

if [[ "${SEVEN_DATA_APPROVAL_TEXT:-}" != "$EXPECTED_APPROVAL" ]]; then
  echo "ERROR: SEVEN_DATA_APPROVAL_TEXT does not exactly match the required data-only approval wording." >&2
  usage >&2
  exit 2
fi

if [[ -z "$ROLLBACK_PLAN" ]]; then
  echo "ERROR: ROLLBACK_PLAN is required." >&2
  usage >&2
  exit 2
fi

if [[ ! -f "$SCHEMA_RECONCILIATION_REPORT" ]]; then
  echo "ERROR: SCHEMA_RECONCILIATION_REPORT not found: $SCHEMA_RECONCILIATION_REPORT" >&2
  exit 2
fi

python3 - "$SCHEMA_RECONCILIATION_REPORT" <<'PY'
import json
import sys
from pathlib import Path

report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
if report.get("writes") is not False or report.get("schemaReady") is not True or report.get("ok") is not True:
    print("ERROR: schema reconciliation report must have writes=false, schemaReady=true, ok=true.", file=sys.stderr)
    sys.exit(2)
PY

PF_LOG="${REPORT_PREFIX}-db-port-forward.log"
APPLY_REPORT="${REPORT_PREFIX}-apply-v1.json"
POST_APPLY_REPORT="${REPORT_PREFIX}-post-apply-v1.json"
EXECUTION_REPORT="${REPORT_PREFIX}-apply-execution-v1.json"
APPROVAL_SHA256="$(printf '%s' "$SEVEN_DATA_APPROVAL_TEXT" | sha256sum | awk '{print $1}')"
rm -f "$PF_LOG" "$APPLY_REPORT" "$POST_APPLY_REPORT" "$EXECUTION_REPORT"

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

CONTENT_TARGET_DATABASE_URL="$(
  kubectl get secret speakasap-content-secret -n statex-apps -o jsonpath='{.data.DATABASE_URL}' \
    | base64 -d \
    | sed "s/@db-server-postgres:5432/@127.0.0.1:${PORT}/"
)"
export CONTENT_TARGET_DATABASE_URL

cd "$ROOT_DIR"
content-service/scripts/migrate-seven-from-legacy.py \
  --check-target \
  --apply \
  --include-languages \
  --confirm-write \
  --approval-note "$SEVEN_DATA_APPROVAL_TEXT" \
  --rollback-plan "$ROLLBACK_PLAN" \
  --json-report "$APPLY_REPORT"

content-service/scripts/migrate-seven-from-legacy.py \
  --check-target \
  --json-report "$POST_APPLY_REPORT"

export APPROVAL_SHA256 SCHEMA_RECONCILIATION_REPORT ROLLBACK_PLAN APPLY_REPORT POST_APPLY_REPORT EXECUTION_REPORT
python3 -c 'import json, os
from datetime import datetime, timezone
from pathlib import Path
post_apply = json.loads(Path(os.environ["POST_APPLY_REPORT"]).read_text(encoding="utf-8"))
report = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "writes": True,
    "scope": "seven public content data only",
    "approvalSha256": os.environ["APPROVAL_SHA256"],
    "schemaReconciliationReport": os.environ["SCHEMA_RECONCILIATION_REPORT"],
    "rollbackPlan": os.environ["ROLLBACK_PLAN"],
    "applyReport": os.environ["APPLY_REPORT"],
    "postApplyReport": os.environ["POST_APPLY_REPORT"],
    "targetChecked": (post_apply.get("target") or {}).get("checked"),
    "blockingIssues": post_apply.get("blockingIssues") or [],
    "ok": post_apply.get("writes") is False and not post_apply.get("blockingIssues"),
    "mediaMutationApproved": False,
    "deploymentApproved": False,
    "legacyRetirementApproved": False,
}
Path(os.environ["EXECUTION_REPORT"]).write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")'

echo "Seven data apply and post-apply no-write reconciliation complete:"
echo "  rollback plan: $ROLLBACK_PLAN"
echo "  apply report: $APPLY_REPORT"
echo "  post-apply report: $POST_APPLY_REPORT"
echo "  execution report: $EXECUTION_REPORT"
