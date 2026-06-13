#!/usr/bin/env python3
"""No-write availability check for seven-course media refs.

Reads a seven migration dry-run/apply JSON report and verifies whether reported
media refs are reachable from a supplied public base URL. Defaults to checking
only internal /media refs; external video URLs can be included explicitly.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='No-write seven media availability checker')
    parser.add_argument('--input-report', required=True, help='seven migration JSON report path')
    parser.add_argument('--base-url', required=True, help='base URL for relative /media refs, e.g. https://speakasap.alfares.cz')
    parser.add_argument('--json-report', help='write availability JSON report to path; use - for stdout')
    parser.add_argument('--limit', type=int, default=0, help='limit refs checked; 0 checks all refs')
    parser.add_argument('--include-external', action='store_true', help='also check absolute external refs such as YouTube')
    parser.add_argument('--timeout', type=float, default=10.0)
    parser.add_argument('--workers', type=int, default=12)
    return parser.parse_args()


def load_refs(path: str, include_external: bool, limit: int) -> list[str]:
    with open(path, encoding='utf-8') as handle:
        report = json.load(handle)
    refs = report.get('migrationMediaRefs', {}).get('refs') or report.get('migrationMediaRefs', {}).get('sample') or []
    filtered = [ref for ref in refs if include_external or ref.startswith('/media/')]
    return filtered[:limit] if limit and limit > 0 else filtered


def to_url(base_url: str, ref: str) -> str:
    if ref.startswith('http://') or ref.startswith('https://'):
        return ref
    return urljoin(base_url.rstrip('/') + '/', ref.lstrip('/'))


def check_one(base_url: str, ref: str, timeout: float) -> dict[str, Any]:
    url = to_url(base_url, ref)
    request = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'speakasap-seven-media-check/1.0'})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return {
                'ref': ref,
                'url': url,
                'ok': 200 <= response.status < 400,
                'status': response.status,
                'contentType': response.headers.get('content-type'),
                'contentLength': response.headers.get('content-length'),
            }
    except urllib.error.HTTPError as exc:
        return {'ref': ref, 'url': url, 'ok': False, 'status': exc.code, 'error': str(exc)}
    except Exception as exc:  # noqa: BLE001 - report availability, do not crash batch
        return {'ref': ref, 'url': url, 'ok': False, 'status': None, 'error': str(exc)}


def main() -> int:
    args = parse_args()
    refs = load_refs(args.input_report, args.include_external, args.limit)
    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = [executor.submit(check_one, args.base_url, ref, args.timeout) for ref in refs]
        for future in as_completed(futures):
            results.append(future.result())
    results.sort(key=lambda item: item['ref'])
    ok_count = sum(1 for item in results if item['ok'])
    report = {
        'generatedAt': now_iso(),
        'writes': False,
        'baseUrl': args.base_url,
        'inputReport': args.input_report,
        'checked': len(results),
        'ok': ok_count,
        'missing': len(results) - ok_count,
        'statusCounts': {str(status): sum(1 for item in results if item.get('status') == status) for status in sorted({item.get('status') for item in results}, key=lambda value: str(value))},
        'failuresSample': [item for item in results if not item['ok']][:50],
        'results': results,
    }
    payload = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
    if args.json_report and args.json_report != '-':
        with open(args.json_report, 'w', encoding='utf-8') as handle:
            handle.write(payload + '\n')
        print(f'wrote report to {args.json_report}')
    else:
        print(payload)
    return 0 if report['missing'] == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
