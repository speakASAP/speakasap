# Gateway API Contract

Date: 2026-06-12

Source of truth:

- `api-gateway/src/proxy/upstream-resolve.ts`
- `api-gateway/src/proxy/gateway-auth.guard.ts`
- `docs/refactoring/GATEWAY_ROUTE_OWNERSHIP_MATRIX.md`
- `docs/orchestrator/LESSON_RECORDING_CONTRACT.md`

## Gateway Contract Principles

1. Browser and frontend API calls enter through `/api/v1/...`.
2. Gateway validates bearer tokens through `auth-microservice` before forwarding, except explicitly allowed public webhooks.
3. Domain services enforce domain-specific authorization after gateway authentication.
5. Gateway forwards to owning services according to `GATEWAY_ROUTE_OWNERSHIP_MATRIX.md`.
6. Gateway must not become the owner of education, payment, notification, content, user, salary, or financial domain behavior.
7. Gateway must not expose direct MinIO/S3 routes or permanent media URLs.

## Standard Request Headers

Frontend to gateway:

- `Authorization: Bearer <jwt>` for protected routes.
- `Content-Type: application/json` for JSON writes.
- `x-request-id` optional; gateway/service may generate one if absent.

Gateway to service:

- Forward `Authorization` unless the route is a service-to-service route governed by [`SERVICE_IDENTITY_CONSUMER_STANDARD.md`](../../auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md) or an approved webhook.
- Preserve `x-request-id`.
- Preserve useful content headers.
- Strip hop-by-hop headers.

## Error Contract

Gateway/service errors should use structured JSON:

```json
{
  "error": {
    "code": "UNAUTHORIZED|FORBIDDEN|NOT_FOUND|BAD_REQUEST|GATEWAY_TIMEOUT|UPSTREAM_UNAVAILABLE|INTERNAL_ERROR",
    "message": "human-readable summary",
    "details": {}
  }
}
```

Rules:

- `401`: missing/invalid bearer token.
- `403`: authenticated user lacks domain permission.
- `404`: no route, no entity, or no visible private resource.
- `400`: malformed payload or validation failure.
- `502/504`: upstream unavailable/timeout.

## Service Contract Index

| Domain | Gateway prefixes | Owner | Contract status |
|---|---|---|---|
| Education lessons/groups/homework | `/api/v1/lessons`, `/api/v1/student-courses`, `/api/v1/homeworks`, `/api/v1/groups` | `education-service` | Existing basic APIs; lesson-recording contract defined. |
| Lesson recordings | `/api/v1/lessons/:lessonUuid/record*` | `education-service` | Defined in `docs/orchestrator/LESSON_RECORDING_CONTRACT.md`; implementation pending. |
| Certification/questionnaires/quests | `/api/v1/manager/user-questionnaires`, `/api/v1/user-questionnaires`, `/api/v1/questionnaires`, `/api/v1/quests`, `/api/v1/education-certificates`, `/api/v1/course-certificates` | `certification-service` | Existing gateway ownership; detailed parity contracts pending. |
| Assessment/tests | `/api/v1/admin/language-user-tests`, `/api/v1/admin/language-tests`, `/api/v1/language-user-tests`, `/api/v1/asset-user-tests` | `assessment-service` | Existing gateway ownership; detailed parity contracts pending. |
| Users/students/teachers/managers | `/api/v1/students`, `/api/v1/teachers`, `/api/v1/managers`, `/api/v1/employee-profiles` | `user-service` | Existing gateway ownership; auth remains in `auth-microservice`. |
| Course/catalog/offers | `/api/v1/products`, `/api/v1/categories`, `/api/v1/offers`, `/api/v1/part-payment-collections` | `course-service` | Existing gateway ownership; product/payment boundary needs review before implementation. |
| Content | `/api/v1/languages`, `/api/v1/grammar`, `/api/v1/phonetics`, `/api/v1/songs`, `/api/v1/dictionary` | `content-service` | Existing gateway ownership; public content parity pending. |
| Payment/order domain | `/api/v1/orders`, `/api/v1/subscriptions`, `/api/v1/invoices`, `/api/v1/discounts`, `/api/v1/webhooks/payments` | `payment-service` | External processing must stay with `payments-microservice`. |
| Notifications | `/api/v1/templates`, `/api/v1/letters`, `/api/v1/in-app`, `/api/v1/dispatch`, `/api/v1/preferences/me`, `/api/v1/notification-groups` | `notification-service` | Delivery remains with `notifications-microservice`. |
| Salary | `/api/v1/salary-profiles`, `/api/v1/salary-expenses`, `/api/v1/calculation-runs`, `/api/v1/payout-runs`, `/api/v1/contracts`, `/api/v1/admin/summary` | `salary-service` | Existing gateway ownership; parity pending. |
| Financial | `/api/v1/dashboard/overview`, `/api/v1/revenue`, `/api/v1/expenses`, `/api/v1/internal/financial*` | `financial-service` plus internal slices | Internal slice ownership documented in route matrix. |

## Lesson Recording API Summary

| Method | Route | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/lessons/:lessonUuid/record` | teacher/student/staff by domain check | Return `none`, `processing`, `ready`, or `unavailable` state. |
| `POST` | `/api/v1/lessons/:lessonUuid/record/presign` | assigned teacher or staff | Create short-lived private upload target. |
| `POST` | `/api/v1/lessons/:lessonUuid/record/commit` | assigned teacher or staff | Verify object metadata and update record state. |
| `GET` | `/api/v1/lessons/:lessonUuid/record/playback` | paid/eligible student, assigned teacher, staff, or scoped token | Stream or return short-lived private playback access. |

The detailed request/response schema is in `docs/orchestrator/LESSON_RECORDING_CONTRACT.md`.

## Verification Commands

Static checks:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap && rg -n "prefix:|EDUCATION_SERVICE_URL|GatewayAuthGuard" api-gateway/src/proxy'
ssh alfares 'cd /home/ssf/Documents/Github/speakasap && rg -n "LessonRecord|record/presign|record/commit|record/playback" docs/orchestrator docs/refactoring'
```

Build checks after code-bearing changes:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap/api-gateway && npm run build'
ssh alfares 'cd /home/ssf/Documents/Github/speakasap/education-service && npm run build'
```

## Drift Rule

Do not add a gateway route without:

- owner service
- auth mode
- domain authorization note
- frontend caller expectation
- build/static verification command
- orchestrator status evidence
