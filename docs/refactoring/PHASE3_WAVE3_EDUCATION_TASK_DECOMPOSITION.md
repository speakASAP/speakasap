# Phase 3 Task Decomposition — Wave 3 (Education Service)

**Date:** 2026-04-12
**Lead Orchestrator:** `docs/agents/master-prompt.md`
**Summary:** `PHASE3_ORCHESTRATION_SUMMARY.md`
**Roadmap:** `ROADMAP.md` §3.2 Education Service — legacy Django app **`education`** (catalog, structure, lessons, homework, groups, student courses, **`course_materials`**, seven, mini, native). Obsolete **`courses`** app consolidated here per ROADMAP.

---

## Scope boundary

| In this wave | Out of scope |
| ------------ | ------------- |
| `speakasap-education-service` (4206), DB `speakasap_education_db` | **`marathon`** app — separate marathon product/service |
| Legacy: `education` models/tables per ROADMAP §3.2 | Payment execution, orders domain (Phase 4 / `speakasap-payment-service`) |
| AI-teacher integration **via** `ai-microservice` (contract + HTTP client patterns in this service) | Changing `ai-microservice` implementation |
| Consumer use of frozen **`COURSE_API_CONTRACT.md`** (product/offer IDs, resolution rules) | Re-opening Wave 2 product catalog scope without Lead sign-off |
| Consumer use of **`USER_API_CONTRACT.md`** / **`USER_DATA_MAPPING.md`** for `authUserId`, student/teacher IDs | Re-migrating Wave 1 user tables in this wave |

**Authoritative inclusion list:** `ROADMAP.md` §3.2 and service description §2 (education-service). Verify actual legacy table names in `speakasap-portal` during TASK-40 / TASK-42.

**Dual-prompt rule:** TASK-39…TASK-43 each run **Implementation** then **Validator** (`AGENT{NN}V_*_VALIDATE.md`). Sync **P3-EA…P3-EE** clear on Validator **PASS** (or documented **WAIVE** with Lead sign-off).

---

## Prerequisites

- Phase 3 Wave 2 program gates closed (**TASK-38** + **`AGENT38V` PASS**, **P3-CE**).
- Frozen **`COURSE_API_CONTRACT.md`** + **`COURSE_DATA_MAPPING.md`** for referencing `legacyProductId`, offers, categories as needed.
- Wave1 **`USER_API_CONTRACT.md`** available for identity resolution rules.
- Ports: `docs/infrastructure/PORT_ALLOCATION.md` — **4206** / `speakasap_education_db`.

---

## Global dependency graph (Wave 3)

```text
Wave2_closed → TASK-39 → TASK-40 → TASK-41 → TASK-42 → TASK-43
```

No parallel tasks in Wave 3 (single service, serial critical path).

---

## Sync gates (Education wave)

| Sync | After | Gate |
|------|-------|------|
| P3-EA | TASK-39 + `AGENT39V` PASS | Scaffold builds; `/health`; env keys; logging bootstrap; 4206 / `speakasap_education_db` |
| P3-EB | TASK-40 + `AGENT40V` PASS | `EDUCATION_API_CONTRACT.md` + `EDUCATION_DATA_MAPPING.md` frozen |
| P3-EC | TASK-41 + `AGENT41V` PASS | HTTP handlers match frozen contract; list limits ≤ 30 |
| P3-ED | TASK-42 + `AGENT42V` PASS | ETL script + `EDUCATION_DATA_MIGRATION_LOG.md` / `EDUCATION_DATA_VALIDATION.md` |
| P3-EE | TASK-43 + `AGENT43V` PASS | `PHASE3_EDUCATION_VALIDATION_REPORT.md` + `PHASE3_EDUCATION_CUTOVER_CHECKLIST.md`; GO/NO-GO |

**Gate status:** **Pending execution** — clear each gate only after the corresponding Validator **PASS**.

---

## TASK-39: Education service scaffold

**Agent:** Infra/Docker
**Implementation:** `docs/agents/AGENT39_EDUCATION_SERVICE_SCAFFOLD.md`
**Validator:** `docs/agents/AGENT39V_EDUCATION_SERVICE_SCAFFOLD_VALIDATE.md`
**Outputs:** `education-service/` (align naming with `course-service/` / `user-service/`), README, Dockerfile / compose per repo patterns. **Env:** `speakasap/.env` + `speakasap/.env.example` only (`ENV_MONOREPO.md`).

---

## TASK-40: Education service design (contract + mapping)

**Agent:** Backend (Design)
**Dependencies:** TASK-39 + P3-EA
**Implementation:** `docs/agents/AGENT40_EDUCATION_SERVICE_DESIGN.md`
**Validator:** `docs/agents/AGENT40V_EDUCATION_SERVICE_DESIGN_VALIDATE.md`
**Outputs:** `docs/refactoring/EDUCATION_API_CONTRACT.md`, `docs/refactoring/EDUCATION_DATA_MAPPING.md`, optional Prisma schema draft in service tree.

---

## TASK-41: Education service implementation

**Agent:** Backend (Implementation)
**Dependencies:** TASK-40 + P3-EB
**Implementation:** `docs/agents/AGENT41_EDUCATION_SERVICE_IMPLEMENTATION.md`
**Validator:** `docs/agents/AGENT41V_EDUCATION_SERVICE_IMPLEMENTATION_VALIDATE.md`

---

## TASK-42: Education data migration

**Agent:** Data Migration
**Dependencies:** TASK-41 + P3-EC
**Implementation:** `docs/agents/AGENT42_EDUCATION_SERVICE_MIGRATION.md`
**Validator:** `docs/agents/AGENT42V_EDUCATION_SERVICE_MIGRATION_VALIDATE.md`
**Outputs:** `education-service/scripts/` ETL (repo-standard path), `EDUCATION_DATA_MIGRATION_LOG.md` + `EDUCATION_DATA_VALIDATION.md` under `docs/refactoring/`.

---

## TASK-43: Education wave program validation

**Agent:** QA / Contract Validator
**Dependencies:** TASK-42 + P3-ED
**Implementation:** `docs/agents/AGENT43_EDUCATION_PHASE3_VALIDATION.md`
**Validator:** `docs/agents/AGENT43V_EDUCATION_PHASE3_VALIDATION_VALIDATE.md`
**Outputs:** `PHASE3_EDUCATION_VALIDATION_REPORT.md`, `PHASE3_EDUCATION_CUTOVER_CHECKLIST.md`

---

## Cross-service references (must stay HTTP-only)

- **course-service:** resolve commercial product/offer context using frozen course contract fields; no cross-DB joins.
- **user-service:** JWT subject / `authUserId` and student/teacher identifiers per `USER_API_CONTRACT.md`.
- **ai-microservice:** AI-teacher features per contract; no shared DB.
- **certification-service / assessment-service:** existing contracts may reference `studentCourseId` and education aggregates — align ID formats in `EDUCATION_API_CONTRACT.md` with `CERTIFICATION_API_CONTRACT.md` / assessment docs where applicable.
