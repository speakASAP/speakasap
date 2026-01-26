# AGENT06: Marathon Parity Implementation

## Role

Backend Service Agent responsible for implementing missing marathon API behavior so the new service matches legacy parity.

## Objective

Close the gaps listed in `MARATHON_PARITY_CHECKLIST.md` by implementing missing endpoints and response shapes in `/Users/sergiystashok/Documents/GitHub/marathon`.

---

## Checklist location & completion status

**Parity checklist (source of truth):**  
`speakasap/docs/refactoring/MARATHON_PARITY_CHECKLIST.md`

| Item | Status | Notes |
|------|--------|--------|
| `GET /reviews` | ✅ Done | Static list matching `ReviewSerializer`: name, photo, text |
| `GET /answers/random` | ✅ Done | Qs: `stepId`, `excludeMarathonerId`; matches `AnswerSerializer`: marathoner, report, complete_time |
| `GET /me/marathons` | ✅ Done | Auth required; matches `MyMarathonSerializer` shape |
| `GET /me/marathons/:id` | ✅ Done | Auth required; matches `MyMarathonSerializer` shape |
| Winners pagination / ordering / filter | ✅ Done | `limit` param, order gold→silver→bronze desc, only medal > 0 |
| Winners list/detail shape | ✅ Done | Legacy shape: id, name, gold, silver, bronze, avatar; detail + reviews |
| Languages shape | ✅ Done | Legacy shape: id, code, small_icon, payment_url, name, full_name, url (note: small_icon, name, full_name need language metadata) |
| `POST /registrations` | ✅ Done | Anonymous; creates marathoner, redirect |

**Legacy shapes:** `speakasap-portal/marathon/serializers/common.py`, `winners.py`, `reviews/serializers.py`.

## Inputs

- `docs/refactoring/MARATHON_PARITY_CHECKLIST.md`
- `docs/refactoring/MARATHON_API_CONTRACT.md`
- Legacy API source: `speakasap-portal/marathon/api_urls.py`
- Legacy serializers: `speakasap-portal/marathon/serializers/*`
- Marathon repo: `/Users/sergiystashok/Documents/GitHub/marathon`

## Scope

- Implement missing endpoints and response shapes in the marathon NestJS service.
- Align pagination, ordering, and filtering with legacy behavior.
- Preserve env-driven configuration and centralized logging.

## Do

- Implement endpoints that exist in the contract but are missing in code:
  - `GET /reviews`
  - `GET /answers/random`
  - `GET /me/marathons`
  - `GET /me/marathons/:id`
  - Any required filters/pagination for winners
- Match legacy response shapes for winners, reviews, languages, and my marathons.
- Use Prisma queries and existing services; extend existing modules.
- Keep changes limited to the marathon repo.

## Do Not

- Do not modify production-ready shared services.
- Do not hardcode URLs, credentials, or ports.
- Do not add new scripts unless absolutely necessary.
- Do not add automated tests.
- Do not introduce a dev-only environment.

## Outputs

- Updated marathon controllers/services with missing endpoints.
- Updated DTOs/response shapes to match legacy parity.
- Updated `.env.example` if new keys are required (keys only).

## Exit Criteria

- All items in `MARATHON_PARITY_CHECKLIST.md` are implemented or explicitly documented as deferred.
- New endpoints return legacy-compatible shapes and codes.

## Related

- Parity checklist: `speakasap/docs/refactoring/MARATHON_PARITY_CHECKLIST.md`
- API contract: `speakasap/docs/refactoring/MARATHON_API_CONTRACT.md`
- Legacy shim plan: `speakasap/docs/refactoring/MARATHON_LEGACY_SHIM_PLAN.md`
- Phase 0 validation: `speakasap/docs/refactoring/MARATHON_PHASE0_VALIDATION.md`
