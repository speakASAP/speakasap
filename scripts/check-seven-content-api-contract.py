#!/usr/bin/env python3
"""No-write static contract checker for seven content-service API shape."""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


CONTROLLER = Path("content-service/src/seven/seven.controller.ts")
SERVICE = Path("content-service/src/seven/seven.service.ts")
MODULE = Path("content-service/src/seven/seven.module.ts")
APP_MODULE = Path("content-service/src/app.module.ts")
MAIN = Path("content-service/src/main.ts")
FRONTEND_CLIENT = Path("frontend/lib/seven.ts")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def main() -> int:
    parser = argparse.ArgumentParser(description="Check seven content API contract without running services")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    controller = read(CONTROLLER)
    service = read(SERVICE)
    module = read(MODULE)
    app_module = read(APP_MODULE)
    main_ts = read(MAIN)
    frontend = read(FRONTEND_CLIENT)
    mutating_decorators = re.findall(r"@(Post|Put|Patch|Delete)\b", controller)
    get_routes = re.findall(r'@Get\("([^"]*)"\)', controller)
    required_service_fields = [
        "legacyId",
        "languageCode",
        "languageName",
        "materialLanguage",
        "metaKeywords",
        "metaDescription",
        "appPackage",
        "materialsChanged",
        "version",
        "lessonsCount",
        "sitePath",
        "appPath",
        "pdfHref",
        "mediaRefs",
        "bodyHtml",
        "exercises",
        "previousLesson",
        "nextLesson",
        "exerciseHtml",
        "answerHtml",
    ]
    assertions = {
        "filesExist": all(path.exists() for path in [CONTROLLER, SERVICE, MODULE, APP_MODULE, MAIN, FRONTEND_CLIENT]),
        "globalApiPrefixPresent": "app.setGlobalPrefix('api/v1'" in main_ts,
        "sevenModuleMounted": "SevenModule" in app_module and "controllers: [SevenController]" in module and "providers: [SevenService]" in module,
        "controllerBaseIsSeven": '@Controller("seven")' in controller,
        "onlyGetEndpoints": not mutating_decorators and sorted(get_routes) == sorted([
            "courses",
            "courses/:languageCode",
            "courses/:languageCode/lessons",
            "courses/:languageCode/lessons/:order",
        ]),
        "invalidOrderRejected": "Number.isInteger(parsedOrder)" in controller and "parsedOrder < 1" in controller and "BadRequestException" in controller,
        "notFoundHandled": controller.count("NotFoundException") >= 1 and "Seven course not found" in controller and "Seven lesson not found" in controller,
        "responseFieldsPresent": all(field in service for field in required_service_fields),
        "lessonNavigationIncluded": "previousLesson" in service and "nextLesson" in service and "order: \"desc\"" in service and "order: \"asc\"" in service,
        "legacyPoNormalizedToPl": 'normalized === "po" ? "pl" : normalized' in service,
        "assetBaseUrlRewritePresent": "process.env.ASSETS_BASE_URL" in service
        and "publicMediaHref" in service
        and "rewriteHtmlMediaRefs" in service
        and "lessonPdfHref" in service,
        "metadataMediaRefsIncluded": "metadata.mediaRefs" in service and "fallbackPdfHref" in service,
        "frontendTypesMatchCoreFields": all(
            field in frontend
            for field in [
                "legacyId",
                "languageCode",
                "materialLanguage",
                "pdfHref",
                "mediaRefs",
                "bodyHtml",
                "previousLesson",
                "nextLesson",
                "exerciseHtml",
                "answerHtml",
            ]
        ),
    }
    report: dict[str, Any] = {
        "generatedAt": now_iso(),
        "writes": False,
        "files": {
            "controller": str(CONTROLLER),
            "service": str(SERVICE),
            "module": str(MODULE),
            "appModule": str(APP_MODULE),
            "main": str(MAIN),
            "frontendClient": str(FRONTEND_CLIENT),
        },
        "getRoutes": get_routes,
        "mutatingDecorators": mutating_decorators,
        "assertions": assertions,
        "approvalBoundary": {
            "contentDeployStillRequiresOwnerApproval": True,
            "dataApplyApproved": False,
            "mediaCopyApproved": False,
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
