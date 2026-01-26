# Marathon Parity Checklist (Legacy vs New)

## Scope

Verify that the new `marathon` product behavior matches legacy marathon API responses before enabling the shim.

## Legacy API Endpoints (source: `speakasap-portal/marathon/api_urls.py`)

### Winners

- `GET /marathon/api/winners.json`
  - Pagination: `limit` parameter respected; default page size = 24
  - Ordering: gold desc, silver desc, bronze desc
  - Filters: only winners with any medals (gold/silver/bronze > 0)

- `GET /marathon/api/winners/{id}.json`
  - Same filtering and ordering rules

### Random Report

- `GET /marathon/api/random_report/{step}.json?marathoner=`
  - Only completed answers
  - Excludes `marathoner` if provided
  - Returns 404 when no match

### My Marathons

- `GET /marathon/api/my.json`
  - Auth required
  - Returns user’s marathoners

- `GET /marathon/api/my/{id}.json`
  - Auth required
  - Returns the specific marathoner for the user

### Languages

- `GET /marathon/api/languages.json`
  - Returns language metadata (code, small_icon, name, full_name)
  - Includes `payment_url` and `url` from legacy serializer

### Reviews

- `GET /marathon/api/reviews.json`
  - Public
  - Returns static reviews list

### Registration

- `POST /marathon/api/register.json`
  - Anonymous only
  - Creates marathoner and redirects to marathon URL

## Response Shape Parity

- Winners list/detail shapes match `WinnerSerializer` / `WinnerDetailSerializer`
- Random report shape matches `AnswerSerializer`
- My marathons shape matches `MyMarathonSerializer`:
  - `title`, `type`, `needs_payment`, `registered`, `id`, `bonus_total`, `bonus_left`,
    `can_change_report_time`, `report_time`, `current_step`, `answers`
- Languages shape matches `MarathonLanguageSerializer`:
  - `id`, `code`, `small_icon`, `payment_url`, `name`, `full_name`, `url`

## Auth / Access

- `my.json` endpoints require auth (same as legacy)
- winners/reviews/random report are public
- register is anonymous only

## Logging & Fallback

- All shim calls log: path, status, latency, user id (if available)
- Fallback to legacy on 5xx/timeout
- 4xx responses from new service are returned as-is

## Cutover Rules

- Do not enable `MARATHON_SHIM_ENABLED=true` until:
  - All endpoints above match expected legacy behavior
  - Response shapes are validated in UI flows or API tests
  - No regression in auth/permission handling
