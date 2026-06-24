#!/usr/bin/env python3
"""No-write checker for central Auth /auth/validate convergence in SpeakASAP services."""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SERVICES: dict[str, dict[str, str]] = {
    "user-service": {
        "guard": "user-service/src/auth/jwt-auth.guard.ts",
        "client": "user-service/src/auth-client/auth-client.service.ts",
        "env": "user-service/src/shared/validate-env.ts",
        "method": "validateAccessToken",
        "context": "req.authUser",
    },
    "course-service": {
        "guard": "course-service/src/auth/jwt-auth.guard.ts",
        "client": "course-service/src/auth-client/auth-client.service.ts",
        "env": "course-service/src/shared/validate-env.ts",
        "method": "validateAccessToken",
        "context": "req.authUser",
    },
    "education-service": {
        "guard": "education-service/src/auth/jwt-auth.guard.ts",
        "client": "education-service/src/auth-client/auth-client.service.ts",
        "env": "education-service/src/shared/validate-env.ts",
        "method": "validateAccessToken",
        "context": "req.authUser",
    },
    "assessment-service": {
        "guard": "assessment-service/src/auth/jwt-auth.guard.ts",
        "optionalGuard": "assessment-service/src/auth/optional-jwt.guard.ts",
        "client": "assessment-service/src/auth/auth-client.service.ts",
        "env": "assessment-service/src/shared/validate-env.ts",
        "method": "validateToken",
        "context": "req.user",
    },
    "certification-service": {
        "guard": "certification-service/src/auth/jwt-auth.guard.ts",
        "client": "certification-service/src/auth-client/auth-client.service.ts",
        "env": "certification-service/src/shared/validate-env.ts",
        "module": "certification-service/src/auth/auth.module.ts",
        "method": "validateAccessToken",
        "context": "req.user",
    },
    "financial-service": {
        "guard": "financial-service/src/auth/jwt-auth.guard.ts",
        "client": "financial-service/src/auth-client/auth-client.service.ts",
        "env": "financial-service/src/shared/validate-env.ts",
        "method": "validateAccessToken",
        "context": "req.authUser",
    },
    "notification-service": {
        "guard": "notification-service/src/auth/jwt-auth.guard.ts",
        "client": "notification-service/src/auth-client/auth-client.service.ts",
        "env": "notification-service/src/shared/validate-env.ts",
        "method": "validateAccessToken",
        "context": "req.authUser",
    },
    "payment-service": {
        "guard": "payment-service/src/auth/jwt-auth.guard.ts",
        "client": "payment-service/src/auth-client/auth-client.service.ts",
        "env": "payment-service/src/shared/validate-env.ts",
        "method": "validateAccessToken",
        "context": "req.authUser",
    },
    "salary-service": {
        "guard": "salary-service/src/auth/jwt-auth.guard.ts",
        "client": "salary-service/src/auth-client/auth-client.service.ts",
        "env": "salary-service/src/shared/validate-env.ts",
        "method": "validateAccessToken",
        "context": "req.authUser",
    },
}

DOCS = [
    Path("docs/orchestrator/2026-06-24-aos-auth-modernization-plan.md"),
    Path("docs/orchestrator/2026-06-24-aos-auth-surface-inventory.md"),
    Path("docs/refactoring/GATEWAY_AUTH_BOUNDARY.md"),
]

FORBIDDEN_SOURCE_PATTERNS = {
    "jsonwebtokenImport": re.compile(r"from ['\"]jsonwebtoken['\"]|require\(['\"]jsonwebtoken['\"]\)"),
    "jwtServiceImport": re.compile(r"JwtService|@nestjs/jwt"),
    "passportJwtImport": re.compile(r"passport-jwt|ExtractJwt|PassportStrategy"),
    "localJwtVerify": re.compile(r"\.verifyAsync\(|jwt\.verify\(|verify\(token"),
    "bearerJwtSecretDependency": re.compile(r"JWT_SECRET"),
}

ALLOW_FORBIDDEN_MATCHES = {
    Path("certification-service/src/shared/validate-env.ts"): ["CERT_VIEW_TOKEN_SECRET"],
}


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def bearer_auth_files(cfg: dict[str, str]) -> list[Path]:
    keys = ["guard", "optionalGuard", "client", "env", "module"]
    return [Path(cfg[key]) for key in keys if key in cfg]


def unauthorized_matches(service: str, cfg: dict[str, str]) -> list[dict[str, str]]:
    matches: list[dict[str, str]] = []
    for path in bearer_auth_files(cfg):
        text = read(path)
        allowed_fragments = ALLOW_FORBIDDEN_MATCHES.get(path, [])
        for name, pattern in FORBIDDEN_SOURCE_PATTERNS.items():
            for match in pattern.finditer(text):
                line_start = text.rfind("\n", 0, match.start()) + 1
                line_end = text.find("\n", match.end())
                if line_end == -1:
                    line_end = len(text)
                line = text[line_start:line_end].strip()
                if any(fragment in line for fragment in allowed_fragments):
                    continue
                matches.append({"service": service, "file": str(path), "pattern": name, "line": line})
    return matches


def service_report(service: str, cfg: dict[str, str]) -> dict[str, Any]:
    guard_path = Path(cfg["guard"])
    client_path = Path(cfg["client"])
    env_path = Path(cfg["env"])
    module_path = Path(cfg["module"]) if "module" in cfg else None
    optional_guard_path = Path(cfg["optionalGuard"]) if "optionalGuard" in cfg else None

    guard = read(guard_path)
    client = read(client_path)
    env = read(env_path)
    module = read(module_path) if module_path else ""
    optional_guard = read(optional_guard_path) if optional_guard_path else ""
    method = cfg["method"]

    checks: dict[str, bool] = {
        "guardFileExists": guard_path.exists(),
        "clientFileExists": client_path.exists(),
        "envFileExists": env_path.exists(),
        "guardImportsAuthClientService": "AuthClientService" in guard,
        "guardExtractsBearerToken": "authorization" in guard and "bearer" in guard.lower(),
        "guardDelegatesToAuthClient": f"authClient.{method}(token)" in guard,
        "guardAttachesValidatedContext": cfg["context"] in guard,
        "clientCallsCentralValidateEndpoint": "/auth/validate" in client,
        "clientUsesPost": "method: 'POST'" in client or 'method: "POST"' in client,
        "clientSendsTokenBody": "JSON.stringify({ token })" in client,
        "clientRejectsMissingInvalidUser": "UnauthorizedException" in client and ".id" in client,
        "envRequiresAuthServiceUrl": "AUTH_SERVICE_URL" in env,
        "envRequiresAuthTimeout": "AUTH_SERVICE_TIMEOUT" in env,
    }

    if optional_guard_path:
        checks["optionalGuardFileExists"] = optional_guard_path.exists()
        checks["optionalGuardDelegatesToAuthClient"] = f"authClient.{method}(token)" in optional_guard
    if module_path:
        checks["authModuleExportsAuthClientService"] = "exports:" in module and "AuthClientService" in module

    forbidden = unauthorized_matches(service, cfg)
    checks["noLocalJwtValidationPatterns"] = not forbidden
    return {"checks": checks, "forbiddenMatches": forbidden}


def main() -> int:
    parser = argparse.ArgumentParser(description="Check central Auth /auth/validate convergence without mutating state")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    services = {name: service_report(name, cfg) for name, cfg in SERVICES.items()}
    docs_text = "\n".join(read(path) for path in DOCS)
    docs_contract = {
        "docsPreserveHostedAuthConsumerBoundary": "hosted Auth" in docs_text and "hosted Auth frontend adapter" in docs_text,
        "docsPreserveCentralValidateBoundary": "/auth/validate" in docs_text and "central" in docs_text,
        "docsPreserveLegacyPortalBoundary": "legacy speakasap-portal" in docs_text,
    }

    ok = all(all(report["checks"].values()) for report in services.values()) and all(docs_contract.values())
    report: dict[str, Any] = {
        "ok": ok,
        "checkedAt": now_iso(),
        "scope": "new speakasap protected bearer-token services only; no legacy speakasap-portal checks, no DB, no secrets, no deployment",
        "services": services,
        "docsContract": docs_contract,
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
