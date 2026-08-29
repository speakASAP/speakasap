#!/usr/bin/env python3
"""No-write deployment readiness contract for the seven-course migration."""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCOPED_DEPLOYMENTS = {
    "content": "speakasap-content",
    "apiGateway": "speakasap-api-gateway",
    "frontend": "speakasap-frontend",
}

SCOPED_MANIFESTS = {
    "content": Path("k8s/services/content-service.yaml"),
    "apiGateway": Path("k8s/services/api-gateway.yaml"),
    "frontend": Path("k8s/services/frontend.yaml"),
    "ingress": Path("k8s/ingress.yaml"),
}

APPROVAL_DOC = Path("docs/orchestrator/SEVEN_DEPLOYMENT_APPROVAL.md")
FRONTEND_DEPLOY = Path("scripts/deploy-frontend.sh")
ROOT_DEPLOY = Path("scripts/deploy.sh")
DEPLOY_CONFIG = Path("deploy.config.sh")
SMOKE_CHECKER = Path("scripts/check-seven-deployment-smoke.py")
DEPLOY_OPERATOR = Path("scripts/deploy-seven-approved.sh")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def contains_all(text: str, needles: list[str]) -> bool:
    lowered = text.lower()
    return all(needle.lower() in lowered for needle in needles)


def deployment_names(manifest: str) -> list[str]:
    names: list[str] = []
    lines = manifest.splitlines()
    for index, line in enumerate(lines):
        if line.strip() == "kind: Deployment":
            for next_line in lines[index + 1 : index + 20]:
                match = re.match(r"\s*name:\s*([A-Za-z0-9_.-]+)\s*$", next_line)
                if match:
                    names.append(match.group(1))
                    break
    return names


def config_value(manifest: str, key: str) -> str | None:
    pattern = re.compile(rf"^\s*{re.escape(key)}:\s*['\"]?([^'\"\n]+)['\"]?\s*$", re.MULTILINE)
    match = pattern.search(manifest)
    return match.group(1).strip() if match else None


def command_mentions_only_scoped_deployments(text: str) -> dict[str, Any]:
    rollout_restart = sorted(set(re.findall(r"kubectl\s+rollout\s+restart\s+deployment/([A-Za-z0-9_.-]+)", text)))
    allowed = set(SCOPED_DEPLOYMENTS.values())
    waiter_present = "wait-for-rollout.sh" in text
    rollout_wait = sorted(name for name in allowed if waiter_present and name in text)
    return {
        "rolloutRestart": rollout_restart,
        "rolloutWait": rollout_wait,
        "unexpectedRolloutRestart": [name for name in rollout_restart if name not in allowed],
        "mentionsAllScopedRestarts": allowed.issubset(set(rollout_restart) | {"speakasap-frontend"}),
        "mentionsAllScopedWaits": allowed.issubset(set(rollout_wait)),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Check seven deployment readiness without mutating state")
    parser.add_argument("--expected-assets-base-url", default="https://assets.alfares.cz")
    parser.add_argument("--expected-public-url", default="https://speakasap.alfares.cz")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    approval = read(APPROVAL_DOC)
    frontend_deploy = read(FRONTEND_DEPLOY)
    root_deploy = read(ROOT_DEPLOY)
    deploy_config = read(DEPLOY_CONFIG)
    smoke = read(SMOKE_CHECKER)
    deploy_operator = read(DEPLOY_OPERATOR)
    manifests = {name: read(path) for name, path in SCOPED_MANIFESTS.items()}

    files = {
        "approvalDoc": APPROVAL_DOC.exists(),
        "frontendDeployScript": FRONTEND_DEPLOY.exists(),
        "rootDeployScript": ROOT_DEPLOY.exists(),
        "deployConfig": DEPLOY_CONFIG.exists(),
        "smokeChecker": SMOKE_CHECKER.exists(),
        "deployOperator": DEPLOY_OPERATOR.exists(),
        **{f"{name}Manifest": path.exists() for name, path in SCOPED_MANIFESTS.items()},
    }
    manifest_contract = {
        "contentDeploymentName": deployment_names(manifests["content"]),
        "apiGatewayDeploymentName": deployment_names(manifests["apiGateway"]),
        "frontendDeploymentName": deployment_names(manifests["frontend"]),
        "contentAssetsBaseUrl": config_value(manifests["content"], "ASSETS_BASE_URL"),
        "apiGatewayAssetsBaseUrl": config_value(manifests["apiGateway"], "ASSETS_BASE_URL"),
        "frontendPublicApiUrl": config_value(manifests["frontend"], "NEXT_PUBLIC_API_URL"),
        "ingressMentionsFrontend": "speakasap-frontend" in manifests["ingress"],
        "ingressMentionsApiGateway": "speakasap-api-gateway" in manifests["ingress"] or "speakasap" in manifests["ingress"],
    }
    approval_commands = command_mentions_only_scoped_deployments(approval)
    root_breadth = {
        "rootDeployIsRetired": "RETIRED" in root_deploy and "refuses" in root_deploy,
        "rootDeployPointsToSharedRunner": "shared/scripts/deploy.sh" in root_deploy,
        "deployConfigContainsFrontend": "speakasap-frontend" in deploy_config,
        "deployConfigContainsSalary": "speakasap-salary" in deploy_config,
        "deployConfigContainsUser": "speakasap-user" in deploy_config,
    }
    deploy_operator_contract = {
        "path": str(DEPLOY_OPERATOR),
        "exists": DEPLOY_OPERATOR.exists(),
        "isExecutable": DEPLOY_OPERATOR.exists() and bool(DEPLOY_OPERATOR.stat().st_mode & 0o111),
        "requiresExecuteFlag": '"${1:-}" != "--execute"' in deploy_operator,
        "requiresExactApprovalText": "SEVEN_DEPLOY_APPROVAL_TEXT" in deploy_operator and "does not exactly match" in deploy_operator,
        "requiresSchemaDataMediaReports": all(value in deploy_operator for value in ["SCHEMA_EXECUTION_REPORT", "DATA_EXECUTION_REPORT", "MEDIA_EXECUTION_REPORT"]),
        "buildsOnlyScopedImages": all(value in deploy_operator for value in ["content-service/Dockerfile", "api-gateway/Dockerfile", "deploy-frontend.sh"]) and "salary-service/Dockerfile" not in deploy_operator,
        "appliesOnlyScopedManifests": all(value in deploy_operator for value in ["k8s/services/content-service.yaml", "k8s/services/api-gateway.yaml", "k8s/services/frontend.yaml", "k8s/ingress.yaml"]) and '"$SERVICES_DIR"/*.yaml' not in deploy_operator,
        "restartsOnlyScopedDeployments": all(value in deploy_operator for value in ["deployment/speakasap-content", "deployment/speakasap-api-gateway", "deployment/speakasap-frontend"]) and "deployment/speakasap-salary" not in deploy_operator,
        "runsDeploymentSmoke": "check-seven-deployment-smoke.py" in deploy_operator and "SMOKE_REPORT" in deploy_operator,
        "writesExecutionReport": "execution-v1.json" in deploy_operator and "approvalSha256" in deploy_operator,
        "writesFailureExecutionReport": "trap deploy_failed ERR" in deploy_operator
        and "failureStage" in deploy_operator
        and "smokeOk" in deploy_operator
        and "exitCode" in deploy_operator,
        "usesSharedRolloutWaiter": "wait-for-rollout.sh" in deploy_operator
        and "kubectl rollout status" not in deploy_operator,
        "acquiresDeployLock": "deploy_lock_acquire" in deploy_operator
        and "deploy_lock_release" in deploy_operator,
        "doesNotRunBroadDeploy": "\n./scripts/deploy.sh" not in deploy_operator
        and "\nscripts/deploy.sh" not in deploy_operator
        and "bash scripts/deploy.sh" not in deploy_operator
        and "shared/scripts/deploy.sh" not in deploy_operator,
        "marksRollbackRetirementFalse": all(value in deploy_operator for value in ["dataRollbackApproved", "mediaRollbackApproved", "legacyRetirementApproved"]),
    }
    assertions = {
        "requiredFilesPresent": all(files.values()),
        "approvalStatusIsDraft": "Status: draft approval packet" in approval,
        "approvalDeniesBroadDeploy": contains_all(
            approval,
            ["must not use the broad shared runner", "shared/scripts/deploy.sh speakasap"],
        ),
        "approvalScopesServices": contains_all(approval, list(SCOPED_DEPLOYMENTS.values())),
        "approvalRequiresGates": contains_all(
            approval,
            [
                "schema readiness",
                "seven data apply",
                "media copy",
                "post-deploy smoke",
            ],
        ),
        "approvalRequiresSmokeChecker": str(SMOKE_CHECKER) in approval,
        "approvalHasRollbackBoundary": contains_all(approval, ["Rollback Boundary", "previous image"]),
        "approvalCommandsAvoidUnexpectedRollouts": not approval_commands["unexpectedRolloutRestart"],
        "approvalCommandsCoverScopedWaits": approval_commands["mentionsAllScopedWaits"],
        "rootDeployBoundaryIsCurrent": all(root_breadth.values()),
        "frontendDeployOnlyBuildsFrontend": "frontend/Dockerfile" in frontend_deploy
        and "content-service/Dockerfile" not in frontend_deploy
        and "api-gateway/Dockerfile" not in frontend_deploy,
        "frontendDeployUsesPublicUrl": 'PUBLIC_URL="${PUBLIC_URL:-https://speakasap.alfares.cz}"' in frontend_deploy,
        "frontendDeployAppliesOnlyFrontendAndIngress": "k8s/services/frontend.yaml" in frontend_deploy
        and "k8s/ingress.yaml" in frontend_deploy
        and '"$SERVICES_DIR"/*.yaml' not in frontend_deploy,
        "frontendDeployRestartsOnlyFrontend": "deployment/speakasap-frontend" in frontend_deploy
        and "deployment/speakasap-content" not in frontend_deploy
        and "deployment/speakasap-api-gateway" not in frontend_deploy,
        "manifestsHaveExpectedDeployments": manifest_contract["contentDeploymentName"] == ["speakasap-content"]
        and manifest_contract["apiGatewayDeploymentName"] == ["speakasap-api-gateway"]
        and manifest_contract["frontendDeploymentName"] == ["speakasap-frontend"],
        "manifestsUseAssetsBaseUrl": manifest_contract["contentAssetsBaseUrl"] == args.expected_assets_base_url
        and manifest_contract["apiGatewayAssetsBaseUrl"] == args.expected_assets_base_url,
        "frontendManifestUsesPublicApiUrl": manifest_contract["frontendPublicApiUrl"] == args.expected_public_url,
        "smokeCheckerIsNoWrite": "No-write" in smoke and "urllib.request.Request" in smoke and "def request(" in smoke,
        "smokeChecksApiPagesAndAssets": contains_all(
            smoke,
            ["courseApi", "lessonsApi", "lessonApi", "coursePage", "lessonPage", "pdfHead", "audioHead"],
        ),
        "deployOperatorContractSafe": all(deploy_operator_contract.values()),
    }
    failed = [name for name, ok in assertions.items() if not ok]
    report = {
        "generatedAt": now_iso(),
        "writes": False,
        "expectedAssetsBaseUrl": args.expected_assets_base_url,
        "expectedPublicUrl": args.expected_public_url,
        "files": files,
        "manifestContract": manifest_contract,
        "approvalCommands": approval_commands,
        "rootDeployBreadth": root_breadth,
        "deployOperatorContract": deploy_operator_contract,
        "assertions": assertions,
        "failedAssertions": failed,
        "ok": not failed,
        "readyForOwnerDeploymentApproval": not failed,
        "readyForCutover": False,
        "nextAction": (
            "Keep deployment approval gated until schema/data/media gates are complete; "
            "then use scoped service deploy and post-deploy smoke."
            if not failed
            else "Fix failed deployment readiness assertions before requesting deployment approval."
        ),
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
