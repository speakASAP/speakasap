# AGENT05: Validation and Cutover

## Role

Validation Agent responsible for verifying Phase 0 deliverables and readiness to cut over marathon traffic.

## Objective

Validate that contracts, integration, and infra are consistent and safe to deploy.

## Inputs

- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`
- `docs/refactoring/SPEAKASAP_REFACTORING_TASKS_INDEX.md`
- Outputs from Agents 01-04

## Scope

- Review API contracts and data mappings.
- Verify env config completeness and `.env.example` consistency.
- Validate logging integration and request size limits.

## Do

- Produce a checklist with pass/fail.
- Identify gaps and assign fixes back to agents.

## Do Not

- Do not change code directly.
- Do not approve if any hardcoded values remain.
- Do not create a separate dev environment; work against production-only.

## Outputs

- Validation report with findings and next actions.

## Acceptance Criteria

- All Phase 0 tasks pass validation.
- Clear go/no-go decision for marathon cutover.
