# AGENT70: Phase 5 - Frontend to Gateway Contract Mapping (TASK-70)

## Role

Frontend Design Agent: freeze page-level frontend usage against gateway contracts.

## Objective

Produce a single contract mapping artifact that links learner/teacher/admin frontend actions to frozen gateway routes, auth mode, and blockers.

## Prerequisites

- **P5-FA** PASS.
- `GATEWAY_API_CONTRACT.md` frozen.

## Inputs

- `docs/refactoring/PHASE5_TASK_DECOMPOSITION.md` - TASK-70
- `docs/refactoring/GATEWAY_API_CONTRACT.md`
- `docs/refactoring/GATEWAY_AUTH_BOUNDARY.md`
- `frontend/` scaffold from TASK-69

## Scope

1. Map each planned portal shell/action to one or more gateway route families.
2. Define required auth mode and role assumptions per action.
3. List unresolved gaps as explicit blockers (no hidden assumptions).

## Do

- Use gateway route families from frozen docs only.
- Keep gateway as the only backend integration point.
- Keep mapping concise and implementation-ready for TASK-71.

## Do Not

- Do not implement UI features in this task.
- Do not modify gateway contracts in this task.
- Do not introduce direct service URLs or non-gateway APIs.
- Do not self-run `AGENT70V` - hand to Validator.

## Outputs

- `docs/refactoring/PHASE5_FRONTEND_GATEWAY_CONTRACT_MAPPING.md`

## Exit Criteria

- Every planned page/action maps to gateway route(s) and auth requirement.
- Unresolved gaps are listed as blockers with owner.
- **Next:** `docs/agents/AGENT70V_FRONTEND_GATEWAY_CONTRACT_MAPPING_VALIDATE.md` -> **PASS** for sync **P5-FB**.
