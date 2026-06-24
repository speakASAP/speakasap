#!/usr/bin/env python3
"""No-write checker for the new SpeakASAP hosted Auth consumer contract."""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

AUTH_SESSION = Path("frontend/lib/auth-session.ts")
HOSTED_LINK = Path("frontend/app/components/hosted-auth-link.tsx")
HOSTED_BUTTON = Path("frontend/app/components/hosted-auth-button.tsx")
CALLBACK_PAGE = Path("frontend/app/auth/callback/page.tsx")
API_CLIENT = Path("frontend/lib/api-client.ts")
HOME_PAGE = Path("frontend/app/page.tsx")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def main() -> int:
    parser = argparse.ArgumentParser(description="Check hosted Auth consumer contract without mutating state")
    parser.add_argument("--json-report", help="write JSON report to path; use - for stdout")
    args = parser.parse_args()

    texts = {
        "authSession": read(AUTH_SESSION),
        "hostedLink": read(HOSTED_LINK),
        "hostedButton": read(HOSTED_BUTTON),
        "callbackPage": read(CALLBACK_PAGE),
        "apiClient": read(API_CLIENT),
        "homePage": read(HOME_PAGE),
    }
    files = {
        "authSession": AUTH_SESSION.exists(),
        "hostedLink": HOSTED_LINK.exists(),
        "hostedButton": HOSTED_BUTTON.exists(),
        "callbackPage": CALLBACK_PAGE.exists(),
        "apiClient": API_CLIENT.exists(),
        "homePage": HOME_PAGE.exists(),
    }

    auth = texts["authSession"]
    link = texts["hostedLink"]
    button = texts["hostedButton"]
    callback = texts["callbackPage"]
    api_client = texts["apiClient"]
    all_frontend = "\n".join(texts.values())

    contract = {
        "usesHostedAuthOrigin": "https://auth.alfares.cz" in auth and "/login" in auth,
        "usesSpeakasapClientId": 'AUTH_CLIENT_ID = "speakasap"' in auth,
        "storesReturnStateBeforeRedirect": "storage?.setItem(`${AUTH_STATE_KEY_PREFIX}${state}`" in auth,
        "callbackReturnUrlIsAbsolute": 'new URL(returnPath || "/auth/callback", window.location.origin).toString()' in auth,
        "hostedLoginSetsReturnUrlToCallback": 'url.searchParams.set("return_url", callbackUrl)' in auth,
        "hostedLoginSetsClientId": 'url.searchParams.set("client_id", AUTH_CLIENT_ID)' in auth,
        "hostedLoginSetsState": 'url.searchParams.set("state", state)' in auth,
        "consumesAccessTokenFragment": 'params.get("access_token")' in auth,
        "consumesRefreshTokenFragment": 'params.get("refresh_token")' in auth,
        "consumesExpiresAtFragment": 'params.get("expires_at")' in auth,
        "validatesReturnedState": "const returnedState =" in auth
        and 'error: "invalid_state"' in auth
        and "storage?.getItem(stateKey)" in auth,
        "safeReturnPathGuard": "function safeReturnPath" in auth and 'value.startsWith("//")' in auth,
        "callbackConsumesFragment": "consumeHostedAuthFragment(window.location)" in callback,
        "callbackClearsUrl": "window.history.replaceState" in callback,
        "gatewayUsesBearerSession": "getAuthSession()?.accessToken" in api_client
        and "headers.Authorization = `Bearer ${sessionToken}`" in api_client,
        "linkBuildsUrlOnClick": "onClick={login}" in link
        and "window.location.assign(buildHostedAuthLoginUrl(returnPath))" in link,
        "linkDoesNotServerRenderAuthUrl": "auth.alfares.cz/login" not in link and 'href="/auth/callback"' in link,
        "buttonBuildsUrlOnClick": "window.location.assign(buildHostedAuthLoginUrl(returnPath))" in button,
        "homeUsesHostedAuthEntrypoints": "HostedAuthLink" in texts["homePage"]
        and "HostedAuthButton" in texts["homePage"],
    }

    forbidden_patterns = {
        "rawHostedHrefHelperRemoved": "getHostedAuthLoginHref" not in all_frontend,
        "noRelativeReturnUrlSetter": 'url.searchParams.set("return_url", returnPath)' not in all_frontend,
        "noPasswordFormInFrontend": not re.search(r"<input[^>]+type=[\"']password[\"']", all_frontend),
        "noLocalPhoneCodeFormInFrontend": "/auth/contact-code/request" not in all_frontend
        and "/auth/contact-code/verify" not in all_frontend,
    }

    ok = all(files.values()) and all(contract.values()) and all(forbidden_patterns.values())
    report: dict[str, Any] = {
        "ok": ok,
        "checkedAt": now_iso(),
        "files": files,
        "contract": contract,
        "forbiddenPatterns": forbidden_patterns,
        "scope": "new speakasap frontend hosted Auth consumer only; no legacy speakasap-portal checks",
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
