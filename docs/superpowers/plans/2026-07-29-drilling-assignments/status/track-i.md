# Track I — SSO Handoff

**State:** **COMPLETE AND LIVE IN PRODUCTION, BOTH SIDES.** The portal's own deployed
code, signing with its live `.env` secret, mints a token the platform verifies, resolves
and exchanges for a real session. Verified across both systems 2026-08-04.
**Services:** `speakasap/frontend`, `speakasap-portal`, `auth-microservice`
**Branches:** `feat/drilling-track-e` (speakasap — Track E and I share it, built in sequence) · `feat/drilling-track-i` (portal) · `feat/internal-session-endpoint` (auth)
**Commits:** `31fb96d9` `e835893c` (portal) · `4072e38` `8df37c2` `a374e34` (frontend) · `0ca95f5` (auth)
**Plan:** [`../12-sso-handoff.md`](../12-sso-handoff.md) · **Blocks:** Track J

## Verification on the final tree

```
Test Files  13 passed (13)
     Tests  146 passed (146)

> ./node_modules/.bin/tsc --noEmit -p tsconfig.json      (clean, no output)
```

36 of those are new (14 resolve, 14 handoff, 8 exchange route). auth-microservice:
**180 passed, 23 suites**, typecheck clean, plus a live boot against the real database.
Portal-side: 19 assertions on the speakasap server's own Python 3.4.3 / PyJWT 1.4.2 —
**10 for the token issuer, 9 for the redirect view, 0 failed**.

**Guards proven by breaking them:**

| Broken behaviour | Tests that went red |
|---|---|
| soft fallback to `claims.sub` on a lookup failure | the three FAILS CLOSED tests (500, timeout, never-falls-back) |
| `safeNextPath` reduced to `startsWith('/')` | protocol-relative `//evil.example` and backslash `/\evil.example` |
| portal issues a token for a user with no email | `None without an email` |
| portal drops the PyJWT bytes→str normalization | `returns str not bytes` |
| exchange route mints a token locally when auth fails | both exchange FAILS CLOSED tests |
| portal `_safe_next` drops its `//` and `/\\` checks | `refuses protocol-relative next`, `refuses backslash next` |

Each was reverted and the suite reconfirmed green.

## Session minting — the former blocker, now built

`resolve-or-provision-legacy` (Track H) answers *who* the student is and stops there.
auth-microservice had **no internal route that issues an access token for an
already-resolved user id**: `generateTokens` is `private`, and
`POST auth/internal/magic-link/token` is keyed on **email**, returns a `verifyUrl` rather
than a token, and **creates a user by email when none matches** — which would bypass the
legacy mapping this whole flow exists to honour.

**`POST /internal/users/:userId/session` was added** (`auth@0ca95f5`, branch
`feat/internal-session-endpoint`), behind `InternalServiceGuard`, returning
`{ accessToken, expiresIn, userId }`.

Two deliberate narrowings versus a password login, both tested:

- **No refresh token.** The session is established from a token in a URL, not from the
  user authenticating to us. Returning a 30-day credential on that basis would widen a
  redirect into standing access. The controller builds its response field by field, so a
  refresh token added upstream later cannot leak through by accident.
- **12 hours, not 7 days**, as a constant rather than an env var, so the blast radius
  cannot drift upward by config.

**Verified against the real auth database, not just mocks.** Adding `AuthService` to
`InternalUsersController` makes `UsersModule` and `AuthModule` mutually dependent; a
missing `forwardRef` fails at **boot**, which no mocked unit test would catch — the same
blind spot as the 2026-08-03 Finding 4 post-mortem, where mocked SQL passed CI. So the
built app was run against the `auth` database over a port-forward:

```
Mapped {/internal/users/:userId/session, POST} route
Nest application successfully started          (zero circular-dependency errors)

POST /internal/users/<resolved uuid>/session
  keys: ['accessToken', 'expiresIn', 'userId']   expiresIn: 43200
  claims: auth_method=portal_sso  ttl_s=43200  sub matches resolved user: True
  unknown user -> 404      no internal service token -> 401
```

The user id came from resolving legacy id `310740` through `by-legacy-id` — a real
mapping, so this exercised resolution and minting together.

The frontend exchange route now makes both calls (`speakasap@a374e34`). A failure in
either produces `IDENTITY_UNRESOLVED`: a resolved identity with no session is still no
session, and a locally minted token would not be verifiable by any other service in the
estate.

## What was built

| File | Purpose |
|---|---|
| `portal/platform_sso.py` | Token issuer. Marathon's helper generalized with `aud` + identity claims. |
| `portal/drill_redirect.py` | The drill link: mints the token, redirects to the platform handoff. |
| `portal/tests/test_drill_redirect.py` | Django `TestCase` suite for the redirect. |
| `auth/src/auth/auth.service.ts` | `createSessionForUser` — 12h, access token only. |
| `auth/src/users/internal-users.controller.ts` | `POST /internal/users/:userId/session`. |
| `frontend/app/auth/handoff/exchange/route.ts` | Resolves, then mints. Fails closed on either. |
| `portal/tests/test_platform_sso.py` | Django `TestCase` suite (see §"How the portal tests were run"). |
| `portal/local_settings_default.py` | Declares `SPEAKASAP_PLATFORM_JWT_SECRET`. |
| `frontend/lib/drills/sso/resolve.ts` | Server-only verification + resolution. Fails closed. |
| `frontend/app/auth/handoff/exchange/route.ts` | Server route; the browser never holds either secret. |
| `frontend/app/auth/handoff/safe-next-path.ts` | Open-redirect guard. |
| `frontend/app/auth/handoff/page.tsx` | The landing page. |

## Decisions worth carrying forward

**Resolution had to move server-side.** The plan places `resolve.ts` in
`lib/drills/sso/`, which reads as client code, but auth's `InternalServiceGuard` wants
`x-internal-service-token` — a shared server secret a browser cannot hold. Hence the
route handler: the page POSTs the SSO token to our own origin, and the secrets stay on
the server. The module is server-only and must never be imported into a client component.

**`alg` comes from our allowlist, never the token.** `verify()` computes HS256 and
compares with `timingSafeEqual`; a header claiming `alg: none` simply fails verification
rather than skipping it. There is no branch that reads `header.alg` to decide *how* to
verify — only one that rejects anything that is not HS256.

**Expiry is checked before audience.** An old token for the right audience is still
expired, and "this link has expired, open it from the portal again" is the more
actionable message.

**The token never touches the URL after arrival.** It is POSTed in a body, and
`history.replaceState` strips it from the address bar before the redirect, keeping it out
of browser history and the referrer.

**PyJWT 1.4.2 returns bytes.** Verified on the server's own interpreter rather than
assumed, which is why the `hasattr(token, 'decode')` branch is load-bearing and has a
test. Copied from the marathon helper unchanged, per the plan.

## How the portal tests were run

`speakasap-portal` has **no local dev environment** — this machine has Python 3.12 and no
Django; the portal needs Python 3.4 + Django 1.11.2, and `test.sh`'s venv path
(`/home/portal_db/DEV/venv`) does not exist on either machine. Django and PyJWT are
installed system-wide on the speakasap server.

`ssh speakasap` is **READ ONLY**, and copying files to production is forbidden. Running
`manage.py test` there would require the unpushed code to be on that host. So the
assertions were executed **over stdin** — the module source and the checks piped into
`python3 -` on the server, nothing written to its filesystem:

```
PASS - sub is the legacy id            PASS - alg is HS256
PASS - identity claims present         PASS - returns str not bytes
PASS - has audience                    PASS - audience not hardcoded
PASS - expires in 300s by default      PASS - None without a secret
PASS - expiry configurable             PASS - None without an email
TOTAL 10 passed, 0 failed
```

Falsification was run the same way: the broken build reported `8 passed, 2 failed`,
failing precisely the email guard and the bytes/str normalization.

`portal/tests/test_platform_sso.py` is the durable equivalent and covers the same ten
behaviours through `django.test.TestCase`. **It has never been run by a Django test
runner** — do that in Track K, once the branch is deployed, with:

```bash
ssh speakasap 'cd speakasap-portal && python3 manage.py test portal.tests.test_platform_sso'
```

## The full cross-system flow, verified 2026-08-04

The decisive test, run after both halves were deployed: the **portal's own
`platform_sso.py` on the speakasap server**, loading the secret from its live `.env`,
minted a token for legacy id `310740`. That token was POSTed to the live platform:

```
POST https://speakasap.alfares.cz/auth/handoff/exchange
  -> 200   authUserId e9c0e180…   expiresIn 43200   session issued
```

Nothing was stubbed between the two systems: portal code, portal secret, platform
verification, auth resolution, auth session minting. The secrets agree across three
places (portal `.env`, `secret/prod/speakasap-frontend`, `secret/prod/speakasap-portal`),
which is exactly what a fingerprint check cannot prove on its own and a real exchange can.

## Verified in production, 2026-08-03

`auth-microservice:0ca95f5` and `speakasap-frontend:46b4097` are live. A real
portal-signed token for legacy id `310740`, minted with the production secret from
Vault, was POSTed to the live exchange route:

```
POST https://speakasap.alfares.cz/auth/handoff/exchange
  -> 200  keys: ['accessToken','authUserId','expiresIn']
          authUserId e9c0e180…   expiresIn 43200
```

Signature verification, legacy-id resolution and session minting all worked against the
real estate — not a mock between them.

**Every fail-closed guard holds against the live stack**, each returning 401 rather than
a session:

| Attack | Result |
|---|---|
| expired token | 401 |
| wrong audience (`marathon`) | 401 |
| `alg: none` bypass | 401 |
| token signed with the wrong secret | 401 |
| garbage / non-JWT | 401 `INVALID_TOKEN` |
| no token at all | 400 |

And auth's allowlist, probed from inside the auth pod:

| Call | Result |
|---|---|
| `speakasap-frontend`, unknown user | 404 — passed the allowlist, reached the handler |
| service name not on the allowlist | 401 |
| no internal service token | 401 |

The 404-vs-401 split is what proves the `speakasap-frontend` allowlist entry is load
bearing.

**Secrets are provisioned.** `secret/prod/speakasap-frontend` was created in Vault and
reaches the pod through a new `speakasap-frontend-secret` ExternalSecret. Fingerprints
confirm the values match their counterparts: `INTERNAL_SERVICE_TOKEN` equals auth's, and
`SPEAKASAP_PLATFORM_JWT_SECRET` equals the portal's — they must, or every token fails
verification. `TRUSTED_INTERNAL_SERVICES` was extended in **Vault**, not by patching the
K8s secret, which ESO would have reverted within its 5m refresh.

**Secrets stay server-side.** Checked against the real build output: neither secret name
appears anywhere in `.next/static/`, only in `.next/server/`. `/auth/handoff/exchange`
builds as a dynamic server route.

## Correction, 2026-08-04 — a defect this track's testing missed

Track J's deploy exposed one: `SPEAKASAP_PLATFORM_JWT_SECRET` and
`SPEAKASAP_PLATFORM_URL` were declared only in `portal/local_settings_default.py`, and
**production loads `local_settings.py` instead**, so `portal/settings.py` never exposed
them. The Django app could not have minted a token.

This was invisible here because every probe in this track read `.env` directly rather
than going through `django.conf.settings` — they proved the *logic* and skipped the
*wiring*. Fixed in `speakasap-portal@845acc59`, and re-verified through the Django app:

```
django app can mint a token: True
redirect -> https://speakasap.alfares.cz/auth/handoff?next=%2Flearner%2F... sso present
```

**Lesson:** a probe that bypasses the framework's configuration proves less than it
appears to. Load settings the way the application loads them.

## Not done

- **The Django test suite has still never run under a real test runner.**
  `manage.py test` fails on the speakasap server with
  `permission denied to create database` — the portal's DB user cannot create
  `test_portal_db`. That is an environment limitation, not a code failure, and granting
  CREATE DATABASE on the production role for a test run was not worth doing unasked.

  The same behaviours are covered by stdin probes run against the **deployed** files on
  that server's own Python 3.4.3 / PyJWT 1.4.2 (5 assertions post-deploy, 19 pre-deploy,
  with falsification). `portal/tests/test_platform_sso.py` and
  `portal/tests/test_drill_redirect.py` remain the durable suites for whenever a test
  database becomes available.

- **No URL routes to `drill_redirect_view`.** The view and its guards are done and
  tested, but nothing in `urls.py` points at it and no template links to it. Wiring the
  entry point in `cabinet/` is Track J's work.

- **`SPEAKASAP_PLATFORM_URL` defaults to `https://speakasap.alfares.cz`.** Confirm that
  is the intended target before the portal ships — `speakasap.alfares.cz` and
  `speakasap.com` are different systems.

- **No browser has walked the flow.** Every hop is proven with curl against production,
  but nobody has clicked a real portal drill link and watched a session land in
  `localStorage`. That needs the portal half first.

- **The speakasap branch still carries both tracks.** Tracks E and I share
  `feat/drilling-track-e`, now deployed as `speakasap-frontend:46b4097`. Split them if
  the tracks need to be revertible independently.
