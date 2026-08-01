# Track H — Legacy Identity Resolution

**State:** COMPLETE
**Service:** `auth-microservice` (a different repository from `speakasap`).
**Branch:** `main` · **Commits:** `411f47a..a3e6313`
**Plan:** [`../05-identity.md`](../05-identity.md)
**Owns:** `src/users/users.service.ts`, `src/users/internal-users.controller.ts` (+ their specs, + the audit query).

## Contract changes

**None.** `POST /internal/users/resolve-or-provision-legacy` implements contract C9
exactly as published in `00-MASTER.md`. Track I may code against it as written.

## What was built

- **H.1** `UsersService.resolveOrProvisionLegacyUser`. Idempotent on
  `(legacySystem, legacyUserId)`: existing mapping → email match → create.
  Blank emails throw `BadRequestException` instead of producing an unusable account.
  Reuses the file's existing `normalizeEmail` and `findByEmail` rather than
  re-implementing normalization.
- **H.2** `POST /internal/users/resolve-or-provision-legacy`. Validates `system`
  and a positive-integer `legacyUserId` before delegating.
- **H.3** `scripts/audit-legacy-mapping-coverage.sql`.

## Verification run

```
$ rtk npm test -- users.service.legacy internal-users
PASS src/users/users.service.legacy.spec.ts
PASS src/users/internal-users.controller.spec.ts
Test Suites: 2 passed, 2 total
Tests:       12 passed, 12 total

$ rtk npm test                    # whole service, regression check
Test Suites: 19 passed, 19 total
Tests:       148 passed, 148 total

$ ./node_modules/.bin/tsc --noEmit -p tsconfig.json
exit 0 — clean
```

Both new suites were confirmed to **fail first** (`TS2339: Property … does not
exist`) before the implementation was written.

**Typecheck note:** this repo has **no `npm run typecheck` script** — Track 0
added those to the 12 `speakasap` packages, and `auth-microservice` is a separate
repository. Typecheck was run through the local compiler by path, never `npx tsc`.

## H.3 coverage audit — run 2026-08-01

Run read-only through the postgres MCP server against database `auth`
(`postgres_agent_guide` → `postgres_health_check` → `postgres_query`, as mandated).

```
status,rows,with_auth_user,missing_auth_user
created,214034,214034,0
created_duplicate_email,192,192,0
mapped,6,6,0
```

**No row has a null `authUserId`.** Zero `skipped` rows of any kind. This is an
exact match to the 2026-07-29 baseline in the plan (214,034 / 192 / 6) — **no
drift, nothing to report to the orchestrator before Track I ships.**
Provisioning is confirmed a rarely-taken fallback, not the main path.

## Deferred to the orchestrator

- **No deploy was run.** The new endpoint exists in `main` but is **not live in
  production**; Track I's SSO handoff will 404 against the deployed pod until
  `auth-microservice` is deployed. Subagents must not deploy — this is Track K's.
- Still outstanding from Track 0, unchanged by this track: `SPEAKASAP_PLATFORM_JWT_SECRET`
  is in Vault but has **not** been ESO-force-synced to K8s or rolled out.
- No migrations. `LegacyIdentityMapping` already existed; no schema change was needed.

## Notes for Track I

1. The endpoint is `POST /internal/users/resolve-or-provision-legacy`, guarded by
   the **class-level** `InternalServiceGuard` on `InternalUsersController` — your
   call needs the internal-service credential, same as the existing
   `GET /internal/users/by-legacy-id`.
2. It returns `{ authUserId, provisioned }`. `provisioned: false` means the
   mapping already existed; `true` means this call wrote one.
3. **It does not 404.** The older `GET …/by-legacy-id` 404s on a missing mapping;
   this POST provisions instead. Per the plan, distinguishing an absent mapping
   from a transport failure — and failing closed on the latter — lives on your
   side, not here.
4. A blank/whitespace email is a `400`, not a silent create. Send a real email.
5. Given the audit above, expect `provisioned: false` on essentially every real
   portal user. A burst of `true` means the legacy id space drifted — worth raising.
