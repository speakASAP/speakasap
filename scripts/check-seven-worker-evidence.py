#!/usr/bin/env python3
"""No-write worker/sub-agent evidence contract for Goal 10."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REQUIRED_WORKERS = {
    "Anscombe": [
        "legacy seven templates/routes/styles/data source",
        "seven/models.py",
        "portal/fixtures/seven.xml",
        "speakasap_site/static/css/speakasap.css",
        "143 lesson HTML templates",
    ],
    "McClintock": [
        "new SpeakASAP frontend/content architecture",
        "content-service owns public content",
        "recommended disjoint implementation slices",
        "gateway-only client",
        "SevenCourse/SevenLesson schema",
    ],
    "Huygens": [
        "frontend/API/gateway runtime contract validation",
        "media/PDF contract",
        "gateway changes are deployed",
        "partial API failures",
        "tsc --noEmit",
    ],
}

REQUIRED_BOUNDARIES = [
    "read-only",
    "no edits",
    "no DB writes",
    "no deploys",
    "master orchestrator remains responsible",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate recorded Goal 10 worker/sub-agent evidence without writes")
    parser.add_argument("--evidence-doc", default="docs/orchestrator/SEVEN_INTENT_PRESERVATION_EVIDENCE.md")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    evidence_path = Path(args.evidence_doc)
    evidence = evidence_path.read_text(encoding="utf-8") if evidence_path.exists() else ""
    worker_checks = {
        name: {phrase: phrase in evidence for phrase in phrases}
        for name, phrases in REQUIRED_WORKERS.items()
    }
    boundary_checks = {phrase: phrase in evidence for phrase in REQUIRED_BOUNDARIES}
    assertions = {
        "evidenceDocExists": evidence_path.exists(),
        "workerSectionPresent": "## Worker / Sub-Agent Evidence" in evidence,
        "allNamedWorkersPresent": all(name in evidence for name in REQUIRED_WORKERS),
        "workerEvidenceComplete": all(all(checks.values()) for checks in worker_checks.values()),
        "workerBoundariesRecorded": all(boundary_checks.values()),
        "masterOwnershipRecorded": "master orchestrator remains responsible" in evidence,
    }
    report: dict[str, Any] = {
        "generatedAt": now_iso(),
        "writes": False,
        "network": False,
        "database": False,
        "deployment": False,
        "inputs": {"evidenceDoc": str(evidence_path)},
        "assertions": assertions,
        "details": {
            "workers": worker_checks,
            "boundaries": boundary_checks,
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
