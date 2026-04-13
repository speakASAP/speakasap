# AGENT50V: Validator — Notification Service Design (TASK-50)

## Role

QA / Contract Validator. Read-only review of TASK-50.

## Objective

Clear sync **P4-NB** — contract + mapping frozen.

## Preconditions

- TASK-50 implementation submitted (`NOTIFICATION_API_CONTRACT.md`, `NOTIFICATION_DATA_MAPPING.md`).

## Verification Scope

1. Both markdown files exist under `docs/refactoring/`.
2. List endpoints specify max **30** items per request.
3. Out-of-scope and obsolete legacy areas explicitly listed.
4. Integration points name **notifications-microservice** only as external HTTP dependency for delivery (no shared DB).
5. Contract explicitly avoids Telegram bot reimplementation in speakasap service.

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Contract/mapping files | file check | paths |
| Pagination cap | scan contract | section |
| Legacy mapping | scan mapping doc | tables |
| Transport boundary | integration section review | wording |
| Out-of-scope clarity | section review | wording |

## Commands (examples)

- `rg "limit|pagination" docs/refactoring/NOTIFICATION_API_CONTRACT.md`
- `rg "notifications-microservice|telegram" docs/refactoring/NOTIFICATION_API_CONTRACT.md`

## Verification results (evidence)

- **Files:** `docs/refactoring/NOTIFICATION_API_CONTRACT.md`, `docs/refactoring/NOTIFICATION_DATA_MAPPING.md` — present (2026-04-13).
- **Pagination:** Contract § “Pagination and sorting” — `limit` default 20, **maximum 30**; list routes `/api/v1/templates`, `/notification-groups`, `/preferences/me/templates`, `/in-app`, `/letters` each document `limit` ≤ 30 + `cursor`.
- **Out-of-scope / legacy:** Contract § “Out of scope”; mapping § “Out-of-scope data”, SmartResponder / `smartresponder_*` skip, SES/telegram ownership table.
- **Transport:** Contract § “Delivery boundary” — HTTP to `NOTIFICATIONS_MICROSERVICE_URL` / `POST /notifications/send` only for delivery; own DB via `NOTIFICATION_DATABASE_URL` / `speakasap_notification_db` in mapping — no shared DB with notifications-ms for delivery.
- **Telegram:** Contract forbids hosting a Telegram bot and direct Telegram Bot API from `notification-service`; non-email channels only via shared POST.

## Sync gate (before TASK-51)

- **P4-NB:** PASS

## Verdict

PASS

### If FAIL

Return to `docs/agents/AGENT50_NOTIFICATION_SERVICE_DESIGN.md`.
