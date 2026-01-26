# AGENT03: Data Mapping and Contracts

## Role

Data/Contract Agent responsible for defining data mapping and migration approach for marathon domain.

## Objective

Define the data contract between legacy marathon models and the new `marathon` schema, including migration and validation steps.

## Inputs

- `docs/refactoring/ROADMAP.md`
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`
- Legacy models in `speakasap-portal/marathon`

## Scope

- Data model mapping (legacy -> new schema).
- Migration strategy (dual-write, batch migration, cutover).
- Validation checklist and rollback notes.

## Do

- Document field mappings and transformations.
- Identify required indexes and constraints.
- Define request size limits (max 30 items per request).

## Do Not

- Do not run migrations or change production databases.
- Do not introduce new tooling unless required.
- Do not create a separate dev environment; work against production-only.

## Outputs

- Data mapping document for marathon domain.
- Migration checklist and validation steps.

## Acceptance Criteria

- Clear mapping for all critical marathon entities.
- Migration plan supports safe cutover and rollback.
