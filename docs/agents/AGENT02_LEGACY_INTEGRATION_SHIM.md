# AGENT02: Legacy Integration Shim

## Role

Integration Adapter Agent responsible for routing legacy marathon flows to the new `marathon` product.

## Objective

Create a minimal integration layer in `speakasap-portal` that forwards marathon operations to the new service without changing unrelated legacy code.

## Inputs

- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`
- `docs/refactoring/ROADMAP.md`
- Legacy marathon views, URLs, templates in `speakasap-portal/marathon`

## Scope

- Identify legacy entry points (URLs, views, templates, API endpoints).
- Implement product calls to `marathon`.
- Add fallback behavior for rollback.

## Do

- Keep changes minimal and localized.
- Add logging for all outbound calls and responses.
- Use env config for service URL and API keys.
- Preserve legacy behavior where possible.

## Do Not

- Do not refactor unrelated apps.
- Do not change shared microservices.
- Do not remove legacy code; comment out with clear notes if needed.
- Do not create a separate dev environment; work against production-only.

## Outputs

- Legacy integration shim design and change list.
- Clear mapping of legacy routes to new service endpoints.
- Env keys required for integration (`MARATHON_URL`, optional API key).

## Acceptance Criteria

- Legacy marathon traffic can be routed to new service with minimal changes.
- Fallback/rollback path documented.
- All new config values added to `.env.example` (keys only).
