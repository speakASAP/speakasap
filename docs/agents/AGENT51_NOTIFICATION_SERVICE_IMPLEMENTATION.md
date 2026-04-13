# AGENT51: Phase 4 — Notification Service Implementation (TASK-51)

## Role

Backend Service Agent (Implementation): HTTP handlers and persistence matching frozen **`NOTIFICATION_API_CONTRACT.md`**.

## Objective

Implement domain routes and service logic for **notification-service** per TASK-50 artifacts.

## Inputs

- `NOTIFICATION_API_CONTRACT.md` and corresponding `*_DATA_MAPPING.md` (frozen after **P4-NB**)
- `notification-service/` codebase from TASK-50

## Scope

1. Implement template, preference, and dispatch routes per contract.
2. Implement persistence and DTO validation.
3. Implement outbound delivery client to `notifications-microservice`.
4. Add structured logs with ISO timestamps and `duration_ms`.

## Do

- Match frozen contract paths and semantics; document intentional deviations in PR notes (prefer zero deviation).
- Keep delivery transport abstracted behind adapter/service.
- Keep list limit `<= 30`.

## Do Not

- Do not change frozen contract files without a new design task + Lead approval.
- Do not increase timeouts to mask hangs — log slow calls with timestamps.
- No automated tests unless explicitly requested.
- Do not call payment provider APIs from notification service.

## Exit Criteria

- `npm run build` passes; manual smoke of `/health` and key routes as documented.
- **Next:** `docs/agents/AGENT51V_NOTIFICATION_SERVICE_IMPLEMENTATION_VALIDATE.md` → **PASS** for **P4-NC**.
