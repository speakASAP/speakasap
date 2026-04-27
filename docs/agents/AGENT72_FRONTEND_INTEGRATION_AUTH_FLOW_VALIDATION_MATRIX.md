# AGENT72: Phase 5 - Frontend Integration and Auth-Flow Validation Matrix (TASK-72)

## Role

QA/Integration Agent: validate frontend end-to-end integration paths through gateway and produce auth-flow validation evidence.

## Objective

Produce a manual validation matrix that verifies learner/teacher/admin frontend flows against gateway contract boundaries, route-guard behavior, and auth-flow expectations.

## Prerequisites

- **P5-FC** PASS.
- TASK-71 implementation available in working tree.

## Inputs

- `docs/refactoring/PHASE5_TASK_DECOMPOSITION.md` - TASK-72
- `docs/refactoring/PHASE5_FRONTEND_GATEWAY_CONTRACT_MAPPING.md`
- `docs/refactoring/GATEWAY_API_CONTRACT.md`
- `docs/refactoring/GATEWAY_AUTH_BOUNDARY.md`
- `frontend/` implementation from TASK-71

## Scope

1. Validate learner/teacher/admin route entry and representative mapped actions.
2. Validate auth-flow behavior for missing token, invalid token, and valid token paths.
3. Validate frontend boundary compliance (gateway-only calls, no internal route usage).
4. Record PASS/DEFERRED/FAIL rows with explicit evidence, owner, and unblock condition.

## Do

- Keep validation manual and evidence-first.
- Include route-guard expectations and backend-auth-source-of-truth note.
- Track unresolved runtime checks as explicit DEFERRED entries (no implicit assumptions).
- Keep timeout findings tied to timestamped log references when applicable.

## Do Not

- Do not modify gateway/frontend implementation in this task unless remediation loop is explicitly opened.
- Do not alter frozen gateway/frontend contracts.
- Do not modify shared microservice repositories.
- Do not self-run `AGENT72V` - hand to Validator.

## Outputs

- `docs/refactoring/PHASE5_FRONTEND_INTEGRATION_AUTH_FLOW_VALIDATION_MATRIX.md`

## Exit Criteria

- Validation matrix includes learner/teacher/admin integration checks and auth-flow checks.
- Deferred rows include owner + unblock condition.
- **Next:** `docs/agents/AGENT72V_FRONTEND_INTEGRATION_AUTH_FLOW_VALIDATION_MATRIX_VALIDATE.md` -> **PASS** for sync **P5-FD**.
