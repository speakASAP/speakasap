#!/usr/bin/env python3
"""No-write next-gate preflight for the seven-course runtime sequence.

This checker answers one operational question without touching external state:
which runtime gate, if any, is eligible to be requested next from the owner?
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULTS = {
    "readiness": "/tmp/speakasap-seven-apply-readiness-suite.json",
    "approval_sequence": "/tmp/speakasap-seven-approval-sequence-suite.json",
    "runtime_evidence": "/tmp/speakasap-seven-runtime-evidence-suite.json",
    "schema_reconciliation": "/tmp/speakasap-seven-post-schema-reconciliation-v1.json",
    "data_post_apply": "/tmp/speakasap-seven-content-post-apply-v1.json",
    "media_postcopy": "/tmp/speakasap-seven-media-postcopy-v1.json",
    "deployment_smoke": "/tmp/speakasap-seven-deploy-smoke-v1.json",
    "visual_qa": "/tmp/speakasap-seven-postdeploy-visual-qa-v1.json",
}

ORDER = ["schema", "data", "media", "deploy", "visualQa", "runtimeEvidence"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: str | None) -> dict[str, Any] | None:
    if not path:
        return None
    p = Path(path)
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def artifact(path: str) -> dict[str, Any]:
    data = load_json(path)
    return {
        "path": path,
        "exists": data is not None,
        "writes": data.get("writes") if data else None,
        "ok": data.get("ok") if data else None,
        "complete": data.get("complete") if data else None,
        "data": data,
    }


def planned_matches_ok(report: dict[str, Any] | None) -> bool:
    if not report:
        return False
    planned = ((report.get("target") or {}).get("plannedMatches") or {})
    return (
        int(planned.get("plannedCourseLegacyIds", 0) or 0) == 19
        and int(planned.get("plannedLessonLegacyIds", 0) or 0) == 136
        and int(planned.get("plannedExerciseLegacyKeys", 0) or 0) == 429
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Determine next seven runtime gate without external actions")
    parser.add_argument("--readiness-report", default=DEFAULTS["readiness"])
    parser.add_argument("--approval-sequence-report", default=DEFAULTS["approval_sequence"])
    parser.add_argument("--runtime-evidence-report", default=DEFAULTS["runtime_evidence"])
    parser.add_argument("--schema-reconciliation-report", default=DEFAULTS["schema_reconciliation"])
    parser.add_argument("--data-post-apply-report", default=DEFAULTS["data_post_apply"])
    parser.add_argument("--media-postcopy-report", default=DEFAULTS["media_postcopy"])
    parser.add_argument("--deployment-smoke-report", default=DEFAULTS["deployment_smoke"])
    parser.add_argument("--visual-qa-report", default=DEFAULTS["visual_qa"])
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    readiness = load_json(args.readiness_report) or {}
    gates = readiness.get("gates") or {}
    sequence = load_json(args.approval_sequence_report) or {}
    runtime = load_json(args.runtime_evidence_report) or {}
    schema = artifact(args.schema_reconciliation_report)
    data = artifact(args.data_post_apply_report)
    media = artifact(args.media_postcopy_report)
    smoke = artifact(args.deployment_smoke_report)
    visual = artifact(args.visual_qa_report)

    gate_state = {
        "schema": {
            "done": bool(schema["exists"] and schema["writes"] is False and (schema["data"] or {}).get("schemaReady") is True and schema["ok"] is True),
            "readyToRequest": bool((gates.get("schema") or {}).get("readyForOwnerSchemaApproval") is True),
            "approvalPacket": "docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md",
            "operator": "scripts/apply-seven-schema-approved.sh --execute",
            "requiredPriorGate": None,
        },
        "data": {
            "done": bool(data["exists"] and data["writes"] is False and not (data["data"] or {}).get("blockingIssues") and planned_matches_ok(data["data"])),
            "readyToRequest": bool((gates.get("data") or {}).get("readyForOwnerDataApproval") is True),
            "approvalPacket": "docs/orchestrator/SEVEN_DATA_MIGRATION_APPROVAL.md",
            "operator": "scripts/apply-seven-data-approved.sh --execute",
            "requiredPriorGate": "schema",
        },
        "media": {
            "done": bool(media["exists"] and media["writes"] is False and media["ok"] is True and (media["data"] or {}).get("missing") == 0),
            "readyToRequest": bool((gates.get("mediaSource") or {}).get("readyForOwnerMediaApproval") is True),
            "approvalPacket": "docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md",
            "operator": "scripts/copy-seven-media-approved.sh --execute",
            "requiredPriorGate": "data",
        },
        "deploy": {
            "done": bool(smoke["exists"] and smoke["writes"] is False and smoke["ok"] is True),
            "readyToRequest": bool((gates.get("deploy") or {}).get("readyForOwnerDeploymentApproval") is True),
            "approvalPacket": "docs/orchestrator/SEVEN_DEPLOYMENT_APPROVAL.md",
            "operator": "scripts/deploy-seven-approved.sh --execute",
            "requiredPriorGate": "media",
        },
        "visualQa": {
            "done": bool(visual["exists"] and visual["writes"] is False and visual["ok"] is True),
            "readyToRequest": bool(smoke["exists"] and smoke["writes"] is False and smoke["ok"] is True),
            "approvalPacket": "post-deploy read-only QA from docs/orchestrator/SEVEN_RUNTIME_APPROVAL_SEQUENCE.md",
            "operator": "node scripts/check-seven-postdeploy-visual-qa.js",
            "requiredPriorGate": "deploy",
        },
        "runtimeEvidence": {
            "done": bool(runtime.get("writes") is False and runtime.get("complete") is True),
            "readyToRequest": bool(visual["exists"] and visual["writes"] is False and visual["ok"] is True),
            "approvalPacket": "final evidence audit from docs/orchestrator/SEVEN_RUNTIME_APPROVAL_SEQUENCE.md",
            "operator": "python3 scripts/check-seven-runtime-evidence.py",
            "requiredPriorGate": "visualQa",
        },
    }

    first_incomplete = next((name for name in ORDER if not gate_state[name]["done"]), None)
    next_gate = first_incomplete or "complete"
    sequence_ok = sequence.get("writes") is False and sequence.get("ok") is True
    readiness_ok = readiness.get("writes") is False and readiness.get("ok") is True
    skipped_gate_risks = [
        name
        for name in ORDER
        if not gate_state[name]["done"]
        and any(gate_state[later]["done"] for later in ORDER[ORDER.index(name) + 1 :])
    ]
    next_gate_state = gate_state.get(next_gate, {})
    prior_gate = next_gate_state.get("requiredPriorGate")
    prior_done = prior_gate is None or gate_state[prior_gate]["done"]
    next_gate_requestable = bool(
        next_gate != "complete"
        and sequence_ok
        and readiness_ok
        and prior_done
        and next_gate_state.get("readyToRequest") is True
    )

    report = {
        "generatedAt": now_iso(),
        "writes": False,
        "network": False,
        "database": False,
        "deployment": False,
        "inputs": {
            "readinessReport": args.readiness_report,
            "approvalSequenceReport": args.approval_sequence_report,
            "runtimeEvidenceReport": args.runtime_evidence_report,
            "schemaReconciliationReport": args.schema_reconciliation_report,
            "dataPostApplyReport": args.data_post_apply_report,
            "mediaPostcopyReport": args.media_postcopy_report,
            "deploymentSmokeReport": args.deployment_smoke_report,
            "visualQaReport": args.visual_qa_report,
        },
        "preconditions": {
            "approvalSequenceOk": sequence_ok,
            "readinessOk": readiness_ok,
            "skippedGateRisks": skipped_gate_risks,
        },
        "gates": gate_state,
        "artifacts": {
            "schemaReconciliation": {k: schema[k] for k in ["path", "exists", "writes", "ok"]},
            "dataPostApply": {k: data[k] for k in ["path", "exists", "writes", "ok"]},
            "mediaPostcopy": {k: media[k] for k in ["path", "exists", "writes", "ok"]},
            "deploymentSmoke": {k: smoke[k] for k in ["path", "exists", "writes", "ok"]},
            "visualQa": {k: visual[k] for k in ["path", "exists", "writes", "ok"]},
        },
        "nextGate": next_gate,
        "nextGateRequestable": next_gate_requestable,
        "nextApprovalPacket": next_gate_state.get("approvalPacket") if next_gate_state else None,
        "nextOperator": next_gate_state.get("operator") if next_gate_state else None,
        "complete": next_gate == "complete",
        "ok": sequence_ok and readiness_ok and not skipped_gate_risks,
        "nextAction": (
            "Goal runtime sequence is complete; run final completion audit."
            if next_gate == "complete"
            else (
                f"Request owner approval for {next_gate} using {next_gate_state.get('approvalPacket')}."
                if next_gate_requestable
                else f"Do not request or run {next_gate} yet; satisfy its preconditions first."
            )
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
