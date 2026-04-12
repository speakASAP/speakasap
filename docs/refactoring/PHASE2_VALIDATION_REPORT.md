# Phase 2 validation report (TASK-28)

**Report version:** 2026-04-12  
**Scope:** Program-level validation for **speakasap-certification-service** and **speakasap-assessment-service** per `SPEAKASAP_REFACTORING_PLAN.md` Phase 2.

## Executive summary

| Track | Data in target DBs | Referential integrity | Public HTTP (contract routes) |
|-------|-------------------|-------------------------|-------------------------------|
| Certification | **PASS** (non-zero volumes; see §4) | **PASS** (orphan queries = 0) | **Deferred** — dedicated service not exposed on `nginx-network` under this run; edge `/health` only |
| Assessment | **PASS** | **PASS** | **Deferred** (same) |

**Program decision:** **GO** for **Phase 2 data migration and integrity** on production Postgres (`db-server-postgres`). **Follow-up (non-blocking):** deploy certification/assessment containers and complete the HTTP E2E rows in §3 once routes exist.

---

## Prior gates (TASK-21…TASK-27)

| Task | Implementation | Validator | Gate / date |
|------|----------------|------------|----------------|
| TASK-21 | Done | AGENT21V PASS | P2-A — 2026-04-10 |
| TASK-22 | Done | AGENT22V PASS | P2-B — 2026-04-11 |
| TASK-25 | Done | AGENT25V PASS | P2-B — 2026-04-11 |
| TASK-23 | Done | AGENT23V PASS | P2-C — 2026-04-11 |
| TASK-26 | Done | AGENT26V PASS | P2-C — 2026-04-11 |
| TASK-24 | Done | AGENT24V PASS | P2-D — 2026-04-11 |
| TASK-27 | Done | AGENT27V PASS | P2-D — 2026-04-11 |

---

## §3 E2E parity matrix

**Legend:** `PASS` = executed with evidence this run. `DEF` = deferred pending service route / container.

| # | Legacy area | New surface | Check performed | Evidence (UTC **2026-04-12** where noted) | Result |
|---|-------------|-------------|-----------------|---------------------------------------------|--------|
| C1 | Site liveness | `speakasap.statex.cz` | `GET /health` | HTTP **200**, body `{"status":"ok"}` (curl from **alfares**) | PASS |
| C2–C8 | Certificates, quests, questionnaires | certification `/api/v1/...` | Not publicly routed in this check | Requires cert container + nginx route | DEF |
| A1 | Site liveness | same host `/health` | Covered by C1 | Same as C1 | PASS |
| A2–A8 | Language + asset tests | assessment `/api/v1/...` | Not publicly routed | Requires assessment container + nginx route | DEF |
| D1 | Certification data | `speakasap_certification_db` | Row counts | See §4 | PASS |
| D2 | Certification FKs | same | Orphan SQL from `CERTIFICATION_DATA_VALIDATION.md` | all **0** | PASS |
| D3 | Assessment data | `speakasap_assessment_db` | Row counts | See §4 | PASS |
| D4 | Assessment FKs | same | Orphan SQL from `ASSESSMENT_DATA_VALIDATION.md` | all **0** | PASS |
| D5 | `teacher_tests` exclusion | assessment DB | `pg_tables` filter `%teacher%` | **no rows** | PASS |

---

## §4 Production database evidence (alfares)

Commands run via **`ssh alfares`** → **`docker exec db-server-postgres psql -U dbadmin -d <db>`** (timestamps in DB are migration history; live counts below).

### Prisma migrations (certification)

Latest applied migrations include `20260411203000_student_course_uuid_string` (UUID string `studentCourseId` alignment).

### Row counts — `speakasap_certification_db`

| Table | Count |
|-------|------:|
| `CourseCertificate` | 1694 |
| `EducationCertificate` | 2978 |
| `QuestInstance` | 704 |
| `Questionnaire` | 1 |

### Row counts — `speakasap_assessment_db`

| Table | Count |
|-------|------:|
| `LanguageTest` | 1 |
| `LanguageUserTest` | 9669 |
| `AssetUserTest` | 389 |

### Orphan checks — certification (all must be 0)

- `UserQuestionnaireAnswer` without parent `UserQuestionnaire` → **0**
- `UserQuestionnaire` without `Questionnaire` → **0**
- `QuestionnaireQuestion` without `Questionnaire` → **0**

### Orphan checks — assessment (all must be 0)

- `LanguageUserTest` without `LanguageTest` → **0**
- `LanguageUserTestQuestion` without `LanguageUserTest` → **0**

---

## Blocking defects

**None** for data migration and integrity on the evaluated production databases.

---

## Non-blocking follow-ups

1. **HTTP contract smoke:** When `certification-service` / `assessment-service` containers are on `nginx-network` and HTTPS routes are active, fill **C2–C8** and **A2–A8** with real JWT-backed requests and paste redacted snippets.
2. **Legacy vs target count parity:** Optional strict row-for-row reconciliation with legacy `portal_db` (run queries from `CERTIFICATION_DATA_VALIDATION.md` / `ASSESSMENT_DATA_VALIDATION.md` against legacy when connected read-only).

---

## Portal shim

`PHASE2_PORTAL_SHIM.md` — no portal code required for standalone services; adapters remain optional on `speakasap2.0`.

---

## AGENT28V meta-validation (P2-E)

Per `docs/agents/AGENT28V_PHASE2_VALIDATION_VALIDATE.md`:

| Criterion | Result |
|-----------|--------|
| TASK-21…TASK-27 + validators | Satisfied (table above) |
| Structured evidence | §3 matrix + §4 DB metrics + orphan SQL |
| GO vs blocking | **GO**; no open blocking items |
| Cutover checklist | `PHASE2_CUTOVER_CHECKLIST.md` updated for operator execution |
| Portal shim doc | Present |
| `teacher_tests` | No tables in assessment DB (`D5`) |

**Meta-verdict: PASS** — **Sync P2-E complete** for data and integrity; HTTP route smoke remains documented follow-up.
