#!/usr/bin/env python3
"""No-write static checker for the seven content schema migration plan."""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


EXPECTED_MIGRATIONS = {
    "20260127161203_init": {
        "requiredTables": [
            "Language",
            "GrammarCourse",
            "GrammarLesson",
            "PhoneticsCourse",
            "PhoneticsLesson",
            "SongsCourse",
            "SongsLesson",
            "Word",
            "WordTheme",
            "WordThemeRelation",
        ],
        "requiredIndexes": [
            "Language_code_key",
            "Language_order_idx",
            "Language_name_idx",
        ],
        "requiredForeignKeys": [
            "GrammarCourse_languageId_fkey",
            "GrammarLesson_courseId_fkey",
            "PhoneticsCourse_languageId_fkey",
            "PhoneticsLesson_courseId_fkey",
            "SongsCourse_languageId_fkey",
            "SongsLesson_courseId_fkey",
            "Word_languageId_fkey",
            "WordThemeRelation_wordId_fkey",
            "WordThemeRelation_themeId_fkey",
        ],
    },
    "20260613110000_seven_content": {
        "requiredTables": [
            "SevenCourse",
            "SevenLesson",
            "SevenExercise",
        ],
        "requiredIndexes": [
            "SevenCourse_legacyId_key",
            "SevenCourse_languageId_materialLanguage_key",
            "SevenCourse_materialLanguage_idx",
            "SevenLesson_legacyId_key",
            "SevenLesson_courseId_order_key",
            "SevenLesson_courseId_order_idx",
            "SevenExercise_legacyKey_key",
            "SevenExercise_lessonId_order_key",
            "SevenExercise_lessonId_order_idx",
        ],
        "requiredForeignKeys": [
            "SevenCourse_languageId_fkey",
            "SevenLesson_courseId_fkey",
            "SevenExercise_lessonId_fkey",
        ],
    },
}

FORBIDDEN_DDL_RE = re.compile(r"^\s*(DROP(?:\s+TABLE|\s+INDEX)?|DELETE\s+FROM|TRUNCATE|UPDATE\s+\"?\w+|INSERT\s+INTO|ALTER\s+TYPE)\b", re.IGNORECASE | re.MULTILINE)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_sql(migrations_dir: Path, migration: str) -> str:
    path = migrations_dir / migration / "migration.sql"
    return path.read_text(encoding="utf-8") if path.exists() else ""


def extract_names(sql: str, pattern: str) -> list[str]:
    return sorted(set(re.findall(pattern, sql)))


def migration_report(migrations_dir: Path, migration: str, spec: dict[str, list[str]]) -> dict[str, Any]:
    path = migrations_dir / migration / "migration.sql"
    sql = read_sql(migrations_dir, migration)
    tables = extract_names(sql, r'CREATE TABLE "([^"]+)"')
    indexes = extract_names(sql, r'CREATE (?:UNIQUE )?INDEX "([^"]+)"')
    foreign_keys = extract_names(sql, r'ADD CONSTRAINT "([^"]+)" FOREIGN KEY')
    forbidden = [match.group(0) for match in FORBIDDEN_DDL_RE.finditer(sql)]
    return {
        "migration": migration,
        "path": str(path),
        "exists": path.exists(),
        "bytes": path.stat().st_size if path.exists() else 0,
        "tables": tables,
        "indexes": indexes,
        "foreignKeys": foreign_keys,
        "missingTables": sorted(set(spec["requiredTables"]) - set(tables)),
        "missingIndexes": sorted(set(spec["requiredIndexes"]) - set(indexes)),
        "missingForeignKeys": sorted(set(spec["requiredForeignKeys"]) - set(foreign_keys)),
        "unexpectedForbiddenStatements": forbidden,
        "ok": (
            path.exists()
            and not (set(spec["requiredTables"]) - set(tables))
            and not (set(spec["requiredIndexes"]) - set(indexes))
            and not (set(spec["requiredForeignKeys"]) - set(foreign_keys))
            and not forbidden
        ),
    }


def schema_model_report(schema_path: Path) -> dict[str, Any]:
    text = schema_path.read_text(encoding="utf-8") if schema_path.exists() else ""
    required_models = [
        "Language",
        "SevenCourse",
        "SevenLesson",
        "SevenExercise",
    ]
    required_relations = [
        "sevenCourses    SevenCourse[]",
        "language          Language @relation(fields: [languageId], references: [id])",
        "course    SevenCourse @relation(fields: [courseId], references: [id])",
        "lesson SevenLesson @relation(fields: [lessonId], references: [id])",
    ]
    return {
        "path": str(schema_path),
        "exists": schema_path.exists(),
        "requiredModelsPresent": {name: f"model {name} " in text for name in required_models},
        "requiredRelationsPresent": {value: value in text for value in required_relations},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Check seven schema migration plan without applying it")
    parser.add_argument("--migrations-dir", default="content-service/prisma/migrations")
    parser.add_argument("--schema", default="content-service/prisma/schema.prisma")
    parser.add_argument("--approval-doc", default="docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md")
    parser.add_argument("--package-json", default="content-service/package.json")
    parser.add_argument("--operator-script", default="scripts/apply-seven-schema-approved.sh")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    migrations_dir = Path(args.migrations_dir)
    reports = [migration_report(migrations_dir, name, spec) for name, spec in EXPECTED_MIGRATIONS.items()]
    schema = schema_model_report(Path(args.schema))
    approval_path = Path(args.approval_doc)
    approval_text = approval_path.read_text(encoding="utf-8") if approval_path.exists() else ""
    package_path = Path(args.package_json)
    package_text = package_path.read_text(encoding="utf-8") if package_path.exists() else ""
    operator_path = Path(args.operator_script)
    operator_text = operator_path.read_text(encoding="utf-8") if operator_path.exists() else ""
    execution_contract = {
        "approvalDocPath": str(approval_path),
        "approvalDocExists": approval_path.exists(),
        "usesDirectPrismaDeploy": "npx prisma migrate deploy --schema prisma/schema.prisma" in approval_text,
        "avoidsNpmMigrateWrapper": "npm run prisma:migrate:deploy" not in approval_text,
        "setsDatabaseUrlFromKubernetesSecret": "kubectl get secret speakasap-content-secret" in approval_text and ("export DATABASE_URL=" in approval_text or "SEVEN_SCHEMA_APPROVAL_TEXT=" in approval_text),
        "documentsNpmWrapperEnvRisk": "sources `../.env`" in approval_text and "override the Kubernetes secret-derived `DATABASE_URL`" in approval_text,
        "packageJsonPath": str(package_path),
        "packageJsonExists": package_path.exists(),
        "npmWrapperSourcesRootEnv": "test -f ../.env && . ../.env" in package_text,
    }
    schema_plan_versions = [
        int(match)
        for match in re.findall(r"/tmp/speakasap-seven-schema-migration-plan-v(\d+)\.json", approval_text)
    ]
    suite_versions = [
        int(match)
        for match in re.findall(r"/tmp/speakasap-seven-no-write-suite-v(\d+)\.json", approval_text)
    ]
    next_gate_versions = [
        int(match)
        for match in re.findall(r"/tmp/speakasap-seven-next-gate-v(\d+)\.json", approval_text)
    ]
    operator_contract = {
        "path": str(operator_path),
        "exists": operator_path.exists(),
        "isExecutable": operator_path.exists() and bool(operator_path.stat().st_mode & 0o111),
        "requiresExecuteFlag": '"${1:-}" != "--execute"' in operator_text,
        "requiresExactApprovalText": "SEVEN_SCHEMA_APPROVAL_TEXT" in operator_text and "does not exactly match" in operator_text,
        "usesDirectPrismaDeploy": "npx prisma migrate deploy --schema prisma/schema.prisma" in operator_text,
        "derivesDatabaseUrlFromKubernetesSecret": "kubectl get secret speakasap-content-secret" in operator_text and "base64 -d" in operator_text,
        "runsPostSchemaTargetReport": "migrate-seven-from-legacy.py" in operator_text and "--check-target" in operator_text,
        "toleratesExpectedLanguageSeedGap": "TARGET_REPORT_STATUS" in operator_text and "post-schema target report failed before writing" in operator_text,
        "runsPostSchemaReconciliationChecker": "check-seven-post-schema-reconciliation.py" in operator_text,
        "writesExecutionReport": "EXECUTION_REPORT" in operator_text and "schema-apply-execution-v1.json" in operator_text,
        "recordsApprovalHash": "APPROVAL_SHA256" in operator_text and "sha256sum" in operator_text,
        "recordsMigrationLog": "MIGRATE_LOG" in operator_text and "schema-migrate-deploy.log" in operator_text,
        "recordsPostSchemaReportPaths": "targetReport" in operator_text and "reconciliationReport" in operator_text,
        "marksLaterApprovalsFalse": all(value in operator_text for value in ["dataApplyApproved", "mediaMutationApproved", "deploymentApproved", "legacyRetirementApproved"]),
        "doesNotRunSevenDataApply": "--apply" not in operator_text,
        "doesNotRunDeployment": "rollout restart" not in operator_text and "docker build" not in operator_text and "docker push" not in operator_text,
    }
    approval_evidence_contract = {
        "referencesSchemaPlanV4OrLater": bool(schema_plan_versions and max(schema_plan_versions) >= 4),
        "referencesNoWriteSuiteV19OrLater": bool(suite_versions and max(suite_versions) >= 19),
        "referencesNextGateV1OrLater": bool(next_gate_versions and max(next_gate_versions) >= 1),
        "referencesNextGateSchemaRequestable": "`nextGate=schema`" in approval_text and "`nextGateRequestable=true`" in approval_text,
        "referencesCurrentPostSchemaBaseline": "/tmp/speakasap-seven-post-schema-reconciliation-fresh-v1.json" in approval_text,
        "omitsStaleSchemaPlanV2": "/tmp/speakasap-seven-schema-migration-plan-v2.json" not in approval_text,
        "omitsStaleTargetDryRunV14": "/tmp/speakasap-seven-dry-run-target-v14.json" not in approval_text,
    }
    assertions = {
        "migrationsDirExists": migrations_dir.exists(),
        "expectedMigrationsPresent": all(item["exists"] for item in reports),
        "expectedMigrationScopesOk": all(item["ok"] for item in reports),
        "schemaFileExists": schema["exists"],
        "schemaModelsPresent": all(schema["requiredModelsPresent"].values()),
        "schemaRelationsPresent": all(schema["requiredRelationsPresent"].values()),
        "schemaExecutionContractSafe": (
            execution_contract["approvalDocExists"]
            and execution_contract["usesDirectPrismaDeploy"]
            and execution_contract["avoidsNpmMigrateWrapper"]
            and execution_contract["setsDatabaseUrlFromKubernetesSecret"]
            and execution_contract["documentsNpmWrapperEnvRisk"]
            and execution_contract["packageJsonExists"]
            and execution_contract["npmWrapperSourcesRootEnv"]
        ),
        "operatorScriptContractSafe": all(operator_contract.values()),
        "approvalEvidenceReferencesCurrent": all(approval_evidence_contract.values()),
    }
    report = {
        "generatedAt": now_iso(),
        "writes": False,
        "migrationsDir": str(migrations_dir),
        "assertions": assertions,
        "migrations": reports,
        "schema": schema,
        "executionContract": execution_contract,
        "approvalEvidenceContract": approval_evidence_contract,
        "operatorContract": operator_contract,
        "approvalBoundary": {
            "schemaApplyStillRequiresOwnerApproval": True,
            "expectedApprovalDoc": "docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md",
            "dataApplyApproved": False,
            "deployApproved": False,
            "mediaMutationApproved": False,
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
