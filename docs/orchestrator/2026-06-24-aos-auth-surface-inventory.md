## WS-G Hosted Auth Adapter Update

Status: implemented after WS-A hosted Auth UI contract slice.

Changed frontend surfaces:

- `frontend/lib/auth-session.ts` centralizes hosted Auth login URL generation, `client_id=speakasap`, callback `return_url`, state nonce storage, fragment parsing, token persistence, and local sign-out.
- `frontend/app/auth/callback/page.tsx` consumes `#access_token`, `#refresh_token`, `#expires_at`, `#state`, and `#auth_method`, stores the session through the frontend helper, strips the fragment from browser history, and returns the user to the original path.
- `frontend/app/admin/page.tsx` now uses the stored hosted Auth access token for gateway calls instead of requiring manual JWT paste.
- `frontend/app/components/lesson-record-workspace.tsx` now uses the stored hosted Auth access token for protected recording gateway calls and keeps scoped playback range checks tokenless after gateway playback response.
- `frontend/app/page.tsx` links to hosted Auth for the root entrypoint.

Validation:

- `cd frontend && npm run build` passed after the adapter change.
- `git diff --check -- frontend docs/orchestrator/2026-06-24-aos-auth-surface-inventory.md docs/orchestrator/STATUS.md` passed after the adapter change.

Remaining limits:

- Tokens are stored in browser `localStorage`, matching this thin frontend-only adapter scope. A cookie/BFF session can replace it later if the platform publishes a stronger frontend session standard.
- No live deployment, production smoke, DB query, secret read, or legacy `speakasap-portal` access was performed in WS-G.

# AOS/Auth Surface Inventory - WS-C New SpeakASAP Consumer

Date: 2026-06-24
Repo: speakasap
Owner role: WS-C new SpeakASAP consumer owner
Scope: new SpeakASAP monorepo frontend auth entrypoints/adapters, api-gateway auth routing, user-service auth id mapping, docs/tests.
Forbidden: legacy speakasap-portal, legacy speakasap runtime host mutation, salary/payment/content unrelated features.

## IPS Chain

Vision: new SpeakASAP uses the shared Alfares AOS/auth-microservice account system and does not depend on legacy speakasap-portal auth.
Goal Impact: learners, teachers, staff, and managers can enter SpeakASAP with the same Alfares identity used by other services.
System: Next.js frontend, api-gateway, user-service, and domain services that validate bearer tokens.
Feature: central hosted auth redirect/callback, BFF/session storage, token validation through auth-microservice, auth user id mapping to SpeakASAP domain profiles.
Task: inventory current auth surfaces and classify what can migrate now versus what is blocked by WS-A contract.
Execution Plan: keep existing bearer validation and domain id mapping; do not add login/callback code until hosted auth URL, callback, token exchange, refresh, and cookie/session contract are published.
Coding Prompt: modify only new speakasap repo; never touch legacy speakasap-portal or the legacy runtime host; avoid unrelated domain changes.
Code: docs-only in this pass because WS-A contract is not present in repository evidence.
Validation: repository search, RAG query, and docs-only validation; code package builds are not applicable until code changes exist.

## Source Evidence

- Required repo instructions and standards were read from `AGENTS.md`, `/home/ssf/.codex/AGENTS.md`, `/home/ssf/.ai-agent-standards/CROSS_AGENT_AUTOMATION_STANDARD.md`, and `AGENT_OPERATIONS.md`.
- Required orchestrator docs were read where present: `BUSINESS.md`, `SYSTEM.md`, `docs/orchestrator/MASTER_PROMPT.md`, `docs/orchestrator/INTENT.md`, `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md`, `docs/orchestrator/GOALS.md`, `docs/orchestrator/PLAN.md`, `docs/orchestrator/IMPLEMENTATION_STATE.md`, `docs/orchestrator/STATE.json`, `docs/orchestrator/STATUS.md`, `TASKS.md`, and root `STATE.json`.
- `[MISSING: docs/orchestrator/IMPLEMENTATION_ORCHESTRATOR.md]` is listed by AGENTS/IPS but is not present in the remote repo.
- RAG was reachable through `deployment/speakasap`, returned HTTP 200, but returned empty context/sources for this AOS/auth query.
- Current planning source: `docs/orchestrator/2026-06-24-aos-auth-modernization-plan.md`.

## Current Auth Surface Inventory

| Surface | Files | Current behavior | Classification | WS-C decision |
|---|---|---|---|---|
| Root frontend shell | `frontend/app/page.tsx`, `frontend/app/layout.tsx` | Public scaffold links to learner, teacher, and admin shells. No login/register/session/callback route. | public entrypoint | Add central login CTA only after WS-A publishes hosted auth URL and return-path contract. |
| Admin frontend shell | `frontend/app/admin/page.tsx`, `frontend/lib/api-client.ts` | Client component accepts manually pasted bearer JWT and calls gateway admin-related APIs with `Authorization: Bearer`. | temporary token-paste protected workflow shell | Replace manual token entry with BFF/session-derived bearer once callback/session contract exists. |
| Learner frontend shell | `frontend/app/learner/page.tsx`, `frontend/app/learner/lessons/[lessonUuid]/record/page.tsx`, `frontend/app/components/lesson-record-workspace.tsx` | Public page collects lesson UUID; nested recording workspace accepts pasted bearer token for protected gateway calls. Playback range can use scoped URL without bearer after gateway playback response. | temporary token-paste protected workflow shell plus scoped media-token path | Preserve gateway-first calls; replace pasted token with session adapter after WS-A contract. |
| Teacher frontend shell | `frontend/app/teacher/page.tsx`, `frontend/app/teacher/lessons/[lessonUuid]/record/page.tsx`, `frontend/app/components/lesson-record-workspace.tsx` | Public page collects lesson UUID; nested recording workspace accepts pasted bearer token for protected state/playback/presign gateway calls. Commit/merge/delete remain excluded. | temporary token-paste protected workflow shell | Preserve destructive-action exclusion; replace pasted token with session adapter after WS-A contract. |
| Seven public frontend | `frontend/app/[languageCode]/seven/page.tsx`, `frontend/app/[languageCode]/seven/[order]/page.tsx`, `frontend/lib/seven.ts` | Public content loads through gateway `/api/v1/seven...`; no bearer/session dependency. | public content | No auth modernization change needed. |
| Frontend API adapter | `frontend/lib/api-client.ts`, `frontend/lib/gateway.ts` | Adds `Authorization: Bearer` only when caller supplies `token`; reads gateway base from `NEXT_PUBLIC_API_URL`. No cookie/session/refresh adapter exists. | frontend auth adapter gap | Needs BFF/session source, refresh behavior, and redirect-on-401 rules from WS-A/consumer contract. |
| Gateway proxy controller | `api-gateway/src/proxy/gateway-proxy.controller.ts`, `api-gateway/src/proxy/proxy.service.ts` | All `/api/v1/*` routes pass through `GatewayAuthGuard` and are forwarded by longest-prefix upstream routing. Authorization header is forwarded. | token validation / forwarding | Already aligned with central token validation for protected APIs. |
| Gateway bearer validation | `api-gateway/src/proxy/gateway-auth.guard.ts`, `api-gateway/src/auth-client/auth-client.service.ts`, `api-gateway/src/shared/validate-env.ts` | Validates bearer token through `AUTH_SERVICE_URL` or `AUTH_MICROSERVICE_URL` `POST /auth/validate`; allows explicit exceptions for payment webhooks, scoped lesson-record download, public Seven GETs, and internal token routes. | token validation | Keep unchanged until WS-A defines login/callback routes that belong in gateway/BFF. |
| Gateway route ownership | `api-gateway/src/proxy/upstream-resolve.ts`, `docs/refactoring/GATEWAY_API_CONTRACT.md`, `docs/refactoring/GATEWAY_AUTH_BOUNDARY.md` | User routes go to `USER_SERVICE_URL`; gateway remains contract layer and must not own domain behavior. | token validation / route boundary | No new auth route should be added without owner service, auth mode, callback/session contract, and validation command. |
| User-service bearer validation | `user-service/src/auth/jwt-auth.guard.ts`, `user-service/src/auth-client/auth-client.service.ts`, `user-service/src/shared/validate-env.ts` | Domain service validates bearer token through `AUTH_SERVICE_URL` `POST /auth/validate` and attaches `req.authUser`. | token validation | Already aligned with auth-microservice identity ownership. |
| User-service profile mapping | `user-service/prisma/schema.prisma`, `user-service/src/students/*`, `user-service/src/teachers/*`, `user-service/src/managers/*`, `user-service/src/employee-profiles/*` | `auth_user_id` is auth-microservice `User.id`; profile rows mirror domain data and optional legacy portal ids. Profile updates can upsert mirror fields but do not create auth identities. | domain profile mirror | Keep as-is; do not create identity records outside auth-microservice. |
| Internal user-service mapping | `user-service/src/internal/internal.controller.ts`, `user-service/src/auth/internal-token.guard.ts` | Internal routes resolve notification targets and upsert domain profiles by `authUserId` behind `x-internal-token`. | internal domain profile mirror | Keep behind internal token; no hosted-login dependency. |

## Missing WS-A Contract

Implementation of central hosted login/callback is blocked because the SpeakASAP repo does not currently contain a stable WS-A contract for:

- hosted login/register/reset URL(s);
- callback route path and allowed redirect URI(s);
- authorization code or token exchange shape;
- refresh-token endpoint and rotation rules;
- BFF cookie names, flags, max age, CSRF requirements, and logout behavior;
- locale and return-path query parameter names;
- 401 handling expectations for frontend routes and gateway/BFF;
- test credentials or non-production token fixture path for callback/session smoke.

The existing AOS plan explicitly says code changes happen after the WS-A contract is stable. No compatible code change was made in this pass.

## Proposed Follow-up Once WS-A Publishes Contract

1. Frontend/BFF owner: add `/auth/login`, `/auth/callback`, `/auth/logout`, and session/token helper routes in frontend or gateway/BFF according to WS-A ownership.
2. Frontend adapter owner: replace manual token entry in `frontend/app/admin/page.tsx` and `frontend/app/components/lesson-record-workspace.tsx` with session-derived gateway calls.
3. Gateway owner: add only the contract-approved public callback/session routes; keep protected `/api/v1/*` bearer validation unchanged.
4. User-service owner: verify no profile path creates auth identities; add tests only if callback claims require a new mapping edge.
5. Validation owner: run frontend build, api-gateway build if touched, user-service build if touched, unauthenticated redirect smoke, callback/session smoke, token refresh smoke, and protected route 401/403 checks.

## Parallel Execution

| Workstream | Status | Owner role | Allowed files | Forbidden files | Dependencies | Expected output | Validation |
|---|---|---|---|---|---|---|---|
| WS-A hosted auth contract | blocked | WS-A auth provider owner | `[MISSING: WS-A contract location]` | SpeakASAP code, legacy portal | Publish stable contract facts above | Contract doc/handoff | Contract review by WS-C integration owner |
| WS-C frontend/BFF adoption | dependency-gated | SpeakASAP frontend consumer owner | `frontend/app/**`, `frontend/lib/**`, contract docs | legacy portal, salary/payment/content unrelated code | WS-A contract | Login/callback/session implementation | `cd frontend && npm run build`; browser smoke |
| WS-C gateway routing | dependency-gated | SpeakASAP gateway owner | `api-gateway/src/**`, `docs/refactoring/**` | user-service schemas, legacy portal | WS-A contract says gateway owns any route | Contract-approved callback/session routing only | `cd api-gateway && npm run build`; 401/callback smoke |
| WS-C user-service mapping | ready now for review only | SpeakASAP user-service owner | `user-service/src/**`, `user-service/prisma/schema.prisma`, docs | auth-microservice, legacy portal | None for review; WS-A for code | Confirm profile mirror remains identity-free | `cd user-service && npm run build` if code changes |
| Final integration | final integration | WS-C integration owner | docs/status plus changed WS-C files | unrelated domains | WS-A plus completed workstreams | IPS evidence, validation summary, merge/commit block | all affected package builds and runtime smoke |

Merge order after WS-A contract: contract doc -> frontend/BFF adapter -> gateway route changes if required -> user-service tests if required -> integration/status.

## Validation For This Pass

- RAG query: HTTP 200 from `deployment/speakasap`, empty `context` and `sources`.
- Repository search: no concrete hosted auth login/callback/session contract found outside the draft AOS plan.
- Code changes: none.
- Build/test: not run because this pass is docs-only and did not change executable code.
- Deployment/runtime mutation: none.

## Handoff

WS-C can safely proceed to code only after WS-A publishes the hosted auth contract. Until then, the safe state is to preserve existing gateway and service bearer validation through auth-microservice, preserve user-service auth UUID mirrors, and avoid adding speculative login/callback/session behavior.
