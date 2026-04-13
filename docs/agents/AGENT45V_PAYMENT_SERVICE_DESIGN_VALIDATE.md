# AGENT45V: Validator — Payment Service Design (TASK-45)

## Role

QA / Contract Validator. Read-only review of TASK-45.

## Objective

Clear sync **P4-OB** — contract + mapping frozen.

## Preconditions

- TASK-45 implementation submitted (`PAYMENT_API_CONTRACT.md`, `PAYMENT_DATA_MAPPING.md`).

## Verification Scope

1. Both markdown files exist under `docs/refactoring/`.
2. List endpoints specify max **30** items per request.
3. Out-of-scope and obsolete legacy areas explicitly listed.
4. Integration points name **payments-microservice** only as external HTTP dependency (no shared DB).
5. Webhook authenticity and idempotency requirements are explicit.
6. Subscription ownership decision is explicit.

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Contract and mapping exist | file check | paths |
| API shape complete | review contract sections | section names |
| Legacy mapping complete | verify key tables/fields | mapping table |
| Shared dependency boundaries | review integration notes | contract section |
| Security notes present | webhook/idempotency section | contract section |

## Commands (examples)

- `rg "limit|pagination" docs/refactoring/PAYMENT_API_CONTRACT.md`
- `rg "webhook|idempot" docs/refactoring/PAYMENT_API_CONTRACT.md`
- `rg "orders|discount|subscription" docs/refactoring/PAYMENT_DATA_MAPPING.md`

## Verification results (evidence)

| Check | Result | Evidence |
| --- | --- | --- |
| Files exist | PASS | `test -f` on both paths → `both_exist_exit_0` |
| List `limit` max 30 | PASS | `PAYMENT_API_CONTRACT.md` L35: `limit` default 20, **maximum 30** |
| Out-of-scope / obsolete legacy | PASS | Contract L7–L11 (`## Out of scope`), legacy `orders.android`; mapping L4 delivery subscriptions **out of scope** |
| External deps / no shared DB | PASS | `## Provider boundary (payments-microservice)` L95–L104 outbound table; mapping targets `speakasap_payment_db` (L4, L101). **Note:** JWT from `auth-microservice` (L5) is documented separately from provider HTTP — not a second payment provider. |
| Webhook + idempotency | PASS | `## Webhook authenticity` L85–L91; `## Idempotency and retries` L71–L78 |
| Subscription ownership | PASS | Contract L147–L148; mapping addendum L134–L138 |

Commands run: `rg "limit|pagination"`, `rg "webhook|idempot"`, `rg "orders|discount|subscription"` on the two docs (matches as cited above).

## Sync gate (before TASK-46)

- **P4-OB:** PASS

## Verdict

PASS — contract + mapping meet TASK-45 freeze criteria for TASK-46.

### If FAIL

Return to `docs/agents/AGENT45_PAYMENT_SERVICE_DESIGN.md`.
