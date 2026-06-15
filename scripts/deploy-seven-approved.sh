#!/usr/bin/env bash
set -euo pipefail

EXPECTED_APPROVAL='Approved to deploy only the seven-course content-service, api-gateway, and frontend changes to Kubernetes after schema/data/media gates are complete, then run the seven deployment smoke and browser typography QA. Do not restart unrelated SpeakASAP services and do not run data/media rollback or legacy route retirement.'
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_PREFIX="${REPORT_PREFIX:-/tmp/speakasap-seven-deploy}"
SCHEMA_EXECUTION_REPORT="${SCHEMA_EXECUTION_REPORT:-/tmp/speakasap-seven-schema-apply-execution-v1.json}"
DATA_EXECUTION_REPORT="${DATA_EXECUTION_REPORT:-/tmp/speakasap-seven-content-apply-execution-v1.json}"
MEDIA_EXECUTION_REPORT="${MEDIA_EXECUTION_REPORT:-/tmp/speakasap-seven-media-copy-execution-v1.json}"
BASE_URL="${BASE_URL:-https://speakasap.alfares.cz}"
ASSETS_BASE_URL="${ASSETS_BASE_URL:-https://assets.alfares.cz}"
CONTENT_IMAGE="${CONTENT_IMAGE:-localhost:5000/speakasap-content:latest}"
GATEWAY_IMAGE="${GATEWAY_IMAGE:-localhost:5000/speakasap-api-gateway:latest}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-localhost:5000/speakasap-frontend:latest}"

usage() {
  cat <<USAGE
Usage:
  SEVEN_DEPLOY_APPROVAL_TEXT="$EXPECTED_APPROVAL" \\
  SCHEMA_EXECUTION_REPORT=/tmp/speakasap-seven-schema-apply-execution-v1.json \\
  DATA_EXECUTION_REPORT=/tmp/speakasap-seven-content-apply-execution-v1.json \\
  MEDIA_EXECUTION_REPORT=/tmp/speakasap-seven-media-copy-execution-v1.json \\
  $0 --execute

This script is intentionally write-gated. It refuses to run unless:
  - --execute is passed
  - SEVEN_DEPLOY_APPROVAL_TEXT exactly matches the required deployment-only approval wording
  - schema/data/media execution reports exist and have ok=true

Scope:
  - build/push only speakasap-content, speakasap-api-gateway, and speakasap-frontend
  - apply only scoped service manifests plus ingress
  - restart/status only scoped deployments
  - run seven deployment smoke
  - do not run root scripts/deploy.sh, data/media rollback, or legacy route retirement
USAGE
}

if [[ "${1:-}" != "--execute" ]]; then
  usage >&2
  exit 2
fi

if [[ "${SEVEN_DEPLOY_APPROVAL_TEXT:-}" != "$EXPECTED_APPROVAL" ]]; then
  echo "ERROR: SEVEN_DEPLOY_APPROVAL_TEXT does not exactly match the required deployment-only approval wording." >&2
  usage >&2
  exit 2
fi

python3 - "$SCHEMA_EXECUTION_REPORT" "$DATA_EXECUTION_REPORT" "$MEDIA_EXECUTION_REPORT" <<'PY'
import json
import sys
from pathlib import Path

for path in sys.argv[1:]:
    p = Path(path)
    if not p.exists():
        print(f"ERROR: required execution report not found: {path}", file=sys.stderr)
        sys.exit(2)
    report = json.loads(p.read_text(encoding="utf-8"))
    if report.get("ok") is not True:
        print(f"ERROR: execution report is not ok: {path}", file=sys.stderr)
        sys.exit(2)
PY

cd "$ROOT_DIR"
PREDEPLOY_REPORT="${REPORT_PREFIX}-predeploy-images-v1.json"
SMOKE_REPORT="${REPORT_PREFIX}-smoke-v1.json"
EXECUTION_REPORT="${REPORT_PREFIX}-execution-v1.json"
APPROVAL_SHA256="$(printf '%s' "$SEVEN_DEPLOY_APPROVAL_TEXT" | sha256sum | awk '{print $1}')"
CURRENT_STAGE="predeploy"

write_execution_report() {
  local deploy_ok="$1"
  local failure_stage="${2:-}"
  local exit_code="${3:-0}"
  export APPROVAL_SHA256 SCHEMA_EXECUTION_REPORT DATA_EXECUTION_REPORT MEDIA_EXECUTION_REPORT PREDEPLOY_REPORT SMOKE_REPORT EXECUTION_REPORT CONTENT_IMAGE GATEWAY_IMAGE FRONTEND_IMAGE deploy_ok failure_stage exit_code
  python3 - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

smoke_path = Path(os.environ["SMOKE_REPORT"])
smoke = json.loads(smoke_path.read_text(encoding="utf-8")) if smoke_path.exists() else {}
deploy_ok = os.environ["deploy_ok"] == "true"
report = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "writes": True,
    "scope": "seven scoped content/api-gateway/frontend deployment only",
    "approvalSha256": os.environ["APPROVAL_SHA256"],
    "schemaExecutionReport": os.environ["SCHEMA_EXECUTION_REPORT"],
    "dataExecutionReport": os.environ["DATA_EXECUTION_REPORT"],
    "mediaExecutionReport": os.environ["MEDIA_EXECUTION_REPORT"],
    "predeployReport": os.environ["PREDEPLOY_REPORT"],
    "smokeReport": os.environ["SMOKE_REPORT"],
    "contentImage": os.environ["CONTENT_IMAGE"],
    "gatewayImage": os.environ["GATEWAY_IMAGE"],
    "frontendImage": os.environ["FRONTEND_IMAGE"],
    "ok": deploy_ok and smoke.get("ok") is True,
    "failureStage": os.environ.get("failure_stage") or None,
    "exitCode": int(os.environ.get("exit_code") or "0"),
    "smokeOk": smoke.get("ok") if smoke else None,
    "dataRollbackApproved": False,
    "mediaRollbackApproved": False,
    "legacyRetirementApproved": False,
}
Path(os.environ["EXECUTION_REPORT"]).write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
PY
}

deploy_failed() {
  local exit_code="$?"
  set +e
  write_execution_report false "$CURRENT_STAGE" "$exit_code" || true
  echo "Seven scoped deployment failed at stage: $CURRENT_STAGE" >&2
  echo "  execution report: $EXECUTION_REPORT" >&2
  exit "$exit_code"
}

trap deploy_failed ERR

kubectl get deployment speakasap-content speakasap-api-gateway speakasap-frontend -n statex-apps \
  -o json > "$PREDEPLOY_REPORT"

CURRENT_STAGE="content-image-build"
docker build -f content-service/Dockerfile -t "$CONTENT_IMAGE" content-service
CURRENT_STAGE="content-image-push"
docker push "$CONTENT_IMAGE"

CURRENT_STAGE="api-gateway-image-build"
docker build -f api-gateway/Dockerfile -t "$GATEWAY_IMAGE" api-gateway
CURRENT_STAGE="api-gateway-image-push"
docker push "$GATEWAY_IMAGE"

CURRENT_STAGE="frontend-deploy"
IMAGE="$FRONTEND_IMAGE" PUBLIC_URL="$BASE_URL" ./scripts/deploy-frontend.sh

CURRENT_STAGE="manifest-apply"
kubectl apply -f k8s/services/content-service.yaml -n statex-apps
kubectl apply -f k8s/services/api-gateway.yaml -n statex-apps
kubectl apply -f k8s/services/frontend.yaml -n statex-apps
kubectl apply -f k8s/ingress.yaml -n statex-apps

CURRENT_STAGE="rollout-restart"
kubectl rollout restart deployment/speakasap-content -n statex-apps
kubectl rollout restart deployment/speakasap-api-gateway -n statex-apps
kubectl rollout restart deployment/speakasap-frontend -n statex-apps

CURRENT_STAGE="rollout-status"
kubectl rollout status deployment/speakasap-content -n statex-apps --timeout=180s
kubectl rollout status deployment/speakasap-api-gateway -n statex-apps --timeout=180s
kubectl rollout status deployment/speakasap-frontend -n statex-apps --timeout=180s

CURRENT_STAGE="deployment-smoke"
scripts/check-seven-deployment-smoke.py \
  --base-url "$BASE_URL" \
  --assets-base-url "$ASSETS_BASE_URL" \
  --language-code en \
  --lesson-order 1 \
  --json-report "$SMOKE_REPORT"

trap - ERR
CURRENT_STAGE="execution-report"
write_execution_report true "" 0

echo "Seven scoped deployment complete:"
echo "  predeploy report: $PREDEPLOY_REPORT"
echo "  smoke report: $SMOKE_REPORT"
echo "  execution report: $EXECUTION_REPORT"
