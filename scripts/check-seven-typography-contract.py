#!/usr/bin/env python3
"""No-write contract check for legacy seven-course typography preservation."""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


CSS_PATH = Path("frontend/app/globals.css")
COURSE_ROUTE = Path("frontend/app/[languageCode]/seven/page.tsx")
LESSON_ROUTE = Path("frontend/app/[languageCode]/seven/[order]/page.tsx")
FONT_PATHS = [
    Path("frontend/public/fonts/PT-Mono.ttf"),
    Path("frontend/public/fonts/Open-Sans.ttf"),
]

CSS_CONTRACT = [
    {
        "selector": ".seven-page",
        "declarations": {
            "color": "#424242",
            "font-family": '"Open Sans Legacy", "Open Sans", Arial, Helvetica, sans-serif',
        },
    },
    {
        "selector": ".hyphenate",
        "declarations": {
            "text-align": "justify",
        },
    },
    {
        "selector": ".lesson__content",
        "declarations": {
            "color": "#424242",
            "padding": "12px",
        },
    },
    {
        "selector": ".lesson__content--seven",
        "declarations": {
            "padding": "4.2%",
        },
    },
    {
        "selector": ".lesson__content h1",
        "declarations": {
            "color": "#2c96ff",
            "font-family": '"PT Mono", monospace',
            "font-size": "32px",
            "font-weight": "400",
            "line-height": "1.25",
        },
    },
    {
        "selector": ".lesson__content h2,\n.seven-exercises > h2",
        "declarations": {
            "color": "#feb600",
            "font-family": '"PT Mono", monospace',
            "font-size": "26px",
            "font-weight": "400",
            "line-height": "1.35",
        },
    },
    {
        "selector": ".lesson__content table td,\n.lesson__content table th",
        "declarations": {
            "font-size": "13px",
            "line-height": "1.5",
        },
    },
    {
        "selector": ".seven-app-promo ul",
        "declarations": {
            "font-size": "16px",
            "line-height": "30px",
        },
    },
]

REQUIRED_SNIPPETS = {
    CSS_PATH: [
        '@font-face',
        'font-family: "PT Mono";',
        'font-family: "Open Sans Legacy";',
        ".seven-reading-indicator",
        ".download-pdf",
        ".seven-app-promo",
        "@media (min-width: 576px)",
        ".lesson__content--seven p,",
        ".lesson__content--seven table th",
        "font-size: 16px;",
        "line-height: 30px;",
    ],
    COURSE_ROUTE: [
        'className="seven-page"',
        'className="seven-course-header"',
        'className="seven-lessons-grid"',
        "<SevenAppPromo",
    ],
    LESSON_ROUTE: [
        'className="seven-page seven-page--lesson"',
        "<SevenReadingIndicator",
        'className="hyphenate"',
        'className="lesson__content lesson__content--seven"',
        'className="lesson-wrapper"',
        'className="seven-button button-download-pdf"',
    ],
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_value(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def parse_declarations(body: str) -> dict[str, str]:
    declarations: dict[str, str] = {}
    for chunk in body.split(";"):
        if ":" not in chunk:
            continue
        key, value = chunk.split(":", 1)
        declarations[key.strip()] = normalize_value(value)
    return declarations


def selector_pattern(selector: str) -> re.Pattern[str]:
    escaped = r"\s+".join(re.escape(part) for part in selector.strip().split())
    return re.compile(escaped + r"\s*\{(?P<body>[^{}]*)\}", re.MULTILINE)


def block_declarations(css: str, selector: str) -> dict[str, str] | None:
    if "::" not in selector:
        match = selector_pattern(selector).search(css)
        return parse_declarations(match.group("body")) if match else None

    media_selector, inner_selector = selector.split("::", 1)
    media_start = css.find(media_selector)
    if media_start < 0:
        return None
    inner_start = css.find(inner_selector, media_start)
    if inner_start < 0:
        return None
    match = selector_pattern(inner_selector).search(css, inner_start)
    return parse_declarations(match.group("body")) if match else None


def check_css_contract(css: str) -> list[dict[str, Any]]:
    results = []
    for item in CSS_CONTRACT:
        actual = block_declarations(css, item["selector"])
        missing = []
        mismatches = []
        if actual is None:
            missing = sorted(item["declarations"])
        else:
            for key, expected in item["declarations"].items():
                actual_value = actual.get(key)
                if actual_value is None:
                    missing.append(key)
                elif normalize_value(expected) != actual_value:
                    mismatches.append({"property": key, "expected": expected, "actual": actual_value})
        results.append(
            {
                "selector": item["selector"],
                "ok": actual is not None and not missing and not mismatches,
                "missing": missing,
                "mismatches": mismatches,
            },
        )
    return results


def check_required_snippets() -> list[dict[str, Any]]:
    results = []
    for path, snippets in REQUIRED_SNIPPETS.items():
        text = path.read_text(encoding="utf-8") if path.exists() else ""
        missing = [snippet for snippet in snippets if snippet not in text]
        results.append({"path": str(path), "exists": path.exists(), "ok": path.exists() and not missing, "missing": missing})
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Check seven-course typography preservation contract")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    css = CSS_PATH.read_text(encoding="utf-8") if CSS_PATH.exists() else ""
    font_results = [{"path": str(path), "exists": path.exists(), "bytes": path.stat().st_size if path.exists() else 0} for path in FONT_PATHS]
    css_results = check_css_contract(css)
    snippet_results = check_required_snippets()
    assertions = {
        "cssFileExists": CSS_PATH.exists(),
        "fontFilesExist": all(item["exists"] and item["bytes"] > 0 for item in font_results),
        "cssContractOk": all(item["ok"] for item in css_results),
        "requiredSnippetsOk": all(item["ok"] for item in snippet_results),
    }
    report = {
        "generatedAt": now_iso(),
        "writes": False,
        "assertions": assertions,
        "fonts": font_results,
        "cssContract": css_results,
        "requiredSnippets": snippet_results,
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
