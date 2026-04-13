# AGENT61: Phase 4 — Financial Service Implementation (TASK-61)

## Role

Backend Service Agent (Implementation): HTTP handlers and persistence matching frozen **`FINANCIAL_API_CONTRACT.md`**.

## Objective

Implement domain routes and service logic for **financial-service** per TASK-60 artifacts.

## Inputs

- `FINANCIAL_API_CONTRACT.md` and corresponding `*_DATA_MAPPING.md` (frozen after **P4-FB**)
- `financial-service/` codebase from TASK-60

## Scope

1. Implement financial endpoints and aggregations per frozen contract.
2. Implement persistence and DTO validation.
3. Implement read adapters from `speakasap-payment-service` and `speakasap-salary-service`.
4. Integrate optional category metadata from `speakasap-course-service` only if TASK-60 requires it.
5. Add structured logs with ISO timestamps and `duration_ms`.

## Do

- Match frozen contract paths and semantics; document intentional deviations in PR notes (prefer zero deviation).
- Enforce list cap `<= 30`.

## Do Not

- Do not change frozen contract files without a new design task + Lead approval.
- Do not increase timeouts to mask hangs — log slow calls with timestamps.
- No automated tests unless explicitly requested.
- Do not directly call `payments-microservice` or `notifications-microservice` unless TASK-60 contract explicitly allows it.

## Outputs

- `financial-service/` — updated with domain modules, aggregation services, query endpoints, and persistence updates

## Exit Criteria

- `npm run build` passes; manual smoke of `/health` and key routes as documented.
- **Next:** `docs/agents/AGENT61V_FINANCIAL_SERVICE_IMPLEMENTATION_VALIDATE.md` → **PASS** for **P4-FC**.
