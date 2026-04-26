# AGENT67: Phase 5 - API Gateway Integration Validation (TASK-67)

## Role

QA/Integration Agent: validate gateway-to-service connectivity and failure behavior against frozen gateway contracts.

## Objective

Produce an integration smoke matrix for gateway health/auth/routing/error behavior and capture PASS/DEFERRED status with owners.

## Prerequisites

- **P5-GC** PASS.
- TASK-66 implementation merged in working tree.

## Inputs

- `docs/refactoring/PHASE5_TASK_DECOMPOSITION.md` - TASK-67
- `docs/refactoring/GATEWAY_API_CONTRACT.md`
- `docs/refactoring/GATEWAY_AUTH_BOUNDARY.md`
- `docs/refactoring/GATEWAY_ROUTE_OWNERSHIP_MATRIX.md`
- `api-gateway/` implementation from TASK-66

## Scope

1. Validate `/health` and protected `/api/v1/**` entry behavior.
2. Validate representative route family forwarding for all mapped upstream services.
3. Validate auth/error behavior (`401`, `403`, `429`, `502`, `504`) and timeout handling logs.
4. Record matrix rows as PASS/DEFERRED with explicit reason and owner.

## Do

- Keep checks manual and contract-focused.
- Verify no public access to `/api/v1/internal/**`.
- Verify `limit <= 30` behavior is enforced at gateway edge.
- Include log evidence references for timeout/failure paths.

## Do Not

- Do not change implementation in this task unless an explicit remediation loop is opened.
- Do not modify shared microservice repos.
- Do not change frozen contracts unless Lead reopens TASK-65.
- Do not self-run `AGENT67V` - hand to Validator.

## Outputs

- `docs/refactoring/PHASE5_GATEWAY_SMOKE_MATRIX.md`

## Exit Criteria

- Smoke matrix exists with route/auth/error coverage and clear PASS/DEFERRED rows.
- **Next:** `docs/agents/AGENT67V_GATEWAY_INTEGRATION_VALIDATE.md` -> **PASS** for sync **P5-GD**.
