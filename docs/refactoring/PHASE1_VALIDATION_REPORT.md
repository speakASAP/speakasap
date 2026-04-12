# Phase 1 Validation Report

Date: 2026-04-10  
Scope: TASK-11 through TASK-15 validation for Content Service cutover readiness.

## Final validation snapshot (2026-04-10)

- `npm run build` in `content-service` -> PASS
- `curl https://content.alfares.cz/health` -> 200
- `POST /api/v1/dictionary/translate` and `POST /api/v1/grammar/translate` -> **live** after AGENT17 redeploy (see §4 for 200/400/504 evidence)

**Phase 1 closure:** Lead Orchestrator accepted remaining recommendations (p95/p99 export, optional smoke script) as **non-blocking follow-up** on **2026-04-10**.

## Evidence Used

- Contract and mapping docs:
  - `docs/refactoring/CONTENT_API_CONTRACT.md`
  - `docs/refactoring/CONTENT_DATA_MAPPING.md`
  - `docs/refactoring/CONTENT_AI_INTEGRATION.md`
  - `docs/refactoring/CONTENT_AI_INTEGRATION_IMPLEMENTATION.md`
- Migration outputs:
  - `docs/refactoring/CONTENT_DATA_MIGRATION_LOG.md`
  - `docs/refactoring/CONTENT_DATA_VALIDATION.md`
- Implementation inspected:
  - `content-service/src/**/*.ts` controllers/services/shared
  - `speakasap/.env.example` (monorepo SSOT; includes content keys)
  - infra/deploy files from TASK-11 and TASK-13 outputs
- Verification commands:
  - `npm run build` in `content-service` -> PASS
  - `npm test` in `content-service` -> FAIL (script missing)
  - Production checks via `ssh alfares`:
    - `curl http://127.0.0.1:4204/health` -> 200
    - `curl https://content.alfares.cz/health` -> 200
    - `curl https://content.statex.cz/health` -> 301

## 1) API Contract Validation

Status: PASS (GET contract)

- Endpoint coverage vs contract:
  - Health: `GET /health` implemented.
  - Languages: list/detail implemented.
  - Grammar: list/courses/detail implemented.
  - Phonetics: list/courses/detail implemented.
  - Songs: list/courses/detail implemented.
  - Dictionary: entries/themes/detail implemented.
- Pagination:
  - Shared pagination response shape matches contract: `items/page/limit/total/nextPage/prevPage`.
  - `MAX_PAGE_SIZE <= 30` enforced in `validate-env.ts`.
- Error format:
  - Global filter returns `{ error: { code, message, details } }` matching contract.
- Filters/sorting:
  - Controllers accept documented filters and normalize `order`.

Production endpoint matrix captured (`http://127.0.0.1:4204`):

- `/health` -> 200
- `/api/v1/languages` -> 200
- `/api/v1/languages/en` -> 200
- `/api/v1/grammar?limit=2` -> 200
- `/api/v1/grammar/courses` -> 200
- `/api/v1/grammar/1` -> 200
- `/api/v1/phonetics?limit=2` -> 200
- `/api/v1/phonetics/courses` -> 200
- `/api/v1/phonetics/1` -> 200
- `/api/v1/songs?limit=2` -> 200
- `/api/v1/songs/courses` -> 200
- `/api/v1/songs/1` -> 200
- `/api/v1/dictionary?limit=2` -> 200
- `/api/v1/dictionary/themes?limit=2` -> 200
- `/api/v1/dictionary/themes/1` -> 200
- `/api/v1/dictionary/1` -> 200

## 2) Data Migration Validation

Status: PASS

- Migration log reports production run completed.
- Legacy vs new count parity recorded for all entities:
  - Language 19
  - GrammarCourse 19
  - GrammarLesson 522
  - PhoneticsCourse 2
  - PhoneticsLesson 20
  - SongsCourse 8
  - SongsLesson 137
  - Word 20878
  - WordTheme 1138
  - WordThemeRelation 32716
- Validation doc confirms parity and successful API sample check.
- No discrepancies documented for the recorded production run.

## 3) Service Functionality Validation

Status: PASS (GET + 400/404 behavior)

- Build verification: PASS (`npm run build`).
- Production runtime reachable on `4204`.
- Health endpoint implementation exists.
- Controllers implement expected GET behavior and 400/404 validation branches.
- Logging is present in controllers and shared error handling.

Gaps:

- No automated test suite exists (`npm test` script missing).
- 500 path was not intentionally reproduced.

Negative-path evidence (production):

- `/api/v1/grammar/abc` -> 400
- `/api/v1/grammar/99999999` -> 404
- `/api/v1/dictionary/themes/abc` -> 400
- `/api/v1/dictionary/99999999` -> 404

## 4) AI Integration Validation

Status: PASS (2026-04-10 re-validation after AGENT17 fix)

Root cause of prior 404: `speakasap-content-green` container was built before TASK-15 translate routes were added to source. Rebuilt and redeployed on 2026-04-10.

- AI client exists (`src/shared/ai-client.service.ts`) and is wired in controllers.
- Translation endpoints now confirmed live in production runtime:
  - `POST /api/v1/dictionary/translate`
  - `POST /api/v1/grammar/translate`
- Env-driven AI configuration present (`AI_SERVICE_URL`, `AI_SERVICE_TIMEOUT=5000`, `RETRY_MAX_ATTEMPTS=3`).
- `AI_SERVICE_API_KEY`, `AI_SERVICE_TIMEOUT`, `AI_SERVICE_TRANSLATE_PATH` added to explicit `environment:` blocks in all 4 docker-compose files.

Runtime evidence (2026-04-10, internal container probes):

- `POST /api/v1/dictionary/translate` (valid payload) → `{"translatedText":"Ahoj","durationMs":16863,"status":"success"}` HTTP 200
- `POST /api/v1/grammar/translate` (valid payload) → `{"translatedText":"Jsem tady","durationMs":3879,"status":"success"}` HTTP 200
- `POST /api/v1/dictionary/translate` (missing `text`) → HTTP 400 `{"error":{"code":"BAD_REQUEST","message":"text is required",...}}`
- `POST /api/v1/grammar/translate` (missing `targetLanguage`) → HTTP 400
- `POST /api/v1/dictionary/translate` via HTTPS when all 3 AI attempts time out → HTTP 504 (correct `GatewayTimeoutException` mapped response)

Logging evidence:

- Startup: logs `Translate routes registered: POST /api/v1/dictionary/translate, POST /api/v1/grammar/translate`
- Per request: `timestamp=<ISO8601> duration_ms=<N> targetLanguage=<lang> providerStatus=<N>`
- On failure: `timestamp=<ISO8601> duration_ms=<N> reason=<timeout|unavailable|validation_error|unexpected_error>`

Notes:

- Dictionary AI calls are slow (~16s with retries when AI is cold). `AI_SERVICE_TIMEOUT=5000` with 3 retries = up to 15s total. Grammar responds faster (~4s).
- HTTPS returns 504 when all retry attempts exhaust — this is correct contract behavior, not a route error.
- AI success path confirmed end-to-end (English → Czech).

## 5) Performance Validation

Status: PARTIAL PASS

- Code has latency logging across controller entry/exit points.
- Quick production latency sample (5 calls each, seconds):
  - `/api/v1/languages`: 0.001632 to 0.002693
  - `/api/v1/grammar?limit=10`: 0.001868 to 0.002738
  - `/api/v1/dictionary?limit=10`: 0.002057 to 0.002641

Gap:

- No formal p95/p99 export collected (sample latencies below; **accepted as follow-up** at Phase 1 closure).
- Informal AI latency evidence in §4 (dictionary vs grammar); percentile export still optional follow-up.

## 6) Infrastructure Validation

Status: PASS (runtime availability)

- TASK-11/TASK-13 artifacts exist:
  - root and service-level `docker-compose` files
  - `scripts/deploy.sh`
  - `docs/infrastructure/SHARED_SERVICES.md`
  - `docs/infrastructure/PORT_ALLOCATION.md`
  - content nginx routes file
- **`speakasap/.env.example`** includes required integration keys and shared-service config placeholders.
- Production Docker runtime reachable; `speakasap-content-green` is healthy and mapped `4204->4201`.

Gap:

- No deployment dry-run executed in this validation cycle.

## Issues Found

1. Missing `npm test` script in `content-service` (unchanged — no automated test suite).
2. ~~Production translation endpoints return 404.~~ **RESOLVED 2026-04-10** (AGENT17).
3. ~~AI failure-path validation blocked until translation routes are active.~~ **RESOLVED** — failure path confirmed: 400 on bad payload, 504 on AI timeout.
4. Performance evidence is sample-level only (no p95/p99 export) — **tracked as follow-up**; not blocking Phase 1 closure.

## Recommendations

1. Add a minimal smoke test command (or scripted curl-based validator) before go-live cutover (optional hardening).
2. Current production endpoint matrix is up to date as release evidence.
3. Consider tuning `AI_SERVICE_TIMEOUT` or `RETRY_MAX_ATTEMPTS` only after root-cause analysis of AI latency (do not mask hangs).
4. Add percentile latency baseline (p95/p99) when operations requires it (optional follow-up).

## GO/NO-GO Decision

Decision: **GO** — **Phase 1 closed 2026-04-10** (Lead Orchestrator sign-off). Prior conditional items (p95/p99 export, deploy dry-run, `npm test` smoke) are **accepted follow-up**, not gates on program phase closure.

Updated: 2026-04-10 after AGENT17 root-cause fix, re-validation, and documentation sign-off.

Evidence:

- GET contract: PASS (all 13 endpoints, same as prior validation)
- Data migration: PASS (10 entity parity confirmed, unchanged)
- AI translate routes: PASS — both endpoints live, success path confirmed (English→Czech), error paths return correct contract shapes
- Logging: PASS — startup route log, ISO 8601 timestamps, `duration_ms`, categorized failure reasons
- Infrastructure: PASS — `speakasap-content-green` healthy, real SSL cert issued for `speakasap.alfares.cz`

Optional follow-up (operations / hardening):

- Capture p95/p99 latency baseline for list endpoints and AI translate.
- Add smoke test script for pre-deploy validation gate.
- Run deployment dry-run when convenient.
