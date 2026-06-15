#!/usr/bin/env python3
"""No-write static contract checker for seven media migration approval."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


EXPECTED_MEDIA = {"audio": 1076, "pdf": 136}
EXPECTED_INTERNAL_REFS = 1212
EXPECTED_SOURCE_BASE = "https://speakasap.com"
EXPECTED_ASSETS_BASE = "https://assets.alfares.cz"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: str | None) -> dict[str, Any] | None:
    if not path:
        return None
    p = Path(path)
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Check seven media approval contract without copying media")
    parser.add_argument("--approval-doc", default="docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md")
    parser.add_argument("--availability-report", required=True)
    parser.add_argument("--manifest-report", required=True)
    parser.add_argument("--assets-contract-report", required=True)
    parser.add_argument("--operator-script", default="scripts/copy-seven-media-approved.sh")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    approval_path = Path(args.approval_doc)
    approval = approval_path.read_text(encoding="utf-8") if approval_path.exists() else ""
    operator_path = Path(args.operator_script)
    operator = operator_path.read_text(encoding="utf-8") if operator_path.exists() else ""
    availability = load_json(args.availability_report) or {}
    manifest = load_json(args.manifest_report) or {}
    assets = load_json(args.assets_contract_report) or {}
    manifest_summary = manifest.get("summary") or {}
    available_by_kind = manifest_summary.get("availableByKind") or {}
    asset_counts = ((assets.get("counts") or {}).get("byKind") or {})
    approval_contract = {
        "approvalDocExists": approval_path.exists(),
        "statusIsDraft": "Status: draft approval packet" in approval,
        "usesCurrentDryRunV20": "/tmp/speakasap-seven-dry-run-v20.json" in approval and "audio=1076" in approval,
        "usesCurrentManifestV3": "/tmp/speakasap-seven-media-copy-manifest-v3.json" in approval,
        "mentionsZeroMissing": "`0` missing refs" in approval or "0` missing refs" in approval,
        "mentionsSourceAndAssetHosts": EXPECTED_SOURCE_BASE in approval and EXPECTED_ASSETS_BASE in approval,
        "approvalWordingScopesManifest": "Approved to copy and route only public seven-course" in approval
        and "/tmp/speakasap-seven-media-copy-manifest-v3.json" in approval,
        "excludesUnapprovedScopes": all(
            phrase in approval
            for phrase in [
                "No private media",
                "unrelated media",
                "destructive cleanup",
                "final test migration",
                "paid-product change",
                "legacy route retirement",
            ]
        ),
        "noEmbeddedStatusSections": "## 2026-" not in approval and "Goal 10 Seven Assets" not in approval,
        "postCopyChecksAssetsHost": "--base-url https://assets.alfares.cz" in approval,
    }
    operator_contract = {
        "path": str(operator_path),
        "exists": operator_path.exists(),
        "isExecutable": operator_path.exists() and bool(operator_path.stat().st_mode & 0o111),
        "requiresExecuteFlag": '"${1:-}" != "--execute"' in operator,
        "requiresExactApprovalText": "SEVEN_MEDIA_APPROVAL_TEXT" in operator and "does not exactly match" in operator,
        "requiresManifest": "MEDIA_COPY_MANIFEST" in operator and "availableRefs=1212" in operator and "missingRefs=0" in operator,
        "requiresTargetRoot": "MEDIA_TARGET_ROOT" in operator and "existing directory" in operator,
        "copiesOnlyAudioPdf": '"audio", "pdf"' in operator and 'kind") in {"audio", "pdf"}' in operator,
        "preservesMediaTargetKeys": 'target_key.startswith("media/")' in operator,
        "usesCurlDownload": '["curl", "-fL"' in operator,
        "runsPostCopyAvailability": "check-seven-media-availability.py" in operator and "ASSETS_BASE_URL" in operator,
        "writesExecutionReport": "copy-execution-v1.json" in operator and "approvalSha256" in operator,
        "marksLaterApprovalsFalse": all(value in operator for value in ["dataApplyApproved", "deploymentApproved", "legacyRetirementApproved", "destructiveCleanupApproved"]),
        "doesNotRunDeployment": "rollout restart" not in operator and "docker build" not in operator and "docker push" not in operator,
    }
    evidence_contract = {
        "availabilityWritesFalse": availability.get("writes") is False,
        "availabilitySourceBaseOk": availability.get("baseUrl") == EXPECTED_SOURCE_BASE,
        "availabilityCheckedAllInternalRefs": int(availability.get("checked", 0) or 0) == EXPECTED_INTERNAL_REFS,
        "availabilityMissingZero": int(availability.get("missing", -1)) == 0,
        "manifestWritesFalse": manifest.get("writes") is False,
        "manifestTotalRefs": int(manifest_summary.get("totalRefs", 0) or 0) == EXPECTED_INTERNAL_REFS,
        "manifestAvailableRefs": int(manifest_summary.get("availableRefs", 0) or 0) == EXPECTED_INTERNAL_REFS,
        "manifestMissingZero": int(manifest_summary.get("missingRefs", -1)) == 0,
        "manifestExpectedKinds": all(int(available_by_kind.get(kind, 0) or 0) == expected for kind, expected in EXPECTED_MEDIA.items()),
        "assetsContractWritesFalse": assets.get("writes") is False,
        "assetsContractOk": assets.get("ok") is True,
        "assetsContractExpectedKinds": all(int(asset_counts.get(kind, 0) or 0) == expected for kind, expected in {**EXPECTED_MEDIA, "video": 133}.items()),
    }
    assertions = {
        "approvalContractSafe": all(approval_contract.values()),
        "evidenceContractSafe": all(evidence_contract.values()),
        "operatorScriptContractSafe": all(operator_contract.values()),
    }
    report = {
        "generatedAt": now_iso(),
        "writes": False,
        "inputs": {
            "approvalDoc": args.approval_doc,
            "availabilityReport": args.availability_report,
            "manifestReport": args.manifest_report,
            "assetsContractReport": args.assets_contract_report,
        },
        "approvalContract": approval_contract,
        "evidenceContract": evidence_contract,
        "operatorContract": operator_contract,
        "assertions": assertions,
        "approvalBoundary": {
            "mediaCopyStillRequiresOwnerApproval": True,
            "schemaApplyApproved": False,
            "dataApplyApproved": False,
            "deployApproved": False,
            "legacyRetirementApproved": False,
        },
        "ok": all(assertions.values()),
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
