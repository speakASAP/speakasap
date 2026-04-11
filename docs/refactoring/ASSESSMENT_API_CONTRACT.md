# Assessment Service API Contract (design freeze)

**Service:** `speakasap-assessment-service` (port **4203**; `PORT` from `.env`). **Base path:** `/api/v1`. **Health:** `GET /health`.

**Legacy sources:** `language_tests`, `user_tests` in `speakasap-portal`.

## Explicitly out of scope: `teacher_tests`

The Django app **`teacher_tests`** is **obsolete** for this refactor (per `ROADMAP.md` / Phase 2 decomposition). **No** endpoints, tables, or migrations may target `teacher_tests`. Any reference in shared URLs (e.g. legacy `/api/teacher_tests/`) is **not** reproduced here.

---

## Pagination

Same as content-service / certification: `page`, `limit`, max **30**, response `{ items, page, limit, total, nextPage, prevPage }`.

## Error format

Same JSON envelope as `CONTENT_API_CONTRACT.md`:

```json
{
  "error": {
    "code": "BAD_REQUEST | NOT_FOUND | UNAUTHORIZED | FORBIDDEN | INTERNAL_ERROR",
    "message": "Human-readable message",
    "details": {}
  }
}
```

---

## A. Adaptive language tests (`language_tests`)

Legacy base path: **`/api/language_tests/`** (included from `rest/urls.py`).

### Roles

| Role | Access |
|------|--------|
| **Student** | Create/list own `UserTest`, current question, submit answers, read own result |
| **Staff** (`ProtectedPermission` / Django model permissions) | CRUD `LanguageTest`, questions, answers, levels; list all user tests; read any user test detail |

### A.1 Test catalog (admin)

### `GET /api/v1/admin/language-tests`

Paginated list of `LanguageTest`.

**Item:** `{ "id", "name", "tag", "languageId", "languageName", "sizeStr", "url" }` — parity with `LanguageTestSerializer` (`url` absolute to public HTML test entry if still routed via frontend).

### `POST /api/v1/admin/language-tests`

Create test (legacy `POST .../tests.json`).

### `GET/PATCH /api/v1/admin/language-tests/:testId`

### `GET/POST /api/v1/admin/language-tests/:testId/questions`

Nested list/create questions for test (ordered by `level.difficult`, `id`).

### `GET/PATCH/DELETE /api/v1/admin/language-tests/questions/:questionId`

Soft-delete parity: legacy `remove()` on TrashMixin — contract uses **DELETE** → tombstone or hard delete per implementation note in mapping.

### `GET/POST /api/v1/admin/language-tests/questions/:questionId/answers`

### `GET/PATCH/DELETE /api/v1/admin/language-tests/answers/:answerId`

### `GET /api/v1/admin/language-tests/levels`

All `Level` rows sorted by `difficult`.

### A.2 Student attempt lifecycle

### `POST /api/v1/language-user-tests`

**Body:** `{ "languageCode": "en", "tag": "placement" }` (exact field names camelCase).

**Effect:** Resolve `LanguageTest` by `(language, tag)`; create `UserTest` with `user` = caller.

**Response:** `UserTestState` (see below).

### `GET /api/v1/language-user-tests/:testId`

**403** if not owner.

**Response (`UserTestState`):**

| Field | Type | Notes |
|-------|------|--------|
| `id` | number | `UserTest.id` |
| `name` | string | Derived `UserTest.name` property |
| `createdAt` | ISO string | |
| `finished` | boolean | `ended != null` |
| `result` | object? | `UserTestResult` when finished |
| `resultUrl` | string? | Signed/absolute URL to result resource |
| `testUrl` | string | Link to language test landing |
| `questions` | array | Nested `UserTestQuestion` summaries (admin serializer includes `isRight`) |

### `GET /api/v1/language-user-tests/:testId/current-question`

**404** when test already ended, or when adaptive flow determines **no more questions** (legacy sets `user_test.ended` and returns 404).

**Effect when allowed:** If latest `UserTestQuestion` still **active** (within **45 seconds** of `created`), return that row. Else pick next question per algorithm (see scoring).

**Response (`CurrentQuestionState`):**

| Field | Type | Notes |
|-------|------|--------|
| `id` | number | `UserTestQuestion.id` |
| `questionText` | string | Legacy uses slug field `text` |
| `answers` | array | `{ "id", "text", "checked" }` shuffled; `checked` if user already selected |
| `activeTill` | ISO string | `created + 45s` |
| `active` | boolean | |
| `complete` | boolean | |
| `order` | number | 1-based order in attempt |
| `secondsLeft` | number | |

### `PATCH /api/v1/language-user-tests/questions/:userQuestionId`

**Body:** `{ "check": [answerId, ...] }` — must be subset of question’s answer ids.

**Validation errors (400):** Question already complete; timer expired; invalid answer ids (legacy Russian messages → use `BAD_REQUEST` + English or keyed `details`).

**Effect:** Attach selected `Answer` rows, set `complete=true`.

### `GET /api/v1/language-user-tests/results/:viewToken`

**Auth:** optional for public share (legacy `IsAuthenticatedOrReadOnly`).

**Response (`LanguageTestResult`):**

| Field | Type | Notes |
|-------|------|--------|
| `score` | number | Integer score |
| `position` | number | Percentile rank legacy `position` |
| `sliderValue` | number | `score / max_score * 100` |
| `avgSliderValue` | number | Compared to other results |
| `recommendations` | array | `{ "title", "description", "link" }` for `level` + `language` |
| `testUrl` | string | |

**404** bad signature or missing result.

### A.3 Admin observation

### `GET /api/v1/admin/language-user-tests`

Paginated all attempts (legacy `tests/user_tests.json`).

### `GET /api/v1/admin/language-user-tests/:testId`

Full detail with `stat` array (`right`, `wrong`, `total`, `percent`, `difficult` per level) and nested questions with `isRight`.

---

## B. Asset-based fixed quizzes (`user_tests`)

Legacy router: **`/api/user_tests/tests/`** (DefaultRouter).

### Roles

| Role | Access |
|------|--------|
| **User** | List/retrieve/update **own** tests |
| **Manager** | `?user=<userId>` on list to impersonate list (legacy `is_manager`) |

### `GET /api/v1/asset-user-tests`

**Query:** `userId` optional for managers only.

**Response:** paginated items `{ "completedAt", "id", "createdAt", "title", "dueDate", "success" }` — `id` is UUID string.

### `POST /api/v1/asset-user-tests`

**Body:** `{ "asset": "<machine_name>" }` — required. Optional `dueDate` (date).

**Effect:** Load `user_tests/assets/<asset>.json`, run `process_questions` equivalent (10 questions, 4 answers each) — implementation ports Python logic.

**Response:** 201 + summary row.

### `GET /api/v1/asset-user-tests/:testId`

**Response (`AssetUserTestDetail`):**

| Field | Type | Notes |
|-------|------|--------|
| `id` | string (UUID) | |
| `questions` | object | Full shuffled exam JSON |
| `answers` | object | Empty until complete |
| `createdAt` | ISO | |
| `dueDate` | date? | |
| `completedAt` | ISO? | |
| `success` | boolean | `errors.length === 0` |
| `isCompleted` | boolean | |
| `errors` | string[] | Question keys or messages from `validate_questions` |

### `PATCH /api/v1/asset-user-tests/:testId`

**Body:** `{ "answers": { ... } }` — same shape legacy expects.

**400** if already completed.

**Effect:** Run validation; set `completedAt`, `errors`, fire success/fail side effects (signals) via domain events or outbox — **not** duplicated in nginx; handled in service code.

**Attempts:** Legacy `MAX_TEST_ATTEMPTS = 5` per `asset` for failed tests; `attemptsLeft` derivable — expose on **GET** detail as optional `attemptsLeft` for UI.

---

## Scoring rules (language adaptive test)

1. **Per-level stats:** For each difficulty level, count right/wrong `UserTestQuestion` where `question.level.difficult` matches.
2. **`percent`** per level: `right / (right + wrong) * 100` (legacy `AnswerStat`).
3. **Overall `score`:** `sum(percent * difficult)` over levels (legacy `UserTest.score` property).
4. **Assigned `level`:** Walk stats from lowest difficulty upward while `percent >= 80` (`LEVEL_THRESHOLD`); assigned level is last level that meets threshold else lowest (legacy loop in `UserTest.level`).
5. **`UserTestResult`:** Created lazily on first access to `result` after `ended` set; stores `score` and `level_id`.
6. **Question progression:** After answering, if all answers correct for multi-select, advance **up** a level; else **down** or stay per `_get_next_level` in `CurrentQuestionView` (mirrored exactly in TASK-26).

**Partial credit:** None per question — a question counts as **right** only if the set of selected answer ids equals the set of answers with `right=true` for that question (legacy `UserTestQuestion.is_right`).

**Timer:** Each `UserTestQuestion` allows submission only while `now < created + 45s` (legacy `active`).

---

## Legacy route → new API (summary)

| Legacy | New |
|--------|-----|
| `POST /api/language_tests/user_tests.json` | `POST /api/v1/language-user-tests` |
| `GET /api/language_tests/user_tests/<pk>.json` | `GET /api/v1/language-user-tests/:testId` |
| `GET .../user_tests/<pk>/questions/current.json` | `GET /api/v1/language-user-tests/:testId/current-question` |
| `PATCH .../questions/<pk>.json` | `PATCH /api/v1/language-user-tests/questions/:userQuestionId` |
| `GET .../results/<signed>.json` | `GET /api/v1/language-user-tests/results/:viewToken` |
| `GET/POST .../tests.json`, etc. | `/api/v1/admin/language-tests...` |
| `GET .../tests/user_tests.json` | `GET /api/v1/admin/language-user-tests` |
| `GET .../tests/user_tests/<pk>.json` | `GET /api/v1/admin/language-user-tests/:testId` |
| `GET/POST /api/user_tests/tests/` | `GET/POST /api/v1/asset-user-tests` |
| `GET/PATCH /api/user_tests/tests/:uuid/` | `GET/PATCH /api/v1/asset-user-tests/:testId` |

---

## Concurrency

- **Language test:** Only one “current” open question per attempt; `current-question` creates row idempotently when timer expired and level rules say next pick.
- **Asset test:** Single `PATCH` completes test; duplicate returns **400**.
