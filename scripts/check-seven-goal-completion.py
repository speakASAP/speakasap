#!/usr/bin/env python3
"""No-write completion audit for the seven-lesson migration goal."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REQUIRED_FILES = {
    "courseRoute": "frontend/app/[languageCode]/seven/page.tsx",
    "lessonRoute": "frontend/app/[languageCode]/seven/[order]/page.tsx",
    "frontendApiClient": "frontend/lib/seven.ts",
    "contentSevenService": "content-service/src/seven/seven.service.ts",
    "intentSystem": "docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md",
    "sevenIntentEvidence": "docs/orchestrator/SEVEN_INTENT_PRESERVATION_EVIDENCE.md",
    "schemaApprovalPacket": "docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md",
    "dataApprovalPacket": "docs/orchestrator/SEVEN_DATA_MIGRATION_APPROVAL.md",
    "mediaApprovalPacket": "docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md",
    "deploymentApprovalPacket": "docs/orchestrator/SEVEN_DEPLOYMENT_APPROVAL.md",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: str | None) -> dict[str, Any] | None:
    if not path:
        return None
    p = Path(path)
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def file_report() -> dict[str, Any]:
    return {
        name: {
            "path": path,
            "exists": Path(path).exists(),
            "bytes": Path(path).stat().st_size if Path(path).exists() else 0,
        }
        for name, path in REQUIRED_FILES.items()
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit seven migration completion without mutating state")
    parser.add_argument("--readiness-report", required=True)
    parser.add_argument("--deployment-smoke-report", required=True)
    parser.add_argument("--typography-report", required=True)
    parser.add_argument("--visual-qa-contract-report")
    parser.add_argument("--visual-qa-report")
    parser.add_argument("--runtime-evidence-report")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    readiness = load_json(args.readiness_report) or {}
    smoke = load_json(args.deployment_smoke_report) or {}
    typography = load_json(args.typography_report) or {}
    visual_contract = load_json(args.visual_qa_contract_report) or {}
    visual_qa = load_json(args.visual_qa_report) or {}
    runtime_evidence = load_json(args.runtime_evidence_report) or {}
    files = file_report()
    gates = readiness.get("gates") or {}

    requirements = {
        "frontendRoutesImplemented": files["courseRoute"]["exists"] and files["lessonRoute"]["exists"] and files["frontendApiClient"]["exists"],
        "frontendRouteContractProven": bool(gates.get("frontendRouteContract", {}).get("ok") is True),
        "contentApiImplemented": files["contentSevenService"]["exists"],
        "contentApiContractProven": bool(gates.get("contentApiContract", {}).get("ok") is True),
        "gatewayPublicAccessContractProven": bool(gates.get("gatewayContract", {}).get("ok") is True),
        "typographyPreservedStaticContract": typography.get("writes") is False and typography.get("ok") is True,
        "postDeployVisualQaContractPresent": visual_contract.get("writes") is False and visual_contract.get("ok") is True and visual_contract.get("postDeployVisualQaRequiredForCompletion") is True,
        "postDeployVisualQaPassed": visual_qa.get("writes") is False and visual_qa.get("ok") is True,
        "runtimeEvidenceChainComplete": runtime_evidence.get("writes") is False and runtime_evidence.get("complete") is True,
        "intentPreservationDocsPresent": files["intentSystem"]["exists"] and files["sevenIntentEvidence"]["exists"],
        "approvalPacketsPresent": all(files[name]["exists"] for name in ["schemaApprovalPacket", "dataApprovalPacket", "mediaApprovalPacket", "deploymentApprovalPacket"]),
        "schemaReadyForApproval": bool(gates.get("schema", {}).get("readyForOwnerSchemaApproval") is True),
        "schemaAppliedAndReconciled": bool(gates.get("data", {}).get("targetChecked") is True),
        "dataApplyContractProven": bool(gates.get("dataApplyContract", {}).get("ok") is True),
        "dataReadyForApproval": bool(gates.get("data", {}).get("readyForOwnerDataApproval") is True),
        "mediaApprovalContractProven": bool(gates.get("mediaApprovalContract", {}).get("ok") is True),
        "mediaSourceReadyForApproval": bool(gates.get("mediaSource", {}).get("readyForOwnerMediaApproval") is True),
        "deploymentReadinessContractsProven": bool(gates.get("deploy", {}).get("readyForOwnerDeploymentApproval") is True),
        "deploymentSmokePassed": smoke.get("writes") is False and smoke.get("ok") is True,
        "cutoverReady": bool(gates.get("deploy", {}).get("readyForCutover") is True),
    }
    missing = [name for name, ok in requirements.items() if not ok]
    report = {
        "generatedAt": now_iso(),
        "writes": False,
        "inputs": {
            "readinessReport": args.readiness_report,
            "deploymentSmokeReport": args.deployment_smoke_report,
            "typographyReport": args.typography_report,
            "visualQaContractReport": args.visual_qa_contract_report,
            "visualQaReport": args.visual_qa_report,
            "runtimeEvidenceReport": args.runtime_evidence_report,
        },
        "files": files,
        "requirements": requirements,
        "missingRequirements": missing,
        "readinessSummary": {
            "ok": readiness.get("ok"),
            "complete": readiness.get("complete"),
            "nextAction": readiness.get("nextAction"),
            "contractGates": {
                "frontendRoute": gates.get("frontendRouteContract", {}).get("ok"),
                "contentApi": gates.get("contentApiContract", {}).get("ok"),
                "gateway": gates.get("gatewayContract", {}).get("ok"),
                "dataApply": gates.get("dataApplyContract", {}).get("ok"),
                "mediaApproval": gates.get("mediaApprovalContract", {}).get("ok"),
                "deploymentReadiness": gates.get("deploy", {}).get("readyForOwnerDeploymentApproval"),
            },
        },
        "runtimeEvidenceSummary": {
            "ok": runtime_evidence.get("ok"),
            "complete": runtime_evidence.get("complete"),
            "missingRequirements": runtime_evidence.get("missingRequirements"),
        },
        "visualQaSummary": {
            "contractOk": visual_contract.get("ok"),
            "reportOk": visual_qa.get("ok"),
            "screenshots": visual_qa.get("screenshots"),
        },
        "deploymentSmokeSummary": {
            "ok": smoke.get("ok"),
            "baseUrl": smoke.get("baseUrl"),
            "assetsBaseUrl": smoke.get("assetsBaseUrl"),
        },
        "ok": not missing,
        "complete": not missing,
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
