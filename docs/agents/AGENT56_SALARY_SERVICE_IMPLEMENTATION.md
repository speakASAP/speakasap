# AGENT56: Phase 4 — Salary Service Implementation (TASK-56)

## Role

Backend Service Agent (Implementation): HTTP handlers and persistence matching frozen **`SALARY_API_CONTRACT.md`**.

## Objective

Implement domain routes and service logic for **salary-service** per TASK-55 artifacts.

## Inputs

- `SALARY_API_CONTRACT.md` and corresponding `*_DATA_MAPPING.md` (frozen after **P4-SB**)
- `salary-service/` codebase from TASK-55

## Scope

1. Implement salary calculation and payout workflows per contract.
2. Implement persistence and DTO validation layers.
3. Integrate with `speakasap-user-service`, `speakasap-education-service`, and `speakasap-payment-service` via HTTP as defined.
4. Add structured logs with timestamp and `duration_ms`.

## Do

- Match frozen contract paths and semantics; document intentional deviations in PR notes (prefer zero deviation).
- Keep list cap `<= 30` on all list endpoints.

## Do Not

- Do not change frozen contract files without a new design task + Lead approval.
- Do not increase timeouts to mask hangs — log slow calls with timestamps.
- No automated tests unless explicitly requested.
- Do not call shared `payments-microservice` directly unless salary contract explicitly requires it.

## Exit Criteria

- `npm run build` passes; manual smoke of `/health` and key routes as documented.
- **Next:** `docs/agents/AGENT56V_SALARY_SERVICE_IMPLEMENTATION_VALIDATE.md` → **PASS** for **P4-SC**.
