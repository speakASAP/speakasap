# Track I — SSO Handoff

**State:** CODE COMPLETE — **blocked on one missing auth-microservice route**, see §"The handoff cannot sign anyone in yet"
**Services:** `speakasap/frontend`, `speakasap-portal`
**Branches:** `feat/drilling-track-i` in both repos
**Commits:** `31fb96d9` (portal, I.1) · `4072e38` (I.2 resolve) · `8df37c2` (I.3 handoff)
**Plan:** [`../12-sso-handoff.md`](../12-sso-handoff.md) · **Blocks:** Track J

## Verification on the final tree

```
Test Files  12 passed (12)
     Tests  138 passed (138)

> ./node_modules/.bin/tsc --noEmit -p tsconfig.json      (clean, no output)
```

28 of those are new (14 resolve, 14 handoff). Portal-side: 10 assertions, run on the
speakasap server's own Python 3.4.3 / PyJWT 1.4.2 — **10 passed, 0 failed**.

**Guards proven by breaking them:**

| Broken behaviour | Tests that went red |
|---|---|
| soft fallback to `claims.sub` on a lookup failure | the three FAILS CLOSED tests (500, timeout, never-falls-back) |
| `safeNextPath` reduced to `startsWith('/')` | protocol-relative `//evil.example` and backslash `/\evil.example` |
| portal issues a token for a user with no email | `None without an email` |
| portal drops the PyJWT bytes→str normalization | `returns str not bytes` |

Each was reverted and the suite reconfirmed green.

## The handoff cannot sign anyone in yet

**This is the one thing to read before continuing the track.** Everything up to and
including identity resolution works. Nothing mints a session.

`resolve-or-provision-legacy` (Track H) returns `{ authUserId, provisioned }` and stops.
auth-microservice exposes **no internal route that issues an access token for an
already-resolved user id**:

- `generateTokens` is `private` in `auth.service.ts:621`.
- `POST auth/internal/magic-link/token` is the only internal token route. It is keyed on
  **email**, returns a `verifyUrl` to redirect to rather than a token, and **creates a
  user by email when none matches** — which would bypass the legacy mapping this entire
  flow exists to honour. It is the wrong instrument here.

So the exchange route returns `authUserId` alone, and the page shows "we could not sign
you in just now" rather than redirecting. A test asserts exactly that: resolution
succeeding without a session must **not** redirect, because landing a student on a page
that looks signed in and is not is worse than an honest error.

**What is needed:** an internal, `InternalServiceGuard`-protected route on
auth-microservice that mints a session for a given `authUserId` — the natural shape being
`POST /internal/users/:userId/session` returning `{ accessToken, refreshToken?, expiresIn }`.
That is auth-microservice's code, outside this track's declared ownership
(`frontend/app/auth/handoff/**`, `frontend/lib/drills/sso/**`,
`portal/platform_sso.py`), so it was not written here.

Once it exists, `app/auth/handoff/exchange/route.ts` needs the call added and the page
works unchanged — it already handles a present `accessToken`.

## What was built

| File | Purpose |
|---|---|
| `portal/platform_sso.py` | Token issuer. Marathon's helper generalized with `aud` + identity claims. |
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

## Not done

- **Session minting** — the blocker above. Track J depends on this handoff working end to
  end, so it should not start until that route exists.
- **The frontend has no secret mount at all — verified against production.**
  `deployment/speakasap-frontend` takes `envFrom` a single ConfigMap,
  `speakasap-frontend-config`, whose entire key set is `NEXT_PUBLIC_API_URL`, `NODE_ENV`,
  `PORT`, `SERVICE_NAME`. There is no `speakasap-frontend-secret`.

  All three server-side values this track needs are therefore absent:
  `SPEAKASAP_PLATFORM_JWT_SECRET`, `INTERNAL_SERVICE_TOKEN` and `AUTH_SERVICE_URL`.
  A secret sourced from Vault (`secret/prod/speakasap-frontend`) has to be created and
  mounted before the handoff can work.

  Note this is a genuine change in what the frontend deployment *is*: it has been a
  purely public-config service until now, and this track is what first gives it a server
  secret. `resolve.ts` is server-only for exactly that reason — importing it from a
  client component would put both secrets in the browser bundle.

  The portal side needs the **same** `SPEAKASAP_PLATFORM_JWT_SECRET` value in its own
  environment. It defaults to `''`, which disables the handoff rather than issuing
  unsigned tokens.
- **`speakasap-frontend` is NOT in auth's `TRUSTED_INTERNAL_SERVICES` — verified against
  production, not assumed.** The allowlist in `auth-microservice-secret` is non-empty and
  holds exactly three names: `orders-microservice`, `marathon`, `education-service`. The
  guard enforces the allowlist whenever it is non-empty, so resolution would fail with
  **401 "Service is not trusted"** today — a failure that reads like a bad token. This is
  the same trap as Finding 4, where `x-service-name` carried the K8s deployment name
  instead of the allowlisted one.

  Add `speakasap-frontend` to that secret before deploying, or change the
  `x-service-name` header in `resolve.ts` to a name already on the list. Adding the new
  name is the better fix: reusing `education-service`'s identity would make auth's audit
  log attribute frontend SSO calls to a different service.
- **Neither branch is deployed or merged.**
- **No portal view calls `get_platform_bearer_token` yet.** That is Track J's work —
  building the drill link in `cabinet/`.
