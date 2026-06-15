#!/usr/bin/env python3
"""No-write contract checker for seven-course media URL mapping."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='No-write seven assets contract checker')
    parser.add_argument('--input-report', required=True, help='seven migration dry-run/apply JSON report')
    parser.add_argument('--assets-base-url', default='https://assets.alfares.cz')
    parser.add_argument('--json-report', help='write JSON report to path; use - for stdout')
    parser.add_argument('--sample-limit', type=int, default=25)
    return parser.parse_args()


def media_kind(ref: str) -> str:
    lower = ref.lower()
    if lower.endswith(('.mp3', '.ogg')) or '/audio/' in lower:
        return 'audio'
    if lower.endswith('.pdf') or '/pdf/' in lower:
        return 'pdf'
    if 'youtube.com' in lower or 'youtu.be' in lower or lower.endswith('.mp4'):
        return 'video'
    if lower.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg')):
        return 'image'
    return 'media'


def load_refs(path: Path) -> tuple[list[str], list[str], int | None]:
    data = json.loads(path.read_text(encoding='utf-8'))
    media = data.get('migrationMediaRefs') or {}
    refs = [ref for ref in media.get('refs') or [] if isinstance(ref, str)]
    raw_planned = media.get('plannedPdfRefs')
    planned_pdf_count = raw_planned if isinstance(raw_planned, int) else None
    planned_pdf_refs = [ref for ref in raw_planned if isinstance(ref, str)] if isinstance(raw_planned, list) else []
    return refs, planned_pdf_refs, planned_pdf_count


def public_href(base_url: str, ref: str) -> str:
    if ref.startswith('http://') or ref.startswith('https://'):
        return ref
    return urljoin(base_url.rstrip('/') + '/', ref.lstrip('/'))


def main() -> int:
    args = parse_args()
    input_report = Path(args.input_report)
    refs, planned_pdf_refs, planned_pdf_count = load_refs(input_report)
    assets_base = args.assets_base_url.rstrip('/')
    parsed_assets_base = urlparse(assets_base)

    internal_refs = [ref for ref in refs if ref.startswith('/media/')]
    external_refs = [ref for ref in refs if ref.startswith(('http://', 'https://'))]
    invalid_refs = [ref for ref in refs if ref not in internal_refs and ref not in external_refs]
    duplicate_refs = sorted({ref for ref in refs if refs.count(ref) > 1})
    mapped_internal = [public_href(assets_base, ref) for ref in internal_refs]
    duplicate_mapped = sorted({href for href in mapped_internal if mapped_internal.count(href) > 1})
    mapped_with_wrong_host = [href for href in mapped_internal if urlparse(href).netloc != parsed_assets_base.netloc]
    mapped_without_media_path = [href for href in mapped_internal if not urlparse(href).path.startswith('/media/')]
    pdf_refs = [ref for ref in refs if media_kind(ref) == 'pdf']
    planned_pdf_missing_from_refs = [ref for ref in planned_pdf_refs if ref not in refs]
    planned_pdf_count_mismatch = planned_pdf_count is not None and planned_pdf_count != len(pdf_refs)

    counts_by_kind: dict[str, int] = {}
    for ref in refs:
        kind = media_kind(ref)
        counts_by_kind[kind] = counts_by_kind.get(kind, 0) + 1

    assertions = {
        'assetsBaseUrlIsAbsoluteHttps': parsed_assets_base.scheme == 'https' and bool(parsed_assets_base.netloc),
        'hasMediaRefs': len(refs) > 0,
        'allRefsClassified': not invalid_refs,
        'noDuplicateRefs': not duplicate_refs,
        'noDuplicateMappedInternalRefs': not duplicate_mapped,
        'mappedInternalRefsUseAssetsHost': not mapped_with_wrong_host,
        'mappedInternalRefsPreserveMediaPrefix': not mapped_without_media_path,
        'plannedPdfRefsIncluded': not planned_pdf_missing_from_refs,
        'plannedPdfCountMatchesRefs': not planned_pdf_count_mismatch,
    }
    sample_limit = max(0, args.sample_limit)
    report: dict[str, Any] = {
        'generatedAt': now_iso(),
        'writes': False,
        'inputReport': str(input_report),
        'assetsBaseUrl': assets_base,
        'counts': {
            'refs': len(refs),
            'internalRefs': len(internal_refs),
            'externalRefs': len(external_refs),
            'plannedPdfRefs': len(planned_pdf_refs),
            'plannedPdfRefCount': planned_pdf_count,
            'pdfRefs': len(pdf_refs),
            'byKind': counts_by_kind,
        },
        'samples': {
            'mappedInternalRefs': [
                {'legacyRef': ref, 'publicHref': public_href(assets_base, ref)}
                for ref in internal_refs[:sample_limit]
            ],
            'externalRefs': external_refs[:sample_limit],
        },
        'issues': {
            'invalidRefs': invalid_refs[:sample_limit],
            'duplicateRefs': duplicate_refs[:sample_limit],
            'duplicateMappedInternalRefs': duplicate_mapped[:sample_limit],
            'mappedWithWrongHost': mapped_with_wrong_host[:sample_limit],
            'mappedWithoutMediaPath': mapped_without_media_path[:sample_limit],
            'plannedPdfMissingFromRefs': planned_pdf_missing_from_refs[:sample_limit],
            'plannedPdfCountMismatch': planned_pdf_count_mismatch,
        },
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
