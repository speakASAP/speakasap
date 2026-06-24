# New SpeakASAP GDD Plan: Central AOS/Auth Adoption

Date: 2026-06-24
Repo: speakasap
Owner role: new SpeakASAP consumer migration owner

## IPS Chain

Vision: new SpeakASAP uses the shared Alfares AOS/auth-microservice account system and does not depend on legacy speakasap-portal auth.
Goal Impact: users can enter SpeakASAP with the same phone/email account used for Marathon and other Alfares services.
System: SpeakASAP monorepo frontend, api-gateway, user-service, domain services that validate auth tokens.
Feature: central auth redirect/callback, BFF session cookies, token validation through auth-microservice, auth user id mapping to domain profiles.
Task: inventory existing auth usage, route login/register to central auth UI, keep domain profile mirrors only.
Execution Plan: use WS-A auth contract; adapt frontend/gateway first; keep backend token validation unchanged where already correct.
Coding Prompt: modify only new speakasap repo; never touch legacy speakasap-portal or legacy runtime host; avoid unrelated domain changes.
Code: frontend auth pages/adapters, api-gateway auth routes if needed, user-service auth mapping, docs/tests.
Validation: affected package builds/tests and smoke for login callback/session.

## Current Findings

- SpeakASAP services already declare `AUTH_SERVICE_URL` and validate bearer tokens through auth-microservice in several domain services.
- user-service stores `auth_user_id` as auth-microservice User.id and optional legacy portal id, which matches the target ownership model.
- Frontend/login entrypoints still need inventory and migration to the central hosted auth UI.

## Goals

G1: Auth surface inventory.
- List all login/register/password/magic-link UI and API routes in the new SpeakASAP repo.
- Classify each as central-auth redirect, BFF callback, token validation, or domain profile mirror.

G2: Central auth redirect.
- Replace local login/register forms with central auth redirect once WS-A publishes URL contract.
- Preserve return path and locale.

G3: Callback/session.
- Store access/refresh tokens through the app BFF/session mechanism, not raw duplicated login forms.
- Refresh through auth-microservice.

G4: Domain profile binding.
- Ensure user-service profile rows reference auth user id.
- Do not create identity records outside auth-microservice.

G5: Regression validation.
- Existing domain services continue to validate bearer tokens.
- Gateway forwards Authorization correctly.
- No legacy speakasap-portal dependency added.

G6: Internal service identity.
- Classify `x-internal-token` routes as transitional machine auth, not Auth RBAC.
- Attach `serviceActor` metadata after successful internal-token validation.
- Send `X-Service-Name` from service-to-service internal callers where source owns the outbound client.
- Follow `auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md` until a final Auth-issued service JWT replacement is approved.

## Deliverables

- `docs/orchestrator/2026-06-24-aos-auth-modernization-plan.md` with this plan.
- Auth route inventory and implementation handoff.
- Code changes after WS-A contract is stable.

## Forbidden Work

- Do not touch `/home/ssf/Documents/Github/speakasap-portal`.
- Do not SSH to legacy `speakasap` runtime for mutation.
- Do not move domain data into auth; auth owns identity only.

## Internal Service Identity Follow-Up - 2026-06-24

Scope: new SpeakASAP only; legacy speakasap-portal remains forbidden.

Implementation lane:
- Gateway `/api/v1/internal/...`, user-service internal routes, education-service internal salary route, financial-service internal financial route, and payment salary-disburse internal route must keep token checks fail-closed.
- Successful internal-token validation should expose a `serviceActor` with `type=service`, `serviceName`, and `authMethod=internal-service-token`.
- Outbound internal clients should include `X-Service-Name` using `SERVICE_NAME` or a deterministic service fallback.
- The no-write checker is `scripts/check-service-identity-contract.py`.

Boundary:
- Do not read, print, rotate, or migrate internal token values in this lane.
- Do not call Auth `/auth/validate` for static internal-token exceptions until an Auth-issued service JWT cutover is explicitly designed and approved.
- Do not treat service actors as human users or grant Auth RBAC from internal token possession.


## Contact-Code Contract Update - 2026-06-24

Auth source now provides central `POST /auth/contact-code/request` and `POST /auth/contact-code/verify` for email or phone passwordless sign-in. New SpeakASAP must remain a hosted Auth redirect/callback consumer:

- do not add local phone-code/passwordless forms;
- redirect login/register entrypoints to hosted Auth with `client_id=speakasap`;
- preserve callback return path and token handoff;
- keep domain services validating bearer tokens through auth-microservice `/auth/validate`.

Runtime evidence: Auth and SpeakASAP frontend deployment/runtime smoke completed on 2026-06-24; browser click smoke verifies hosted Auth redirect with absolute callback and stored return state. Remaining gate: live user credential/contact-code smoke requires owner-approved test contact/provider readiness. Source guardrail: scripts/check-hosted-auth-contract.py now enforces the hosted Auth frontend contract and forbids local password/contact-code forms or relative return_url helpers.

## Central Auth Validate Source Guard - 2026-06-24

Scope: new SpeakASAP protected bearer-token services only; legacy `speakasap-portal` remains forbidden and was not inspected or changed.

Implementation lane:
- Preserve the hosted Auth frontend adapter as the session entrypoint and keep backend protected APIs validating bearer tokens through auth-microservice `POST /auth/validate`.
- Add `scripts/check-auth-validate-contract.py` as a no-write static guard for central validation convergence across user, course, education, assessment, certification, financial, notification, payment, and salary services.
- The checker fails if protected `JwtAuthGuard` implementations stop delegating bearer tokens to `AuthClientService`, if service clients stop using `POST /auth/validate`, or if local bearer JWT verification dependencies reappear in service source.

Boundary:
- Do not read secrets, live PII, or token values.
- Do not deploy or restart services from this source-level guard lane.
- Do not convert transitional internal-token machine auth to Auth `/auth/validate`; that remains separately gated by the service identity standard and Auth-issued service JWT design.
