# User Service API Contract (design freeze — TASK-30)

**Service:** `speakasap-user-service` (port **4207** per `docs/infrastructure/PORT_ALLOCATION.md`; bind `PORT` from `.env`). **Base path:** `/api/v1`. **Health:** `GET /health` — `{ "status": "ok" }` (no prefix; same as content/certification scaffolds).

**Legacy sources (this wave):** Django apps **`students`** (`Student`), **`employees`** (`Teacher`, `Manager`, `EmployeeProfile`). See `USER_DATA_MAPPING.md` for table and field lineage.

**Auth:** **JWT from auth-microservice** on every `/api/v1/**` route unless noted. Header: `Authorization: Bearer <access_token>`. **Consumer-only:** this service validates the token by calling **`POST {AUTH_SERVICE_URL}/auth/validate`** with `{ "token": "<access_token>" }` (see auth-microservice). **Identity key:** `authUserId` = **string UUID** equal to auth-microservice **`users.id`** (JWT `sub`). Optional **`legacyPortalUserId`** (integer) = legacy **`auth_user.id`** for Portal ETL correlation (TASK-32); exposed on internal upsert payloads, omitted on public responses unless needed later. This service **does not** issue sessions, passwords, or OAuth callbacks.

**Logging:** All handlers log via shared `LOGGING_SERVICE_URL` pattern (ISO timestamps, `duration_ms` on outbound calls) — align with `user-service` scaffold.

---

## Pagination (aligned with content-service / certification-service)

Used for **every list** endpoint.

| Query param | Type | Default | Max |
|-------------|------|---------|-----|
| `page` | integer ≥ 1 | `1` | — |
| `limit` | integer ≥ 1 | from `DEFAULT_PAGE_SIZE` in `.env` | **30** (`MAX_PAGE_SIZE`, hard cap) |

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

Invalid `page` / `limit` → apply defaults; **`limit` clamped to max 30**.

**Single-resource `PATCH`:** one logical entity per request (implicit batch size **1**; field count is not paginated).

## Error format

Same global shape as **content-service** (`HttpExceptionFilter`):

```json
{
  "error": {
    "code": "BAD_REQUEST | NOT_FOUND | UNAUTHORIZED | FORBIDDEN | CONFLICT | INTERNAL_ERROR",
    "message": "Human-readable message",
    "details": {}
  }
}
```

| HTTP | `code` | Typical cause |
|------|--------|----------------|
| 400 | `BAD_REQUEST` | Validation, bad UUID/int id |
| 401 | `UNAUTHORIZED` | Missing/invalid/expired JWT |
| 403 | `FORBIDDEN` | Role mismatch (e.g. not staff) |
| 404 | `NOT_FOUND` | No row for id or “me” resource absent |
| 409 | `CONFLICT` | Unique constraint (e.g. duplicate `authUserId`) |
| 500 | `INTERNAL_ERROR` | Unhandled error |

---

## Role model (derived, not stored as Django groups)

| Role hint | Rule |
|-----------|------|
| **Self** | `authUserId` from JWT matches row `authUserId`. |
| **Staff list/read** | JWT includes a claim or scope interpreted as **SpeakASAP staff** (exact claim name frozen at TASK-31 implementation — document in OpenAPI when added). Until claim is wired, **list routes may return 403** for all non-internal callers. |

No Django `Group` replication in user-service DB.

---

## 1. Current student profile (`students.Student`)

### `GET /api/v1/students/me`

**Auth:** required. **404** if no `Student` row for `authUserId`.

**Response (`StudentProfile`):**

| Field | Type | Notes |
|-------|------|--------|
| `id` | number | Legacy `Student.id` |
| `authUserId` | string (UUID) | Auth `users.id` / JWT `sub` |
| `firstName` | string | From identity read model / mirror |
| `lastName` | string | |
| `email` | string | |
| `phone` | string | |
| `avatarUrl` | string \| null | From user image / CDN rules in `.env` |
| `interfaceLanguage` | string | Legacy `User.language` |
| `userCountry` | string | Legacy `User.country` |
| `notLoyal` | boolean | `Student.not_loyal` |
| `spamBot` | boolean | `Student.spam_bot` |
| `doNotContact` | boolean | `Student.do_not_contact` |
| `emailAdditional` | string | |
| `telegram` | string | |
| `whatsapp` | string | |
| `phoneAdditional` | string | |
| `motivation` | string | |
| `portrait` | string | Free text portrait |
| `salesInfo` | string | Staff-editable; **403** on write if not staff |
| `country` | string | Student profile country code |
| `invoiceAddress` | string | |
| `managerId` | number \| null | Legacy `employees.Manager.id` (target `managers.id`) when set |
| `readHelp` | boolean | Legacy field; may be deprecated |

### `PATCH /api/v1/students/me`

**Auth:** required. **404** if no student row.

**Body:** partial `StudentProfileUpdate` — **only** fields the legacy student self-service could change: `firstName`, `lastName`, `email`, `phone`, `interfaceLanguage`, `userCountry`, `emailAdditional`, `telegram`, `whatsapp`, `phoneAdditional`, `motivation`, `portrait`, `country`, `invoiceAddress` (and `notLoyal` / `spamBot` / `doNotContact` if product allows). **Staff-only** on `salesInfo`, `managerId`. Implementation must enforce the same permission split as legacy.

**409** if email/phone uniqueness conflicts with another user (auth-side or mirror — implementation aligns with auth-microservice rules).

**Response:** full `StudentProfile`.

### `GET /api/v1/students/:id`

**Auth:** required. **Staff** or **relationship rule** (e.g. teacher of student — future education integration): for Wave 1, **staff-only** to avoid guessing education-graph edges. **404** if not found.

### `GET /api/v1/students`

**Auth:** staff only (see Role model). Pagination `page`, `limit` (max **30**). Optional filters (implementation may add query keys later without breaking contract): `country`, `managerId`, `search` (name/email substring).

---

## 2. Current teacher profile (`employees.Teacher`)

### `GET /api/v1/teachers/me`

**Auth:** required. **404** if user is not a `Teacher`.

**Response (`TeacherProfile`):**

| Field | Type | Notes |
|-------|------|--------|
| `id` | number | Legacy `Teacher.id` |
| `authUserId` | string (UUID) | |
| `firstName` | string | |
| `lastName` | string | |
| `email` | string | |
| `phone` | string | |
| `avatarUrl` | string \| null | |
| `interfaceLanguage` | string | Derived legacy `Teacher.interface_language` |
| `userCountry` | string | From `User.country` |
| `description` | string \| null | Employee-level text |
| `position` | string | |
| `contractName` | string | Display; **not** `EmployeeContract` documents |
| `passportNumber` | string | |
| `address` | string | |
| `postalCode` | string | |
| `city` | string | |
| `addressCz` | string | |
| `cityCz` | string | |
| `languageCode` | string | Primary `Language.code` |
| `additionalLanguageCodes` | string[] | From M2M `additional_languages` |
| `russian` | boolean | |
| `native` | boolean | |
| `languageSupport` | boolean | |
| `canGetStudents` | boolean | |
| `coordinatorInfo` | string | |
| `workSince` | string (ISO date) \| null | |
| `contractEnd` | string (ISO date) \| null | Display; salary contracts live in **salary-service** |

### `PATCH /api/v1/teachers/me`

**Auth:** required; **404** if not a teacher.

**Body:** partial `TeacherProfileUpdate` — safe self fields: `description`, `coordinatorInfo`, `phone` (if policy allows self-service), `position` (if not auto-generated). **Staff-only:** `canGetStudents`, `languageCode`, `additionalLanguageCodes`, `russian`, `native`, `languageSupport`, payroll-related address blocks, `workSince`, `contractEnd`. Exact split frozen at implementation to match legacy **TeacherUpdate** / admin flows.

**Response:** full `TeacherProfile`.

### `GET /api/v1/teachers/:id`

**Auth:** required. **Staff** OR same user as `authUserId`. **404** if not found.

### `GET /api/v1/teachers`

**Auth:** staff (list) OR **authenticated teacher** with reduced payload (optional optimization — default: **staff-only** for Wave 1). Pagination; `limit` ≤ **30**. Optional `languageCode` filter.

---

## 3. Manager (`employees.Manager`)

### `GET /api/v1/managers/me`

**Auth:** required. **404** if user has no `Manager` row.

**Response (`ManagerProfile`):** subset of employee address fields + `id`, `authUserId`, `firstName`, `lastName`, `email`, `phone`, `avatarUrl` (same pattern as teacher). Managers are low-volume; **no list endpoint** in Wave 1 unless product demands it (add in later TASK with version bump).

---

## 4. Employee public profile (`employees.EmployeeProfile`)

### `GET /api/v1/employee-profiles/me`

**Auth:** required. **404** if no row.

**Response (`EmployeeProfileSummary`):**

| Field | Type | Notes |
|-------|------|--------|
| `id` | number | Legacy `EmployeeProfile.id` |
| `authUserId` | string (UUID) | |
| `additionalInfo` | string \| null | `additional_info` |
| `description` | string \| null | |
| `position` | string \| null | |

### `PATCH /api/v1/employee-profiles/me`

**Auth:** required. Body: partial `EmployeeProfileUpdate` — `additionalInfo`, `description`, `position` only (same semantics as legacy self-edit).

---

## 5. Internal / migration support (service-to-service)

All under `/api/v1/internal/…`; **separate auth:** header **`X-Internal-Token`** must equal `INTERNAL_API_TOKEN` from `.env` — **not** user JWT.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/internal/students/upsert-by-auth-user` | Idempotent upsert for **TASK-32** batch load: JSON `{ "items": [ … ] }` (each item: `authUserId` UUID string, optional `legacyPortalUserId`, student columns). **Max 30** `items`. |
| `POST` | `/api/v1/internal/teachers/upsert-by-auth-user` | Same shape for teachers; max **30** `items`. |
| `POST` | `/api/v1/internal/managers/upsert-by-auth-user` | Same; max **30** `items`. |

**429** not required; reject >30 with **400** `BAD_REQUEST`.

---

## 6. Explicitly out of scope (this contract)

- **Local login/register/password** — auth-microservice only.
- **`employees.EmployeeContract`** and **`expenses.SalaryProfile`** / payroll computations — **speakasap-salary-service** (`ROADMAP.md` §4.3).
- **Django Groups / permissions matrix** — not replicated; use JWT claims/scopes.
- **Orders, balance, transactions** — payment / orders domains.
- **Education graph** (lessons, courses) — education-service; only minimal **staff** student read in Wave 1.
- **nginx-microservice** routing — deployment scripts only.

---

## 7. Environment variables (contract surface)

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP listen |
| `SERVICE_NAME` | Logging |
| `DATABASE_URL` / `DB_*` | `speakasap_user_db` |
| `LOGGING_SERVICE_URL`, `LOGGING_SERVICE_API_PATH`, `LOGGING_SERVICE_TIMEOUT` | Central logging |
| `AUTH_SERVICE_URL`, `AUTH_SERVICE_TIMEOUT` | JWT validation / JWKS |
| `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE` | Pagination (cap **30**) |
| `INTERNAL_API_TOKEN` | Internal routes; sent as **`X-Internal-Token`** header |
| `MATERIALS_BASE_URL` or gateway avatar URL rule | Resolve `avatarUrl` if stored as relative path |

No hardcoded URLs in code — values from `.env` only.
