#!/usr/bin/env python3
"""Run the local no-write seven migration validation suite.

This wrapper intentionally avoids database connections, network checks, media
copy, image builds, kubectl, and deployment. It regenerates static/contract
reports from existing no-write inputs and aggregates readiness/completion.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_INPUTS = {
    "dry_run": "/tmp/speakasap-seven-dry-run-v20.json",
    "post_schema_reconciliation": "/tmp/speakasap-seven-post-schema-reconciliation-fresh-v1.json",
    "media_availability": "/tmp/speakasap-seven-media-check-legacy-source-v2.json",
    "media_manifest": "/tmp/speakasap-seven-media-copy-manifest-v3.json",
    "deployment_smoke": "/tmp/speakasap-seven-deployment-smoke-current-v3.json",
}

DEFAULT_OUTPUTS = {
    "assets_contract": "/tmp/speakasap-seven-assets-contract-suite.json",
    "schema_plan": "/tmp/speakasap-seven-schema-migration-plan-suite.json",
    "data_apply_contract": "/tmp/speakasap-seven-data-apply-contract-suite.json",
    "media_approval_contract": "/tmp/speakasap-seven-media-approval-contract-suite.json",
    "frontend_route_contract": "/tmp/speakasap-seven-frontend-route-contract-suite.json",
    "content_api_contract": "/tmp/speakasap-seven-content-api-contract-suite.json",
    "assets_host_readiness": "/tmp/speakasap-seven-assets-host-readiness-suite.json",
    "gateway_contract": "/tmp/speakasap-seven-gateway-contract-suite.json",
    "deployment_readiness": "/tmp/speakasap-seven-deployment-readiness-suite.json",
    "typography": "/tmp/speakasap-seven-typography-contract-suite.json",
    "visual_qa_contract": "/tmp/speakasap-seven-visual-qa-contract-suite.json",
    "runtime_evidence": "/tmp/speakasap-seven-runtime-evidence-suite.json",
    "operator_refusal": "/tmp/speakasap-seven-operator-refusal-suite.json",
    "approval_sequence": "/tmp/speakasap-seven-approval-sequence-suite.json",
    "next_gate": "/tmp/speakasap-seven-next-gate-suite.json",
    "intent_commit": "/tmp/speakasap-seven-intent-commit-readiness-suite.json",
    "worker_evidence": "/tmp/speakasap-seven-worker-evidence-suite.json",
    "readiness": "/tmp/speakasap-seven-apply-readiness-suite.json",
    "completion": "/tmp/speakasap-seven-goal-completion-audit-suite.json",
    "summary": "/tmp/speakasap-seven-no-write-suite.json",
}

PY_COMPILE_TARGETS = [
    "content-service/scripts/migrate-seven-from-legacy.py",
    "content-service/scripts/check-seven-assets-contract.py",
    "content-service/scripts/check-seven-schema-migration-plan.py",
    "content-service/scripts/check-seven-data-apply-contract.py",
    "content-service/scripts/check-seven-post-schema-reconciliation.py",
    "content-service/scripts/check-seven-media-approval-contract.py",
    "content-service/scripts/check-seven-apply-readiness.py",
    "scripts/check-seven-frontend-route-contract.py",
    "scripts/check-seven-content-api-contract.py",
    "scripts/check-seven-gateway-contract.py",
    "scripts/check-seven-assets-host-readiness.py",
    "scripts/check-seven-deployment-readiness.py",
    "scripts/check-seven-typography-contract.py",
    "scripts/check-seven-visual-qa-contract.py",
    "scripts/check-seven-runtime-evidence.py",
    "scripts/check-seven-operator-refusal.py",
    "scripts/check-seven-approval-sequence.py",
    "scripts/check-seven-next-gate.py",
    "scripts/check-seven-intent-commit-readiness.py",
    "scripts/check-seven-worker-evidence.py",
    "scripts/check-seven-goal-completion.py",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def run(cmd: list[str]) -> dict[str, Any]:
    completed = subprocess.run(cmd, text=True, capture_output=True)
    return {
        "cmd": cmd,
        "returncode": completed.returncode,
        "stdout": completed.stdout.strip(),
        "stderr": completed.stderr.strip(),
        "ok": completed.returncode == 0,
    }


def load_json(path: str) -> dict[str, Any] | None:
    p = Path(path)
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run local no-write seven validation suite")
    parser.add_argument("--dry-run-report", default=DEFAULT_INPUTS["dry_run"])
    parser.add_argument("--post-schema-reconciliation-report", default=DEFAULT_INPUTS["post_schema_reconciliation"])
    parser.add_argument("--media-availability-report", default=DEFAULT_INPUTS["media_availability"])
    parser.add_argument("--media-copy-manifest-report", default=DEFAULT_INPUTS["media_manifest"])
    parser.add_argument("--deployment-smoke-report", default=DEFAULT_INPUTS["deployment_smoke"])
    parser.add_argument("--json-report", default=DEFAULT_OUTPUTS["summary"])
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    commands: list[list[str]] = [
        ["python3", "-m", "py_compile", *PY_COMPILE_TARGETS],
        ["bash", "-n", "scripts/apply-seven-schema-approved.sh"],
        ["bash", "-n", "scripts/apply-seven-data-approved.sh"],
        ["bash", "-n", "scripts/copy-seven-media-approved.sh"],
        ["bash", "-n", "scripts/apply-seven-assets-host-approved.sh"],
        ["bash", "-n", "scripts/deploy-seven-approved.sh"],
        ["node", "--check", "scripts/check-seven-postdeploy-visual-qa.js"],
        ["python3", "scripts/check-seven-operator-refusal.py", "--json-report", DEFAULT_OUTPUTS["operator_refusal"]],
        ["python3", "scripts/check-seven-approval-sequence.py", "--json-report", DEFAULT_OUTPUTS["approval_sequence"]],
        ["python3", "content-service/scripts/check-seven-assets-contract.py", "--input-report", args.dry_run_report, "--assets-base-url", "https://assets.alfares.cz", "--json-report", DEFAULT_OUTPUTS["assets_contract"]],
        ["python3", "content-service/scripts/check-seven-schema-migration-plan.py", "--json-report", DEFAULT_OUTPUTS["schema_plan"]],
        ["python3", "content-service/scripts/check-seven-data-apply-contract.py", "--dry-run-report", args.dry_run_report, "--json-report", DEFAULT_OUTPUTS["data_apply_contract"]],
        ["python3", "content-service/scripts/check-seven-media-approval-contract.py", "--availability-report", args.media_availability_report, "--manifest-report", args.media_copy_manifest_report, "--assets-contract-report", DEFAULT_OUTPUTS["assets_contract"], "--json-report", DEFAULT_OUTPUTS["media_approval_contract"]],
        ["python3", "scripts/check-seven-frontend-route-contract.py", "--json-report", DEFAULT_OUTPUTS["frontend_route_contract"]],
        ["python3", "scripts/check-seven-content-api-contract.py", "--json-report", DEFAULT_OUTPUTS["content_api_contract"]],
        ["python3", "scripts/check-seven-gateway-contract.py", "--json-report", DEFAULT_OUTPUTS["gateway_contract"]],
        ["python3", "scripts/check-seven-assets-host-readiness.py", "--json-report", DEFAULT_OUTPUTS["assets_host_readiness"]],
        ["python3", "scripts/check-seven-deployment-readiness.py", "--json-report", DEFAULT_OUTPUTS["deployment_readiness"]],
        ["python3", "scripts/check-seven-typography-contract.py", "--json-report", DEFAULT_OUTPUTS["typography"]],
        ["python3", "scripts/check-seven-visual-qa-contract.py", "--json-report", DEFAULT_OUTPUTS["visual_qa_contract"]],
        ["python3", "scripts/check-seven-runtime-evidence.py", "--json-report", DEFAULT_OUTPUTS["runtime_evidence"]],
        [
            "python3",
            "content-service/scripts/check-seven-apply-readiness.py",
            "--dry-run-report",
            args.dry_run_report,
            "--assets-contract-report",
            DEFAULT_OUTPUTS["assets_contract"],
            "--schema-migration-plan-report",
            DEFAULT_OUTPUTS["schema_plan"],
            "--data-apply-contract-report",
            DEFAULT_OUTPUTS["data_apply_contract"],
            "--post-schema-reconciliation-report",
            args.post_schema_reconciliation_report,
            "--media-availability-report",
            args.media_availability_report,
            "--media-copy-manifest-report",
            args.media_copy_manifest_report,
            "--media-approval-contract-report",
            DEFAULT_OUTPUTS["media_approval_contract"],
            "--frontend-route-contract-report",
            DEFAULT_OUTPUTS["frontend_route_contract"],
            "--content-api-contract-report",
            DEFAULT_OUTPUTS["content_api_contract"],
            "--gateway-contract-report",
            DEFAULT_OUTPUTS["gateway_contract"],
            "--deployment-smoke-report",
            args.deployment_smoke_report,
            "--deployment-readiness-report",
            DEFAULT_OUTPUTS["deployment_readiness"],
            "--json-report",
            DEFAULT_OUTPUTS["readiness"],
        ],
        [
            "python3",
            "scripts/check-seven-next-gate.py",
            "--readiness-report",
            DEFAULT_OUTPUTS["readiness"],
            "--approval-sequence-report",
            DEFAULT_OUTPUTS["approval_sequence"],
            "--runtime-evidence-report",
            DEFAULT_OUTPUTS["runtime_evidence"],
            "--json-report",
            DEFAULT_OUTPUTS["next_gate"],
        ],
        ["python3", "scripts/check-seven-intent-commit-readiness.py", "--json-report", DEFAULT_OUTPUTS["intent_commit"]],
        ["python3", "scripts/check-seven-worker-evidence.py", "--json-report", DEFAULT_OUTPUTS["worker_evidence"]],
        [
            "python3",
            "scripts/check-seven-goal-completion.py",
            "--readiness-report",
            DEFAULT_OUTPUTS["readiness"],
            "--deployment-smoke-report",
            args.deployment_smoke_report,
            "--typography-report",
            DEFAULT_OUTPUTS["typography"],
            "--visual-qa-contract-report",
            DEFAULT_OUTPUTS["visual_qa_contract"],
            "--runtime-evidence-report",
            DEFAULT_OUTPUTS["runtime_evidence"],
            "--json-report",
            DEFAULT_OUTPUTS["completion"],
        ],
    ]

    results: list[dict[str, Any]] = []
    for cmd in commands:
        result = run(cmd)
        results.append(result)
        if not result["ok"] and cmd[1] != "scripts/check-seven-goal-completion.py":
            break

    readiness = load_json(DEFAULT_OUTPUTS["readiness"]) or {}
    completion = load_json(DEFAULT_OUTPUTS["completion"]) or {}
    report = {
        "generatedAt": now_iso(),
        "writes": False,
        "network": False,
        "database": False,
        "deployment": False,
        "inputs": {
            "dryRunReport": args.dry_run_report,
            "postSchemaReconciliationReport": args.post_schema_reconciliation_report,
            "mediaAvailabilityReport": args.media_availability_report,
            "mediaCopyManifestReport": args.media_copy_manifest_report,
            "deploymentSmokeReport": args.deployment_smoke_report,
        },
        "outputs": DEFAULT_OUTPUTS,
        "results": results,
        "readinessSummary": {
            "ok": readiness.get("ok"),
            "complete": readiness.get("complete"),
            "nextAction": readiness.get("nextAction"),
        },
        "nextGateSummary": (load_json(DEFAULT_OUTPUTS["next_gate"]) or {}),
        "intentCommitSummary": (load_json(DEFAULT_OUTPUTS["intent_commit"]) or {}),
        "workerEvidenceSummary": (load_json(DEFAULT_OUTPUTS["worker_evidence"]) or {}),
        "completionSummary": {
            "ok": completion.get("ok"),
            "complete": completion.get("complete"),
            "missingRequirements": completion.get("missingRequirements"),
        },
        "ok": bool(readiness.get("ok") is True and completion.get("writes") is False and completion.get("complete") is False),
        "complete": False,
    }
    payload = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
    Path(args.json_report).write_text(payload + "\n", encoding="utf-8")
    print(f"wrote suite report to {args.json_report}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
