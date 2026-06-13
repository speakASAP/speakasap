#!/usr/bin/env python3
"""No-write smoke checks for deployed seven-course frontend/API routes."""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='No-write deployed seven route smoke checker')
    parser.add_argument('--base-url', default='https://speakasap.alfares.cz')
    parser.add_argument('--language-code', default='en')
    parser.add_argument('--lesson-order', default='1')
    parser.add_argument('--json-report', help='write JSON report to path; use - for stdout')
    parser.add_argument('--timeout', type=float, default=15.0)
    return parser.parse_args()


def request(url: str, timeout: float, method: str = 'GET') -> dict[str, Any]:
    req = urllib.request.Request(url, method=method, headers={'User-Agent': 'speakasap-seven-smoke/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read(100000) if method == 'GET' else b''
            return {
                'url': url,
                'ok': 200 <= response.status < 400,
                'status': response.status,
                'contentType': response.headers.get('content-type'),
                'contentLength': response.headers.get('content-length'),
                'bodySample': body.decode('utf-8', errors='replace')[:1000],
            }
    except urllib.error.HTTPError as exc:
        body = exc.read(100000) if method == 'GET' else b''
        return {
            'url': url,
            'ok': False,
            'status': exc.code,
            'contentType': exc.headers.get('content-type') if exc.headers else None,
            'contentLength': exc.headers.get('content-length') if exc.headers else None,
            'bodySample': body.decode('utf-8', errors='replace')[:1000],
            'error': str(exc),
        }
    except Exception as exc:  # noqa: BLE001 - smoke report should capture failures
        return {'url': url, 'ok': False, 'status': None, 'error': str(exc), 'bodySample': ''}


def expect_json_item(result: dict[str, Any], key: str | None = None) -> bool:
    if not result.get('ok'):
        return False
    try:
        data = json.loads(result.get('bodySample') or '{}')
    except Exception:
        return False
    if key is None:
        return True
    return key in data


def main() -> int:
    args = parse_args()
    base = args.base_url.rstrip('/')
    language = args.language_code.strip('/')
    order = args.lesson_order.strip('/')
    checks = {
        'health': request(urljoin(base + '/', 'health'), args.timeout, 'GET'),
        'coursePage': request(urljoin(base + '/', f'{language}/seven'), args.timeout, 'GET'),
        'lessonPage': request(urljoin(base + '/', f'{language}/seven/{order}'), args.timeout, 'GET'),
        'courseApi': request(urljoin(base + '/', f'api/v1/seven/courses/{language}'), args.timeout, 'GET'),
        'lessonsApi': request(urljoin(base + '/', f'api/v1/seven/courses/{language}/lessons'), args.timeout, 'GET'),
        'lessonApi': request(urljoin(base + '/', f'api/v1/seven/courses/{language}/lessons/{order}'), args.timeout, 'GET'),
        'pdfHead': request(urljoin(base + '/', f'media/pdf/{language}/lesson{order}.pdf'), args.timeout, 'HEAD'),
        'audioHead': request(urljoin(base + '/', f'media/audio/{language}/lesson{order}.mp3'), args.timeout, 'HEAD'),
    }
    assertions = {
        'healthOk': checks['health'].get('status') == 200,
        'coursePageOk': checks['coursePage'].get('status') == 200,
        'lessonPageOk': checks['lessonPage'].get('status') == 200,
        'courseApiOk': checks['courseApi'].get('status') == 200 and expect_json_item(checks['courseApi'], 'lessonsCount'),
        'lessonsApiOk': checks['lessonsApi'].get('status') == 200,
        'lessonApiOk': checks['lessonApi'].get('status') == 200 and expect_json_item(checks['lessonApi'], 'bodyHtml'),
        'pdfOk': checks['pdfHead'].get('status') == 200,
        'audioOk': checks['audioHead'].get('status') == 200,
    }
    report = {
        'generatedAt': now_iso(),
        'writes': False,
        'baseUrl': base,
        'languageCode': language,
        'lessonOrder': order,
        'checks': checks,
        'assertions': assertions,
        'ok': all(assertions.values()),
    }
    payload = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
    if args.json_report and args.json_report != '-':
        Path(args.json_report).write_text(payload + '\n', encoding='utf-8')
        print(f'wrote report to {args.json_report}')
    else:
        print(payload)
    return 0 if report['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
