# speakasap-assessment-service

NestJS service for **adaptive language tests** (`language_tests`) and **asset-based quizzes** (`user_tests`) per `docs/refactoring/ASSESSMENT_API_CONTRACT.md`. Legacy **`teacher_tests`** are out of scope.

## Port and database

| Item | Typical value |
| ---- | ------------- |
| Listen port | **4203** (`PORT`) |
| PostgreSQL DB | **`speakasap_assessment_db`** (`DATABASE_URL`) |

## API

- **Health:** `GET /health` (no `/api/v1` prefix).
- **Versioned API:** `GET/POST/PATCH/...` under **`/api/v1`** (see contract doc).

### Highlights

- **Auth:** `Authorization: Bearer <JWT>` on protected routes; tokens validated via **`AUTH_SERVICE_URL`** → `POST /auth/validate`.
- **Staff (admin language tests):** users must have a role listed in **`ASSESSMENT_STAFF_ROLE_NAMES`** (default `admin,super_admin,staff` if unset).
- **Managers (asset list `?userId=`):** roles from **`ASSESSMENT_MANAGER_ROLE_NAMES`** (default `manager,admin,super_admin`).
- **Pagination:** `page`, `limit` (max **30**).
- **Errors:** JSON `{ error: { code, message, details } }` (same shape as content-service contract).
- **Asset JSON:** load from **`USER_TEST_ASSETS_DIR`** (e.g. `./assets`); sample `webinar1.json` / `webinar2.json` are copied into `./assets` for local use.

## Configuration

Copy `.env.example` to `.env`. Required keys include:

`PORT`, `SERVICE_NAME`, `DATABASE_URL`, logging trio, `AUTH_SERVICE_URL`, `AUTH_SERVICE_TIMEOUT`, `LANGUAGE_TEST_LANDING_BASE_URL`, `ASSESSMENT_SERVICE_PUBLIC_BASE_URL`, `ASSESSMENT_VIEW_TOKEN_SECRET`, `USER_TEST_ASSETS_DIR`.

- **`LANGUAGE_TEST_LANDING_BASE_URL`:** public site base for HTML language test entry (used for `testUrl` catalog links).
- **`ASSESSMENT_SERVICE_PUBLIC_BASE_URL`:** public base of this API (used for signed `resultUrl`).
- **`ASSESSMENT_VIEW_TOKEN_SECRET`:** HMAC secret for result view tokens.

## Prisma

Schema: `prisma/schema.prisma`. After schema changes:

```bash
npx prisma migrate dev
```

(Or apply SQL migrations in your environment.)

## Run

```bash
npm install
npm run build
npm start
```

## Verify

```bash
npm run build
curl -s http://localhost:${PORT:-4203}/health
```

## Next step

Run `docs/agents/AGENT26V_ASSESSMENT_IMPLEMENTATION_VALIDATE.md` for contract validation (PASS/FAIL).
