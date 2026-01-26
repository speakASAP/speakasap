# Marathon Legacy Integration Shim (Phase 0)

## Scope

Minimal shim in `speakasap-portal` to forward legacy marathon API traffic to the new `marathon` product while keeping existing templates and URLs stable.

## Legacy Entry Points (current)

### API

Legacy path prefix: `/marathon/api/`

- `GET /marathon/api/winners.json`
- `GET /marathon/api/winners/{id}.json`
- `GET /marathon/api/random_report/{step}.json?marathoner=`
- `GET /marathon/api/my.json`
- `GET /marathon/api/my/{id}.json`
- `GET /marathon/api/languages.json`
- `GET /marathon/api/reviews.json`
- `POST /marathon/api/register.json`

### Web (keep legacy for now)

Legacy templates and flows in `speakasap-portal/marathon/` remain until API parity is validated and a separate UI cutover is planned.

## Shim Strategy

- Proxy only the legacy API endpoints listed above to the new service.
- Preserve legacy URLs and response shapes where the frontend relies on them.
- Add a fallback path (if the new service fails, use legacy behavior).
- Keep changes localized to the marathon app; do not refactor unrelated code.

## Mapping: Legacy → New Service

New service base: `/api/v1`

- `GET /marathon/api/winners.json` → `GET /api/v1/winners`
- `GET /marathon/api/winners/{id}.json` → `GET /api/v1/winners/{winnerId}`
- `GET /marathon/api/random_report/{step}.json?marathoner=` → `GET /api/v1/answers/random?stepId={step}&excludeMarathonerId={marathoner}`
- `GET /marathon/api/my.json` → `GET /api/v1/me/marathons`
- `GET /marathon/api/my/{id}.json` → `GET /api/v1/me/marathons/{marathonerId}`
- `GET /marathon/api/languages.json` → `GET /api/v1/marathons/languages`
- `GET /marathon/api/reviews.json` → `GET /api/v1/reviews`
- `POST /marathon/api/register.json` → `POST /api/v1/registrations`

## Env Keys

- `MARATHON_URL` (base URL for the new service, required)
- `MARATHON_SHIM_ENABLED` (optional toggle, defaults to off if not set)
- `MARATHON_API_KEY` (optional, if the new service requires auth)

## Logging

Log all outbound requests with:

- request path, method, user id (if available)
- response status and latency
- fallback activation reason (if used)

## Fallback / Rollback

- If `MARATHON_SHIM_ENABLED` is false or missing, use legacy behavior.
- If the new service returns 5xx or times out, fall back to legacy behavior.
- For 4xx from new service, return the new service response (no fallback).

## Acceptance Criteria

- All legacy API endpoints listed above return correct data for the same inputs.
- Fallback path is verified and documented.
- No unrelated legacy code modified.
