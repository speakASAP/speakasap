#!/usr/bin/env python3
"""No-write checker for SpeakASAP service/internal identity boundaries."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


FILES = {
    "gatewayGuard": Path("api-gateway/src/proxy/gateway-auth.guard.ts"),
    "userInternalGuard": Path("user-service/src/auth/internal-token.guard.ts"),
    "educationInternalGuard": Path("education-service/src/auth/internal-token.guard.ts"),
    "financialInternalGuard": Path("financial-service/src/auth/internal-token.guard.ts"),
    "educationUserClient": Path("education-service/src/internal-salary/internal-salary.service.ts"),
    "financialPaymentClient": Path("financial-service/src/deps/payment-client.service.ts"),
    "financialCourseClient": Path("financial-service/src/deps/course-client.service.ts"),
    "financialSalaryClient": Path("financial-service/src/deps/salary-client.service.ts"),
    "paymentSalaryController": Path("payment-service/src/salary-disburse/salary-disburse.controller.ts"),
    "paymentSalaryService": Path("payment-service/src/salary-disburse/salary-disburse.service.ts"),
    "surfaceInventory": Path("docs/orchestrator/2026-06-24-aos-auth-surface-inventory.md"),
    "modernizationPlan": Path("docs/orchestrator/2026-06-24-aos-auth-modernization-plan.md"),
    "gatewayBoundary": Path("docs/refactoring/GATEWAY_AUTH_BOUNDARY.md"),
}


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def contains_all(text: str, markers: list[str]) -> bool:
    return all(marker in text for marker in markers)


def main() -> int:
    parser = argparse.ArgumentParser(description="Check SpeakASAP service identity contract without mutating state")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    texts = {name: read(path) for name, path in FILES.items()}
    files = {name: path.exists() for name, path in FILES.items()}

    inbound_markers = ["ServiceActor", "serviceActor", "type: 'service'", "authMethod: 'internal-service-token'"]
    receiver_contract = {
        "gatewayInternalRoutesAttachServiceActor": contains_all(texts["gatewayGuard"], inbound_markers)
        and "x-service-name" in texts["gatewayGuard"]
        and "FORBIDDEN_INTERNAL_ROUTE" in texts["gatewayGuard"],
        "userInternalGuardAttachesServiceActor": contains_all(texts["userInternalGuard"], inbound_markers)
        and "x-service-name" in texts["userInternalGuard"],
        "educationInternalGuardAttachesServiceActor": contains_all(texts["educationInternalGuard"], inbound_markers)
        and "x-service-name" in texts["educationInternalGuard"],
        "financialInternalGuardAttachesServiceActor": contains_all(texts["financialInternalGuard"], inbound_markers)
        and "x-service-name" in texts["financialInternalGuard"],
        "paymentSalaryInternalPathClassifiesServiceActor": contains_all(texts["paymentSalaryService"], inbound_markers)
        and "assertInternalServiceActor" in texts["paymentSalaryService"]
        and "x-service-name" in texts["paymentSalaryController"],
    }

    outbound_contract = {
        "educationUserClientSendsServiceName": "'X-Service-Name': this.serviceName" in texts["educationUserClient"]
        and "process.env.SERVICE_NAME" in texts["educationUserClient"],
        "financialPaymentClientSendsServiceName": texts["financialPaymentClient"].count("'X-Service-Name': this.serviceName") >= 2
        and "process.env.SERVICE_NAME" in texts["financialPaymentClient"],
        "financialCourseClientSendsServiceName": "'X-Service-Name': this.serviceName" in texts["financialCourseClient"]
        and "process.env.SERVICE_NAME" in texts["financialCourseClient"],
        "financialSalaryClientSendsServiceName": "'X-Service-Name': this.serviceName" in texts["financialSalaryClient"]
        and "process.env.SERVICE_NAME" in texts["financialSalaryClient"],
    }

    docs_text = "\n".join([texts["surfaceInventory"], texts["modernizationPlan"], texts["gatewayBoundary"]])
    docs_contract = {
        "docsReferenceCentralServiceIdentityStandard": "auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md" in docs_text,
        "docsClassifyInternalTokensAsMachineAuth": "machine auth" in docs_text and "not Auth RBAC" in docs_text,
        "docsMentionServiceActor": "serviceActor" in docs_text and "X-Service-Name" in docs_text,
        "docsPreserveLegacyPortalBoundary": "legacy speakasap-portal" in docs_text,
    }

    forbidden = {
        "internalTokenGuardsDoNotCallAuthValidate": "/auth/validate" not in "\n".join(
            [
                texts["gatewayGuard"].split("if (pathname.startsWith('/api/v1/internal'))", 1)[-1].split("const authz", 1)[0],
                texts["userInternalGuard"],
                texts["educationInternalGuard"],
                texts["financialInternalGuard"],
                texts["paymentSalaryService"],
            ],
        ),
        "serviceIdentityDoesNotLogTokenValues": "console.log(token" not in "\n".join(texts.values())
        and "logger.log(token" not in "\n".join(texts.values()),
    }

    ok = all(files.values()) and all(receiver_contract.values()) and all(outbound_contract.values()) and all(docs_contract.values()) and all(forbidden.values())
    report: dict[str, Any] = {
        "ok": ok,
        "checkedAt": now_iso(),
        "files": files,
        "receiverContract": receiver_contract,
        "outboundContract": outbound_contract,
        "docsContract": docs_contract,
        "forbidden": forbidden,
        "scope": "new speakasap service/internal identity only; no legacy speakasap-portal checks",
    }

    if args.json_report:
        payload = json.dumps(report, indent=2, sort_keys=True)
        if args.json_report == "-":
            print(payload)
        else:
            Path(args.json_report).write_text(payload + "\n", encoding="utf-8")

    if not ok:
        print(json.dumps(report, indent=2, sort_keys=True), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
