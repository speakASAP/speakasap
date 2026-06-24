# Gateway Auth Boundary

Date: 2026-06-12

## Boundary Rule

`auth-microservice` owns identity, JWT validation, and role payloads. `api-gateway` validates bearer tokens with `auth-microservice` and forwards authenticated requests. Domain services enforce domain-specific authorization, such as teacher assignment, student lesson access, paid access, manager permissions, or internal service access.

## Gateway Responsibilities

- Require `Authorization: Bearer <jwt>` for protected `/api/v1/...` routes.
- Validate bearer tokens through `auth-microservice`.
- Attach request context for logging.
- Allow only explicitly approved public webhook exceptions.
- Require `x-internal-token` for `/api/v1/internal/...`.
- Treat `x-internal-token` as transitional machine auth, not Auth RBAC. After token validation, attach `serviceActor` metadata from `X-Service-Name` or the `internal-service` fallback.
- Forward requests to owner services by route matrix.

## Domain Service Responsibilities

- Re-check domain access using service-owned data.
- Return `403` for authenticated users without access.
- Return `404` when revealing resource existence would leak private data.
- Never trust a frontend role label without validated auth context.
- Log actor, route, decision, and request ID without logging secrets.

## Current Gateway Exceptions

| Route | Exception | Required service-side control |
|---|---|---|
| `POST /api/v1/webhooks/payments` | Bearer auth bypassed at gateway | `payment-service` must verify webhook signature/provider authenticity. |
| `/api/v1/internal/...` | Uses `x-internal-token` instead of bearer token | Owning service must treat as internal-only machine auth, validate token/contract, and attach `serviceActor` metadata. |

## Lesson Recording Auth Boundary

Lesson recording migration must add education-service domain checks:

- Teacher upload/presign/commit requires assigned teacher for lesson and student.
- Student playback requires paid access and lesson availability.
- Manager/admin playback requires explicit manager/staff/admin role.
- Optional media token must be signed, scoped to lesson/user/scope, and time-limited to one hour or less.

Gateway must not expose direct MinIO routes. The education service must mediate playback through streaming or short-lived scoped presigned URLs.

## Verification

For implementation chunks, verify at least:

- Missing bearer token returns `401`.
- Valid user without domain access returns `403`.
- Unknown/private resource returns `404`.
- Payment webhook path does not allow arbitrary unauthenticated mutation.
- Internal routes reject missing or wrong `x-internal-token`.
- Internal route source contract follows `auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md`: `X-Service-Name` identifies the caller where available, and local internal tokens remain a transitional service credential boundary rather than a human user identity.
