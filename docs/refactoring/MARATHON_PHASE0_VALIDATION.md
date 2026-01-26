# Marathon Phase 0 Validation Checklist

## Scope

Validate Phase 0 artifacts for `marathon` before any implementation:

- `MARATHON_API_CONTRACT.md`
- `MARATHON_DATA_MAPPING.md`
- `MARATHON_INFRA_PLAN.md`

## Validation Checklist

### Contract

- API endpoints match legacy behavior in `speakasap-portal/marathon/api_urls.py`.
- Pagination enforces limit <= 30.
- Error codes and shapes are consistent and documented.
- Authenticated endpoints are clearly marked.

### Data Mapping

- All core legacy entities mapped (Marathon, Step, Marathoner, Answer, PenaltyReport, Winner, MarathonProduct, MarathonGift).
- Field transforms are explicit (slug, URLs, timestamps).
- Migration strategy documented (dual-write + backfill preferred).
- Rollback strategy documented.

### Infra

- All configuration is env-driven.
- `LOGGING_SERVICE_URL` required and documented.
- No dev environment references; production-only.
- Port guidance is in 42xx range.

## Go / No-Go

- GO if all checklist items pass.
- NO-GO if any of: missing contract sections, missing mapping for a core entity, hardcoded config, or dev-only guidance.
