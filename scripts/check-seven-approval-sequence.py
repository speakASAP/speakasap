#!/usr/bin/env python3
"""No-write approval-sequence contract for the seven runtime gates."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


RUNBOOK = Path("docs/orchestrator/SEVEN_RUNTIME_APPROVAL_SEQUENCE.md")
ORDERED_MARKERS = [
    "## Gate 1: Schema",
    "docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md",
    "scripts/apply-seven-schema-approved.sh --execute",
    "/tmp/speakasap-seven-schema-apply-execution-v1.json",
    "/tmp/speakasap-seven-post-schema-reconciliation-v1.json",
    "## Gate 2: Data",
    "docs/orchestrator/SEVEN_DATA_MIGRATION_APPROVAL.md",
    "scripts/apply-seven-data-approved.sh --execute",
    "/tmp/speakasap-seven-content-rollback-v1.sql",
    "/tmp/speakasap-seven-content-apply-execution-v1.json",
    "/tmp/speakasap-seven-content-post-apply-v1.json",
    "## Gate 3: Media",
    "docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md",
    "scripts/copy-seven-media-approved.sh --execute",
    "/tmp/speakasap-seven-media-copy-execution-v1.json",
    "/tmp/speakasap-seven-media-postcopy-v1.json",
    "## Gate 4: Deploy",
    "docs/orchestrator/SEVEN_DEPLOYMENT_APPROVAL.md",
    "scripts/deploy-seven-approved.sh --execute",
    "/tmp/speakasap-seven-deploy-execution-v1.json",
    "/tmp/speakasap-seven-deploy-smoke-v1.json",
    "## Gate 5: Visual QA",
    "node scripts/check-seven-postdeploy-visual-qa.js",
    "/tmp/speakasap-seven-postdeploy-visual-qa-v1.json",
    "## Gate 6: Runtime Evidence And Completion Audit",
    "python3 scripts/check-seven-runtime-evidence.py",
]

REQUIRED_FILES = [
    RUNBOOK,
    Path("docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md"),
    Path("docs/orchestrator/SEVEN_DATA_MIGRATION_APPROVAL.md"),
    Path("docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md"),
    Path("docs/orchestrator/SEVEN_DEPLOYMENT_APPROVAL.md"),
    Path("scripts/apply-seven-schema-approved.sh"),
    Path("scripts/apply-seven-data-approved.sh"),
    Path("scripts/copy-seven-media-approved.sh"),
    Path("scripts/deploy-seven-approved.sh"),
    Path("scripts/check-seven-postdeploy-visual-qa.js"),
    Path("scripts/check-seven-runtime-evidence.py"),
]

REQUIRED_BOUNDARY_PHRASES = [
    "no runtime approval is inferred",
    "Do not skip ahead",
    "does not approve",
    "legacy route retirement",
    "broad shared runner command",
    "Each action still requires the exact approval text",
]

FORBIDDEN_PHRASES = [
    "run ./scripts/deploy.sh",
    "legacy route retirement is approved without separate approval",
    "schema/data/media/deploy approval is granted",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ordered_positions(text: str) -> dict[str, int]:
    positions: dict[str, int] = {}
    cursor = 0
    for marker in ORDERED_MARKERS:
        index = text.find(marker, cursor)
        positions[marker] = index
        if index >= 0:
            cursor = index + len(marker)
    return positions


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate seven runtime approval sequence without external actions")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    text = RUNBOOK.read_text(encoding="utf-8") if RUNBOOK.exists() else ""
    positions = ordered_positions(text)
    missing_markers = [marker for marker, index in positions.items() if index < 0]
    missing_files = [str(path) for path in REQUIRED_FILES if not path.exists()]
    missing_boundary_phrases = [phrase for phrase in REQUIRED_BOUNDARY_PHRASES if phrase not in text]
    forbidden_hits = [phrase for phrase in FORBIDDEN_PHRASES if phrase in text]
    executable_scripts = {
        str(path): bool(path.exists() and path.stat().st_mode & 0o111)
        for path in REQUIRED_FILES
        if path.suffix == ".sh"
    }
    non_executable_scripts = [path for path, executable in executable_scripts.items() if not executable]

    report: dict[str, Any] = {
        "generatedAt": now_iso(),
        "writes": False,
        "network": False,
        "database": False,
        "deployment": False,
        "runbook": str(RUNBOOK),
        "orderedMarkers": positions,
        "requiredFiles": {str(path): path.exists() for path in REQUIRED_FILES},
        "executableScripts": executable_scripts,
        "missingMarkers": missing_markers,
        "missingFiles": missing_files,
        "missingBoundaryPhrases": missing_boundary_phrases,
        "forbiddenPhraseHits": forbidden_hits,
        "nonExecutableScripts": non_executable_scripts,
        "sequence": ["schema", "data", "media", "deploy", "visual QA", "runtime evidence"],
        "ok": not (missing_markers or missing_files or missing_boundary_phrases or forbidden_hits or non_executable_scripts),
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
