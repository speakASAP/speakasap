# Phase 1 Validation Report

Date: 2026-04-10  
Scope: TASK-11 through TASK-15 validation for Content Service cutover readiness.

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
  - `content-service/.env.example`
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

Status: FAIL (production runtime)

- AI client exists (`src/shared/ai-client.service.ts`) and is wired in controllers.
- Translation endpoints implemented:
  - `POST /api/v1/dictionary/translate`
  - `POST /api/v1/grammar/translate`
- Env-driven AI configuration present (`AI_SERVICE_URL`, `AI_SERVICE_TIMEOUT`, `AI_SERVICE_TRANSLATE_PATH`, optional API key).
- Error handling strategy is documented and implementation file claims mapped status behavior.

Runtime evidence (production):

- `POST /api/v1/dictionary/translate` -> 404 (`Cannot POST ...`)
- `POST /api/v1/grammar/translate` -> 404 (`Cannot POST ...`)

Gap:

- AI success/timeout/fallback cannot be validated until these routes are active in deployed runtime.

## 5) Performance Validation

Status: PARTIAL PASS

- Code has latency logging across controller entry/exit points.
- Quick production latency sample (5 calls each, seconds):
  - `/api/v1/languages`: 0.001632 to 0.002693
  - `/api/v1/grammar?limit=10`: 0.001868 to 0.002738
  - `/api/v1/dictionary?limit=10`: 0.002057 to 0.002641

Gap:

- No p95/p99 export collected.
- No AI latency baseline possible until translate routes are available.

## 6) Infrastructure Validation

Status: PASS (runtime availability)

- TASK-11/TASK-13 artifacts exist:
  - root and service-level `docker-compose` files
  - `scripts/deploy.sh`
  - `docs/infrastructure/SHARED_SERVICES.md`
  - `docs/infrastructure/PORT_ALLOCATION.md`
  - content nginx routes file
- `.env.example` includes required integration keys and shared-service config placeholders.
- Production Docker runtime reachable; `speakasap-content-green` is healthy and mapped `4204->4201`.

Gap:

- No deployment dry-run executed in this validation cycle.

## Issues Found

1. Missing `npm test` script in `content-service`.
2. Production translation endpoints return 404.
3. AI failure-path validation blocked until translation routes are active.
4. Performance evidence is sample-level only (no p95/p99).

## Recommendations

1. Add a minimal smoke test command (or scripted curl-based validator) before cutover.
2. Keep current production endpoint matrix as release evidence.
3. Fix deployment drift/root cause so TASK-15 routes are exposed in production.
4. Re-run AI success/unavailable/timeout probes after deploy.
5. Add percentile latency baseline (p95/p99) for cutover evidence.

## GO/NO-GO Decision

Decision: NO-GO

Reason: GET contract and migration validate in production, but required AI translation endpoints are missing in deployed runtime (`404`).

Condition to flip to GO:

- Deploy runtime that exposes translation endpoints, then pass AI probes and remaining checklist items with no critical failures.

## Immediate Next Commands (root-cause fix)

```bash
ssh alfares
cd /home/ssf/Documents/Github/speakasap/content-service
# verify deployed image/tag/config includes translation routes, redeploy content service
# then validate:
curl -sS -m 10 -X POST http://127.0.0.1:4204/api/v1/dictionary/translate -H "Content-Type: application/json" -d '{"text":"Hello","targetLanguage":"cs"}'
```
