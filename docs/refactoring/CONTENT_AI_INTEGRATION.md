# Content Service AI Integration

## Overview

Content Service is read-only and can optionally enrich dictionary entries with AI-assisted translations or suggestions. AI usage must be optional and fail-safe.

## Configuration

- `AI_SERVICE_URL` (required when AI features enabled)
- `HTTP_TIMEOUT` (request timeout)
- `RETRY_MAX_ATTEMPTS`
- `RETRY_DELAY_MS`

## Integration Points

### 1. Dictionary Translation Enrichment

Use ai-microservice to suggest translations for a given `word` in a target language.

Request shape:

```json
{
  "sourceLanguage": "en",
  "targetLanguage": "ru",
  "text": "apple"
}
```

Response shape:

```json
{
  "translations": ["яблоко", "апельсин"],
  "confidence": 0.92
}
```

Behavior:

- If AI is unavailable, return stored dictionary data only.
- Never block core content responses on AI calls.

### 2. Content Tag Suggestions (Optional)

Suggest tags for grammar lessons or songs based on text fields.

Request shape:

```json
{
  "languageCode": "en",
  "title": "Present Simple",
  "content": "..."
}
```

Response shape:

```json
{
  "tags": ["grammar", "tense", "beginner"]
}
```

## Error Handling

- Network errors: log and skip enrichment.
- Timeout: log and skip enrichment.
- AI error response: log `error.code` and `error.message`, skip enrichment.

## Logging

All AI calls should be logged (no sensitive data):

- operation (`dictionary.translate`, `content.tags`)
- language codes
- input size
- latency
- result status (`success`, `timeout`, `error`)

## Fallback Strategy

If AI enrichment is disabled or fails:

- Return stored content as-is.
- Do not reduce core response fields.
