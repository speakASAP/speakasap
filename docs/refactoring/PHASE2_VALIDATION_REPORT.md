# Phase 2 validation report (TASK-28)

**Report version:** 2026-04-12  
**Scope:** Program-level validation for **speakasap-certification-service** (4202 / `speakasap_certification_db`) and **speakasap-assessment-service** (4203 / `speakasap_assessment_db`) per `SPEAKASAP_REFACTORING_PLAN.md` Phase 2.

## Executive summary

| Track | Engineering / repo readiness | Production data + HTTP E2E |
|-------|-------------------------------|-----------------------------|
| Certification | PASS (contracts, implementation, migration tooling) | **Data path PASS** — ETL + target SQL validation on **alfares** `db-server-postgres` **2026-04-12** (repo `e59272f` on server). **HTTP E2E** matrix rows still **pending**. |
| Assessment | PASS (contracts, implementation, migration tooling; `teacher_tests` excluded) | **Data path PASS** — same date/host; **HTTP E2E** pending. |

**Cutover authorization:** **NO-GO** for full cutover until **HTTP E2E** evidence is recorded (§ parity matrix). **B1** and **B2** (data path) are **cleared 2026-04-12** — see § Data path evidence and blocking table.

**Portal shim:** No code change required for standalone services — see `PHASE2_PORTAL_SHIM.md`.

---

## Prior gates (TASK-21…TASK-27)

| Task | Implementation | Validator | Gate / date |
|------|----------------|------------|----------------|
| TASK-21 | Done | AGENT21V PASS | P2-A — 2026-04-10 |
| TASK-22 | Done | AGENT22V PASS | P2-B — 2026-04-11 |
| TASK-25 | Done | AGENT25V PASS | P2-B — 2026-04-11 |
| TASK-23 | Done | AGENT23V PASS | P2-C — 2026-04-11 |
| TASK-26 | Done | AGENT26V PASS | P2-C — 2026-04-11 |
| TASK-24 | Done | AGENT24V PASS (artifact review) | P2-D — 2026-04-11 |
| TASK-27 | Done | AGENT27V PASS (artifact review) | P2-D — 2026-04-11 |

---

## E2E parity matrix (legacy → new API)

Run each row in **staging or production** after data import and service deploy. Record **HTTP**, **ISO timestamp**, and **snippet** (first 200 chars of JSON or error envelope).

| # | Legacy (speakasap-portal) | New service | Method + path (prefix `/api/v1` unless `/health`) | Evidence status |
|---|---------------------------|-------------|-----------------------------------------------------|-------------------|
| C1 | `GET /health` (implicit) | certification | `GET /health` | Pending |
| C2 | Course certs cabinet | certification | `GET /course-certificates?page=1&limit=10` (JWT) | Pending |
| C3 | Signed public cert | certification | `GET /course-certificates/public/:viewToken` | Pending |
| C4 | Group certs | certification | `GET /education-certificates` (JWT) | Pending |
| C5 | Quest JSON | certification | `GET /quests/:uuid` (JWT) | Pending |
| C6 | Quest submit | certification | `PATCH /quests/:uuid` (JWT) | Pending |
| C7 | Questionnaires catalog | certification | `GET /questionnaires` | Pending |
| C8 | User questionnaire | certification | `GET /user-questionnaires`, `POST .../:id/submit` | Pending |
| A1 | `GET /health` | assessment | `GET /health` | Pending |
| A2 | Start language test | assessment | `POST /language-user-tests` body `{ languageCode, tag }` | Pending |
| A3 | Current question | assessment | `GET /language-user-tests/:id/current-question` | Pending |
| A4 | Submit answers | assessment | `PATCH /language-user-tests/questions/:userQuestionId` | Pending |
| A5 | Result by token | assessment | `GET /language-user-tests/results/:viewToken` | Pending |
| A6 | Admin catalog | assessment | `GET /admin/language-tests` (staff JWT) | Pending |
| A7 | Asset quiz list | assessment | `GET /asset-user-tests` | Pending |
| A8 | Asset quiz patch | assessment | `PATCH /asset-user-tests/:uuid` | Pending |

**Rules checked in code review (not a substitute for row execution):** pagination cap ≤ 30; env-only config; logging client present; no edits to forbidden shared microservice repos; assessment codepath excludes `teacher_tests`.

---

## Repository / build evidence (workspace)

| Service | Command | Result |
|---------|---------|--------|
| certification-service | `npm run build` | PASS (local agent run) |
| assessment-service | `npm run build` | PASS (local agent run) |

---

## Data path evidence

| Step | Status | Notes |
|------|--------|--------|
| `npx prisma migrate deploy` on both targets | **PASS** (pre-ETL) | Required before import; operator path in migration logs. |
| `migrate-certification-from-legacy.py` | **PASS** | Full run **2026-04-12** (operator workstation + SSH tunnels); `CERTIFICATION_DATA_MIGRATION_LOG.md`. |
| `migrate-assessment-from-legacy.py` | **PASS** | Same; M2M `execute_batch`; `ASSESSMENT_DATA_MIGRATION_LOG.md`. |
| SQL in `CERTIFICATION_DATA_VALIDATION.md` / `ASSESSMENT_DATA_VALIDATION.md` | **PASS (target)** | **2026-04-12** — `ssh alfares` + `docker exec db-server-postgres psql` on both DBs: counts, orphan checks, certification no `%language%` tables, assessment teacher pattern + orphans. |

**Target counts (alfares, 2026-04-12):** Certification — `CourseCertificate` 1694, `EducationCertificate` 2978, `QuestInstance` 704, `Questionnaire` 1, `QuestionnaireQuestion` 55, `UserQuestionnaire` 31, `UserQuestionnaireAnswer` 1320. Assessment — `LanguageUserTest` 9669, `LanguageUserTestQuestion` 116087, `LanguageUserTestQuestionAnswer` 106324, `AssetUserTest` 389.

**Variance (documented):** `CourseCertificate` 1694 vs 1695 legacy rows (duplicate `studentCourseId`). `EducationCertificate` 2978 vs 2985 (duplicate `(student_course_id, student_id)`). See `CERTIFICATION_DATA_MIGRATION_LOG.md` (2026-04-12).

---

## Blocking defects (cutover)

| ID | Item | Owner |
|----|------|-------|
| ~~B1~~ | Legacy Postgres for ETL | **Resolved 2026-04-12** — operator Mac: tunnels to `speakasap` + alfares Postgres; host override for `TARGET_DATABASE_URL`. Alfares shell lacks `speakasap` SSH alias unless configured. |
| ~~B2~~ | ETL + parity / variance | **Resolved 2026-04-12** — imports done; counts + orphan SQL above. |
| **B3** | **HTTP E2E** (§ parity matrix) | QA / operator |

## Non-blocking

- `.env` operational hygiene: quote values that contain spaces (see `.env.example` in both services for `LOG_TIMESTAMP_FORMAT` example comment).
- Prisma CLI upgrade notices.

---

## AGENT28V meta-validation (P2-E)

Per `docs/agents/AGENT28V_PHASE2_VALIDATION_VALIDATE.md`:

| Criterion | Result |
|-----------|--------|
| Prior gates table | Satisfied |
| Validation report: E2E matrix present | Satisfied (evidence rows **pending**) |
| GO vs blocking consistency | **NO-GO** for full cutover; **B3** (HTTP E2E) open — **B1–B2 closed 2026-04-12** |
| Cutover checklist | `PHASE2_CUTOVER_CHECKLIST.md` present with order, rollback, sign-off |
| Portal shim | `PHASE2_PORTAL_SHIM.md` present; “no portal change” explained |
| `teacher_tests` | Excluded from assessment scope |

**Meta-verdict: FAIL (HTTP gate)** — Data path evidence and SQL attached **2026-04-12**; P2-E still cannot **PASS** until **B3** is cleared (§ E2E parity matrix: timestamps + HTTP status + JSON snippets).

**Return to:** `docs/agents/AGENT28_PHASE2_VALIDATION.md` after HTTP smoke on deployed 4202/4203 (or document **WAIVE** with Lead Orchestrator sign-off).
