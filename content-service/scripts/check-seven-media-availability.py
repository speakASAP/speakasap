#!/usr/bin/env python3
"""No-write availability check for seven-course media refs.

Reads a seven migration dry-run/apply JSON report and verifies whether reported
media refs are reachable from a supplied public base URL. Defaults to checking
only internal /media refs; external video URLs can be included explicitly.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import time
import sys
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
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--retries', type=int, default=2)
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


def request_once(url: str, method: str, timeout: float) -> dict[str, Any]:
    cmd = [
        'curl',
        '-sS',
        '--max-time',
        str(timeout),
        '-A',
        'curl/8.5.0',
        '-o',
        '/dev/null',
        '-w',
        '%{http_code}\\t%{content_type}\\t%{size_download}',
    ]
    if method == 'HEAD':
        cmd.extend(['-I'])
    else:
        cmd.extend(['--range', '0-0'])
    cmd.append(url)
    completed = subprocess.run(cmd, text=True, capture_output=True)
    stdout = completed.stdout.strip()
    status_text = stdout.split('\t', 1)[0] if stdout else '000'
    try:
        status = int(status_text)
    except ValueError:
        status = 0
    return {
        'ok': completed.returncode == 0 and 200 <= status < 400,
        'status': status or None,
        'contentType': stdout.split('\t')[1] if stdout.count('\t') >= 1 else None,
        'contentLength': stdout.split('\t')[2] if stdout.count('\t') >= 2 else None,
        'method': method,
        'error': completed.stderr.strip() or None,
    }


def check_one(base_url: str, ref: str, timeout: float, retries: int) -> dict[str, Any]:
    url = to_url(base_url, ref)
    errors = []
    for attempt in range(max(1, retries + 1)):
        for method in ('HEAD', 'GET'):
            result = request_once(url, method, timeout)
            if result['ok']:
                result.update({'ref': ref, 'url': url, 'attempt': attempt + 1})
                return result
            errors.append(f'{method}: status={result.get("status")} error={result.get("error")}')
        if attempt < retries:
            time.sleep(min(2.0, 0.25 * (attempt + 1)))
    return {'ref': ref, 'url': url, 'ok': False, 'status': None, 'error': '; '.join(errors[-4:]), 'attempt': max(1, retries + 1)}


def main() -> int:
    args = parse_args()
    refs = load_refs(args.input_report, args.include_external, args.limit)
    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = [executor.submit(check_one, args.base_url, ref, args.timeout, args.retries) for ref in refs]
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
        'ok': len(results) - ok_count == 0,
        'okCount': ok_count,
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
