# Legacy → speakasap-notification-service data mapping (TASK-50)

**Sources verified (workspace):** `speakasap-portal/notifications/models.py`, `speakasap-portal/notifications/tasks.py` (async dispatch), `speakasap-portal/notifications/models.py` → `Letter.send` (notifications-microservice client).  
**SES boundary:** `speakasap-portal/ses/backend.py` imports the same **notifications** client path — operational email may still flow through Django mail backends in some configs; **target architecture** is: **all** outbound multi-channel sends that today hit `get_notification_client().send_email(...)` are owned by **speakasap-notification-service** calling **notifications-microservice** only.  
**SmartResponder:** `delivery/migrations/0020_remove_smartresponder.py` drops `smartresponder_delivery` — **no live legacy table**; mapping is **historical / ETL skip** unless a dump exists outside the repo.

---

## Legacy Django apps → target service

| Legacy surface | Target ownership |
|----------------|------------------|
| `notifications` app models | `speakasap_notification_db` |
| `ses` app (EmailProfile, backends) | **Not** duplicated in notification-service; SES provider choice lives in **notifications-microservice** env |
| `telegram` app (portal) | **notifications-microservice** only (per `ROADMAP.md`) |
| Celery `notifications.send_notification` | Future: callers enqueue via **HTTP** to notification-service or event bus — **TASK-52** defines migration off workers |

---

## Table mapping (conceptual Prisma / SQL)

### `NotificationTemplate` ← `notifications_notificationtemplate`

| Legacy column | Target field | Notes |
|---------------|--------------|--------|
| `machine_name` | `machineName` | **Primary business key**; unique index |
| `title` | `title` | Default email subject if none passed |
| `visible` | `visible` | Controls whether per-user `NotificationSettings` apply |
| `help` | `help` | Markdown/plain text for UI |
| `settings_title` | `settingsTitle` | Profile settings label |
| M2M `groups` → `NotificationGroup` | join table `TemplateGroup` | Preserve group order only if product needs it; else unordered set |
| *(no DB column)* | `bodyHtml` | **New authoritative field:** ingest from `notifications/templates/.../{machine_name}.html` + `base.html` composition rules in TASK-52 |

### `NotificationGroup` ← `notifications_notificationgroup`

| Legacy column | Target field | Notes |
|---------------|--------------|--------|
| `machine_name` | `machineName` | Unique |
| `title` | `title` | |
| M2M `managers` → `employees.Manager` via `notifications_notificationgroup_managers` | `NotificationGroupManager.managerUserId` | **TASK-52 ETL (authoritative):** store legacy portal `employees_manager.user_id` (Django `auth_user.id`) as **decimal string** in `managerUserId`, same interim convention as payment ETL until a user-service UUID map exists. **Future:** replace values with speakasap-user-service UUID strings when that map is available (one-off migration or re-run ETL with resolver). |

### `Letter` ← `notifications_letter`

| Legacy column | Target field | Notes |
|---------------|--------------|--------|
| `id` | `id` (UUID recommended) + optional `legacyLetterId` int | |
| `template_id` | `templateMachineName` or FK `templateId` | Prefer FK internally; expose `machineName` in API |
| `user_id` | `userId` | Actor / owner row (legacy used fallback user when null — **do not** preserve that silently; TASK-52 should log orphans) |
| `text` | `renderedBody` | HTML/plain after render |
| `created` | `createdAt` | |
| `sent` | `sentAt` | Nullable until transport confirms success |
| `recipients` | `recipients` | Normalized JSON array of emails (legacy: space-separated string) |
| `from_email` | `fromEmail` | |

### `CommonEmailSettings` ← `notifications_commonemailsettings`

| Legacy column | Target field | Notes |
|---------------|--------------|--------|
| `user_id` | `userId` | Unique |
| `email_enabled` | `emailEnabled` | |

### `NotificationSettings` ← `notifications_notificationsettings`

| Legacy column | Target field | Notes |
|---------------|--------------|--------|
| `user_id` | `userId` | |
| `notification_id` | `templateId` or `machineName` | Unique together with user |
| `active` | `active` | |

### `Notification` (in-app feed) ← `notifications_notification`

| Legacy column | Target field | Notes |
|---------------|--------------|--------|
| `id` | `id` | |
| `user_id` | `userId` | |
| `read` | `read` | |
| `text` | `text` | |
| `link` | `link` | Nullable |
| `created` | `createdAt` | |

---

## Dispatch pipeline mapping (behavioral)

| Legacy step | Target step |
|-------------|-------------|
| `NotificationTemplate.send(..., send_async=True)` → Celery `send_notification` | `POST /api/v1/dispatch/email` (or async job inside notification-service that still ends in same handler) |
| `_convert_models_to_ids` | Caller passes **`context`** with ids; no Django ORM in new service |
| `NotificationTemplate._send_sync` preference checks | `respectPreferences` + `respectDoNotContact` in API contract |
| `Letter.create` + `render_to_string` | Template render engine in TASK-51 (store result in `Letter` lineage row before send) |
| `Letter.send` → `notification_client.send_email` | Adapter: `POST {NOTIFICATIONS_MICROSERVICE_URL}/notifications/send` with DTO fields aligned to shared `SendNotificationDto` |
| `send_group` manager dedupe | `POST /api/v1/dispatch/email/group` implementation |

---

## SES / logging naming

Legacy code uses logger name **`ses.common`** for transport diagnostics even when sending through notifications-microservice. Target: use **one** service name in structured logs, e.g. `service: "speakasap-notification-service"`, and **drop** dependency on `ses.common` logger in new code (TASK-51).

---

## Rate limiting / retries

Legacy: Django cache rate limit per minute + per-recipient retries on transient errors.  
Target: **centralize** rate limiting policy in **notification-service** (or defer to notifications-ms if it enforces quotas) — **TASK-51** picks one source of truth; migration must not **double** rate limits accidentally when portal and new service both run during cutover.

---

## Out-of-scope data (explicit)

| Area | Mapping action |
|------|----------------|
| Helpdesk-only templates | May exist as files under `notifications/templates/...`; **product scope** for notification-service **excludes** helpdesk workflows — still migrate **rows** if they are plain `NotificationTemplate` rows used elsewhere; otherwise document **exclude list** in TASK-52 inventory |
| Marathon / analytics templates | Same: migrate only if in DB; feature triggers stay out of scope |
| `smartresponder_*` tables | **Skip** — removed in migrations |
| `ses.models.EmailProfile` | User-facing profile data stays in **user-service** or is dropped if unused — **TASK-52** inventory |

---

## Payment wave cross-reference

When payment-service emits dispatch (post Phase 4 integration), it should pass **`orderId`**, **`userId`**, **`productId`** in `context` per **`PAYMENT_API_CONTRACT.md`** stable ids — **no payment-side template storage**.

---

## Validator handoff

Frozen for **P4-NB** with `NOTIFICATION_API_CONTRACT.md` + this file; validate via `docs/agents/AGENT50V_NOTIFICATION_SERVICE_DESIGN_VALIDATE.md`.
