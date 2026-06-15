#!/usr/bin/env python3
"""No-write refusal checks for seven runtime operators.

Each operator must exit before external actions unless --execute and exact
approval context are provided. This checker runs the no-argument refusal path
only; it must not call kubectl, docker, curl, prisma, or the data importer.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


OPERATORS = [
    {
        "name": "schema",
        "path": "scripts/apply-seven-schema-approved.sh",
        "requiredText": ["This script is intentionally write-gated", "--execute", "SEVEN_SCHEMA_APPROVAL_TEXT"],
    },
    {
        "name": "data",
        "path": "scripts/apply-seven-data-approved.sh",
        "requiredText": ["This script is intentionally write-gated", "--execute", "SEVEN_DATA_APPROVAL_TEXT"],
    },
    {
        "name": "media",
        "path": "scripts/copy-seven-media-approved.sh",
        "requiredText": ["This script is intentionally write-gated", "--execute", "SEVEN_MEDIA_APPROVAL_TEXT"],
    },
    {
        "name": "deployment",
        "path": "scripts/deploy-seven-approved.sh",
        "requiredText": ["This script is intentionally write-gated", "--execute", "SEVEN_DEPLOY_APPROVAL_TEXT"],
    },
]

FORBIDDEN_OUTPUT = [
    "Forwarding from",
    "Successfully built",
    "rollout restarted",
    "wrote report to",
    "wrote manifest to",
    "Schema apply and post-schema",
    "Seven data apply",
    "Seven media copy complete",
    "Seven scoped deployment complete",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def run_operator(item: dict[str, Any]) -> dict[str, Any]:
    path = Path(item["path"])
    if not path.exists():
        return {"name": item["name"], "path": item["path"], "exists": False, "ok": False, "returncode": None}
    completed = subprocess.run([str(path)], text=True, capture_output=True, timeout=10)
    output = (completed.stdout or "") + "\n" + (completed.stderr or "")
    missing_required = [text for text in item["requiredText"] if text not in output]
    forbidden_hits = [text for text in FORBIDDEN_OUTPUT if text in output]
    return {
        "name": item["name"],
        "path": item["path"],
        "exists": True,
        "returncode": completed.returncode,
        "stdout": completed.stdout.strip(),
        "stderr": completed.stderr.strip(),
        "missingRequiredText": missing_required,
        "forbiddenOutputHits": forbidden_hits,
        "ok": completed.returncode == 2 and not missing_required and not forbidden_hits,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Check seven runtime operator refusal gates")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()
    results = [run_operator(item) for item in OPERATORS]
    report = {
        "generatedAt": now_iso(),
        "writes": False,
        "network": False,
        "database": False,
        "deployment": False,
        "results": results,
        "ok": all(item["ok"] for item in results),
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
