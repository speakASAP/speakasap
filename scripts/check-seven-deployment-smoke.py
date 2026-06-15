#!/usr/bin/env python3
"""No-write smoke checks for deployed seven-course frontend/API routes."""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

LEGACY_TEMPLATE_PATTERNS = (
    ("djangoBlock", re.compile(r"{%|%}")),
    ("djangoVariable", re.compile(r"{{|}}")),
    ("scriptTag", re.compile(r"<\s*script\b", re.IGNORECASE)),
    ("formTag", re.compile(r"<\s*form\b", re.IGNORECASE)),
    ("inlineHandler", re.compile(r"\son[a-z]+\s*=", re.IGNORECASE)),
    ("javascriptUrl", re.compile(r"javascript\s*:", re.IGNORECASE)),
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="No-write deployed seven route smoke checker")
    parser.add_argument("--base-url", default="https://speakasap.alfares.cz")
    parser.add_argument("--language-code", default="en")
    parser.add_argument("--lesson-order", default="1")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    parser.add_argument("--timeout", type=float, default=15.0)
    parser.add_argument("--body-limit", type=int, default=500000)
    parser.add_argument("--assets-base-url", default="https://assets.alfares.cz")
    return parser.parse_args()


def request(url: str, timeout: float, method: str = "GET", body_limit: int = 500000) -> dict[str, Any]:
    req = urllib.request.Request(url, method=method, headers={"User-Agent": "speakasap-seven-smoke/1.1"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read(body_limit) if method == "GET" else b""
            return {
                "url": url,
                "ok": 200 <= response.status < 400,
                "status": response.status,
                "contentType": response.headers.get("content-type"),
                "contentLength": response.headers.get("content-length"),
                "bodySample": body.decode("utf-8", errors="replace"),
            }
    except urllib.error.HTTPError as exc:
        body = exc.read(body_limit) if method == "GET" else b""
        return {
            "url": url,
            "ok": False,
            "status": exc.code,
            "contentType": exc.headers.get("content-type") if exc.headers else None,
            "contentLength": exc.headers.get("content-length") if exc.headers else None,
            "bodySample": body.decode("utf-8", errors="replace"),
            "error": str(exc),
        }
    except Exception as exc:  # noqa: BLE001 - smoke report should capture failures
        return {"url": url, "ok": False, "status": None, "error": str(exc), "bodySample": ""}


def parse_json(result: dict[str, Any]) -> Any | None:
    if not result.get("ok"):
        return None
    try:
        return json.loads(result.get("bodySample") or "null")
    except Exception:
        return None


def unresolved_legacy_issues(value: str) -> list[str]:
    return [name for name, pattern in LEGACY_TEMPLATE_PATTERNS if pattern.search(value or "")]


def has_media_kind(refs: Any, expected_kind: str) -> bool:
    if not isinstance(refs, list):
        return False
    return any(isinstance(ref, dict) and ref.get("kind") == expected_kind and isinstance(ref.get("href"), str) for ref in refs)


def main() -> int:
    args = parse_args()
    base = args.base_url.rstrip("/")
    language = args.language_code.strip("/")
    order = args.lesson_order.strip("/")
    pdf_path = f"media/pdf/{language}/lesson{order}.pdf"
    audio_path = f"media/audio/{language}/lesson{order}.mp3"
    assets_base = args.assets_base_url.rstrip("/")
    media_base = assets_base or base
    checks = {
        "health": request(urljoin(base + "/", "health"), args.timeout, "GET", args.body_limit),
        "coursePage": request(urljoin(base + "/", f"{language}/seven"), args.timeout, "GET", args.body_limit),
        "lessonPage": request(urljoin(base + "/", f"{language}/seven/{order}"), args.timeout, "GET", args.body_limit),
        "courseApi": request(urljoin(base + "/", f"api/v1/seven/courses/{language}"), args.timeout, "GET", args.body_limit),
        "lessonsApi": request(urljoin(base + "/", f"api/v1/seven/courses/{language}/lessons"), args.timeout, "GET", args.body_limit),
        "lessonApi": request(urljoin(base + "/", f"api/v1/seven/courses/{language}/lessons/{order}"), args.timeout, "GET", args.body_limit),
        "pdfHead": request(urljoin(media_base + "/", pdf_path), args.timeout, "HEAD", args.body_limit),
        "audioHead": request(urljoin(media_base + "/", audio_path), args.timeout, "HEAD", args.body_limit),
    }

    course_data = parse_json(checks["courseApi"])
    lessons_data = parse_json(checks["lessonsApi"])
    lesson_data = parse_json(checks["lessonApi"])
    lesson_body = lesson_data.get("bodyHtml") if isinstance(lesson_data, dict) else ""
    lesson_exercises = lesson_data.get("exercises") if isinstance(lesson_data, dict) else None
    lesson_media_refs = lesson_data.get("mediaRefs") if isinstance(lesson_data, dict) else None
    lesson_page = checks["lessonPage"].get("bodySample") or ""
    course_page = checks["coursePage"].get("bodySample") or ""

    lessons_include_order = False
    if isinstance(lessons_data, list):
        lessons_include_order = any(isinstance(item, dict) and str(item.get("order")) == order for item in lessons_data)

    expected_pdf_href = urljoin(media_base + "/", pdf_path) if assets_base else "/" + pdf_path
    contract = {
        "courseJsonShape": isinstance(course_data, dict)
        and isinstance(course_data.get("title"), str)
        and isinstance(course_data.get("lessonsCount"), int)
        and course_data.get("lessonsCount", 0) > 0,
        "lessonsJsonShape": isinstance(lessons_data, list) and len(lessons_data) > 0 and lessons_include_order,
        "lessonJsonShape": isinstance(lesson_data, dict)
        and isinstance(lesson_data.get("title"), str)
        and isinstance(lesson_body, str)
        and bool(lesson_body.strip()),
        "lessonExercisesShape": isinstance(lesson_exercises, list),
        "lessonPdfHref": isinstance(lesson_data, dict) and lesson_data.get("pdfHref") == expected_pdf_href,
        "lessonMediaRefsIncludePdf": has_media_kind(lesson_media_refs, "pdf"),
        "lessonHtmlSafety": isinstance(lesson_body, str) and not unresolved_legacy_issues(lesson_body),
        "coursePageMarkers": "seven-page" in course_page and "seven-lessons-grid" in course_page,
        "lessonPageMarkers": "seven-page--lesson" in lesson_page
        and "lesson__content--seven" in lesson_page
        and "lesson-wrapper" in lesson_page,
        "lessonPageNoTemplateSyntax": not unresolved_legacy_issues(lesson_page),
    }
    assertions = {
        "healthOk": checks["health"].get("status") == 200,
        "coursePageOk": checks["coursePage"].get("status") == 200,
        "lessonPageOk": checks["lessonPage"].get("status") == 200,
        "courseApiOk": checks["courseApi"].get("status") == 200,
        "lessonsApiOk": checks["lessonsApi"].get("status") == 200,
        "lessonApiOk": checks["lessonApi"].get("status") == 200,
        "pdfOk": checks["pdfHead"].get("status") == 200,
        "audioOk": checks["audioHead"].get("status") == 200,
        **contract,
    }
    diagnostics = {
        "courseApiKeys": sorted(course_data.keys()) if isinstance(course_data, dict) else [],
        "lessonApiKeys": sorted(lesson_data.keys()) if isinstance(lesson_data, dict) else [],
        "lessonsApiCount": len(lessons_data) if isinstance(lessons_data, list) else None,
        "lessonExerciseCount": len(lesson_exercises) if isinstance(lesson_exercises, list) else None,
        "lessonHtmlIssues": unresolved_legacy_issues(lesson_body) if isinstance(lesson_body, str) else ["missingBodyHtml"],
        "lessonPageIssues": unresolved_legacy_issues(lesson_page),
        "expectedPdfHref": expected_pdf_href,
    }
    report = {
        "generatedAt": now_iso(),
        "writes": False,
        "baseUrl": base,
        "assetsBaseUrl": assets_base,
        "languageCode": language,
        "lessonOrder": order,
        "checks": checks,
        "assertions": assertions,
        "diagnostics": diagnostics,
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
