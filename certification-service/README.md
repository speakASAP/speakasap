# speakasap-certification-service

NestJS service for certification, quests, and user questionnaires extracted from `speakasap-portal`, implemented against the frozen contract in `speakasap/docs/refactoring/CERTIFICATION_API_CONTRACT.md`.

## Port and database

| Item | Value |
| ---- | ----- |
| Default port | **4202** |
| PostgreSQL database | **`speakasap_certification_db`** (via `DATABASE_URL`) |

See `speakasap/docs/infrastructure/PORT_ALLOCATION.md`.

## Health

- **GET** `/health` — `{ "status": "ok" }` (no `/api/v1` prefix).

## API (`/api/v1`)

All routes below are under the global prefix **`/api/v1`** except `/health`. Authenticated routes expect **`Authorization: Bearer <access_token>`** from **auth-microservice** (shared **`JWT_SECRET`** for HS256 verification).

Pagination matches **content-service**: `page`, `limit`; `limit` is clamped to **`MAX_PAGE_SIZE` (≤ 30)**.

### Course certificates (`certificates` legacy app)

| Method | Path | Auth |
| ------ | ---- | ---- |
| GET | `/course-certificates` | JWT (owner list) |
| GET | `/course-certificates/:id` | JWT (owner) |
| GET | `/course-certificates/public/:viewToken` | Public |
| POST | `/internal/course-certificates/generate` | `X-Internal-Api-Key` |

### Group education certificates

| Method | Path | Auth |
| ------ | ---- | ---- |
| GET | `/education-certificates` | JWT |
| GET | `/education-certificates/:id` | JWT (owner or teacher/manager “staff”) |
| GET | `/education-certificates/public/:viewToken` | Public |
| POST | `/internal/education-certificates/generate` | `X-Internal-Api-Key` |

### Quests

| Method | Path | Auth |
| ------ | ---- | ---- |
| GET | `/quests/:questId` | JWT (owner; teacher/manager read) |
| PATCH | `/quests/:questId` | JWT (owner only; 403 if already completed) |
| GET | `/teacher/courses/:studentCourseUuid/quests/students/:studentId/:postfix` | JWT, **portal teacher** role only (`teacher_strict`, legacy `TeacherRequired` parity) |

### Questionnaires / user questionnaires

| Method | Path | Auth |
| ------ | ---- | ---- |
| GET | `/questionnaires` | JWT |
| GET | `/questionnaires/:id` | JWT |
| GET | `/user-questionnaires?status=incomplete\|completed` | JWT (optional `userId=` for managers on completed-style policy) |
| GET | `/user-questionnaires/:id` | JWT (incomplete, owner only) |
| POST | `/user-questionnaires/:id/submit` | JWT |
| GET | `/manager/user-questionnaires/completed` | JWT, manager |
| GET | `/manager/user-questionnaires/completed/:id` | JWT, manager |

## Configuration

Copy `.env.example` to `.env`. Required keys:

`PORT`, `SERVICE_NAME`, `DATABASE_URL`, `LOGGING_SERVICE_URL`, `LOGGING_SERVICE_API_PATH`, `LOGGING_SERVICE_TIMEOUT`, `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE` (≤ 30), `JWT_SECRET`, `CERT_VIEW_TOKEN_SECRET`, `MATERIALS_PUBLIC_BASE_URL`, `INTERNAL_API_KEY`.

- **`MATERIALS_PUBLIC_BASE_URL`**: base URL used with stored relative `imagePath` to build `imageUrl` in API responses.
- **`INTERNAL_API_KEY`**: required for `POST /internal/.../generate` routes (`X-Internal-Api-Key` header).

## Database

```bash
npx prisma migrate deploy
```

(Or `npm run prisma:migrate` during development.)

## Local run

```bash
npm install
npm run build
npm start
```

Docker (this directory):

```bash
docker compose up --build
```

## Error shape

HTTP errors follow **content-service** style: `{ "error": { "code", "message", "details" } }`.

## References

- `speakasap/docs/refactoring/CERTIFICATION_API_CONTRACT.md`
- `speakasap/docs/refactoring/CERTIFICATION_DATA_MAPPING.md`
- `speakasap/docs/infrastructure/SHARED_SERVICES.md`

## Next

Validator checklist: `speakasap/docs/agents/AGENT23V_CERTIFICATION_IMPLEMENTATION_VALIDATE.md`.
