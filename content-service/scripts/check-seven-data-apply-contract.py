#!/usr/bin/env python3
"""No-write static contract checker for seven content data apply/rollback."""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


EXPECTED_COUNTS = {
    "languages": 19,
    "courses": 19,
    "lessons": 136,
    "exercises": 429,
}

REQUIRED_SNIPPETS = [
    "if args.apply:",
    "if not args.confirm_write:",
    "ERROR: --apply requires --confirm-write",
    "if not args.approval_note:",
    "ERROR: --apply requires --approval-note",
    "if not args.rollback_plan:",
    "ERROR: --apply requires --rollback-plan",
    "if report['blockingIssues']:",
    "ERROR: --apply refused because dry-run blocking issues exist",
    "ERROR: --apply requires CONTENT_TARGET_DATABASE_URL/CONTENT_DATABASE_URL/DATABASE_URL/TARGET_DATABASE_URL",
    "write_rollback_sql(args.rollback_plan, language_rows, course_rows, lesson_rows, exercise_rows, args.approval_note, args.include_languages)",
    "execute_apply(conn, language_rows, course_rows, lesson_rows, exercise_rows, args.include_languages)",
    "conn.commit()",
    "conn.rollback()",
    "ON CONFLICT (\"code\") DO UPDATE SET",
    "ON CONFLICT (\"legacyId\") DO UPDATE SET",
    "ON CONFLICT (\"legacyKey\") DO UPDATE SET",
    "DELETE FROM \"SevenExercise\" WHERE \"legacyKey\" IN",
    "DELETE FROM \"SevenLesson\" WHERE \"legacyId\" IN",
    "DELETE FROM \"SevenCourse\" WHERE \"legacyId\" IN",
    "NOT EXISTS (SELECT 1 FROM \"GrammarCourse\"",
    "NOT EXISTS (SELECT 1 FROM \"PhoneticsCourse\"",
    "NOT EXISTS (SELECT 1 FROM \"SongsCourse\"",
    "NOT EXISTS (SELECT 1 FROM \"Word\"",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: str | None) -> dict[str, Any] | None:
    if not path:
        return None
    p = Path(path)
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def function_signature(text: str, name: str) -> list[str]:
    match = re.search(rf"def {name}\((.*?)\)\s*->", text, flags=re.DOTALL)
    if not match:
        return []
    raw = match.group(1)
    args: list[str] = []
    current: list[str] = []
    depth = 0
    for char in raw:
        if char == "[":
            depth += 1
        elif char == "]" and depth:
            depth -= 1
        if char == "," and depth == 0:
            token = "".join(current).strip().split(":", 1)[0].strip()
            if token:
                args.append(token)
            current = []
            continue
        current.append(char)
    token = "".join(current).strip().split(":", 1)[0].strip()
    if token:
        args.append(token)
    return args


def main() -> int:
    parser = argparse.ArgumentParser(description="Check seven data apply/rollback contract without applying data")
    parser.add_argument("--script", default="content-service/scripts/migrate-seven-from-legacy.py")
    parser.add_argument("--dry-run-report", required=True)
    parser.add_argument("--approval-doc", default="docs/orchestrator/SEVEN_DATA_MIGRATION_APPROVAL.md")
    parser.add_argument("--operator-script", default="scripts/apply-seven-data-approved.sh")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    script_path = Path(args.script)
    script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""
    dry_run = load_json(args.dry_run_report) or {}
    approval_path = Path(args.approval_doc)
    approval_text = approval_path.read_text(encoding="utf-8") if approval_path.exists() else ""
    operator_path = Path(args.operator_script)
    operator_text = operator_path.read_text(encoding="utf-8") if operator_path.exists() else ""
    counts = dry_run.get("migrationPayloadCounts") or {}
    missing_snippets = [snippet for snippet in REQUIRED_SNIPPETS if snippet not in script]
    write_rollback_args = function_signature(script, "write_rollback_sql")
    execute_apply_args = function_signature(script, "execute_apply")
    data_contract_versions = [
        int(match)
        for match in re.findall(r"/tmp/speakasap-seven-data-apply-contract-v(\d+)\.json", approval_text)
    ]
    approval_contract = {
        "approvalDocPath": str(approval_path),
        "approvalDocExists": approval_path.exists(),
        "statusIsDraft": "Status: draft approval packet" in approval_text,
        "mentionsSchemaPrecondition": "CONTENT_BASE_SCHEMA_APPROVAL.md" in approval_text and "post-schema DB-backed no-write report" in approval_text,
        "mentionsExactCounts": all(value in approval_text for value in ["19` `Language`", "19` `SevenCourse`", "136` `SevenLesson`", "429` `SevenExercise`"]),
        "usesContentTargetDatabaseUrl": "CONTENT_TARGET_DATABASE_URL" in approval_text,
        "usesCheckTargetApply": "--check-target --apply --include-languages --confirm-write" in approval_text,
        "requiresApprovalNote": "SEVEN_DATA_APPROVAL_TEXT" in approval_text and "exact `SEVEN_DATA_APPROVAL_TEXT` match" in approval_text,
        "requiresRollbackPlan": "ROLLBACK_PLAN=/tmp/speakasap-seven-content-rollback-v1.sql" in approval_text and "rollback SQL path" in approval_text,
        "postApplyNoWriteVerification": "content-service/scripts/migrate-seven-from-legacy.py --check-target --json-report /tmp/speakasap-seven-content-post-apply-v1.json" in approval_text,
        "excludesUnapprovedScopes": all(phrase in approval_text for phrase in ["No deployment", "object mutation", "media copy", "final test migration", "private progress migration", "paid-product change", "legacy route retirement"]),
        "noEmbeddedStatusSections": "## 2026-" not in approval_text and "Goal 10 Seven Apply Readiness Aggregator" not in approval_text,
        "mentionsCurrentContractReport": bool(data_contract_versions and max(data_contract_versions) >= 8),
    }
    operator_contract = {
        "path": str(operator_path),
        "exists": operator_path.exists(),
        "isExecutable": operator_path.exists() and bool(operator_path.stat().st_mode & 0o111),
        "requiresExecuteFlag": '"${1:-}" != "--execute"' in operator_text,
        "requiresExactApprovalText": "SEVEN_DATA_APPROVAL_TEXT" in operator_text and "does not exactly match" in operator_text,
        "requiresSchemaReconciliationReady": "schemaReady" in operator_text and "SCHEMA_RECONCILIATION_REPORT" in operator_text,
        "requiresRollbackPlan": "ROLLBACK_PLAN" in operator_text and "rollback-plan" in operator_text,
        "usesContentTargetDatabaseUrl": "CONTENT_TARGET_DATABASE_URL" in operator_text and "kubectl get secret speakasap-content-secret" in operator_text,
        "runsCheckTargetApplyWithLanguages": "--check-target" in operator_text and "--apply" in operator_text and "--include-languages" in operator_text and "--confirm-write" in operator_text,
        "runsPostApplyNoWriteVerification": "POST_APPLY_REPORT" in operator_text and "--json-report \"$POST_APPLY_REPORT\"" in operator_text,
        "writesExecutionReport": "EXECUTION_REPORT" in operator_text and "apply-execution-v1.json" in operator_text,
        "recordsApprovalHash": "APPROVAL_SHA256" in operator_text and "sha256sum" in operator_text,
        "marksLaterApprovalsFalse": all(value in operator_text for value in ["mediaMutationApproved", "deploymentApproved", "legacyRetirementApproved"]),
        "doesNotRunDeployment": "rollout restart" not in operator_text and "docker build" not in operator_text and "docker push" not in operator_text,
    }
    assertions = {
        "scriptExists": script_path.exists(),
        "dryRunWritesFalse": dry_run.get("writes") is False,
        "dryRunBlockingIssuesEmpty": not dry_run.get("blockingIssues"),
        "payloadCountsMatch": all(int(counts.get(key, 0) or 0) == expected for key, expected in EXPECTED_COUNTS.items()),
        "requiredSnippetsPresent": not missing_snippets,
        "rollbackSignatureIncludesLanguageScope": write_rollback_args == [
            "path",
            "language_rows",
            "course_rows",
            "lesson_rows",
            "exercise_rows",
            "approval_note",
            "include_languages",
        ],
        "executeApplySignatureIncludesLanguageScope": execute_apply_args == [
            "conn",
            "language_rows",
            "course_rows",
            "lesson_rows",
            "exercise_rows",
            "include_languages",
        ],
        "approvalContractSafe": all(approval_contract.values()),
        "operatorScriptContractSafe": all(operator_contract.values()),
    }
    report = {
        "generatedAt": now_iso(),
        "writes": False,
        "inputs": {
            "script": str(script_path),
            "dryRunReport": args.dry_run_report,
            "approvalDoc": args.approval_doc,
        },
        "counts": counts,
        "assertions": assertions,
        "missingSnippets": missing_snippets,
        "approvalContract": approval_contract,
        "operatorContract": operator_contract,
        "writeRollbackArgs": write_rollback_args,
        "executeApplyArgs": execute_apply_args,
        "approvalBoundary": {
            "dataApplyStillRequiresOwnerApproval": True,
            "requiresIncludeLanguagesForCurrentPlan": True,
            "schemaApplyApproved": False,
            "mediaCopyApproved": False,
            "deployApproved": False,
            "legacyRetirementApproved": False,
        },
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
