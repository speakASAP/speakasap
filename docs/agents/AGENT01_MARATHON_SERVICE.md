# AGENT01: Marathon

## Role

Backend Service Agent responsible for designing and implementing `marathon` as a standalone NestJS product.

## Objective

Define the domain boundary, API contract, and initial product structure for `marathon`, aligned to the roadmap and ready for legacy integration.

---

## Completion status (as of 2026-01-26)

| Output / criterion | Status | Notes |
| ------------------ | ------ | ------ |
| API contract documented | ✅ Done | `docs/refactoring/MARATHON_API_CONTRACT.md` |
| Service skeleton / implementation | ✅ Done | NestJS app in `marathon` repo: marathons, registrations, winners |
| DB schema proposal | ✅ Done | Prisma schema in `marathon/prisma/schema.prisma`; aligns with `MARATHON_DATA_MAPPING.md` |
| API contract consistent with legacy | ✅ Done | Contract mirrors legacy; implementation is a subset (see below) |
| Service boundary decoupled | ✅ Done | Standalone repo, no legacy code |
| Env config in `.env.example` | ✅ Done | Keys-only; `LOGGING_SERVICE_URL`, `NOTIFICATION_SERVICE_URL`, etc. |

**Implemented endpoints (base path `api/v1`):**

- `GET /marathons` (filters: `languageCode`, `active`)
- `GET /marathons/languages`
- `GET /marathons/by-language/:languageCode`
- `GET /marathons/:marathonId`
- `POST /registrations` (body: `email`, `phone?`, `name?`, `password?`, `languageCode?`)
- `GET /winners`
- `GET /winners/:winnerId`
- `GET /health` (excluded from prefix)

**Not yet implemented (per contract):** pagination (`page`, `limit`, `{ items, page, limit, total, nextPage, prevPage }`), standardized error shape `{ code, message, details?, traceId? }`, `GET /reviews`, `GET /answers/random`, `GET /me/marathons`, `GET /me/marathons/:id`, `POST /marathons/:id/join`, `POST /marathoners/:id/report-time`, PATCH/POST answers & penalties, marathoner restart/delete, `POST /gifts/activate`, `GET /marathons/:id/payment-url`. These are deferred to Phase 1+ or AGENT02 handoff.

**Infra:** Dockerfile, docker-compose (blue/green), Prisma migrations, seed. See `marathon/README.md` and `MARATHON_INFRA_PLAN.md`.

## Inputs

- `docs/refactoring/ROADMAP.md`
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`
- Legacy marathon app in `speakasap-portal/marathon`
- Marathon repo: `/Users/sergiystashok/Documents/GitHub/marathon` (`git@github.com:speakASAP/marathon.git`)

## Scope

- Service boundary, endpoints, and data schema for marathon domain.
- Marathon implementation lives in `/Users/sergiystashok/Documents/GitHub/marathon`.
- `/Users/sergiystashok/Documents/GitHub/speakasap` is reserved for other services.
- Integration points to shared microservices (auth, database-server, logging, notifications, payments if needed).

## Do

- Use NestJS + TypeScript.
- Define API contract first (request/response shapes, errors, pagination).
- Use env-driven config; update `.env.example` with keys only.
- Include centralized logging integration via `LOGGING_SERVICE_URL`.

## Do Not

- Do not modify production-ready shared services.
- Do not hardcode URLs, credentials, or ports.
- Do not create new scripts unless absolutely necessary.
- Do not add automated tests.
- Do not create a separate dev environment; work against production-only.

## Outputs

- Marathon service API contract (documented) → `docs/refactoring/MARATHON_API_CONTRACT.md`
- Service skeleton or implementation plan aligned to NestJS patterns → implemented in `marathon` repo
- DB schema proposal for marathon domain → `marathon/prisma/schema.prisma`; mapping in `MARATHON_DATA_MAPPING.md`

See **Completion status** above for what is implemented vs deferred.

## Acceptance Criteria

- API contract reviewed and consistent with legacy marathon flows.
- Service boundary clearly decoupled from legacy.
- Env configuration documented with `.env.example` keys.

## Related

- Phase 0 validation: `docs/refactoring/MARATHON_PHASE0_VALIDATION.md`
- Infra plan: `docs/refactoring/MARATHON_INFRA_PLAN.md`
- Task index: `docs/refactoring/SPEAKASAP_REFACTORING_TASKS_INDEX.md` (TASK-01)
