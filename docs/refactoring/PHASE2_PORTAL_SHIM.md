# Phase 2 — Portal integration (optional shim)

**Branch (per `SPEAKASAP_REFACTORING_PLAN.md`):** `speakasap-portal` → `speakasap2.0` when introducing HTTP adapters.

## Current stance (Phase 2 closure)

**No portal code change is required** for certification-service and assessment-service to run as standalone containers with their own databases. Legacy Django remains the **authoritative** read/write path until product owners flip traffic.

## Future thin adapter (when needed)

1. **Read path:** Django view or middleware calls `https://certification.<domain>/api/v1/...` or `https://assessment.<domain>/api/v1/...` with the user’s JWT (or server-side service token for internal routes).
2. **Write path:** Same pattern for internal generation endpoints (`X-Internal-Api-Key`) — keep keys in `.env` only.
3. **Rollback:** Disable adapter flags in portal config; all traffic returns to legacy ORM. No nginx business-rule edits — routing is regenerated from service `deploy.sh` / central nginx flow per workspace rules.

## Out of scope

- Replacing Django templates with Next.js for these domains (later phase).
- `teacher_tests` — not reproduced in assessment-service.
