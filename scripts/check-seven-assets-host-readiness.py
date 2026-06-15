#!/usr/bin/env python3
"""No-write readiness check for the isolated seven-course assets host."""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


MANIFEST = Path("k8s/services/assets-service.yaml")
OPERATOR = Path("scripts/apply-seven-assets-host-approved.sh")
EXPECTED_TARGET_ROOT = "/home/ssf/speakasap-assets"
EXPECTED_HOST = "assets.alfares.cz"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def kind_count(manifest: str, kind: str) -> int:
    return len(re.findall(rf"^kind:\s+{re.escape(kind)}\s*$", manifest, re.MULTILINE))


def main() -> int:
    parser = argparse.ArgumentParser(description="Check isolated assets host readiness without mutating state")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    manifest = read(MANIFEST)
    operator = read(OPERATOR)
    files = {
        "manifest": MANIFEST.exists(),
        "operator": OPERATOR.exists(),
    }
    manifest_contract: dict[str, Any] = {
        "deploymentCount": kind_count(manifest, "Deployment"),
        "serviceCount": kind_count(manifest, "Service"),
        "ingressCount": kind_count(manifest, "Ingress"),
        "deploymentName": "name: speakasap-assets" in manifest,
        "serviceName": "name: speakasap-assets" in manifest,
        "namespace": "namespace: statex-apps" in manifest,
        "host": EXPECTED_HOST in manifest,
        "targetRoot": f"path: {EXPECTED_TARGET_ROOT}" in manifest,
        "readOnlyMount": "readOnly: true" in manifest,
        "mediaLocationOnly": "location /media/" in manifest and "location / {" in manifest and "return 404" in manifest,
        "noApplicationServiceReference": all(value not in manifest for value in ["speakasap-content", "speakasap-api-gateway", "speakasap-frontend"]),
        "lowResourceRequests": 'memory: "32Mi"' in manifest and 'cpu: "10m"' in manifest,
        "rollingUpdateSafe": "maxUnavailable: 0" in manifest and "maxSurge: 1" in manifest,
    }
    operator_contract: dict[str, Any] = {
        "isExecutable": OPERATOR.exists() and bool(OPERATOR.stat().st_mode & 0o111),
        "requiresExecuteFlag": '"${1:-}" != "--execute"' in operator,
        "requiresExactApproval": "SEVEN_ASSETS_HOST_APPROVAL_TEXT" in operator and "does not exactly match" in operator,
        "pinsTargetRoot": EXPECTED_TARGET_ROOT in operator and "MEDIA_TARGET_ROOT must remain" in operator,
        "serverDryRunBeforeApply": "kubectl apply --dry-run=server" in operator,
        "appliesOnlyAssetsManifest": 'kubectl apply -f "$MANIFEST"' in operator and "k8s/services/assets-service.yaml" in operator,
        "waitsOnlyAssetsRollout": "kubectl rollout status deployment/speakasap-assets" in operator
        and "kubectl rollout status deployment/speakasap-content" not in operator
        and "kubectl rollout restart" not in operator,
        "verifiesPublicHost": "/media/.well-known/health.txt" in operator and "missingMedia" in operator,
        "writesExecutionReport": "execution-v1.json" in operator and "approvalSha256" in operator,
        "doesNotCopyMedia": "copy-seven-media-approved" not in operator and "curl -fL" not in operator,
        "marksNoDatabaseWrites": "databaseWrites" in operator and "False" in operator,
    }
    assertions = {
        "requiredFilesPresent": all(files.values()),
        "manifestHasExpectedResourceCounts": manifest_contract["deploymentCount"] == 1
        and manifest_contract["serviceCount"] == 1
        and manifest_contract["ingressCount"] == 1,
        "manifestScopeIsIsolated": all(
            bool(manifest_contract[key])
            for key in [
                "deploymentName",
                "serviceName",
                "namespace",
                "host",
                "targetRoot",
                "readOnlyMount",
                "mediaLocationOnly",
                "noApplicationServiceReference",
                "rollingUpdateSafe",
            ]
        ),
        "operatorContractSafe": all(operator_contract.values()),
    }
    failed = [name for name, ok in assertions.items() if not ok]
    report = {
        "generatedAt": now_iso(),
        "writes": False,
        "expectedHost": EXPECTED_HOST,
        "expectedTargetRoot": EXPECTED_TARGET_ROOT,
        "files": files,
        "manifestContract": manifest_contract,
        "operatorContract": operator_contract,
        "assertions": assertions,
        "failedAssertions": failed,
        "ok": not failed,
        "nextAction": (
            "Run scripts/apply-seven-assets-host-approved.sh --execute, then use /home/ssf/speakasap-assets as MEDIA_TARGET_ROOT."
            if not failed
            else "Fix assets-host readiness assertions before applying the assets host."
        ),
    }
    payload = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
    if args.json_report and args.json_report != "-":
        Path(args.json_report).write_text(payload + "\n", encoding="utf-8")
        print(f"wrote report to {args.json_report}")
    else:
        print(payload)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
