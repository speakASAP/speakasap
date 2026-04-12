# Phase 2 validation report (TASK-28)

**Report version:** 2026-04-12 (§3.1 F2 probe **2026-04-12**; §3.2 task-01 re-run **2026-04-12**)  
**Scope:** Program-level validation for **speakasap-certification-service** and **speakasap-assessment-service** per `SPEAKASAP_REFACTORING_PLAN.md` Phase 2.

## Executive summary

| Track | Data in target DBs | Referential integrity | Public HTTP (contract routes) |
|-------|-------------------|-------------------------|-------------------------------|
| Certification | **PASS** (non-zero volumes; see §4) | **PASS** (orphan queries = 0) | **Deferred** — see §3.1: public HTTPS vhost not cert app; host **4202** responds as cert service |
| Assessment | **PASS** | **PASS** | **Deferred** — see §3.1: HTTPS vhost + container stability |

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
| C2–C8 | Certificates, quests, questionnaires | certification `/api/v1/...` | JWT matrix not run on public HTTPS (wrong upstream); localhost cert OK for unauth gate | §3.1–**§3.2** **2026-04-12** | DEF |
| A1 | Site liveness | same host `/health` | Covered by C1 | Same as C1 | PASS |
| A2–A8 | Language + asset tests | assessment `/api/v1/...` | No stable service endpoint for JWT matrix this run | §3.1–**§3.2** **2026-04-12** | DEF |
| D1 | Certification data | `speakasap_certification_db` | Row counts | See §4 | PASS |
| D2 | Certification FKs | same | Orphan SQL from `CERTIFICATION_DATA_VALIDATION.md` | all **0** | PASS |
| D3 | Assessment data | `speakasap_assessment_db` | Row counts | See §4 | PASS |
| D4 | Assessment FKs | same | Orphan SQL from `ASSESSMENT_DATA_VALIDATION.md` | all **0** | PASS |
| D5 | `teacher_tests` exclusion | assessment DB | `pg_tables` filter `%teacher%` | **no rows** | PASS |

### §3.1 F2-HTTP-JWT smoke / routing probe (alfares, UTC **2026-04-12**)

Delegated re-run when routing is fixed: `docs/superpowers/cursor-tasks/task-01-f2-http-jwt-smoke.md` (AGENT28-style evidence; JWT redacted).

| Check | Command / observation | Result |
|-------|------------------------|--------|
| Cert HTTPS `/health` | `curl -sS -L https://speakasap-certification.statex.cz/health` | Body identifies **`auth-microservice`**, not certification-service — **wrong upstream** |
| Assess HTTPS `/health` | `curl -sS -L https://speakasap-assessment.statex.cz/health` | Same (**auth-microservice**) |
| Cert HTTPS API | `GET https://speakasap-certification.statex.cz/api/v1/course-certificates?page=1&limit=1` | **404** `Cannot GET ...` (not certification `UNAUTHORIZED` JSON) |
| Cert service local | `GET http://127.0.0.1:4202/health` (published **speakasap-certification-green**) | **200** `{"status":"ok"}` |
| Cert service local API | `GET http://127.0.0.1:4202/api/v1/course-certificates?page=1&limit=1` (no `Authorization`) | **401** `UNAUTHORIZED` / missing bearer — **expected** Nest guard |
| Assessment container | `docker ps`: **`speakasap-assessment-green`** | **`Restarting`** — no in-container `/health` for matrix until stable |

**Conclusion:** **C2–C8** and **A2–A8** remain **DEF** (prerequisite: correct HTTPS upstream + stable assessment + JWT calls not satisfied this probe). No false PASS.

### §3.2 Cursor `task-01-f2-http-jwt-smoke` re-execution (alfares, UTC **2026-04-12** ~15:57)

Same prerequisites as §3.1; outcome unchanged — **do not** set matrix PASS or tick cutover until routing + stable assessment + JWT evidence exist.

| Check | Command / observation | Result |
|-------|------------------------|--------|
| Cert HTTPS `/health` | `curl -sS -L https://speakasap-certification.statex.cz/health` | Still **`service":"auth-microservice"`** (not Nest `{ "status": "ok" }` only) |
| Assess HTTPS `/health` | `curl -sS -L https://speakasap-assessment.statex.cz/health` | Same (**auth-microservice**) |
| Cert HTTPS list (no JWT) | `GET …/api/v1/course-certificates?page=1&limit=1` | **404** (wrong upstream; not certification **401** envelope) |
| Cert local | `GET http://127.0.0.1:4202/health` | **200** `{"status":"ok"}` — **speakasap-certification-green** healthy |
| Assessment container | `docker ps`: **`speakasap-assessment-green`** | **`Restarting`** — logs: **`Missing required env vars: USER_TEST_ASSETS_DIR`** (bootstrap fails before matrix) |
| Assessment local | `GET http://127.0.0.1:4203/health` | **Connection refused** (no stable listener while restarting) |

**Conclusion:** **C2–C8** / **A2–A8** stay **DEF**. Fix: (1) service-side deploy/nginx regeneration so certification/assessment hostnames hit Nest apps; (2) set **`USER_TEST_ASSETS_DIR`** (and redeploy) for assessment-service so the container stays **Up**; then re-run JWT matrix per `docs/superpowers/cursor-tasks/task-01-f2-http-jwt-smoke.md`.

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

## Scheduled follow-up: F2-HTTP-JWT

**Index:** `SPEAKASAP_REFACTORING_TASKS_INDEX.md` — Operational follow-up (Phase 2).

**Trigger:** `certification-service` and `assessment-service` are deployed and **routed** so HTTPS reaches their `/api/v1/...` surfaces (routing produced only via standard service deploy / blue-green regeneration — no hand-edited `nginx-microservice` rules).

**Work:** Execute and evidence **§3** rows **C2–C8** and **A2–A8** (JWT-backed); change **DEF** → **PASS** in this report; complete **Deploy / smoke** in `PHASE2_CUTOVER_CHECKLIST.md`.

**2026-04-12:** Cursor ran `task-01-f2-http-jwt-smoke.md` on alfares; prerequisites still failed — see **§3.2** (not done).

**Orchestration note:** Tracked in `PHASE2_ORCHESTRATION_SUMMARY.md` § Follow-up queue. **Validator-style probe** §3.1 + Cursor handoff: `docs/superpowers/cursor-tasks/task-01-f2-http-jwt-smoke.md`.

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
