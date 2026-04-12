# Phase 3 Task Decomposition — Wave 2 (Course Service)

**Date:** 2026-04-12
**Lead Orchestrator:** `docs/agents/master-prompt.md`
**Summary:** `PHASE3_ORCHESTRATION_SUMMARY.md`
**Roadmap:** `ROADMAP.md` §3.1 Course Service — this wave covers **products / offers / pricing** only.

---

## Scope boundary

| In this wave | Out of scope (later Phase 3 waves) |
| ------------ | ----------------------------------- |
| `speakasap-course-service` (4205), DB `speakasap_course_db` | `speakasap-education-service` (4206), catalog, lessons, homework, groups, `course_materials` |
| Legacy: Django models `products`, `offers`, `pricing` per ROADMAP §3.1 | AI-teacher, marathon, financial billing categories (Phase 4) |
| Contract-level notes for future **education-service** consumers | Implementing or calling education-service HTTP APIs |

**Authoritative inclusion list:** ROADMAP §3.1. If `ROADMAP.md` executive tables disagree (e.g. `course_materials`), **§3.1 wins** — verify table names in `speakasap-portal` during TASK-35 / TASK-37.

**Dual-prompt rule:** TASK-34…TASK-38 each run **Implementation** then **Validator** (`AGENT{NN}V_*_VALIDATE.md`). Sync **P3-CA…P3-CE** clear on Validator **PASS** (or documented **WAIVE** with Lead sign-off).

---

## Prerequisites

- Phase 3 Wave 1 program gates closed (**TASK-33** + **`AGENT33V` PASS**).
- Ports: `docs/infrastructure/PORT_ALLOCATION.md` — **4205** / `speakasap_course_db`.

---

## Global dependency graph (Wave 2)

```text
Wave1_closed → TASK-34 → TASK-35 → TASK-36 → TASK-37 → TASK-38
```

No parallel tasks in Wave 2 (single service, serial critical path).

---

## Sync gates (Course wave)

| Sync | After | Gate |
|------|-------|------|
| P3-CA | TASK-34 + `AGENT34V` PASS | Scaffold builds; `/health`; env keys; logging bootstrap; 4205 / `speakasap_course_db` |
| P3-CB | TASK-35 + `AGENT35V` PASS | `COURSE_API_CONTRACT.md` + `COURSE_DATA_MAPPING.md` frozen |
| P3-CC | TASK-36 + `AGENT36V` PASS | HTTP handlers match frozen contract; list limits ≤ 30 |
| P3-CD | TASK-37 + `AGENT37V` PASS | ETL script + `COURSE_DATA_MIGRATION_LOG.md` / `COURSE_DATA_VALIDATION.md` |
| P3-CE | TASK-38 + `AGENT38V` PASS | `PHASE3_COURSE_VALIDATION_REPORT.md` + `PHASE3_COURSE_CUTOVER_CHECKLIST.md`; GO/NO-GO |

**Gate status (2026-04-12):** **P3-CA** PASS (`AGENT34V`). **P3-CB** PASS (`AGENT35V`). **P3-CC** PASS (`AGENT36V`). **P3-CD** PASS (`AGENT37V` — script/docs; live ETL pending operator). **P3-CE** PASS (`AGENT38V` — program validation report + cutover checklist; HTTP/deploy DEFERRED).

---

## TASK-34: Course service scaffold

**Agent:** Infra/Docker
**Implementation:** `docs/agents/AGENT34_COURSE_SERVICE_SCAFFOLD.md`
**Validator:** `docs/agents/AGENT34V_COURSE_SERVICE_SCAFFOLD_VALIDATE.md`
**Outputs:** `course-service/` (align naming with `user-service/` / `content-service/`), README, Dockerfile / compose per repo patterns. **Env:** `speakasap/.env` + `speakasap/.env.example` only (`ENV_MONOREPO.md`).

---

## TASK-35: Course service design (contract + mapping)

**Agent:** Backend (Design)
**Dependencies:** TASK-34 + P3-CA
**Implementation:** `docs/agents/AGENT35_COURSE_SERVICE_DESIGN.md`
**Validator:** `docs/agents/AGENT35V_COURSE_SERVICE_DESIGN_VALIDATE.md`
**Outputs:** `docs/refactoring/COURSE_API_CONTRACT.md`, `docs/refactoring/COURSE_DATA_MAPPING.md`, optional Prisma schema draft in service tree.

---

## TASK-36: Course service implementation

**Agent:** Backend (Implementation)
**Dependencies:** TASK-35 + P3-CB
**Implementation:** `docs/agents/AGENT36_COURSE_SERVICE_IMPLEMENTATION.md`
**Validator:** `docs/agents/AGENT36V_COURSE_SERVICE_IMPLEMENTATION_VALIDATE.md`

---

## TASK-37: Course data migration

**Agent:** Data Migration
**Dependencies:** TASK-36 + P3-CC
**Implementation:** `docs/agents/AGENT37_COURSE_SERVICE_MIGRATION.md`
**Validator:** `docs/agents/AGENT37V_COURSE_SERVICE_MIGRATION_VALIDATE.md`
**Outputs:** `course-service/scripts/` ETL (repo-standard path), migration log + validation markdown under `docs/refactoring/`.

---

## TASK-38: Course wave program validation

**Agent:** QA / Contract Validator
**Dependencies:** TASK-37 + P3-CD
**Implementation:** `docs/agents/AGENT38_COURSE_PHASE3_VALIDATION.md`
**Validator:** `docs/agents/AGENT38V_COURSE_PHASE3_VALIDATION_VALIDATE.md`
**Outputs:** `PHASE3_COURSE_VALIDATION_REPORT.md`, `PHASE3_COURSE_CUTOVER_CHECKLIST.md`

---

## Wave 3 (education-service)

Decomposition, sync gates **P3-EA…P3-EE**, and TASK-39…TASK-43 prompts: **`PHASE3_WAVE3_EDUCATION_TASK_DECOMPOSITION.md`**. Start only after **P3-CE** PASS.
