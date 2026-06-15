#!/usr/bin/env python3
"""Prepare a no-write copy manifest for public seven-course media.

Input is the no-write availability report produced by
check-seven-media-availability.py. This script does not download media or touch
object storage; it only emits JSON/CSV artifacts for approval review.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def media_kind(ref: str) -> str:
    lower = ref.lower()
    if lower.endswith(('.mp3', '.ogg', '.wav')) or '/audio/' in lower:
        return 'audio'
    if lower.endswith('.pdf') or '/pdf/' in lower:
        return 'pdf'
    if 'youtube.com' in lower or 'youtu.be' in lower:
        return 'video'
    return 'media'


def media_prefix(ref: str) -> str:
    if ref.startswith('/media/'):
        parts = ref.strip('/').split('/')
        return '/'.join(parts[:3]) if len(parts) >= 3 else '/'.join(parts)
    return 'external' if '://' in ref else 'other'


def target_key(ref: str) -> str:
    return ref.lstrip('/')


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Prepare no-write seven media copy manifest')
    parser.add_argument('--availability-report', required=True, help='JSON from check-seven-media-availability.py')
    parser.add_argument('--json-report', required=True, help='output manifest JSON path; use - for stdout')
    parser.add_argument('--csv-report', help='optional output CSV path for available refs')
    parser.add_argument('--missing-csv-report', help='optional output CSV path for missing refs')
    parser.add_argument('--resolver-report', help='optional JSON from check-seven-missing-media-sources.py')
    return parser.parse_args()


def load_report(path: str) -> dict[str, Any]:
    with open(path, encoding='utf-8') as handle:
        return json.load(handle)


def load_resolved_overrides(path: str | None) -> dict[str, dict[str, Any]]:
    if not path:
        return {}
    report = load_report(path)
    overrides: dict[str, dict[str, Any]] = {}
    for item in report.get('refs', []):
        ref = item.get('ref')
        matches = item.get('matches') or []
        if not ref or not matches:
            continue
        match = matches[0]
        overrides[str(ref)] = {
            'ref': str(ref),
            'kind': media_kind(str(ref)),
            'prefix': media_prefix(str(ref)),
            'sourceUrl': match.get('url'),
            'targetKey': target_key(str(ref)),
            'status': match.get('status'),
            'contentType': match.get('contentType'),
            'contentLength': int(match['contentLength']) if str(match.get('contentLength') or '').isdigit() else None,
            'ok': True,
            'error': None,
            'sourceOverride': True,
            'sourceStrategy': match.get('strategy'),
        }
    return overrides


def row_from_result(item: dict[str, Any]) -> dict[str, Any]:
    ref = item['ref']
    return {
        'ref': ref,
        'kind': media_kind(ref),
        'prefix': media_prefix(ref),
        'sourceUrl': item.get('url'),
        'targetKey': target_key(ref),
        'status': item.get('status'),
        'contentType': item.get('contentType'),
        'contentLength': int(item['contentLength']) if str(item.get('contentLength') or '').isdigit() else None,
        'ok': bool(item.get('ok')),
        'error': item.get('error'),
    }


def write_csv(path: str, rows: list[dict[str, Any]]) -> None:
    fields = ['ref', 'kind', 'prefix', 'sourceUrl', 'targetKey', 'status', 'contentType', 'contentLength', 'ok', 'error']
    with open(path, 'w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field) for field in fields})


def main() -> int:
    args = parse_args()
    source = load_report(args.availability_report)
    rows = [row_from_result(item) for item in source.get('results', [])]
    resolved_overrides = load_resolved_overrides(args.resolver_report)
    available = [row for row in rows if row['ok']]
    available.extend(override for ref, override in sorted(resolved_overrides.items()) if ref in {row['ref'] for row in rows if not row['ok']})
    missing = [row for row in rows if not row['ok'] and row['ref'] not in resolved_overrides]
    available_by_kind = Counter(row['kind'] for row in available)
    missing_by_kind = Counter(row['kind'] for row in missing)
    missing_by_prefix = Counter(row['prefix'] for row in missing)
    available_bytes_by_kind: dict[str, int] = {}
    for row in available:
        if row['contentLength'] is not None:
            available_bytes_by_kind[row['kind']] = available_bytes_by_kind.get(row['kind'], 0) + int(row['contentLength'])

    manifest = {
        'generatedAt': now_iso(),
        'writes': False,
        'sourceAvailabilityReport': args.availability_report,
        'sourceResolverReport': args.resolver_report,
        'sourceBaseUrl': source.get('baseUrl'),
        'inputReport': source.get('inputReport'),
        'summary': {
            'totalRefs': len(rows),
            'availableRefs': len(available),
            'missingRefs': len(missing),
            'availableByKind': dict(sorted(available_by_kind.items())),
            'missingByKind': dict(sorted(missing_by_kind.items())),
            'missingByPrefix': dict(missing_by_prefix.most_common()),
            'availableBytesByKind': dict(sorted(available_bytes_by_kind.items())),
            'sourceOverrideRefs': len(resolved_overrides),
        },
        'available': available,
        'missing': missing,
        'approvalBoundary': {
            'copyAllowedOnlyAfterOwnerApproval': True,
            'copyCandidateRows': len(available),
            'excludedMissingRows': len(missing),
            'notes': [
                'This manifest is no-write evidence only.',
                'Copy only rows with ok=true and only after explicit owner approval.',
                'Missing refs require source resolution or documented fallback before claiming complete media parity.',
                'Rows with sourceOverride=true preserve the original target key while copying from the resolved source URL.',
            ],
        },
    }

    payload = json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True)
    if args.json_report == '-':
        print(payload)
    else:
        Path(args.json_report).write_text(payload + '\n', encoding='utf-8')
        print(f'wrote manifest to {args.json_report}')
    if args.csv_report:
        write_csv(args.csv_report, available)
        print(f'wrote available CSV to {args.csv_report}')
    if args.missing_csv_report:
        write_csv(args.missing_csv_report, missing)
        print(f'wrote missing CSV to {args.missing_csv_report}')
    return 0 if not missing else 1


if __name__ == '__main__':
    sys.exit(main())
