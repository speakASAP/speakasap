#!/usr/bin/env python3
"""No-write readiness gate report for the SpeakASAP seven migration.

This script aggregates already-generated no-write evidence. It does not connect to
databases, call the network, copy media, deploy services, or mutate state unless
--json-report writes a local report file.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

EXPECTED_COUNTS = {
    'languages': 19,
    'courses': 19,
    'lessons': 136,
    'exercises': 429,
}
EXPECTED_MEDIA = {
    'audio': 1076,
    'pdf': 136,
    'video': 133,
}
REQUIRED_APPROVAL_DOCS = [
    'CONTENT_BASE_SCHEMA_APPROVAL.md',
    'SEVEN_DATA_MIGRATION_APPROVAL.md',
    'SEVEN_MEDIA_MIGRATION_APPROVAL.md',
    'SEVEN_DEPLOYMENT_APPROVAL.md',
]
ACTIVE_SCHEMA_APPROVAL_DOC = 'CONTENT_BASE_SCHEMA_APPROVAL.md'
SUPERSEDED_SCHEMA_APPROVAL_DOC = 'SEVEN_SCHEMA_MIGRATION_APPROVAL.md'
REQUIRED_SCHEMA_APPROVAL_TEXT = (
    'Approved to apply pending content-service Prisma migrations to the Kubernetes content database '
    'for base schema readiness and seven schema creation only, then run DB-backed no-write '
    'reconciliation. No seven data apply, deploy, object mutation, or legacy route retirement is approved.'
)
SUPERSEDED_SCHEMA_MARKER = (
    'Status: superseded by ' + chr(96) + 'docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md' + chr(96) + '.'
)
FORBIDDEN_ACTIVE_SCHEMA_PHRASES = [
    'Approved to apply only ' + chr(96) + 'content-service/prisma/migrations/20260613110000_seven_content/migration.sql' + chr(96),
    'apply only the content-service seven schema migration',
    'applying only the content-service seven schema migration',
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='No-write seven apply readiness checker')
    parser.add_argument('--dry-run-report', required=True)
    parser.add_argument('--assets-contract-report')
    parser.add_argument('--schema-migration-plan-report')
    parser.add_argument('--data-apply-contract-report')
    parser.add_argument('--post-schema-reconciliation-report')
    parser.add_argument('--media-availability-report')
    parser.add_argument('--media-copy-manifest-report')
    parser.add_argument('--media-approval-contract-report')
    parser.add_argument('--frontend-route-contract-report')
    parser.add_argument('--content-api-contract-report')
    parser.add_argument('--gateway-contract-report')
    parser.add_argument('--deployment-smoke-report')
    parser.add_argument('--deployment-readiness-report')
    parser.add_argument('--approval-dir', default='docs/orchestrator')
    parser.add_argument('--json-report', help='write JSON report to path; use - for stdout')
    return parser.parse_args()


def load_json(path: str | None) -> dict[str, Any] | None:
    if not path:
        return None
    p = Path(path)
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding='utf-8'))

def payload_counts(dry_run: dict[str, Any]) -> dict[str, int]:
    counts = dry_run.get('migrationPayloadCounts') or dry_run.get('payloadCounts') or {}
    return {key: int(counts.get(key, 0) or 0) for key in EXPECTED_COUNTS}

def media_counts(dry_run: dict[str, Any]) -> dict[str, int]:
    media = dry_run.get('migrationMediaRefs') or {}
    by_kind = media.get('uniqueRefsByKind') or {}
    return {key: int(by_kind.get(key, 0) or 0) for key in EXPECTED_MEDIA}


def target_summary(dry_run: dict[str, Any]) -> dict[str, Any]:
    target = dry_run.get('target') or {}
    blocking = dry_run.get('blockingIssues') or []
    return {
        'checked': target.get('checked') is True,
        'reason': target.get('reason'),
        'blockingIssues': blocking,
        'targetBlockingIssues': [issue for issue in blocking if str(issue).startswith('TARGET_')],
        'raw': target,
    }


def media_source_summary(availability: dict[str, Any] | None, manifest: dict[str, Any] | None) -> dict[str, Any]:
    manifest_summary = manifest.get('summary') if isinstance(manifest, dict) else {}
    return {
        'availabilityProvided': availability is not None,
        'availabilityWritesFalse': bool(availability and availability.get('writes') is False),
        'availabilityChecked': int(availability.get('checked', 0) or 0) if availability else 0,
        'availabilityMissing': int(availability.get('missing', 0) or 0) if availability else None,
        'availabilityMissingZero': bool(availability and int(availability.get('missing', 0) or 0) == 0),
        'manifestProvided': manifest is not None,
        'manifestWritesFalse': bool(manifest and manifest.get('writes') is False),
        'manifestTotalRefs': int(manifest_summary.get('totalRefs', 0) or 0),
        'manifestAvailableRefs': int(manifest_summary.get('availableRefs', 0) or 0),
        'manifestMissingRefs': int(manifest_summary.get('missingRefs', 0) or 0),
        'manifestMissingZero': bool(manifest and int(manifest_summary.get('missingRefs', 0) or 0) == 0),
        'availabilityCoversManifest': bool(
            availability
            and manifest
            and int(availability.get('checked', 0) or 0) == int(manifest_summary.get('totalRefs', 0) or 0)
            and int(availability.get('ok', 0) or 0) == int(manifest_summary.get('availableRefs', 0) or 0)
        ),
    }

def approval_docs(dir_path: Path) -> dict[str, Any]:
    docs = {}
    for name in [*REQUIRED_APPROVAL_DOCS, SUPERSEDED_SCHEMA_APPROVAL_DOC]:
        path = dir_path / name
        content = path.read_text(encoding='utf-8') if path.exists() else ''
        docs[name] = {
            'exists': path.exists(),
            'path': str(path),
            'bytes': path.stat().st_size if path.exists() else 0,
            'hasRequiredSchemaApprovalText': REQUIRED_SCHEMA_APPROVAL_TEXT in content,
            'hasSupersededSchemaMarker': SUPERSEDED_SCHEMA_MARKER in content,
            'forbiddenActiveSchemaPhrases': [phrase for phrase in FORBIDDEN_ACTIVE_SCHEMA_PHRASES if phrase in content],
        }
    return docs


def approval_consistency(approvals: dict[str, Any]) -> dict[str, Any]:
    active = approvals.get(ACTIVE_SCHEMA_APPROVAL_DOC) or {}
    superseded = approvals.get(SUPERSEDED_SCHEMA_APPROVAL_DOC) or {}
    required_docs_present = all((approvals.get(name) or {}).get('exists') for name in REQUIRED_APPROVAL_DOCS)
    stale_phrase_docs = {
        name: item.get('forbiddenActiveSchemaPhrases') or []
        for name, item in approvals.items()
        if name != SUPERSEDED_SCHEMA_APPROVAL_DOC and item.get('forbiddenActiveSchemaPhrases')
    }
    return {
        'requiredDocsPresent': required_docs_present,
        'activeSchemaApprovalDoc': ACTIVE_SCHEMA_APPROVAL_DOC,
        'activeSchemaApprovalTextPresent': active.get('hasRequiredSchemaApprovalText') is True,
        'supersededSchemaDoc': SUPERSEDED_SCHEMA_APPROVAL_DOC,
        'supersededSchemaDocMarked': (not superseded.get('exists')) or superseded.get('hasSupersededSchemaMarker') is True,
        'staleActiveSchemaPhrasesAbsent': not stale_phrase_docs,
        'stalePhraseDocs': stale_phrase_docs,
    }


def main() -> int:
    args = parse_args()
    dry_run = load_json(args.dry_run_report)
    if dry_run is None:
        print(f'ERROR: dry-run report not found: {args.dry_run_report}', file=sys.stderr)
        return 2
    assets = load_json(args.assets_contract_report)
    schema_plan = load_json(args.schema_migration_plan_report)
    data_apply_contract = load_json(args.data_apply_contract_report)
    post_schema = load_json(args.post_schema_reconciliation_report)
    media_availability = load_json(args.media_availability_report)
    media_manifest = load_json(args.media_copy_manifest_report)
    media_approval_contract = load_json(args.media_approval_contract_report)
    frontend_route_contract = load_json(args.frontend_route_contract_report)
    content_api_contract = load_json(args.content_api_contract_report)
    gateway_contract = load_json(args.gateway_contract_report)
    smoke = load_json(args.deployment_smoke_report)
    deployment_readiness = load_json(args.deployment_readiness_report)
    approvals = approval_docs(Path(args.approval_dir))

    counts = payload_counts(dry_run)
    media = media_counts(dry_run)
    html_safety = dry_run.get('htmlSafety') or {}
    target = target_summary(dry_run)
    media_source = media_source_summary(media_availability, media_manifest)
    approval = approval_consistency(approvals)
    approval_docs_present = approval['requiredDocsPresent']
    approval_consistent = (
        approval['requiredDocsPresent']
        and approval['activeSchemaApprovalTextPresent']
        and approval['supersededSchemaDocMarked']
        and approval['staleActiveSchemaPhrasesAbsent']
    )
    count_matches = {key: counts.get(key) == expected for key, expected in EXPECTED_COUNTS.items()}
    media_matches = {key: media.get(key) == expected for key, expected in EXPECTED_MEDIA.items()}

    source_gate = {
        'writesFalse': dry_run.get('writes') is False,
        'blockingIssuesEmpty': not dry_run.get('blockingIssues'),
        'payloadCountsMatch': all(count_matches.values()),
        'htmlSafetyOk': html_safety.get('ok') is True,
        'mediaCountsMatch': all(media_matches.values()),
    }
    assets_gate = {
        'provided': assets is not None,
        'ok': bool(assets and assets.get('ok') is True),
        'writesFalse': bool(assets and assets.get('writes') is False),
    }
    schema_plan_gate = {
        'provided': schema_plan is not None,
        'ok': bool(schema_plan and schema_plan.get('ok') is True),
        'writesFalse': bool(schema_plan and schema_plan.get('writes') is False),
        'approvalBoundaryPresent': bool(schema_plan and schema_plan.get('approvalBoundary', {}).get('schemaApplyStillRequiresOwnerApproval') is True),
    }
    schema_gate = {
        'approvalDocsPresent': approval_docs_present,
        'approvalDocsConsistent': approval_consistent,
        'sourceDryRunReady': all(source_gate.values()),
        'assetsContractReady': all(assets_gate.values()),
        'schemaMigrationPlanReady': all(schema_plan_gate.values()),
        'readyForOwnerSchemaApproval': approval_consistent and all(source_gate.values()) and all(assets_gate.values()) and all(schema_plan_gate.values()),
    }
    data_apply_contract_gate = {
        'provided': data_apply_contract is not None,
        'ok': bool(data_apply_contract and data_apply_contract.get('ok') is True),
        'writesFalse': bool(data_apply_contract and data_apply_contract.get('writes') is False),
        'approvalBoundaryPresent': bool(data_apply_contract and data_apply_contract.get('approvalBoundary', {}).get('dataApplyStillRequiresOwnerApproval') is True),
    }
    post_schema_gate = {
        'provided': post_schema is not None,
        'ok': bool(post_schema and post_schema.get('ok') is True),
        'writesFalse': bool(post_schema and post_schema.get('writes') is False),
        'schemaReady': bool(post_schema and post_schema.get('schemaReady') is True),
        'dataReady': bool(post_schema and post_schema.get('dataReady') is True),
    }
    data_gate = {
        'targetChecked': post_schema_gate['provided'] and post_schema_gate['writesFalse'],
        'targetBlockingIssuesEmpty': post_schema_gate['schemaReady'],
        'dataApplyContractReady': all(data_apply_contract_gate.values()),
        'postSchemaReconciliationReady': post_schema_gate['provided'] and post_schema_gate['writesFalse'] and post_schema_gate['schemaReady'],
        'postSchemaDataReady': post_schema_gate['dataReady'],
        'readyForOwnerDataApproval': (
            all(source_gate.values())
            and all(data_apply_contract_gate.values())
            and post_schema_gate['provided']
            and post_schema_gate['writesFalse']
            and post_schema_gate['schemaReady']
        ),
    }
    media_approval_contract_gate = {
        'provided': media_approval_contract is not None,
        'ok': bool(media_approval_contract and media_approval_contract.get('ok') is True),
        'writesFalse': bool(media_approval_contract and media_approval_contract.get('writes') is False),
        'approvalBoundaryPresent': bool(media_approval_contract and media_approval_contract.get('approvalBoundary', {}).get('mediaCopyStillRequiresOwnerApproval') is True),
    }
    media_source_gate = {
        **media_source,
        'mediaApprovalContractReady': all(media_approval_contract_gate.values()),
        'readyForOwnerMediaApproval': (
            media_source['availabilityProvided']
            and media_source['availabilityWritesFalse']
            and media_source['availabilityMissingZero']
            and media_source['manifestProvided']
            and media_source['manifestWritesFalse']
            and media_source['manifestMissingZero']
            and media_source['availabilityCoversManifest']
            and all(media_approval_contract_gate.values())
        ),
    }
    frontend_route_contract_gate = {
        'provided': frontend_route_contract is not None,
        'ok': bool(frontend_route_contract and frontend_route_contract.get('ok') is True),
        'writesFalse': bool(frontend_route_contract and frontend_route_contract.get('writes') is False),
        'approvalBoundaryPresent': bool(frontend_route_contract and frontend_route_contract.get('approvalBoundary', {}).get('frontendDeployStillRequiresOwnerApproval') is True),
    }
    content_api_contract_gate = {
        'provided': content_api_contract is not None,
        'ok': bool(content_api_contract and content_api_contract.get('ok') is True),
        'writesFalse': bool(content_api_contract and content_api_contract.get('writes') is False),
        'approvalBoundaryPresent': bool(content_api_contract and content_api_contract.get('approvalBoundary', {}).get('contentDeployStillRequiresOwnerApproval') is True),
    }
    gateway_contract_gate = {
        'provided': gateway_contract is not None,
        'ok': bool(gateway_contract and gateway_contract.get('ok') is True),
        'writesFalse': bool(gateway_contract and gateway_contract.get('writes') is False),
        'approvalBoundaryPresent': bool(gateway_contract and gateway_contract.get('approvalBoundary', {}).get('gatewayDeployStillRequiresOwnerApproval') is True),
    }
    deployment_readiness_gate = {
        'provided': deployment_readiness is not None,
        'ok': bool(deployment_readiness and deployment_readiness.get('ok') is True),
        'writesFalse': bool(deployment_readiness and deployment_readiness.get('writes') is False),
        'scopedApprovalReady': bool(deployment_readiness and deployment_readiness.get('readyForOwnerDeploymentApproval') is True),
        'cutoverStillFalse': bool(deployment_readiness and deployment_readiness.get('readyForCutover') is False),
    }
    deploy_gate = {
        **deployment_readiness_gate,
        'deploymentSmokeProvided': smoke is not None,
        'deploymentSmokeOk': bool(smoke and smoke.get('ok') is True),
        'frontendRouteContractReady': all(frontend_route_contract_gate.values()),
        'contentApiContractReady': all(content_api_contract_gate.values()),
        'gatewayContractReady': all(gateway_contract_gate.values()),
        'readyForOwnerDeploymentApproval': all(deployment_readiness_gate.values()) and all(frontend_route_contract_gate.values()) and all(content_api_contract_gate.values()) and all(gateway_contract_gate.values()),
        'readyForCutover': bool(smoke and smoke.get('ok') is True) and data_gate['readyForOwnerDataApproval'] and media_source_gate['readyForOwnerMediaApproval'],
    }

    if not schema_gate['readyForOwnerSchemaApproval']:
        next_action = 'Fix no-write source/assets evidence before requesting schema approval.'
    elif not data_gate['readyForOwnerDataApproval']:
        next_action = 'Get explicit schema-only approval, apply content-service schema migrations, then rerun DB-backed no-write reconciliation.'
    elif not media_source_gate['readyForOwnerMediaApproval']:
        next_action = 'Refresh media source availability and copy manifest evidence before media approval.'
    elif not deploy_gate['readyForCutover']:
        next_action = 'Request separate data/media/deploy approvals in order, then rerun production smoke.'
    else:
        next_action = 'All readiness gates report ready; perform final completion audit before marking the goal complete.'

    report: dict[str, Any] = {
        'generatedAt': now_iso(),
        'writes': False,
        'inputs': {
            'dryRunReport': args.dry_run_report,
            'assetsContractReport': args.assets_contract_report,
            'schemaMigrationPlanReport': args.schema_migration_plan_report,
            'dataApplyContractReport': args.data_apply_contract_report,
            'postSchemaReconciliationReport': args.post_schema_reconciliation_report,
            'mediaAvailabilityReport': args.media_availability_report,
            'mediaCopyManifestReport': args.media_copy_manifest_report,
            'mediaApprovalContractReport': args.media_approval_contract_report,
            'frontendRouteContractReport': args.frontend_route_contract_report,
            'contentApiContractReport': args.content_api_contract_report,
            'gatewayContractReport': args.gateway_contract_report,
            'deploymentSmokeReport': args.deployment_smoke_report,
            'deploymentReadinessReport': args.deployment_readiness_report,
            'approvalDir': args.approval_dir,
        },
        'counts': {
            'payload': counts,
            'payloadMatchesExpected': count_matches,
            'media': media,
            'mediaMatchesExpected': media_matches,
        },
        'htmlSafety': html_safety,
        'target': target,
        'mediaSource': media_source,
        'approvalDocs': approvals,
        'approvalConsistency': approval,
        'gates': {
            'source': source_gate,
            'assets': assets_gate,
            'schemaMigrationPlan': schema_plan_gate,
            'schema': schema_gate,
            'dataApplyContract': data_apply_contract_gate,
            'postSchemaReconciliation': post_schema_gate,
            'data': data_gate,
            'mediaApprovalContract': media_approval_contract_gate,
            'mediaSource': media_source_gate,
            'frontendRouteContract': frontend_route_contract_gate,
            'contentApiContract': content_api_contract_gate,
            'gatewayContract': gateway_contract_gate,
            'deploy': deploy_gate,
        },
        'nextAction': next_action,
        'ok': schema_gate['readyForOwnerSchemaApproval'],
        'complete': deploy_gate['readyForCutover'],
    }
    payload = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
    if args.json_report and args.json_report != '-':
        Path(args.json_report).write_text(payload + "\n", encoding="utf-8")
        print(f'wrote report to {args.json_report}')
    else:
        print(payload)
    return 0 if report['ok'] else 1

if __name__ == '__main__':
    sys.exit(main())
