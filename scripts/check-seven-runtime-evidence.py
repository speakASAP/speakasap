#!/usr/bin/env python3
"""No-write runtime evidence auditor for the seven-course migration.

Before runtime approvals execute, this report remains ok=true/complete=false and
lists missing execution artifacts. After schema/data/media/deploy/visual QA run,
it becomes the single completion evidence chain for the objective.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULTS = {
    "schema_execution": "/tmp/speakasap-seven-schema-apply-execution-v1.json",
    "schema_reconciliation": "/tmp/speakasap-seven-post-schema-reconciliation-v1.json",
    "data_execution": "/tmp/speakasap-seven-content-apply-execution-v1.json",
    "data_post_apply": "/tmp/speakasap-seven-content-post-apply-v1.json",
    "media_execution": "/tmp/speakasap-seven-media-copy-execution-v1.json",
    "media_postcopy": "/tmp/speakasap-seven-media-postcopy-v1.json",
    "deploy_execution": "/tmp/speakasap-seven-deploy-execution-v1.json",
    "deployment_smoke": "/tmp/speakasap-seven-deploy-smoke-v1.json",
    "visual_qa": "/tmp/speakasap-seven-postdeploy-visual-qa-v1.json",
}

EXPECTED_COUNTS = {
    "plannedCourseLegacyIds": 19,
    "plannedLessonLegacyIds": 136,
    "plannedExerciseLegacyKeys": 429,
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: str) -> dict[str, Any] | None:
    p = Path(path)
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def report_state(path: str) -> dict[str, Any]:
    data = load_json(path)
    return {
        "path": path,
        "exists": data is not None,
        "writes": data.get("writes") if data else None,
        "ok": data.get("ok") if data else None,
        "data": data,
    }


def planned_matches_ok(report: dict[str, Any] | None) -> bool:
    if not report:
        return False
    planned = ((report.get("target") or {}).get("plannedMatches") or {})
    return all(int(planned.get(key, 0) or 0) == value for key, value in EXPECTED_COUNTS.items())


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit seven runtime evidence chain without mutating state")
    parser.add_argument("--schema-execution-report", default=DEFAULTS["schema_execution"])
    parser.add_argument("--schema-reconciliation-report", default=DEFAULTS["schema_reconciliation"])
    parser.add_argument("--data-execution-report", default=DEFAULTS["data_execution"])
    parser.add_argument("--data-post-apply-report", default=DEFAULTS["data_post_apply"])
    parser.add_argument("--media-execution-report", default=DEFAULTS["media_execution"])
    parser.add_argument("--media-postcopy-report", default=DEFAULTS["media_postcopy"])
    parser.add_argument("--deploy-execution-report", default=DEFAULTS["deploy_execution"])
    parser.add_argument("--deployment-smoke-report", default=DEFAULTS["deployment_smoke"])
    parser.add_argument("--visual-qa-report", default=DEFAULTS["visual_qa"])
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    states = {
        "schemaExecution": report_state(args.schema_execution_report),
        "schemaReconciliation": report_state(args.schema_reconciliation_report),
        "dataExecution": report_state(args.data_execution_report),
        "dataPostApply": report_state(args.data_post_apply_report),
        "mediaExecution": report_state(args.media_execution_report),
        "mediaPostcopy": report_state(args.media_postcopy_report),
        "deployExecution": report_state(args.deploy_execution_report),
        "deploymentSmoke": report_state(args.deployment_smoke_report),
        "visualQa": report_state(args.visual_qa_report),
    }
    schema_reconciliation = states["schemaReconciliation"]["data"]
    data_post_apply = states["dataPostApply"]["data"]
    media_postcopy = states["mediaPostcopy"]["data"]
    deployment_smoke = states["deploymentSmoke"]["data"]
    visual_qa = states["visualQa"]["data"]

    requirements = {
        "schemaExecutionOk": states["schemaExecution"]["writes"] is True and states["schemaExecution"]["ok"] is True,
        "schemaReconciliationOk": bool(schema_reconciliation and schema_reconciliation.get("writes") is False and schema_reconciliation.get("schemaReady") is True and schema_reconciliation.get("ok") is True),
        "dataExecutionOk": states["dataExecution"]["writes"] is True and states["dataExecution"]["ok"] is True,
        "dataPostApplyOk": bool(data_post_apply and data_post_apply.get("writes") is False and not data_post_apply.get("blockingIssues") and planned_matches_ok(data_post_apply)),
        "mediaExecutionOk": states["mediaExecution"]["writes"] is True and states["mediaExecution"]["ok"] is True,
        "mediaPostcopyOk": bool(media_postcopy and media_postcopy.get("writes") is False and media_postcopy.get("missing") == 0),
        "deployExecutionOk": states["deployExecution"]["writes"] is True and states["deployExecution"]["ok"] is True,
        "deploymentSmokeOk": bool(deployment_smoke and deployment_smoke.get("writes") is False and deployment_smoke.get("ok") is True),
        "visualQaOk": bool(visual_qa and visual_qa.get("writes") is False and visual_qa.get("ok") is True),
    }
    missing = [name for name, ok in requirements.items() if not ok]
    report = {
        "generatedAt": now_iso(),
        "writes": False,
        "inputs": {key: value["path"] for key, value in states.items()},
        "artifacts": {
            key: {sub_key: value[sub_key] for sub_key in ["path", "exists", "writes", "ok"]}
            for key, value in states.items()
        },
        "requirements": requirements,
        "missingRequirements": missing,
        "ok": True,
        "complete": not missing,
        "nextAction": (
            "Runtime evidence complete; run final completion audit."
            if not missing
            else "Execute remaining approved runtime gates in order: schema, data, media, deployment, visual QA."
        ),
    }
    payload = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
    if args.json_report and args.json_report != "-":
        Path(args.json_report).write_text(payload + "\n", encoding="utf-8")
        print(f"wrote report to {args.json_report}")
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
