#!/usr/bin/env python3
"""No-write intent/commit readiness contract for the seven migration slice."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REQUIRED_SECTIONS = [
    "## Goal",
    "## Legacy Evidence",
    "## Style Preservation",
    "## Target Ownership",
    "## Implemented No-Write Work",
    "## Current Evidence",
    "## Approval Status",
    "## Rollback Plan",
    "## Required Commit Message Block",
]

REQUIRED_LEGACY_EVIDENCE = [
    "seven/models.py",
    "seven/urls.py",
    "seven/api_views.py",
    "portal/fixtures/seven.xml",
    "seven/templates/seven/*",
    "speakasap_site/templates/site/seven/base.html",
    "speakasap_site/templates/site/seven/index.html",
    "speakasap_site/static/css/speakasap.css",
    "speakasap_site/static/css/site.css",
    "speakasap_site/static/scss/_seven.scss",
]

REQUIRED_OWNERSHIP = [
    "content-service owns public seven-course content",
    "api-gateway owns public routing",
    "frontend owns presentation",
    "course-service remains owner for paid products",
    "education-service remains owner for private progress",
]

REQUIRED_STYLE = [
    "PT Mono",
    "Open Sans",
    "#424242",
    "16px / 30px",
    "blue h1",
    "yellow h2",
    ".lesson__content--seven",
]

REQUIRED_REPORTS = [
    "/tmp/speakasap-seven-dry-run-v20.json",
    "/tmp/speakasap-seven-assets-contract-v2.json",
    "/tmp/speakasap-seven-schema-migration-plan-v10.json",
    "/tmp/speakasap-seven-data-apply-contract-v10.json",
    "/tmp/speakasap-seven-media-check-legacy-source-v2.json",
    "/tmp/speakasap-seven-media-copy-manifest-v3.json",
    "/tmp/speakasap-seven-media-approval-contract-v2.json",
    "/tmp/speakasap-seven-deployment-readiness-v3.json",
    "/tmp/speakasap-seven-frontend-route-contract-v1.json",
    "/tmp/speakasap-seven-content-api-contract-v1.json",
    "/tmp/speakasap-seven-gateway-contract-v1.json",
    "/tmp/speakasap-seven-typography-contract-v2.json",
    "/tmp/speakasap-seven-visual-qa-contract-v1.json",
    "/tmp/speakasap-seven-approval-sequence-v1.json",
    "/tmp/speakasap-seven-next-gate-v1.json",
    "/tmp/speakasap-seven-no-write-suite-v21.json",
]

REQUIRED_APPROVAL_BOUNDARIES = [
    "content-service schema migration against the Kubernetes content database",
    "seven content data apply",
    "media download/copy/object mutation",
    "image build/push, Kubernetes deployment, or rollout",
    "legacy route retirement",
    "destructive rollback/cleanup",
]

REQUIRED_COMMIT_BLOCK_HEADINGS = [
    "Intent:",
    "Legacy evidence:",
    "Ownership:",
    "Verification:",
    "Approval:",
    "Rollback:",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def contains_all(text: str, values: list[str]) -> dict[str, bool]:
    return {value: value in text for value in values}


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate seven intent-preservation and commit-readiness evidence without writes")
    parser.add_argument("--evidence-doc", default="docs/orchestrator/SEVEN_INTENT_PRESERVATION_EVIDENCE.md")
    parser.add_argument("--intent-system-doc", default="docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    evidence_path = Path(args.evidence_doc)
    intent_path = Path(args.intent_system_doc)
    evidence = evidence_path.read_text(encoding="utf-8") if evidence_path.exists() else ""
    intent_system = intent_path.read_text(encoding="utf-8") if intent_path.exists() else ""

    sections = contains_all(evidence, REQUIRED_SECTIONS)
    legacy = contains_all(evidence, REQUIRED_LEGACY_EVIDENCE)
    ownership = contains_all(evidence, REQUIRED_OWNERSHIP)
    style = contains_all(evidence, REQUIRED_STYLE)
    reports = contains_all(evidence, REQUIRED_REPORTS)
    approvals = contains_all(evidence, REQUIRED_APPROVAL_BOUNDARIES)
    commit_block = contains_all(evidence, REQUIRED_COMMIT_BLOCK_HEADINGS)
    intent_system_requirements = contains_all(
        intent_system,
        [
            "Preserved Intent Chain",
            "Legacy behavior and data source",
            "schema-only apply",
            "data apply",
            "media/object mutation",
            "deployment",
            "browser/runtime validation",
            "legacy route retirement",
            "Required Commit Message Block",
        ],
    )

    assertions = {
        "evidenceDocExists": evidence_path.exists(),
        "intentSystemDocExists": intent_path.exists(),
        "requiredSectionsPresent": all(sections.values()),
        "legacyEvidencePresent": all(legacy.values()),
        "targetOwnershipPresent": all(ownership.values()),
        "stylePreservationPresent": all(style.values()),
        "requiredReportsPresent": all(reports.values()),
        "approvalBoundariesPresent": all(approvals.values()),
        "commitBlockComplete": all(commit_block.values()),
        "commitBlockStatesCurrentApprovalBoundary": (
            "Schema/data/media approved and executed; deploy, data/media rollback, destructive cleanup, and legacy-retirement approval not used in this chunk." in evidence
        ),
        "rollbackBoundaryPresent": "Importer rollback SQL required before apply" in evidence and "legacy portal remains fallback" in evidence,
        "runtimeCompletionStillPending": "complete=false" in evidence and "runtime gates are pending" in evidence,
        "intentSystemCoversRequiredGates": all(intent_system_requirements.values()),
    }

    report: dict[str, Any] = {
        "generatedAt": now_iso(),
        "writes": False,
        "network": False,
        "database": False,
        "deployment": False,
        "inputs": {
            "evidenceDoc": str(evidence_path),
            "intentSystemDoc": str(intent_path),
        },
        "assertions": assertions,
        "details": {
            "sections": sections,
            "legacyEvidence": legacy,
            "ownership": ownership,
            "style": style,
            "reports": reports,
            "approvalBoundaries": approvals,
            "commitBlock": commit_block,
            "intentSystemRequirements": intent_system_requirements,
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
