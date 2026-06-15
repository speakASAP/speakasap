#!/usr/bin/env python3
"""No-write resolver for missing seven-course media refs.

Input: a media availability report with missing /media refs.
Output: JSON showing HEAD results for candidate source URL variants.
"""
from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin


DEFAULT_BASES = [
    "https://speakasap.com",
    "https://www.speakasap.com",
    "https://old.speakasap.com",
    "https://speakasap.ru",
    "https://www.speakasap.ru",
    "https://assets.alfares.cz",
    "https://speakasap.alfares.cz",
]

PREFIX_VARIANTS = [
    "/media/audio/ru/",
    "/media/audio/russian/",
    "/media/audio/japanese/",
    "/media/audio/ja/",
    "/media/audio/jp/",
    "/media/audio/ru/japanese/",
    "/media/audio/japanese/ru/",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Resolve missing seven media refs without downloading")
    parser.add_argument("--availability-report", required=True)
    parser.add_argument("--json-report", required=True)
    parser.add_argument("--timeout", type=float, default=8.0)
    parser.add_argument("--workers", type=int, default=16)
    return parser.parse_args()


def load_missing(path: str) -> list[str]:
    report = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = [item for item in report.get("results", []) if not item.get("ok")]
    return sorted({str(item["ref"]) for item in rows if str(item.get("ref", "")).startswith("/media/")})


def candidate_urls(ref: str) -> list[dict[str, str]]:
    filename = ref.rsplit("/", 1)[-1]
    candidates: list[dict[str, str]] = []
    for base in DEFAULT_BASES:
        candidates.append({"strategy": "same_path", "url": urljoin(base.rstrip("/") + "/", ref.lstrip("/"))})
        for prefix in PREFIX_VARIANTS:
            candidates.append({"strategy": "prefix:" + prefix, "url": urljoin(base.rstrip("/") + "/", (prefix + filename).lstrip("/"))})
    # Keep order while removing duplicates.
    seen: set[str] = set()
    unique = []
    for item in candidates:
        if item["url"] in seen:
            continue
        seen.add(item["url"])
        unique.append(item)
    return unique


def head(url: str, timeout: float) -> dict[str, Any]:
    request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "speakasap-seven-missing-media-resolver/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return {
                "ok": 200 <= response.status < 400,
                "status": response.status,
                "contentType": response.headers.get("content-type"),
                "contentLength": response.headers.get("content-length"),
            }
    except urllib.error.HTTPError as exc:
        return {"ok": False, "status": exc.code, "error": str(exc)}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "status": None, "error": str(exc)}


def main() -> int:
    args = parse_args()
    refs = load_missing(args.availability_report)
    jobs = []
    for ref in refs:
        for candidate in candidate_urls(ref):
            jobs.append((ref, candidate))

    results_by_ref: dict[str, list[dict[str, Any]]] = {ref: [] for ref in refs}
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = {executor.submit(head, candidate["url"], args.timeout): (ref, candidate) for ref, candidate in jobs}
        for future in as_completed(futures):
            ref, candidate = futures[future]
            item = dict(candidate)
            item.update(future.result())
            results_by_ref[ref].append(item)

    ref_reports = []
    resolved = 0
    for ref in refs:
        candidates = sorted(results_by_ref[ref], key=lambda item: (not item.get("ok"), str(item.get("status")), item["url"]))
        matches = [item for item in candidates if item.get("ok")]
        if matches:
            resolved += 1
        ref_reports.append({"ref": ref, "resolved": bool(matches), "matches": matches, "candidates": candidates[:20]})

    report = {
        "generatedAt": now_iso(),
        "writes": False,
        "inputReport": args.availability_report,
        "missingRefs": len(refs),
        "resolvedRefs": resolved,
        "unresolvedRefs": len(refs) - resolved,
        "basesChecked": DEFAULT_BASES,
        "prefixVariantsChecked": PREFIX_VARIANTS,
        "refs": ref_reports,
        "ok": resolved == len(refs),
    }
    payload = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
    Path(args.json_report).write_text(payload + "\n", encoding="utf-8")
    print(f"wrote report to {args.json_report}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
