# AGENT71: Phase 5 - Frontend Initial Implementation (TASK-71)

## Role

Frontend Implementation Agent: build initial learner/teacher/admin flows against frozen gateway contract mapping.

## Objective

Implement portal-level pages and shared API client so frontend calls gateway routes only, with role-aware navigation and auth-ready request flow.

## Prerequisites

- **P5-FB** PASS.
- `PHASE5_FRONTEND_GATEWAY_CONTRACT_MAPPING.md` frozen.

## Inputs

- `docs/refactoring/PHASE5_TASK_DECOMPOSITION.md` - TASK-71
- `docs/refactoring/PHASE5_FRONTEND_GATEWAY_CONTRACT_MAPPING.md`
- `docs/refactoring/GATEWAY_API_CONTRACT.md`
- `frontend/` scaffold from TASK-69

## Scope

1. Add shared frontend API client layer for gateway calls.
2. Implement initial learner/teacher/admin pages using mapped gateway routes.
3. Keep role-aware page structure and auth-token-based request flow.

## Do

- Keep all API calls gateway-only via `NEXT_PUBLIC_API_URL`.
- Keep auth flow aligned with bearer-token contract boundaries.
- Keep implementation minimal and mapping-aligned (no speculative features).

## Do Not

- Do not call `/api/v1/internal/**` from frontend.
- Do not hardcode backend service URLs or credentials.
- Do not modify gateway contracts in this task.
- Do not self-run `AGENT71V` - hand to Validator.

## Outputs

- Updated `frontend/` pages/components/api client implementing initial mapped flows.

## Exit Criteria

- Frontend build passes.
- Learner/teacher/admin pages use gateway API client only.
- **Next:** `docs/agents/AGENT71V_FRONTEND_IMPLEMENTATION_VALIDATE.md` -> **PASS** for sync **P5-FC**.
