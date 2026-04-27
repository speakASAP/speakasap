# AGENT70V: Validator - Frontend to Gateway Contract Mapping (TASK-70)

## Role

QA / Contract Validator. Read-only verification of TASK-70 mapping output.

## Objective

Clear sync **P5-FB** by confirming frontend contract mapping is complete, gateway-only, and blocker-explicit.

## Preconditions

- TASK-70 output submitted.

## Verification Scope

1. Mapping doc exists and references frozen gateway contract.
2. Learner/teacher/admin route shells each have mapped actions/endpoints.
3. Auth requirements are specified and consistent with gateway auth boundary.
4. No direct service URLs or non-gateway endpoints are introduced.
5. Unresolved gaps are listed as blockers with owner.

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Output doc present | file check | path |
| Portal coverage | inspect mapping sections | learner/teacher/admin |
| Auth clarity | inspect auth column/notes | JWT/internal/public |
| Gateway-only discipline | scan for non-gateway service URLs | none found |
| Blocker quality | inspect blocker list | explicit owner + condition |

## Commands (examples)

- `rg "learner|teacher|admin|/api/v1|JWT|blocker|owner" docs/refactoring/PHASE5_FRONTEND_GATEWAY_CONTRACT_MAPPING.md`
- `rg "content-service|user-service|payment-service|http://|https://" docs/refactoring/PHASE5_FRONTEND_GATEWAY_CONTRACT_MAPPING.md`

## Sync gate (before TASK-71)

- **P5-FB:** PASS / FAIL

## Verdict

PASS or FAIL with evidence.

### If FAIL

- List defects with exact paths.
- Return implementation to `docs/agents/AGENT70_FRONTEND_GATEWAY_CONTRACT_MAPPING.md`.
- Do not clear **P5-FB** until PASS.
