# API Gateway Contract (Phase 5 / TASK-65 freeze)

**Service:** `speakasap-api-gateway`  
**Port:** `4210`  
**Base path:** `/api/v1`  
**Health:** `GET /health` (no prefix)

## Objective

Define the frozen gateway routing contract for Phase 5 so implementation can stay deterministic and preserve single-writer ownership.

## Source of truth

- `GATEWAY_ROUTE_OWNERSHIP_MATRIX.md`
- Upstream frozen contracts (`*_API_CONTRACT.md`)

If this document conflicts with an upstream domain contract, upstream contract semantics win and gateway behavior must be adjusted.

## Global rules

1. Gateway is transport/orchestration only; it does not own business entities.
2. Gateway forwards requests to one upstream owner service per route family.
3. Gateway does not expose `/api/v1/internal/**` routes to browser/public traffic.
4. Gateway preserves upstream list limits (`limit <= 30`).
5. Gateway emits structured logs with timestamp + `duration_ms` per upstream call.
6. Gateway does not increase global timeouts to hide hangs; timeout handling requires explicit error mapping and logs.

## Route mapping (frozen)

| Public gateway route family | Upstream owner service | Forwarded methods |
| --- | --- | --- |
| `/api/v1/languages`, `/api/v1/grammar`, `/api/v1/phonetics`, `/api/v1/songs`, `/api/v1/dictionary` | `speakasap-content-service` | `GET` |
| `/api/v1/course-certificates`, `/api/v1/education-certificates`, `/api/v1/quests`, `/api/v1/questionnaires`, `/api/v1/user-questionnaires`, `/api/v1/manager/user-questionnaires` | `speakasap-certification-service` | `GET`, `PATCH`, `POST` (submit paths only) |
| `/api/v1/admin/language-tests`, `/api/v1/language-user-tests`, `/api/v1/asset-user-tests`, `/api/v1/admin/language-user-tests` | `speakasap-assessment-service` | `GET`, `POST`, `PATCH`, `DELETE` |
| `/api/v1/students`, `/api/v1/teachers`, `/api/v1/managers`, `/api/v1/employee-profiles` | `speakasap-user-service` | `GET`, `PATCH` |
| `/api/v1/categories`, `/api/v1/products`, `/api/v1/part-payment-collections`, `/api/v1/offers` | `speakasap-course-service` | `GET` |
| `/api/v1/groups`, `/api/v1/student-courses`, `/api/v1/lessons`, `/api/v1/homeworks` | `speakasap-education-service` | `GET` |
| `/api/v1/orders`, `/api/v1/discounts/templates`, `/api/v1/subscriptions`, `/api/v1/invoices`, `/api/v1/webhooks/payments`, `/api/v1/orders/:orderId/pay`, `/api/v1/orders/:orderId/mark-paid` | `speakasap-payment-service` | `GET`, `POST`, `PATCH`, `DELETE` per upstream contract |
| `/api/v1/templates`, `/api/v1/notification-groups`, `/api/v1/preferences/me/*`, `/api/v1/dispatch/email*`, `/api/v1/in-app*`, `/api/v1/letters*` | `speakasap-notification-service` | `GET`, `POST`, `PATCH`, `DELETE` per upstream contract |
| `/api/v1/salary-profiles`, `/api/v1/salary-expenses`, `/api/v1/contracts`, `/api/v1/calculation-runs*`, `/api/v1/payout-runs*`, `/api/v1/admin/summary/*` | `speakasap-salary-service` | `GET`, `POST`, `PATCH` |
| `/api/v1/revenue/*`, `/api/v1/expenses/*`, `/api/v1/dashboard/overview` | `speakasap-financial-service` | `GET` |

## Internal route policy

The following families are **not public** through gateway browser/client entrypoints:

- `/api/v1/internal/*` from user-service
- `/api/v1/internal/financial/products-metadata` from course-service
- `/api/v1/internal/salary/disburse*` from salary-service
- `/api/v1/internal/financial/*` from financial-service
- Any other `/api/v1/internal/**` route from upstream services

Only trusted service callers may use a dedicated internal gateway channel (if enabled later), protected by explicit internal token policy.

## Error mapping

Gateway returns a normalized envelope while preserving upstream semantics:

```json
{
  "statusCode": 502,
  "error": {
    "code": "UPSTREAM_UNAVAILABLE",
    "message": "Upstream service unavailable",
    "details": {
      "service": "speakasap-payment-service",
      "requestId": "..."
    }
  }
}
```

### Required status behavior

- `400`, `401`, `403`, `404`, `409`: pass-through status and upstream message/code where possible.
- `429`: gateway-generated for rate-limit violation.
- `502`: upstream unavailable, bad gateway response, or dependency hard failure.
- `504`: gateway timeout on upstream call.

## Versioning

- Gateway exposes upstream `v1` contract surface under `/api/v1`.
- Breaking gateway behavior requires `/api/v2` or explicit compatibility layer.

## Out of scope (TASK-65)

- Detailed middleware implementation.
- Retry algorithm implementation details.
- UI/frontend endpoint composition logic (covered by Phase 5 frontend tasks).
