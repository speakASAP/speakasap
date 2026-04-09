# Content Service API Contract (read-only)

**Service:** `speakasap-content-service` (port 4201 in roadmap; actual `PORT` from `.env`). **Base path:** `/api/v1` (global prefix). **Health:** `GET /health` (no prefix). **Source:** TASK-12 / AGENT12 — aligns with legacy `speakasap-portal` apps `grammar`, `phonetics`, `dictionary`, `songs`, `language`.

## Terminology note

AGENT12 wording “grammar rules” maps to legacy **`GrammarLesson`** rows (grammar lesson catalog), not a separate “rule” entity. Same pattern for phonetics and songs: list endpoints return **lessons**; detail `:id` is the lesson primary key.

## Pagination (Marathon-aligned)

Used for every list endpoint below that returns a page.

| Query param | Type | Default | Max |
|-------------|------|---------|-----|
| `page` | integer ≥ 1 | `1` | — |
| `limit` | integer ≥ 1 | `DEFAULT_PAGE_SIZE` from `.env` | `MAX_PAGE_SIZE` (cap **30**, same as marathon `MAX_PAGE_SIZE`) |

**Success body:**

```json
{
  "items": [],
  "page": 1,
  "limit": 24,
  "total": 100,
  "nextPage": 2,
  "prevPage": null
}
```

- `nextPage` / `prevPage` are numbers or `null` (same semantics as marathon winners list).
- Invalid numeric `page` / `limit` fall back to defaults; `limit` is clamped to `MAX_PAGE_SIZE`.

## Sorting

Where supported, `order=asc` | `order=desc` (default `asc`). Applies to the primary sort field documented per resource.

## Error format

Global `HttpErrorFilter` shape:

```json
{
  "error": {
    "code": "BAD_REQUEST | NOT_FOUND | UNAUTHORIZED | FORBIDDEN | INTERNAL_ERROR",
    "message": "Human-readable message",
    "details": {}
  }
}
```

| HTTP | `code` | Typical cause |
|------|--------|----------------|
| 400 | `BAD_REQUEST` | Invalid `id`, `courseId`, `themeId`, etc. |
| 404 | `NOT_FOUND` | Unknown id/code |
| 500 | `INTERNAL_ERROR` | Unhandled server error |

## Endpoints

### `GET /health`

**Response:** `{ "status": "ok" }` (exact value from `AppService.health()`).

---

### `GET /api/v1/languages`

Paginated languages.

| Query | Description |
|-------|-------------|
| `q` | Case-insensitive substring on `name` |
| `order` | Sort by `order`, then `name` (`asc`/`desc`) |

**Item shape (`LanguageResponse`):**

| Field | Type | Notes |
|-------|------|--------|
| `id` | number | PK |
| `code` | string | 2-char code (e.g. `en`, `de`) |
| `machineName` | string | Legacy `machine_name` |
| `name` | string | Russian display name in legacy |
| `iconUrl` | string | Built from `ASSETS_BASE_URL` + `iconPath` when set |
| `order` | number | |
| `speaker` | string | |

**Legacy mapping:** Replaces language lists embedded in portal; no single public “JSON” URL in legacy — UI read from DB. `Language` model used across portal.

---

### `GET /api/v1/languages/:code`

**Path:** `code` = language code (e.g. `en`). **Response:** Same object as list item. **404:** `Language not found`.

---

### `GET /api/v1/grammar`

Paginated **grammar lessons**.

| Query | Description |
|-------|-------------|
| `languageCode` | Filter by course → language `code` |
| `materialLanguage` | Filter by course `materialLanguage` |
| `courseId` | Filter by grammar course id |
| `section` | Exact section string |
| `q` | Case-insensitive substring on lesson `title` |
| `order` | Sort by lesson `order` |

**Item shape (`GrammarLessonResponse`):** `id`, `title`, `courseId`, `template`, `alias`, `url`, `section`, `teaser`, `order`, `metaKeywords`, `metaDescription`.

**Legacy URLs (HTML):**

- Course: `/{lang}/grammar/`
- Lesson: `/{lang}/grammar/{url}/` (slug)

---

### `GET /api/v1/grammar/courses`

**Response:** `GrammarCourseResponse[]` (not paginated; small set).

| Field | Type |
|-------|------|
| `id`, `title`, `languageId`, `materialLanguage` | |
| `metaKeywords`, `metaDescription` | nullable |

---

### `GET /api/v1/grammar/:id`

Lesson by numeric id. **404:** `Grammar lesson not found`.

---

### `GET /api/v1/phonetics`

Paginated **phonetics lessons**. Filters: `languageCode`, `materialLanguage`, `courseId`, `order` (on `order` field).

**Item (`PhoneticsLessonResponse`):** `id`, `title`, `courseId`, `order`, `metaKeywords`, `metaDescription`.

**Legacy URLs:**

- `/{lang}/phonetics/`
- `/{lang}/phonetics/{lesson}/` (numeric lesson order in path)

---

### `GET /api/v1/phonetics/courses`

**Response:** `PhoneticsCourseResponse[]`.

---

### `GET /api/v1/phonetics/:id`

**404:** `Phonetics lesson not found`.

---

### `GET /api/v1/songs`

Paginated **song lessons**. Filters: `languageCode`, `materialLanguage`, `courseId`, `order`.

**Item (`SongsLessonResponse`):** `id`, `title`, `courseId`, `order`.

**Legacy URLs:**

- `/{lang}/songs/`
- `/{lang}/songs/{lesson}/`

---

### `GET /api/v1/songs/courses`

**Response:** `SongsCourseResponse[]` (`id`, `title`, `languageId`, `materialLanguage`).

---

### `GET /api/v1/songs/:id`

**404:** `Song lesson not found`.

---

### `GET /api/v1/dictionary`

Paginated **dictionary entries** (words).

| Query | Description |
|-------|-------------|
| `languageCode` | Filter by word language |
| `themeId` | Words linked to theme |
| `q` | Substring on `word` OR `translation` (case-insensitive) |
| `order` | Sort by `word` |

**Item (`DictionaryEntryResponse`):** `id`, `word`, `transcription`, `translation`, `languageId`.

**Legacy:** Words used from DB in portal (e.g. memoword and course UIs); no dedicated public grammar-style URL pattern in `urls.py` grep — treat as **data API** for migrated clients.

---

### `GET /api/v1/dictionary/themes`

Paginated themes. Query: `q` (name), `order` (on `order` / name as implemented in service).

**Item (`DictionaryThemeResponse`):** `id`, `name`, `moduleClass`, `order`.

---

### `GET /api/v1/dictionary/themes/:id`

**404:** `Dictionary theme not found`.

---

### `GET /api/v1/dictionary/:id`

**404:** `Dictionary entry not found`.

---

## Example requests

```http
GET /api/v1/grammar?page=1&limit=20&languageCode=de&order=asc
GET /api/v1/grammar/42
GET /api/v1/dictionary?q=haus&languageCode=de&limit=30
GET /api/v1/languages?order=asc&limit=30
GET /api/v1/languages/de
```

## Shared services env (contract / `.env.example`)

See `docs/infrastructure/SHARED_SERVICES.md`. Content service `.env.example` should keep keys for:

- `LOGGING_SERVICE_URL`, `LOGGING_SERVICE_API_PATH`
- `NOTIFICATIONS_MICROSERVICE_URL`, `NOTIFICATIONS_MICROSERVICE_PORT`
- `NOTIFICATION_*` template keys already listed in `.env.example` (order/stock/sync placeholders)
- `AI_SERVICE_URL` (integration design in `CONTENT_AI_INTEGRATION.md`)

No secrets in docs; values only in `.env`.

## Verification checklist

- [ ] All list endpoints use `page` / `limit` with max 30 via `MAX_PAGE_SIZE`
- [ ] Paginated body matches `{ items, page, limit, total, nextPage, prevPage }`
- [ ] Errors use `{ error: { code, message, details } }`
- [ ] Read-only: no `POST`/`PUT`/`PATCH`/`DELETE` on content resources
