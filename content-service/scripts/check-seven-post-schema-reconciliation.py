#!/usr/bin/env python3
"""No-write acceptance check for post-schema seven target reconciliation."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


EXPECTED_PLANNED = {
    "plannedCourseLegacyIds": 19,
    "plannedLessonLegacyIds": 136,
    "plannedExerciseLegacyKeys": 429,
}
SEVEN_TABLES = ["SevenCourse", "SevenLesson", "SevenExercise"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_report(path: str) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Check post-schema seven target reconciliation report")
    parser.add_argument("--target-report", required=True, help="JSON from migrate-seven-from-legacy.py --check-target")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    source = load_report(args.target_report)
    target = source.get("target") or {}
    table_errors = target.get("tableErrors") or {}
    counts = target.get("counts") or {}
    planned = target.get("plannedMatches") or {}
    language = target.get("languageReadiness") or {}
    blocking_codes = [issue.get("code") for issue in source.get("blockingIssues") or [] if isinstance(issue, dict)]
    assertions = {
        "sourceWritesFalse": source.get("writes") is False,
        "targetChecked": target.get("checked") is True,
        "sevenTablesQueryable": all(table not in table_errors and isinstance(counts.get(table), int) for table in SEVEN_TABLES),
        "sevenTablesEmptyBeforeDataApply": all(counts.get(table) == 0 for table in SEVEN_TABLES),
        "plannedCountsMatch": all(int(planned.get(key, 0) or 0) == expected for key, expected in EXPECTED_PLANNED.items()),
        "languageTableQueryable": "error" not in language,
        "noLanguageTableUnavailableBlocker": "TARGET_LANGUAGE_TABLE_UNAVAILABLE" not in blocking_codes,
    }
    data_readiness = {
        "plannedLanguageCodesCount": language.get("plannedLanguageCodesCount"),
        "existingLanguageCodesCount": language.get("existingLanguageCodesCount", 0),
        "missingLanguageCodes": language.get("missingLanguageCodes") or [],
        "requiresDataApprovalWithIncludeLanguages": bool(language.get("missingLanguageCodes")),
    }
    report = {
        "generatedAt": now_iso(),
        "writes": False,
        "inputReport": args.target_report,
        "assertions": assertions,
        "targetCounts": counts,
        "plannedMatches": planned,
        "languageReadiness": data_readiness,
        "schemaReady": all(assertions.values()),
        "dataReady": all(assertions.values()) and not data_readiness["requiresDataApprovalWithIncludeLanguages"],
        "ok": all(assertions.values()),
        "complete": False,
        "nextAction": (
            "Request separate seven data approval with --include-languages."
            if all(assertions.values()) and data_readiness["requiresDataApprovalWithIncludeLanguages"]
            else "Fix target schema reconciliation before requesting data approval."
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
