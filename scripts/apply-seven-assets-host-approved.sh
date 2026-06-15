#!/usr/bin/env bash
set -euo pipefail

EXPECTED_APPROVAL='Approved to create only the isolated speakasap-assets static Kubernetes service and ingress for assets.alfares.cz backed by /home/ssf/speakasap-assets. No database writes, no existing SpeakASAP service restarts, no media copy, no destructive cleanup, no paid-product change, and no legacy route retirement are approved.'
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${ASSETS_HOST_MANIFEST:-k8s/services/assets-service.yaml}"
TARGET_ROOT="${MEDIA_TARGET_ROOT:-/home/ssf/speakasap-assets}"
REPORT_PREFIX="${REPORT_PREFIX:-/tmp/speakasap-seven-assets-host}"
ASSETS_BASE_URL="${ASSETS_BASE_URL:-https://assets.alfares.cz}"

usage() {
  cat <<USAGE
Usage:
  SEVEN_ASSETS_HOST_APPROVAL_TEXT="$EXPECTED_APPROVAL" \\
  MEDIA_TARGET_ROOT=/home/ssf/speakasap-assets \\
  $0 --execute

This operator is intentionally write-gated. It refuses to run unless:
  - --execute is passed
  - SEVEN_ASSETS_HOST_APPROVAL_TEXT exactly matches the required assets-host approval wording

Scope:
  - create or reuse only MEDIA_TARGET_ROOT
  - apply only k8s/services/assets-service.yaml
  - wait only deployment/speakasap-assets
  - verify only assets.alfares.cz health/root responses
  - do not copy media, deploy application services, write databases, or retire legacy routes
USAGE
}

if [[ "${1:-}" != "--execute" ]]; then
  usage >&2
  exit 2
fi

if [[ "${SEVEN_ASSETS_HOST_APPROVAL_TEXT:-}" != "$EXPECTED_APPROVAL" ]]; then
  echo "ERROR: SEVEN_ASSETS_HOST_APPROVAL_TEXT does not exactly match the required assets-host approval wording." >&2
  usage >&2
  exit 2
fi

cd "$ROOT_DIR"

if [[ ! -f "$MANIFEST" ]]; then
  echo "ERROR: assets host manifest not found: $MANIFEST" >&2
  exit 2
fi

if [[ "$TARGET_ROOT" != "/home/ssf/speakasap-assets" ]]; then
  echo "ERROR: MEDIA_TARGET_ROOT must remain /home/ssf/speakasap-assets for this approved assets host." >&2
  exit 2
fi

APPROVAL_SHA256="$(printf '%s' "$SEVEN_ASSETS_HOST_APPROVAL_TEXT" | sha256sum | awk '{print $1}')"
PRECHECK_REPORT="${REPORT_PREFIX}-precheck-v1.json"
DRY_RUN_REPORT="${REPORT_PREFIX}-dry-run-v1.json"
EXECUTION_REPORT="${REPORT_PREFIX}-execution-v1.json"
VERIFY_REPORT="${REPORT_PREFIX}-verify-v1.json"

export MANIFEST TARGET_ROOT PRECHECK_REPORT DRY_RUN_REPORT EXECUTION_REPORT VERIFY_REPORT APPROVAL_SHA256 ASSETS_BASE_URL

python3 - <<'PY'
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

manifest_path = Path(os.environ["MANIFEST"])
manifest = manifest_path.read_text(encoding="utf-8")
checks = {
    "writes": False,
    "manifest": str(manifest_path),
    "targetRoot": os.environ["TARGET_ROOT"],
    "hasSingleDeployment": len(re.findall(r"^kind: Deployment$", manifest, re.MULTILINE)) == 1,
    "hasSingleService": len(re.findall(r"^kind: Service$", manifest, re.MULTILINE)) == 1,
    "hasSingleIngress": len(re.findall(r"^kind: Ingress$", manifest, re.MULTILINE)) == 1,
    "deploymentName": "name: speakasap-assets" in manifest,
    "serviceName": "name: speakasap-assets" in manifest,
    "host": "assets.alfares.cz" in manifest,
    "hostPath": "path: /home/ssf/speakasap-assets" in manifest,
    "readOnlyMount": "readOnly: true" in manifest,
    "servesMediaOnly": "location /media/" in manifest and "return 404" in manifest,
    "doesNotMentionApplicationServices": all(value not in manifest for value in ["speakasap-content", "speakasap-api-gateway", "speakasap-frontend"]),
}
failed = [key for key, value in checks.items() if key != "writes" and value is False]
report = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    **checks,
    "failedChecks": failed,
    "ok": not failed,
}
Path(os.environ["PRECHECK_REPORT"]).write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
if failed:
    raise SystemExit("assets host precheck failed: " + ", ".join(failed))
PY

kubectl apply --dry-run=server -f "$MANIFEST" -n statex-apps -o json > "$DRY_RUN_REPORT"

mkdir -p "$TARGET_ROOT/media/.well-known"
printf 'ok\n' > "$TARGET_ROOT/media/.well-known/health.txt"

kubectl apply -f "$MANIFEST" -n statex-apps
kubectl rollout status deployment/speakasap-assets -n statex-apps --timeout=180s

python3 - <<'PY'
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

base = os.environ["ASSETS_BASE_URL"].rstrip("/")
urls = {
    "root": base + "/",
    "health": base + "/media/.well-known/health.txt",
    "missingMedia": base + "/media/__missing-seven-assets-probe__.txt",
}
results = {}
for name, url in urls.items():
    request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "curl/8.5.0"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            results[name] = {"url": url, "status": response.status}
    except urllib.error.HTTPError as exc:
        results[name] = {"url": url, "status": exc.code}
report = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "writes": False,
    "assetsBaseUrl": base,
    "results": results,
    "ok": results.get("root", {}).get("status") == 404
    and results.get("health", {}).get("status") == 200
    and results.get("missingMedia", {}).get("status") == 404,
}
Path(os.environ["VERIFY_REPORT"]).write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
if not report["ok"]:
    raise SystemExit("assets host verification failed")
PY

python3 - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

verify = json.loads(Path(os.environ["VERIFY_REPORT"]).read_text(encoding="utf-8"))
report = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "writes": True,
    "scope": "isolated static assets host for seven public media",
    "approvalSha256": os.environ["APPROVAL_SHA256"],
    "manifest": os.environ["MANIFEST"],
    "targetRoot": os.environ["TARGET_ROOT"],
    "precheckReport": os.environ["PRECHECK_REPORT"],
    "dryRunReport": os.environ["DRY_RUN_REPORT"],
    "verifyReport": os.environ["VERIFY_REPORT"],
    "ok": verify.get("ok") is True,
    "databaseWrites": False,
    "existingSpeakASAPServiceRestarts": False,
    "mediaCopyApproved": False,
    "deploymentApproved": False,
    "legacyRetirementApproved": False,
}
Path(os.environ["EXECUTION_REPORT"]).write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
PY

echo "Seven assets host ready:"
echo "  precheck report: $PRECHECK_REPORT"
echo "  dry-run report: $DRY_RUN_REPORT"
echo "  verify report: $VERIFY_REPORT"
echo "  execution report: $EXECUTION_REPORT"
