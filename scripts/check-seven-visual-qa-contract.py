#!/usr/bin/env python3
"""No-write static contract for post-deploy seven visual QA."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


QA_SCRIPT = Path("scripts/check-seven-postdeploy-visual-qa.js")


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
    parser = argparse.ArgumentParser(description="Check post-deploy visual QA contract without running browser")
    parser.add_argument("--visual-qa-report", help="optional report from check-seven-postdeploy-visual-qa.js")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    text = QA_SCRIPT.read_text(encoding="utf-8") if QA_SCRIPT.exists() else ""
    visual_report = load_json(args.visual_qa_report)
    script_contract = {
        "scriptExists": QA_SCRIPT.exists(),
        "scriptExecutable": QA_SCRIPT.exists() and bool(QA_SCRIPT.stat().st_mode & 0o111),
        "usesPlaywright": '"playwright"' in text and "playwright-core" in text and "chromium.launch" in text,
        "usesSystemChromeFallback": "chromeExecutablePath" in text and "/usr/bin/google-chrome" in text and "executablePath" in text,
        "hasNoNetworkSelfTest": "self-test" in text and "page.setContent" in text and "selfTestOk" in text,
        "checksDesktopAndMobile": '"desktop"' in text and '"mobile"' in text and "390" in text and "1440" in text,
        "checksCourseAndLessonRoutes": "courseUrl" in text and "lessonUrl" in text,
        "capturesScreenshots": "page.screenshot" in text and "screenshotDir" in text,
        "checksConsoleHealth": "consoleEntries" in text and "consoleHealthy" in text,
        "checksFrameworkOverlay": "hasFrameworkOverlay" in text and "data-nextjs-dialog-overlay" in text,
        "checksLegacyTypography": all(value in text for value in ["rgb(66, 66, 66)", "16px", "30px", "rgb(44, 150, 255)", "PT Mono"]),
        "checksViewportAwareTextTypography": all(value in text for value in ["expectedReadableTextFontSize", "expectedReadableTextLineHeight", '"15px"', '"16px"']),
        "checksViewportAwareTableTypography": all(value in text for value in ["expectedTableFontSize", "expectedTableLineHeight", '"13px"', '"16px"']),
        "checksCourseTypography": all(value in text for value in ["courseHeadingColor", "courseHeadingFont", "courseHeadingSize", "courseLessonCardHeading", "appPromoListReadable"]),
        "checksLessonTablesAndExercises": all(value in text for value in ["legacyTableReadable", "exerciseTitleMono", "legacySubheadingYellow"]),
        "checksLayoutCollapse": "noHorizontalCollapse" in text,
        "writesJsonReport": "JSON.stringify(report" in text and "json-report" in text,
    }
    report_contract = {
        "reportProvided": visual_report is not None,
        "writesFalse": bool(visual_report and visual_report.get("writes") is False),
        "ok": bool(visual_report and visual_report.get("ok") is True),
        "desktopAndMobileCovered": bool(visual_report and (visual_report.get("assertions") or {}).get("desktopAndMobileCovered") is True),
        "courseAndLessonCovered": bool(visual_report and (visual_report.get("assertions") or {}).get("courseAndLessonCovered") is True),
        "consoleHealthy": bool(visual_report and (visual_report.get("assertions") or {}).get("consoleHealthy") is True),
    }
    assertions = {
        "scriptContractSafe": all(script_contract.values()),
        "visualQaPassedWhenProvided": True if visual_report is None else all(report_contract.values()),
    }
    report = {
        "generatedAt": now_iso(),
        "writes": False,
        "script": str(QA_SCRIPT),
        "scriptContract": script_contract,
        "visualReportInput": args.visual_qa_report,
        "visualReportContract": report_contract,
        "assertions": assertions,
        "ok": all(assertions.values()),
        "postDeployVisualQaRequiredForCompletion": True,
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
