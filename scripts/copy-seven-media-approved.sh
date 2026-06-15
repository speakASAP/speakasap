#!/usr/bin/env bash
set -euo pipefail

EXPECTED_APPROVAL='Approved to copy and route only public seven-course `/media/audio/...` and `/media/pdf/...` assets identified by `/tmp/speakasap-seven-media-copy-manifest-v3.json` from `https://speakasap.com` to the asset host serving `https://assets.alfares.cz/media/...`. No private media, unrelated media, destructive cleanup, final test migration, paid-product change, or legacy route retirement is approved.'
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${MEDIA_COPY_MANIFEST:-/tmp/speakasap-seven-media-copy-manifest-v3.json}"
TARGET_ROOT="${MEDIA_TARGET_ROOT:-}"
REPORT_PREFIX="${REPORT_PREFIX:-/tmp/speakasap-seven-media}"
ASSETS_BASE_URL="${ASSETS_BASE_URL:-https://assets.alfares.cz}"

usage() {
  cat <<USAGE
Usage:
  SEVEN_MEDIA_APPROVAL_TEXT="$EXPECTED_APPROVAL" \\
  MEDIA_COPY_MANIFEST=/tmp/speakasap-seven-media-copy-manifest-v3.json \\
  MEDIA_TARGET_ROOT=/absolute/path/served/by/assets-host \\
  $0 --execute

This script is intentionally write-gated. It refuses to run unless:
  - --execute is passed
  - SEVEN_MEDIA_APPROVAL_TEXT exactly matches the required media-only approval wording
  - MEDIA_COPY_MANIFEST exists and has writes=false, availableRefs=1212, missingRefs=0
  - MEDIA_TARGET_ROOT is an existing directory

Scope:
  - copy only manifest rows where ok=true and kind is audio/pdf
  - preserve target keys such as media/audio/... and media/pdf/...
  - run post-copy availability verification against ASSETS_BASE_URL
  - do not copy private media, delete files, deploy services, change paid products, or retire legacy routes
USAGE
}

if [[ "${1:-}" != "--execute" ]]; then
  usage >&2
  exit 2
fi

if [[ "${SEVEN_MEDIA_APPROVAL_TEXT:-}" != "$EXPECTED_APPROVAL" ]]; then
  echo "ERROR: SEVEN_MEDIA_APPROVAL_TEXT does not exactly match the required media-only approval wording." >&2
  usage >&2
  exit 2
fi

if [[ ! -f "$MANIFEST" ]]; then
  echo "ERROR: MEDIA_COPY_MANIFEST not found: $MANIFEST" >&2
  exit 2
fi

if [[ -z "$TARGET_ROOT" || ! -d "$TARGET_ROOT" ]]; then
  echo "ERROR: MEDIA_TARGET_ROOT must be an existing directory served by the asset host." >&2
  usage >&2
  exit 2
fi

MANIFEST_CHECK="${REPORT_PREFIX}-manifest-check-v1.json"
COPY_REPORT="${REPORT_PREFIX}-copy-execution-v1.json"
POSTCOPY_REPORT="${REPORT_PREFIX}-postcopy-v1.json"
APPROVAL_SHA256="$(printf '%s' "$SEVEN_MEDIA_APPROVAL_TEXT" | sha256sum | awk '{print $1}')"
export MANIFEST TARGET_ROOT MANIFEST_CHECK COPY_REPORT APPROVAL_SHA256

python3 -c 'import json, os, sys
from pathlib import Path
manifest = json.loads(Path(os.environ["MANIFEST"]).read_text(encoding="utf-8"))
summary = manifest.get("summary") or {}
if manifest.get("writes") is not False:
    print("ERROR: manifest must have writes=false", file=sys.stderr); sys.exit(2)
available_refs = int(summary.get("availableRefs", 0))
missing_refs = int(summary.get("missingRefs", -1))
if available_refs != 1212 or missing_refs != 0:
    print("ERROR: manifest must have availableRefs=1212 and missingRefs=0", file=sys.stderr); sys.exit(2)
rows = [row for row in manifest.get("available", []) if row.get("ok") is True and row.get("kind") in {"audio", "pdf"}]
if len(rows) != 1212:
    print(f"ERROR: expected 1212 audio/pdf rows, got {len(rows)}", file=sys.stderr); sys.exit(2)
Path(os.environ["MANIFEST_CHECK"]).write_text(json.dumps({"writes": False, "ok": True, "copyRows": len(rows)}, indent=2) + "\n", encoding="utf-8")'

python3 - "$MANIFEST" "$TARGET_ROOT" "$COPY_REPORT" "$APPROVAL_SHA256" <<'PY'
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

manifest_path, target_root, copy_report_path, approval_sha = sys.argv[1:5]
manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
rows = [row for row in manifest.get("available", []) if row.get("ok") is True and row.get("kind") in {"audio", "pdf"}]
copied = []
for row in rows:
    source_url = row.get("sourceUrl")
    target_key = str(row.get("targetKey") or "").lstrip("/")
    if not source_url or not target_key.startswith("media/"):
        raise SystemExit(f"invalid media row: {row!r}")
    destination = Path(target_root) / target_key
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["curl", "-fL", "--retry", "3", "--connect-timeout", "20", "-o", str(destination), source_url], check=True)
    copied.append({"ref": row.get("ref"), "sourceUrl": source_url, "targetKey": target_key, "bytes": destination.stat().st_size})

report = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "writes": True,
    "scope": "public seven-course audio/pdf media only",
    "approvalSha256": approval_sha,
    "manifest": manifest_path,
    "targetRoot": target_root,
    "copied": len(copied),
    "items": copied[:25],
    "dataApplyApproved": False,
    "deploymentApproved": False,
    "legacyRetirementApproved": False,
    "destructiveCleanupApproved": False,
    "ok": len(copied) == 1212,
}
Path(copy_report_path).write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
PY

cd "$ROOT_DIR"
content-service/scripts/check-seven-media-availability.py \
  --input-report /tmp/speakasap-seven-dry-run-v20.json \
  --base-url "$ASSETS_BASE_URL" \
  --json-report "$POSTCOPY_REPORT"

echo "Seven media copy complete:"
echo "  copy report: $COPY_REPORT"
echo "  post-copy availability report: $POSTCOPY_REPORT"
