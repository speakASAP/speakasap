# Payment service API contract (frozen for TASK-46)

**Service:** `speakasap-payment-service` (`payment-service/`)  
**Base path:** `GET /health` (no prefix); all other routes under `api/v1` (Nest global prefix, same as `course-service`).  
**Auth:** JWT from `auth-microservice` on user/admin-facing routes unless noted. Internal routes use headers below.

## Out of scope (explicit)

- Helpdesk, analytics, marathon flows, catalog/warehouse microservices.
- Legacy `orders.android` (obsolete per `ROADMAP.md`).
- Editing `auth-microservice`, `payments-microservice`, or nginx configs.

## Cross-service identifiers (read-only references)

- `userId` — stable user id from **speakasap-user-service** / auth subject.
- `productId` — legacy product id or future **speakasap-course-service** product id (string or int as in Phase 3 contracts; document per resource).
- `education*` references — optional opaque ids for correlation only; **no education access decisions** inside payment-service.

## Environment (key names only; values in root `.env`)

Per `AGENT45_PAYMENT_SERVICE_DESIGN.md`:

- `PAYMENTS_MICROSERVICE_URL`
- `PAYMENTS_WEBHOOK_SHARED_SECRET`
- `PAYMENT_SERVICE_PORT`
- `PAYMENT_DATABASE_URL`
- `LOGGING_SERVICE_URL`

**Outbound to payments-microservice:** `POST/GET` require header `X-API-Key` with a key that appears in that service’s `API_KEYS` list. Add a dedicated key name to `speakasap/.env.example` in TASK-46 if missing (no secret in example).

---

## Pagination and sorting

- List endpoints accept `limit` (default 20, **maximum 30**) and `cursor` (opaque, optional).
- Response shape: `{ "data": [...], "meta": { "nextCursor": string | null, "limit": number } }`.
- Sort defaults to `createdAt` descending unless specified.

---

## Error model

HTTP status + JSON body:

```json
{
  "statusCode": 400,
  "error": {
    "code": "PAYMENT_ORDER_INVALID_STATE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

**Standard codes (non-exhaustive):**

| HTTP | `error.code` | When |
|------|----------------|------|
| 400 | `VALIDATION_FAILED` | DTO / query validation |
| 401 | `UNAUTHORIZED` | Missing/invalid JWT |
| 403 | `FORBIDDEN` | Wrong user/role for resource |
| 404 | `NOT_FOUND` | Order, discount, invoice, subscription id unknown |
| 409 | `CONFLICT` | State transition not allowed |
| 409 | `IDEMPOTENCY_REPLAY` | Same idempotency key, same body (return original result) |
| 422 | `PROVIDER_ERROR` | payments-ms returned business error |
| 502 | `PROVIDER_UNAVAILABLE` | payments-ms timeout/unreachable |

---

## Idempotency and retries

| Operation | Rule |
|-----------|------|
| `POST` create order (optional) | Client may send `Idempotency-Key` (UUID). Server stores hash of body + key for 24h; duplicate key + same body → same response; same key + different body → `409 CONFLICT`. |
| `POST` apply discount | Idempotent only if discount already applied to that order → `200` with current state. |
| `POST` provider session | Delegates to payments-ms; use their `paymentId` as idempotency anchor locally. |
| Webhooks | Unique constraint on `(provider, providerEventId)` or `(provider, paymentId, normalizedStatus, eventTime)`; duplicates return `200` with no side effects. |
| Refund | Delegates to `POST .../refund` on payments-ms; persist refund id; replays safe. |

**Retries:** Clients should retry GET and idempotent POST on `502`/`503` with backoff. Do not retry non-idempotent POST without `Idempotency-Key`.

---

## Webhook authenticity (payment-service **inbound**)

Routes are **public** (no JWT); authenticity via shared secret:

- Header: `X-Webhook-Signature: sha256=<hex>` (HMAC-SHA256 over **raw request body** using `PAYMENTS_WEBHOOK_SHARED_SECRET`).
- Optional header: `X-Webhook-Timestamp` (Unix seconds); reject if skew > 300s from server time (replay window).
- Constant-time compare signature.

---

## Provider boundary (payments-microservice)

**Outbound (payment-service → payments-ms), base URL `PAYMENTS_MICROSERVICE_URL`:**

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/payments/create` | Start capture flow; body per existing `CreatePaymentDto` |
| GET | `/payments/:paymentId` | Status, amount, currency, method |
| POST | `/payments/:paymentId/refund` | Partial/full refund per `RefundPaymentDto` |

**No** direct edits to payments-ms source in this wave; if DTOs drift, update **this** contract and payment-service adapter only.

---

## Domain endpoints

### Orders

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/orders` | List orders for current user (admin: optional `userId` query if role allows). |
| POST | `/api/v1/orders` | Create draft order (product, price snapshot, metadata). |
| GET | `/api/v1/orders/:orderId` | Order detail including payment children summary. |
| PATCH | `/api/v1/orders/:orderId` | Limited updates (e.g. metadata, cancel draft). |
| POST | `/api/v1/orders/:orderId/pay` | Create provider payment session (calls payments-ms). |
| POST | `/api/v1/orders/:orderId/mark-paid` | **Internal/admin only** — reconcile invoice/manual flows (guarded). |

**Order DTO (response, core fields):**

- `id`, `userId`, `title`, `price` (minor unit int, EUR legacy), `currency` (default `EUR`), `paid` (bool), `status` (enum below), `productId` (nullable), `data` (JSON), `tillDate` (nullable), `createdAt`, `updatedAt`, `discountCode` (nullable, resolved template code).

**`Order.status` (normalized):** `draft` | `awaiting_payment` | `paid` | `canceled` | `expired` — maps from legacy `paid`, `till_date`, trash flags (see mapping doc).

### Discounts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/discounts/templates` | Admin list discount templates (paginated). |
| POST | `/api/v1/discounts/templates` | Admin create template. |
| GET | `/api/v1/discounts/templates/:code` | Lookup by code (admin or internal). |
| POST | `/api/v1/orders/:orderId/discounts/apply` | Apply code to order (validates template rules). |
| DELETE | `/api/v1/orders/:orderId/discounts` | Remove applied discount if policy allows. |

### Subscriptions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/subscriptions` | List current user’s subscriptions (paginated). |
| GET | `/api/v1/subscriptions/:subscriptionId` | Detail. |
| POST | `/api/v1/subscriptions` | Create subscription agreement linked to order/payment method (billing). |
| PATCH | `/api/v1/subscriptions/:subscriptionId` | Pause/cancel/change method per policy. |

**Ownership note:** Subscription **billing** and provider state live here; **access to lessons/content** is owned by **education-service** (events only).

### Invoices (business documents — not provider webhooks)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/invoices` | List invoice payments (filters: user, state). |
| GET | `/api/v1/invoices/:invoiceId` | Detail including `number`, `received`, amounts. |
| POST | `/api/v1/invoices` | Create invoice record for an order (bank transfer flow). |
| PATCH | `/api/v1/invoices/:invoiceId` | Mark received, attach metadata (scan URL stays out-of-band or future attachment service). |

### Webhooks (payment-service **inbound**)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/webhooks/payments` | Normalized completion/failure from payments-ms worker or bridge (signature above). Body: `{ "eventId", "paymentId", "orderId?", "status", "amount", "currency", "occurredAt", "rawRef?" }`. |

**Explicit:** Provider-native paths (PayPal, Stripe, WebPay, …) remain on **payments-microservice** only; payment-service receives **already normalized** events on `/api/v1/webhooks/payments`.

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness/readiness, no auth. |

---

## Events (optional outbound, TASK-46 if wired)

- `order.paid` — `{ orderId, userId, amount, currency, paidAt }` (align `ROADMAP.md`).

---

## Versioning

URL prefix `api/v1`. Breaking changes require `v2` and deprecation header.
