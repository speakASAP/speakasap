# Education Service API Contract (Phase 3 Wave 3)

**Service:** `speakasap-education-service` — port **4206** (from `EDUCATION_SERVICE_PORT`). **Base path:** `/api/v1`. **Health:** `GET /health` (no version prefix).

**Auth:** `Authorization: Bearer <access_token>` from **auth-microservice** on all `/api/v1/**` routes unless noted.

**Pagination:** Query `page` (default 1), `limit` (default from `DEFAULT_PAGE_SIZE`, max **30** via `MAX_PAGE_SIZE`). List responses:

```json
{
  "items": [],
  "page": 1,
  "limit": 10,
  "total": 0,
  "nextPage": null,
  "prevPage": null
}
```

**Errors:** JSON `{ "error": { "code": "...", "message": "...", "details": {} } }` (aligned with other speakasap Nest services).

**Staff gate (MVP):** List/detail routes below require **staff/manager/admin** access derived from auth validate payload (`userType` or `roles`). **403** if JWT valid but user is not staff. Future waves add learner/teacher-scoped routes without this gate.

**Out of scope (this contract revision):** `marathon` domain; payment/order execution; full AI-teacher orchestration (separate endpoints will reference **ai-microservice** HTTP only). Commercial product context uses **`legacyProductId` / offer UUID** from **course-service** per `COURSE_API_CONTRACT.md` — education stores **course codes / module class strings** as migrated from legacy, not duplicate product rows.

---

## Groups

### `GET /api/v1/groups`

Staff. Paginated list of learning groups.

**Response item fields:**

| Field | Type | Description |
| ----- | ---- | ----------- |
| uuid | string (UUID) | Primary key |
| title | string | Group title |
| createdAt | string (ISO 8601) | Legacy `created` |
| studentCount | number | Count of `education_group_students` |
| studentCourseCount | number | Count of `education_studentcourse` in group |

### `GET /api/v1/groups/:uuid`

Staff. Group detail with capped membership lists (max **30** each).

**Response:**

| Field | Type |
| ----- | ---- |
| uuid | string |
| title | string |
| createdAt | string |
| studentIds | number[] | Legacy `students.models.Student` PK |
| studentCourseUuids | string[] | Student course UUIDs |

**404** if not found.

---

## Student courses

### `GET /api/v1/student-courses`

Staff. Paginated list (all instances).

**Response item:** `uuid`, `courseClass`, `courseDisplayTitle`, `createdAt`, `groupUuid`, `groupTitle`, `isFinished`, `isPaused`.

### `GET /api/v1/student-courses/:uuid`

Staff. Full detail for one `StudentCourse`.

**404** if not found.

---

## Lessons

### `GET /api/v1/lessons`

Staff. **Required query:** `studentCourseUuid=<uuid>`. Paginated lessons for that student course ordered by `order` ascending.

**400** if `studentCourseUuid` missing.

### `GET /api/v1/lessons/:uuid`

Staff. Lesson detail including `groupUuid` (via student course).

**404** if not found.

---

## Homeworks

### `GET /api/v1/homeworks`

Staff. **Required query:** `lessonUuid=<uuid>`. Paginated homework rows for that lesson.

**400** if `lessonUuid` missing.

### `GET /api/v1/homeworks/:uuid`

Staff. Homework detail (includes `contentStudent` / `contentTeacher`).

**404** if not found.

---

## Cross-service identifiers

- **`studentId`:** Legacy portal integer from `students_student.id`. Resolve to **`authUserId`** via **user-service** / `USER_API_CONTRACT.md` where needed.
- **`studentCourseUuid`:** Matches certification contract **`studentCourseId`** string form when both refer to the same legacy row.
- **Course commercial context:** Use **course-service** HTTP APIs; do not join `speakasap_course_db` from education DB.

---

## AI-teacher (reserved)

Future `POST /api/v1/ai-teacher/...` routes will proxy or compose **ai-microservice** only; no schema in this document until TASK extension approved by Lead.
