# Gateway Auth Boundary (Phase 5 / TASK-65 freeze)

**Scope:** Authentication, authorization boundary, and token propagation rules for `speakasap-api-gateway`.

## Core boundary decisions

1. Authentication source of truth is `auth-microservice`.
2. Gateway authenticates browser/client calls with JWT bearer tokens.
3. Gateway forwards user JWT to upstream services; it does not mint domain tokens.
4. Gateway never exposes service-to-service `X-Internal-Token` values to browser clients.
5. Internal routes (`/api/v1/internal/**`) are denied for browser/public clients by default.

## Auth modes

| Mode | Caller type | Credential | Validation path | Allowed route families |
| --- | --- | --- | --- | --- |
| Public-authenticated | Browser/mobile/client | `Authorization: Bearer <jwt>` | Gateway verifies JWT via `auth-microservice` policy and forwards bearer | Public `/api/v1/**` routes per `GATEWAY_API_CONTRACT.md` |
| Public-unauthenticated | Browser/mobile/client | none | none | `GET /health` only |
| Trusted-internal (optional channel) | Service caller only | `X-Internal-Token` | Exact-match against configured gateway internal token policy | Explicit allowlist of `/api/v1/internal/**` routes |

## JWT propagation rules

- Gateway requires `Authorization` header for all public `/api/v1/**` routes.
- Gateway forwards original bearer token to upstream owner service.
- Gateway may attach gateway metadata headers (`X-Request-Id`, trace headers), but not mutate user identity claims.
- If JWT is missing/invalid/expired:
  - Return `401 UNAUTHORIZED`
  - Do not call upstream service.

## Authorization boundary

- Domain authorization remains in owner services (role checks, staff/admin checks, entity-level permissions).
- Gateway may enforce coarse deny rules:
  - block internal routes for public clients
  - block unknown methods on known prefixes
  - apply global rate limits
- Gateway must not encode domain-specific business permissions that can drift from upstream contracts.

## Internal token boundary

- Internal routes are excluded from public gateway routing by default.
- If internal channel is enabled, it must:
  - use dedicated token(s) from env (key names only; no secrets in docs)
  - apply strict route allowlist
  - log caller/service identity and `duration_ms`
- Internal token failures return `403 FORBIDDEN`.

## Error semantics

| Case | Status | Code |
| --- | --- | --- |
| Missing/invalid JWT on public route | `401` | `UNAUTHORIZED` |
| Public attempt to internal route | `403` | `FORBIDDEN_INTERNAL_ROUTE` |
| Invalid/missing internal token on internal channel | `403` | `FORBIDDEN` |
| Auth dependency failure (`auth-microservice` unavailable) | `502` | `AUTH_DEPENDENCY_UNAVAILABLE` |

## Observability and security logging

Each gateway request log must include:

- timestamp (ISO 8601)
- request id
- route + method
- auth mode (`public_jwt` | `internal_token` | `health`)
- upstream target service (if called)
- outcome status code
- `duration_ms`

Do not log raw JWTs or internal token values.

## Env keys (names only)

- `AUTH_SERVICE_URL`
- `GATEWAY_INTERNAL_API_TOKEN` (if internal channel is enabled)
- `LOGGING_SERVICE_URL`

## Non-goals for TASK-65

- SSO/session UI logic
- OAuth callback handling in gateway
- Fine-grained RBAC policy authoring per domain
