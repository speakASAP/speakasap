# Content Service AI Integration Implementation

## Scope

TASK-15 implementation adds a thin integration adapter from `content-service` to `ai-microservice` for on-demand translation endpoints.

## Implemented Files

- `content-service/src/shared/ai-client.service.ts`
- `content-service/src/shared/shared.module.ts`
- `content-service/src/dictionary/dictionary.controller.ts`
- `content-service/src/grammar/grammar.controller.ts`
- `content-service/src/shared/validate-env.ts`
- `content-service/.env.example`

## Endpoints

### `POST /api/v1/dictionary/translate`

Request:

```json
{
  "text": "Hello",
  "sourceLanguage": "en",
  "targetLanguage": "ru"
}
```

Response:

```json
{
  "translatedText": "Привет",
  "durationMs": 83,
  "status": "success"
}
```

### `POST /api/v1/grammar/translate`

Request/response contract is identical to dictionary translate.

## AI Client Behavior

- Uses `AI_SERVICE_URL` + `AI_SERVICE_TRANSLATE_PATH` (`/api/v1/translate` default).
- Uses `AI_SERVICE_TIMEOUT` (fallback `HTTP_TIMEOUT`, then `5000` ms).
- Optional API key header: `x-api-key` from `AI_SERVICE_API_KEY`.
- Retry behavior from existing shared keys: `RETRY_MAX_ATTEMPTS`, `RETRY_DELAY_MS`.
- Logs request metadata and latency with ISO timestamps through Nest logger pipeline.

## Error Handling

- Invalid input (`text`, `targetLanguage`) -> `400`.
- Upstream timeout -> `504`.
- Upstream unavailable or 5xx -> `503`.
- Upstream rate limit -> `429`.
- Other upstream failures -> `502`.

All failures are logged with context and duration; secret values are never logged.

## Environment Keys

Added to `content-service/.env.example`:

- `AI_SERVICE_TIMEOUT`
- `AI_SERVICE_API_KEY`
- `AI_SERVICE_TRANSLATE_PATH`

`AI_SERVICE_URL` already existed and is now validated as required.

## Results Update (Stable Contract)

- Implemented in `ai-microservice`: `POST /api/v1/translate` in `services/ai-orchestrator/app/main.py`.
- Switched deployed SpeakASAP envs (local + alfares) to:
  - `AI_SERVICE_TRANSLATE_PATH=/api/v1/translate`
  - `AI_SERVICE_TIMEOUT=5000`
- Root cause addressed: translation now uses a dedicated contract instead of overloading generic completion flow.

## Verification

1. Build:

```bash
cd /Users/sergiystashok/Documents/GitHub/speakasap/content-service
npm run build
```

1. Runtime checks:

```bash
curl -X POST http://localhost:4201/api/v1/dictionary/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello","targetLanguage":"ru"}'
```

```bash
curl -X POST http://localhost:4201/api/v1/grammar/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"Good morning","targetLanguage":"cs"}'
```
