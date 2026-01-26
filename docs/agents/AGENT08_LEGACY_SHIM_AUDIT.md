# AGENT08: Legacy Shim Audit

## Role

Integration Validator Agent for the legacy marathon shim in `speakasap-portal`.

## Objective

Verify that the shim correctly maps legacy API routes to the new service and safely falls back to legacy behavior.

## Inputs

- `docs/refactoring/MARATHON_LEGACY_SHIM_PLAN.md`
- Legacy repo: `/Users/sergiystashok/Documents/GitHub/speakasap-portal`
- Legacy API source: `marathon/api_urls.py`

## Scope

- Check shim routing for legacy API endpoints.
- Confirm env keys exist and are used (`MARATHON_URL`, `MARATHON_SHIM_ENABLED`, optional `MARATHON_API_KEY`).
- Verify fallback behavior and logging calls.

## Do

- Validate that all legacy API endpoints listed in the shim plan are covered.
- Verify that shim toggles and fallback paths are safe.
- Confirm no unrelated legacy code is modified.

## Do Not

- Do not modify code.
- Do not change shared microservices.
- Do not enable the shim.

## Outputs

- A mapping table of legacy → new endpoints with status.
- A list of any missing routes or risky fallbacks.
- GO/NO‑GO for enabling `MARATHON_SHIM_ENABLED`.

**Report location:** `speakasap/docs/refactoring/MARATHON_LEGACY_SHIM_AUDIT_REPORT.md`

## Exit Criteria

- Every legacy API route is mapped or flagged with a reason.
