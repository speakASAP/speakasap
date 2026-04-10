# Content Service ↔ AI Microservice Integration Plan

**Related:** TASK-15 / AGENT15 (implementation), ROADMAP Phase 1 (content + AI). **Constraint:** Read-only content API stays **GET**; any AI-powered **mutations** or heavy compute belong in dedicated flows (orchestrator, jobs), not silent side effects on simple reads.

## 1. Configuration

- `AI_SERVICE_URL`: Base URL for ai-microservice (e.g. `http://ai-microservice:3380`).

Align with `docs/infrastructure/SHARED_SERVICES.md`. No hardcoded hosts in code (TASK-13/15).

Optional timeouts/retries should reuse existing patterns in content-service `.env.example` (`HTTP_TIMEOUT`, `RETRY_*`) — do not increase timeouts to mask hangs; log latency and upstream errors.

## 2. Current ecosystem reality

The ai-microservice repository now exposes a stable translation contract in ai-orchestrator:

- `POST /api/v1/translate`
- request: `{ "text": "...", "sourceLang": "ru", "targetLang": "en" }`
- response: `{ "translatedText": "...", "sourceLang": "ru|auto", "targetLang": "en", "modelUsed": "...", "durationMs": 123 }`

This path is now the default integration route for SpeakASAP content-service (`AI_SERVICE_TRANSLATE_PATH=/api/v1/translate`).

## 3. Use cases (SpeakASAP content)

### 3.1 On-demand translation

**Need:** Translate `Word.translation` teasers, grammar `teaser`, or UI strings when target locale ≠ material language.

**Pattern:**

1. **Preferred:** `POST` to a small **ai-orchestrator** (or dedicated) route, e.g. body `{ "text": "...", "sourceLang": "ru", "targetLang": "en" }`, response `{ "translatedText": "..." }`.
2. **Cache:** Key `(hash(text), source, target)` in Redis (shared database-server) to avoid repeat calls — implemented in TASK-15, not in read-only GET handlers if it adds latency; optional `GET ?translate=true` flag is a **product decision** (can violate “read-only” semantics if it triggers writes to cache — prefer **separate** `GET /api/v1/.../translated` or client calls AI directly via gateway).

**Fallback:** If AI unavailable, return original field and `translationStatus: "fallback"` in envelope **only** if API is extended; otherwise log error and return unmodified content.

### 3.2 Content generation (optional / later)

**Need:** Generate examples, drills, or summaries for lessons.

**Pattern:** Async job (queue or orchestrator workflow) → writes to staging tables or CMS — **out of scope** for Phase 1 read-only content service unless product explicitly adds write APIs later.

## 4. Error handling

- AI timeout: Log `duration_ms`, ERROR; return content without AI enrichment.
- 4xx/5xx from AI: Log status and truncated body; same fallback.
- Invalid API key/auth: Log ERROR; do not leak secrets to client.

Use **logging-microservice** with ISO timestamps per platform standard.

## 5. Notifications (shared keys)

If AI pipeline sends user-facing alerts (e.g. generation failed), use **notifications-microservice** with keys from `.env.example`:

- `NOTIFICATIONS_MICROSERVICE_URL`, `NOTIFICATIONS_MICROSERVICE_PORT`
- Template IDs: `NOTIFICATION_ORDER_CREATED`, etc. (add **content-specific** keys when implementing, e.g. `NOTIFICATION_CONTENT_AI_FAILED`, in `.env.example` keys-only)

Content read endpoints **must not** send notifications by default.

## 6. Security

- Service-to-service: network isolation on Docker `nginx-network`; optional internal API key header defined in TASK-15.
- No user content in logs (PII).

## 7. Deliverables for TASK-15

- Thin **AI client** in content-service (existing path suggestion: `src/shared/ai-client.service.ts`).
- Stable route documented and implemented: `POST /api/v1/translate` (ai-orchestrator).

## 8. Verification

- [x] All AI calls use `AI_SERVICE_URL` from env
- [x] Failures logged with timestamp and `duration_ms`
- [x] User-facing responses degrade gracefully without 500 when AI is optional
