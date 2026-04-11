# Certification Service API Contract (design freeze)

**Service:** `speakasap-certification-service` (port **4202** per roadmap; bind `PORT` from `.env`). **Base path:** `/api/v1`. **Health:** `GET /health` — `{ "status": "ok" }` (same pattern as content-service scaffold).

**Legacy sources:** Django apps `certificates`, `education_certificates`, `quests`, `user_quest` in `speakasap-portal`.

**Auth:** JWT from **auth-microservice** on all `/api/v1/**` routes unless noted. User identity is the subject of the token; cross-domain IDs (`studentCourseId`, `studentId`, etc.) reference **speakasap-education-service** (or legacy numeric IDs during migration — see data mapping).

---

## Pagination (aligned with content-service)

Used for every list endpoint.

| Query param | Type | Default | Max |
|-------------|------|---------|-----|
| `page` | integer ≥ 1 | `1` | — |
| `limit` | integer ≥ 1 | from `DEFAULT_PAGE_SIZE` in `.env` | **30** (`MAX_PAGE_SIZE`, same cap as marathon / content) |

**Success list body:**

```json
{
  "items": [],
  "page": 1,
  "limit": 24,
  "total": 0,
  "nextPage": null,
  "prevPage": null
}
```

Invalid `page` / `limit` → defaults; `limit` clamped to max **30**.

## Error format

Same global shape as **content-service** (`HttpExceptionFilter`):

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
| 400 | `BAD_REQUEST` | Invalid body, unsigned id, validation |
| 401 | `UNAUTHORIZED` | Missing/invalid JWT |
| 403 | `FORBIDDEN` | Not owner / not teacher / not manager |
| 404 | `NOT_FOUND` | Unknown id or quest |
| 500 | `INTERNAL_ERROR` | Unhandled error |

---

## 1. Course completion certificates (`certificates` app)

Legacy model `certificates.Certificate`: one row per finished **individual** `StudentCourse` (FK `course` → `education.StudentCourse`), PNG `image` on materials storage, public link via **signed** certificate PK (`Signer`).

### `GET /api/v1/course-certificates`

**Purpose:** List current user’s individual course certificates (legacy `Certificate.objects.filter(course__student__user=user)`).

| Query | Description |
|-------|-------------|
| `page`, `limit` | Pagination |

**Item (`CourseCertificateSummary`):**

| Field | Type | Notes |
|-------|------|--------|
| `id` | number | Primary key (legacy `Certificate.id`) |
| `studentCourseId` | number | Legacy `StudentCourse` PK |
| `imageUrl` | string | Resolved URL for stored PNG (from `MATERIALS_BASE_URL` / gateway rules in `.env`) |
| `signedViewToken` | string | Opaque token for public viewer (replaces Django `Signer.sign(pk)`; implementation may wrap `id`) |
| `certText` | string | Human-readable line from legacy `cert_text` property |
| `createdAt` | string (ISO 8601) | From image/metadata or migration default |

### `GET /api/v1/course-certificates/:id`

**404** if not found or not owned by caller.

**Response:** `CourseCertificateSummary` plus optional `courseCode`, `languageCode` if joined from education read-model (or omitted until integration exists).

### `GET /api/v1/course-certificates/public/:viewToken`

**Purpose:** Resolve signed link (legacy `profile_certificate`). **Auth:** optional (public share). **404** if token invalid/expired.

**Response:** Same display fields as detail without internal ids if policy requires; at minimum `imageUrl`, `certText`.

### Idempotency / generation (writes)

Legacy generation runs on `course_finished` signal; **does not** expose a student REST “generate” endpoint. For parity and operations:

- **`POST /api/v1/internal/course-certificates/generate`** (service-to-service or admin role only): body `{ "studentCourseId": number, "forceBase": boolean }`. Behavior matches `Certificate.generate_certificate`: no-op if course not finished and `forceBase` false; if row exists for course, return existing unless `forceBase` forces regeneration (legacy semantics). **Idempotency-Key** header recommended for retries.

- Raster pipeline is **synchronous CPU + file write** in legacy; new service may queue a job but **contract** requires eventual row + `imageUrl` or explicit **202** with `jobId` — pick one in implementation and document in OpenAPI when added.

---

## 2. Group education certificates (`education_certificates` app)

Legacy `education_certificates.Certificate`: FK `student_course`, `student`, PNG `image`; list `Certificate.objects.filter(student__user=user)` in cabinet.

### `GET /api/v1/education-certificates`

Same pagination; items for current user (any group membership path preserved in mapping).

**Item (`EducationCertificateSummary`):**

| Field | Type | Notes |
|-------|------|--------|
| `id` | number | PK |
| `studentCourseId` | number | Group `StudentCourse` PK |
| `studentId` | number | Legacy `students.Student` PK |
| `imageUrl` | string | |
| `signedViewToken` | string | Public resolver |
| `certText` | string | Legacy property |

### `GET /api/v1/education-certificates/:id`

Owner or staff; **403** otherwise.

### `GET /api/v1/education-certificates/public/:viewToken`

Same pattern as course certificates.

### Internal generation

**`POST /api/v1/internal/education-certificates/generate`**: body `{ "studentCourseId": number, "studentIds": number[] | "allFinished": true, "forceBase": boolean, "sendNotification": boolean }` — mirrors `Certificate.generate_certificate` batch per student. **Idempotency-Key** per logical batch.

---

## 3. Gamified quests (`quests` app — `Quest` model)

Legacy REST: **`/api/quests/<uuid>.json`** (site mount `^api/quests/`). UUID is **primary key** of `Quest`.

### `GET /api/v1/quests/:questId`

`questId` = UUID string. **Auth:** required.

**Response (`QuestState`):**

| Field | Type | Notes |
|-------|------|--------|
| `questId` | string (UUID) | |
| `code` | string | Quest template code (must exist in template catalog) |
| `identifier` | object | Legacy JSON, e.g. `{ "student_course": "<uuid>" }` or lesson keys |
| `questions` | object | Rendered template JSON (pages/elements) |
| `answers` | object | User answers; empty until submitted |
| `isCompleted` | boolean | `completed != null` |
| `startOpened` | boolean | Legacy serializer: derived from `StudentCourse` read state when identifier has `student_course` |

**404** if quest not found or not permitted.

### `PATCH /api/v1/quests/:questId`

**Body:** `{ "answers": { "<elementName>": "<value>", ... } }` — keys must match all required question keys from `questions.pages[0].elements` names (legacy validation).

**Effect:** Merge answers, set `completed` to server `now` (legacy `QuestSerializer.update`).

**403** if quest already completed (legacy: only GET or teacher allowed after complete).

**Teacher/manager:** may **GET** any quest; **PATCH** only owner unless policy extended later.

### Teacher: course quest read (legacy `CourseQuestViewSet`)

Legacy: `education/api/teacher/.../courses/<uuid>/quests/student/<student_pk>/<postfix>` with `postfix` in `start|finish`.

### `GET /api/v1/teacher/courses/:studentCourseUuid/quests/students/:studentId/:postfix`

**Auth:** teacher role; must teach lesson linked to `student_course` (parity with `lesson__teacher` check).

**Response:** `QuestState` or empty object `{}` if `Quest.DoesNotExist` (legacy returns `{}`).

---

## 4. User questionnaires (`user_quest` app)

Legacy list/detail under **`/api/user_quests/`** (Django REST).

### `GET /api/v1/questionnaires`

Catalog of `Questionnaire` (legacy `QuestList` — all templates).

**Pagination:** max **30**.

**Item:** `{ "id", "title" }`

### `GET /api/v1/questionnaires/:id`

**Response:** `{ "id", "title", "questions": [ { "id", "text", "header" } ] }` ordered by legacy `order_with_respect_to`.

### `GET /api/v1/user-questionnaires`

**Query:** `status=incomplete|completed` (default `incomplete`). **Auth:** user sees own rows; managers may use `userId=` filter if policy matches legacy `manager_required` completed list.

**Item:** `{ "id", "questionnaire": { "id", "title" }, "userId", "createdAt", "finishedAt" }`

### `GET /api/v1/user-questionnaires/:id`

Incomplete instances: **only** if `user` is caller and `finished` is null.

**Response:** questionnaire detail + `answers[]` read-only + write-only channel for submit:

| Field | Type | Notes |
|-------|------|--------|
| `answers` | array | `{ "questionPk", "questionText", "questionHeader", "text" }` |
| `answer` | object | Write-only: `{ "<questionId>": "text", ... }` for POST body alternative |

### `POST /api/v1/user-questionnaires/:id/submit`

**Body:** `{ "answer": { "<questionId>": "...", ... } }` — upserts `Answer` rows, calls finish when all questions answered (legacy `finish()`).

**400** if incomplete answers.

### `GET /api/v1/manager/user-questionnaires/completed`

**Auth:** manager role (legacy `quests/completed/`). Paginated.

### `GET /api/v1/manager/user-questionnaires/completed/:id`

Completed instance detail (any user).

---

## Legacy route → new API (summary)

| Legacy | Method | New endpoint |
|--------|--------|----------------|
| `/api/quests/<uuid>.json` | GET | `GET /api/v1/quests/:questId` |
| `/api/quests/<uuid>.json` | PATCH | `PATCH /api/v1/quests/:questId` |
| `/api/user_quests/` | GET | `GET /api/v1/user-questionnaires?status=...` |
| `/api/user_quests/<pk>.json` | GET | `GET /api/v1/user-questionnaires/:id` |
| `/api/user_quests/<pk>.json` | POST | `POST /api/v1/user-questionnaires/:id/submit` |
| `/api/quests/completed/` | GET | `GET /api/v1/manager/user-questionnaires/completed` |
| `/api/quests/completed/<pk>/` | GET | `GET /api/v1/manager/user-questionnaires/completed/:id` |
| Teacher course quest URL | GET | `GET /api/v1/teacher/courses/:uuid/quests/students/:studentId/:postfix` |
| `/profile/certificates/` (HTML) | — | `GET /api/v1/education-certificates` (+ course list) |
| `profile_certificate` signed | GET | `GET .../public/:viewToken` |

---

## PDF / raster notes

Legacy certificates are **PNG** composited with `ImageTexter` onto a template file (`certificate.png`), stored on `materials_fs`. There is **no** PDF output in the analyzed code paths. The service should treat outputs as **raster images**; PDF export, if ever required, is a separate feature.

## Concurrency

- **Quest PATCH:** Last write wins on `answers`; completion timestamp set once when valid full answer set submitted; second PATCH should return **400** or **403** if already completed.
- **Certificate generation:** Unique logical key `(studentCourseId)` for course certs; `(studentCourseId, studentId)` for education certs — second call returns existing row unless `forceBase` / explicit regenerate flag.

---

## Out of scope (this contract)

- **Assessment** apps (`language_tests`, `user_tests`, `teacher_tests`) — assessment service only.
- **Notification** payloads for `base_course_finished` — remain **notifications-microservice** / templates; certification service only ensures certificate rows and assets exist before optional events (integration boundary in implementation).
