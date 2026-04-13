# Notification service API contract (frozen for TASK-51)

**Service:** `speakasap-notification-service` (`notification-service/`)  
**Base path:** `GET /health` (no prefix); other routes under `api/v1` (Nest global prefix, same as `payment-service` / `course-service`).  
**Auth:** JWT from **auth-microservice** on all `/api/v1/**` routes unless noted. Internal automation uses the same pattern as other Phase 4 services: **service or user JWT** with roles enforced per route (exact claim names follow `auth-microservice` — TASK-51 must not invent a parallel auth system).

## Out of scope (explicit)

- **Helpdesk**, **analytics**, **marathon**, **catalog**, **warehouse** microservices and their bespoke template trees unless a later task reopens scope.
- Implementing or hosting a **Telegram bot**, **WhatsApp connector**, or **direct AWS SES / SMTP** inside this service — **delivery transport is only** `notifications-microservice`.
- Editing **`auth-microservice`**, **`notifications-microservice`**, or **nginx** configs in this wave.
- Rebuilding **SmartResponder** delivery pipelines — legacy table removed; see `NOTIFICATION_DATA_MAPPING.md`.

## Cross-service identifiers (read-only references)

- `userId` — stable id from **speakasap-user-service** / JWT subject where applicable.
- `legacyPortalUserId` — optional integer for ETL correlation only (same idea as user-service contract).
- `orderId`, `productId`, `paymentId` — opaque correlation ids compatible with **`PAYMENT_API_CONTRACT.md`**; notification-service does **not** interpret payment state.

## Environment (key names only; values in root `speakasap/.env`)

Per `AGENT50_NOTIFICATION_SERVICE_DESIGN.md`:

- `NOTIFICATIONS_MICROSERVICE_URL`
- `NOTIFICATION_SERVICE_PORT`
- `NOTIFICATION_DATABASE_URL`
- `LOGGING_SERVICE_URL`

**TASK-51** may add (keys only in `.env.example`, never secret values):

- Outbound auth to **notifications-microservice** if that deployment requires it (e.g. API key header name aligned with that service’s config — **do not** document secret values here).

**Optional read:** `USER_SERVICE_URL` (or equivalent already used in Phase 4) when resolving `userId` → email for dispatch; if unset, dispatch by `userId` alone is **not** required to succeed (caller may supply `recipient`).

---

## Pagination and sorting

Aligned with **payment-service** Phase 4 lists:

- List endpoints accept `limit` (default **20**, **maximum 30**) and `cursor` (opaque, optional).
- Response shape: `{ "data": [...], "meta": { "nextCursor": string | null, "limit": number } }`.
- Sort defaults to `createdAt` descending unless a route specifies otherwise.

---

## Error model

HTTP status + JSON body (same shape as `PAYMENT_API_CONTRACT.md`):

```json
{
  "statusCode": 400,
  "error": {
    "code": "NOTIFICATION_VALIDATION_FAILED",
    "message": "Human-readable message",
    "details": {}
  }
}
```

**Standard codes (non-exhaustive):**

| HTTP | `error.code` | When |
|------|----------------|------|
| 400 | `NOTIFICATION_VALIDATION_FAILED` | DTO / query validation |
| 400 | `NOTIFICATION_TEMPLATE_INVALID_BODY` | Template render / HTML safety checks failed |
| 401 | `UNAUTHORIZED` | Missing/invalid JWT |
| 403 | `FORBIDDEN` | Wrong user/role for resource |
| 404 | `NOT_FOUND` | Unknown `machineName`, letter id, in-app id, group |
| 409 | `NOTIFICATION_CONFLICT` | Duplicate `machineName` on create |
| 409 | `IDEMPOTENCY_REPLAY` | Same `Idempotency-Key` + same body → return original dispatch result |
| 422 | `NOTIFICATION_PREFERENCE_BLOCKED` | User opted out (`emailEnabled` false or per-template inactive) |
| 502 | `NOTIFICATION_TRANSPORT_UNAVAILABLE` | `notifications-microservice` timeout/unreachable |
| 502 | `NOTIFICATION_USER_LOOKUP_FAILED` | user-service unavailable when `userId` resolution is required |

---

## Idempotency and retries

| Operation | Rule |
|-----------|------|
| `POST` dispatch (single or group) | Client **should** send `Idempotency-Key` (UUID). Server stores hash of canonical body + key for **24h**; duplicate key + same body → `200` with same `dispatchRequestId` / status; same key + different body → `409 NOTIFICATION_CONFLICT`. |
| Template / preference writes | No idempotency required; use normal optimistic concurrency if `updatedAt` is added later. |

**Retries:** Retry **GET** and dispatch **POST** with same `Idempotency-Key` on `502`/`503` with backoff. **Do not** raise global HTTP client timeouts when transport is slow — log `duration_ms` and fix the slow hop (project rule).

---

## Delivery boundary (**notifications-microservice** only)

All **email / telegram / whatsapp / sms** delivery goes through **`NOTIFICATIONS_MICROSERVICE_URL`**. This service is responsible for **template management**, **preferences**, **rendering** (or delegating body assembly), **audit rows**, and **mapping** to the shared API.

**Outbound (notification-service → notifications-ms), base URL `NOTIFICATIONS_MICROSERVICE_URL`:**

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/notifications/send` | Send one message; body fields align with shared `SendNotificationDto` (e.g. `channel`, `type`, `recipient`, `subject`, `message`, optional `attachments`, `templateData`, `service`). |

**Channel mapping (frozen intent):**

| Use case | `channel` | `type` (examples) | Notes |
|----------|-----------|-------------------|--------|
| Portal-style transactional email | `email` | `custom` (or other enum value accepted by ms) | `message` = HTML or plain text; ms may auto-detect HTML |
| Future non-email channel | `telegram` / `whatsapp` / `sms` | `custom` | **Only** via this POST; no local bot |

**Forbidden in TASK-51:** direct calls to SES, SendGrid, Telegram Bot API, or SMTP from `notification-service`.

---

## Domain endpoints

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness; no auth. |

---

### Notification templates (`NotificationTemplate` domain)

Admin/staff routes (role enforced in TASK-51; exact role name follows portal parity — e.g. staff managing templates).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/templates` | List templates (`limit` ≤ 30, `cursor`, optional `visible` filter). |
| POST | `/api/v1/templates` | Create template. |
| GET | `/api/v1/templates/:machineName` | Get one by **machine name** (path segment URL-encoded; case-sensitive **as stored**). |
| PATCH | `/api/v1/templates/:machineName` | Update metadata and/or `bodyHtml`. |
| DELETE | `/api/v1/templates/:machineName` | Soft-delete or hard-delete per TASK-51 schema (contract: must become non-sendable). |

**Template JSON (representative):**

```json
{
  "machineName": "student/paid_other_product",
  "title": "Оплата заказа SpeakASAP®",
  "visible": true,
  "help": "…",
  "settingsTitle": null,
  "bodyHtml": "<html>…</html>",
  "groupMachineNames": ["service_group"],
  "createdAt": "2026-04-13T12:00:00.000Z",
  "updatedAt": "2026-04-13T12:00:00.000Z"
}
```

- `bodyHtml` — **authoritative rendered source** in the new service (migrated from Django files + edits). Variable placeholders use **`{{variableName}}`** syntax in TASK-52 unless migration chooses a different delimiter and documents it in **one** place.
- `groupMachineNames` — links template to **notification groups** for manager broadcasts (legacy `groups` M2M).

---

### Notification groups (`NotificationGroup` domain)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/notification-groups` | List groups (`limit` ≤ 30, `cursor`). |
| POST | `/api/v1/notification-groups` | Create group. |
| GET | `/api/v1/notification-groups/:machineName` | Detail including `managerUserIds` (or equivalent foreign keys). |
| PATCH | `/api/v1/notification-groups/:machineName` | Update title / manager membership. |
| DELETE | `/api/v1/notification-groups/:machineName` | Remove group (only if templates do not reference it, or cascade rules defined in TASK-51). |

**Group JSON (representative):**

```json
{
  "machineName": "service_group",
  "title": "Service",
  "managerUserIds": [101, 102],
  "createdAt": "2026-04-13T12:00:00.000Z",
  "updatedAt": "2026-04-13T12:00:00.000Z"
}
```

`managerUserIds` are **speakasap-user-service** user ids (legacy: `employees.Manager` → `User`).

---

### Preferences

**Common email toggle** (legacy `CommonEmailSettings`):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/preferences/me/email` | Returns `{ "emailEnabled": true }` for JWT user. |
| PATCH | `/api/v1/preferences/me/email` | Update global email opt-in. |

**Per-template toggles** (legacy `NotificationSettings` for `visible` templates only):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/preferences/me/templates` | List `{ "machineName", "active", "title" }` for current user (`limit` ≤ 30, `cursor`). |
| PATCH | `/api/v1/preferences/me/templates/:machineName` | Set `active` for one template. |

---

### Dispatch requests (email)

**Single recipient** (legacy `NotificationTemplate.send` / `Letter` path):

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/dispatch/email` | Enqueue or send one email per rules below. |

**Request JSON (representative):**

```json
{
  "templateMachineName": "student/paid_other_product",
  "subject": "optional override",
  "userId": "uuid-or-null",
  "recipient": "optional@example.com",
  "context": {
    "orderId": 12345,
    "scheme": "https",
    "viewOnSiteUrl": "https://…"
  },
  "attachments": ["/tmp/a.pdf"],
  "cc": "optional@example.com",
  "respectPreferences": true,
  "respectDoNotContact": true
}
```

**Rules (frozen):**

1. Exactly one of **`userId`** or **`recipient`** must yield a validated mailbox after resolution (implementation may resolve `userId` via user-service).
2. If `respectPreferences` is **true** (default): apply `CommonEmailSettings.emailEnabled` and `NotificationSettings.active` for `templateMachineName` when `userId` is present; if blocked → `422 NOTIFICATION_PREFERENCE_BLOCKED` (no call to notifications-ms).
3. If `respectDoNotContact` is **true** (default): if student profile has **do not contact** (carried in user-service or future profile field), **do not send** — response `422` with distinct `details.code` (TASK-51).
4. Render `bodyHtml` with `context` → HTML/plain string → POST `/notifications/send` with `channel: "email"`, `recipient`, `subject`, `message`, optional `attachments`, `service: "speakasap-notification-service"`.
5. Persist an **audit row** (“Letter” lineage) with rendered body hash, recipients, timestamps — see mapping doc.

**Group / managers** (legacy `send_group`):

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/dispatch/email/group` | For templates linked to groups: expand managers, dedupe emails, apply per-manager preference rules as legacy does for each manager user. |

Same `Idempotency-Key` semantics; body includes `templateMachineName` + `context` (no single `userId`; optional `actorUserId` for audit).

---

### In-app notifications (legacy `Notification` model — bell / feed)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/in-app` | Current user’s feed (`limit` ≤ 30, `cursor`). |
| PATCH | `/api/v1/in-app/:id/read` | Mark one read. |
| POST | `/api/v1/in-app/mark-all-read` | Optional convenience (idempotent). |

**Item JSON (representative):**

```json
{
  "id": "uuid",
  "text": "…",
  "link": "https://…",
  "read": false,
  "createdAt": "2026-04-13T12:00:00.000Z"
}
```

---

### Letters / outbound audit (read-only API for users and staff)

Maps to legacy **`Letter`** rows (email audit trail).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/letters` | List current user’s letters; staff may filter by `userId` if role allows (`limit` ≤ 30, `cursor`). |
| GET | `/api/v1/letters/:id` | Detail including render status and `sentAt`. |

---

## Logging

Every handler and every outbound call to **notifications-microservice** (and optional **user-service**) must log to **logging-microservice** with **ISO 8601** timestamps and **`duration_ms`** on the outbound HTTP span (same standard as `notification-service` README).

---

## Variable taxonomy (template `context`)

**Minimum frozen names** for parity with payment and portal call sites (callers may add arbitrary keys as strings; renderer treats missing keys as empty string unless TASK-51 defines stricter behavior):

| Key | Type | Meaning |
|-----|------|---------|
| `orderId` | number / string | From payment-service / legacy order |
| `productId` | number / string | Course/product reference |
| `user` / `userId` | object / string | Prefer flat `userId` + separate user-service fetch in new code; legacy passed nested `user` |
| `scheme` | string | `https` / `http` for links |
| `viewOnSiteUrl` | string | Letter “view on site” link lineage |
| `ticketId` | number | Helpdesk correlation **allowed as opaque id** even though helpdesk is out of scope for features |

Exact merge rules for `context` vs server-injected globals (footer phones, `bg_url`, etc.) are **implementation** details in TASK-51 but must be **deterministic** and documented in service README once behavior exists.

---

## Next validator

`docs/agents/AGENT50V_NOTIFICATION_SERVICE_DESIGN_VALIDATE.md` — contracts frozen for sync **P4-NB** after **P4-NA** PASS.
