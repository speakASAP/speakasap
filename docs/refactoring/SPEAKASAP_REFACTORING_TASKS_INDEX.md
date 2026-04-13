# SpeakASAP Refactoring - Tasks Index

This index lists the agent tasks for the SpeakASAP refactoring program. Each task has a dedicated agent prompt in `docs/agents/`.

**Lead orchestrator:** `docs/agents/master-prompt.md` (Phase 0–2 closed **2026-04-12**; **Phase 3** waves 1–3 closed **2026-04-12** — engineering **GO**; deploy/HTTP smoke **DEFERRED** operator where noted). **Phase 4** (**TASK-44…TASK-63**) **opened** **2026-04-13** — **Payment wave** **P4-OA…P4-OE** **PASS** **2026-04-13** (`PHASE4_PAYMENT_VALIDATION_REPORT.md`, `AGENT48V`); remaining gates **P4-NA…P4-FE** **open** until corresponding validators **PASS**; see `PHASE4_TASK_DECOMPOSITION.md`, `PHASE4_ORCHESTRATION_SUMMARY.md`.

## Task Structure

Each task file contains:

- Status and objective
- Inputs and dependencies
- Implementation steps
- Outputs and acceptance criteria

## Orchestration (Phase 0) — ✅ Complete

Global dependency graph:

```text
Phase 0 (Marathon) → Phase 1+ (per ROADMAP)
```

Task groups (historical parallel batches):

- Contract + Data: TASK-01, TASK-03 (parallel after TASK-01 starts)
- Infra: TASK-04 (depends on TASK-01)
- Integration: TASK-02 (depends on TASK-01)
- Validation: TASK-05 (depends on TASK-01 through TASK-04)

Sync points are documented in:

- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`
- `docs/refactoring/MARATHON_PHASE0_VALIDATION.md`

## Orchestration (Phase 1) — ✅ Complete (2026-04-10)

Global dependency graph (historical):

```text
Phase 0 (complete) → Phase 1 (Foundation + Content Service) ✅
TASK-11 → TASK-12 → TASK-13 → (TASK-14 ∥ TASK-15) → TASK-16
```

Parallel batches (executed):

- **After TASK-11:** TASK-12 only (contract freeze = Sync B prerequisite).
- **After TASK-12:** TASK-13 (implementation).
- **After TASK-13:** TASK-14 and TASK-15 **in parallel** (migration vs AI integration).
- **After TASK-11…TASK-15:** TASK-16 (validation / cutover GO). **Sync D closed 2026-04-10.**

Docs: `PHASE1_TASK_DECOMPOSITION.md`, `PHASE1_ORCHESTRATION_SUMMARY.md`, `PHASE1_COMPLETION_SUMMARY.md`.

## Phase 0: Marathon Extraction (complete)

Note: `marathon` is a standalone product in `/Users/sergiystashok/Documents/GitHub/marathon` with repo `git@github.com:speakASAP/marathon.git`.

Phase 0 outputs:

- `docs/refactoring/MARATHON_API_CONTRACT.md`
- `docs/refactoring/MARATHON_DATA_MAPPING.md`
- `docs/refactoring/MARATHON_INFRA_PLAN.md`
- `docs/refactoring/MARATHON_PHASE0_VALIDATION.md`

## Phase 0 Completion

**Status:** ✅ Complete

**Completion Checklist:** `docs/refactoring/PHASE0_COMPLETION_CHECKLIST.md`

**Remaining Items:** None (Phase 0 closed; Phase 1 complete — proceed with Phase 2 per `master-prompt.md`).

---

## Phase 1: Foundation & Infrastructure - Content Service

**Status:** ✅ **Complete** (Lead Orchestrator sign-off **2026-04-10**). Evidence: `PHASE1_VALIDATION_REPORT.md` (GO), `PHASE1_COMPLETION_SUMMARY.md`, `CONTENT_CUTOVER_CHECKLIST.md` (validation gate).

**Task Decomposition:** `docs/refactoring/PHASE1_TASK_DECOMPOSITION.md`

**Scope:**

- Infrastructure setup and foundation
- Content Service extraction (read-only)
- AI microservice integration
- Notifications-microservice integration

**Task Groups:**

- Group A: Infrastructure Setup (TASK-11) — sequential
- Group B: Content Service — TASK-12 → TASK-13 → (TASK-14 ∥ TASK-15)
- Group C: Validation (TASK-16) — after TASK-11…TASK-15

### TASK-11: Project Setup and Infrastructure Foundation

- **Prompt**: `docs/agents/AGENT11_INFRA_SETUP.md`
- **Status**: ✅ Complete
- **Dependencies**: Phase 0 completion
- **Agent Type**: Infra/Docker Agent

### TASK-12: Content Service Design and API Contract

- **Prompt**: `docs/agents/AGENT12_CONTENT_DESIGN.md`
- **Status**: ✅ Complete — **Lead Orchestrator GO 2026-04-09** (see sign-off in prompt)
- **Dependencies**: TASK-11
- **Agent Type**: Backend Service Agent (Design)

### TASK-13: Content Service Implementation

- **Prompt**: `docs/agents/AGENT13_CONTENT_IMPLEMENTATION.md`
- **Status**: ✅ Complete
- **Dependencies**: TASK-11, TASK-12
- **Agent Type**: Backend Service Agent (Implementation)

### TASK-14: Content Data Migration

- **Prompt**: `docs/agents/AGENT14_CONTENT_MIGRATION.md`
- **Status**: ✅ Complete
- **Dependencies**: TASK-12, TASK-13
- **Agent Type**: Data Migration Agent

### TASK-15: AI Microservice Integration

- **Prompt**: `docs/agents/AGENT15_AI_INTEGRATION.md`
- **Status**: ✅ Complete
- **Dependencies**: TASK-12, TASK-13
- **Agent Type**: Integration Adapter Agent

### TASK-16: Phase 1 Validation and Cutover Checklist

- **Prompt**: `docs/agents/AGENT16_PHASE1_VALIDATION.md`
- **Status**: ✅ Complete (Phase 1 GO **2026-04-10**)
- **Dependencies**: TASK-11 through TASK-15
- **Agent Type**: QA/Contract Validator Agent

---

## Orchestration (Phase 2) — Complete (reference)

**Prerequisite:** ✅ Phase 1 complete — TASK-16 **GO** and Lead Orchestrator sign-off **2026-04-10** (`PHASE1_VALIDATION_REPORT.md`, `PHASE1_COMPLETION_SUMMARY.md`).

**Dual prompts:** Each task has an **Implementation** prompt and a **Validator** prompt (`AGENT{NN}V_*_VALIDATE.md`). Run Validator after Implementation; sync gates require Validator **PASS**.

Global dependency graph:

```text
Phase1_GO → TASK-21 → TASK-22 ∥ TASK-25
TASK-22 → TASK-23 → TASK-24
TASK-25 → TASK-26 → TASK-27
(TASK-24 ∥ TASK-27 only if parallelism gate in PHASE2_TASK_DECOMPOSITION.md is satisfied)
TASK-24 + TASK-27 → TASK-28
```

Parallel batches:

- **After TASK-21 (P2-A):** TASK-22 and TASK-25 in parallel (contracts).
- **After P2-B:** TASK-23 and TASK-26 in parallel (implementations).
- **After P2-C:** TASK-24 and TASK-27 in parallel **if** gate satisfied; else sequential.
- **After P2-D:** TASK-28 (program validation) → `AGENT28V` meta-validator (P2-E).

Docs: `PHASE2_TASK_DECOMPOSITION.md`, `PHASE2_ORCHESTRATION_SUMMARY.md`.

---

## Phase 2: Certification & Assessment Services

**Status:** **Phase 2 program gates closed 2026-04-12** — **P2-D** (2026-04-11) + **P2-E** (`AGENT28V` **PASS**). **F2-HTTP-JWT** follow-up scheduled when routes are live (see `PHASE2_VALIDATION_REPORT.md` § Scheduled follow-up + `PHASE2_ORCHESTRATION_SUMMARY.md`).

**Task Decomposition:** `docs/refactoring/PHASE2_TASK_DECOMPOSITION.md`

**Scope (ROADMAP Phase 2):**

- `speakasap-certification-service` — port **4202**, DB **`speakasap_certification_db`**
- `speakasap-assessment-service` — port **4203**, DB **`speakasap_assessment_db`**
- Legacy: certification apps + `language_tests` / `user_tests`; **`teacher_tests` out of scope**

### TASK-21: Phase 2 Service Scaffolds

- **Implementation:** `docs/agents/AGENT21_PHASE2_INFRA.md`
- **Validator:** `docs/agents/AGENT21V_PHASE2_INFRA_VALIDATE.md`
- **Status:** ✅ Complete — **AGENT21V PASS 2026-04-10** (Sync **P2-A**)
- **Dependencies:** Phase 1 GO
- **Agent Type:** Infra/Docker Agent

### TASK-22: Certification — Design and API Contract

- **Implementation:** `docs/agents/AGENT22_CERTIFICATION_DESIGN.md`
- **Validator:** `docs/agents/AGENT22V_CERTIFICATION_DESIGN_VALIDATE.md`
- **Status:** ✅ Complete — outputs: `docs/refactoring/CERTIFICATION_API_CONTRACT.md`, `docs/refactoring/CERTIFICATION_DATA_MAPPING.md`, optional `certification-service/prisma/schema.prisma`. **`AGENT22V` PASS 2026-04-11** (Sync **P2-B** — certification side).
- **Dependencies:** TASK-21 + TASK-21V PASS
- **Agent Type:** Backend Service Agent (Design)

### TASK-23: Certification — Implementation

- **Implementation:** `docs/agents/AGENT23_CERTIFICATION_IMPLEMENTATION.md`
- **Validator:** `docs/agents/AGENT23V_CERTIFICATION_IMPLEMENTATION_VALIDATE.md`
- **Status:** ✅ Complete — **`AGENT23V` PASS 2026-04-11** (Sync **P2-C** — certification implementation).
- **Dependencies:** TASK-22 + TASK-22V PASS
- **Agent Type:** Backend Service Agent (Implementation)

### TASK-24: Certification — Data Migration

- **Implementation:** `docs/agents/AGENT24_CERTIFICATION_MIGRATION.md`
- **Validator:** `docs/agents/AGENT24V_CERTIFICATION_MIGRATION_VALIDATE.md`
- **Status:** ✅ Complete — `certification-service/scripts/migrate-certification-from-legacy.py` + `CERTIFICATION_DATA_MIGRATION_LOG.md` / `CERTIFICATION_DATA_VALIDATION.md`. Prisma: `studentCourseId` → UUID string. **`AGENT24V` PASS 2026-04-11** (documentation + script review; execute validation queries post-import).
- **Dependencies:** TASK-23 + TASK-23V PASS
- **Agent Type:** Data Migration Agent

### TASK-25: Assessment — Design and API Contract

- **Implementation:** `docs/agents/AGENT25_ASSESSMENT_DESIGN.md`
- **Validator:** `docs/agents/AGENT25V_ASSESSMENT_DESIGN_VALIDATE.md`
- **Status:** ✅ Complete — outputs: `docs/refactoring/ASSESSMENT_API_CONTRACT.md`, `docs/refactoring/ASSESSMENT_DATA_MAPPING.md`, optional `assessment-service/prisma/schema.prisma`. **`teacher_tests` excluded.** **`AGENT25V` PASS 2026-04-11** (Sync **P2-B** — assessment side).
- **Dependencies:** TASK-21 + TASK-21V PASS
- **Agent Type:** Backend Service Agent (Design)

### TASK-26: Assessment — Implementation

- **Implementation:** `docs/agents/AGENT26_ASSESSMENT_IMPLEMENTATION.md`
- **Validator:** `docs/agents/AGENT26V_ASSESSMENT_IMPLEMENTATION_VALIDATE.md`
- **Status:** ✅ Complete — **`AGENT26V` PASS 2026-04-11** (Sync **P2-C** — assessment implementation). No `teacher_tests` in source (README/schema comments only).
- **Dependencies:** TASK-25 + TASK-25V PASS
- **Agent Type:** Backend Service Agent (Implementation)

### TASK-27: Assessment — Data Migration

- **Implementation:** `docs/agents/AGENT27_ASSESSMENT_MIGRATION.md`
- **Validator:** `docs/agents/AGENT27V_ASSESSMENT_MIGRATION_VALIDATE.md`
- **Status:** ✅ Complete — `assessment-service/scripts/migrate-assessment-from-legacy.py` + `ASSESSMENT_DATA_MIGRATION_LOG.md` / `ASSESSMENT_DATA_VALIDATION.md`. No `teacher_tests`. **`AGENT27V` PASS 2026-04-11** (documentation + script review; confirm M2M table name on legacy if needed).
- **Dependencies:** TASK-26 + TASK-26V PASS
- **Agent Type:** Data Migration Agent

### TASK-28: Phase 2 Program Validation & Cutover

- **Implementation:** `docs/agents/AGENT28_PHASE2_VALIDATION.md`
- **Validator:** `docs/agents/AGENT28V_PHASE2_VALIDATION_VALIDATE.md` (meta-validator)
- **Status:** ✅ Complete — **`AGENT28V` PASS 2026-04-12** (Sync **P2-E**). Evidence: `PHASE2_VALIDATION_REPORT.md` (alfares `db-server-postgres` counts + orphans + edge `/health`). Non-blocking: JWT HTTP matrix when services routed.
- **Dependencies:** TASK-21…TASK-27 + all prior validators PASS
- **Agent Type:** QA/Contract Validator Agent

---

## Operational follow-up (Phase 2 — non-blocking)

| ID | Item | When | Docs |
| -- | ---- | ---- | ---- |
| **F2-HTTP-JWT** | Dedicated certification + assessment HTTP/JWT matrix (`PHASE2_VALIDATION_REPORT.md` §3: C2–C8, A2–A8) | After both services are deployed and **routed** via standard service `deploy.sh` / blue-green (no hand-edited nginx) | **§3.3 2026-04-12:** matrix **PASS** on **origin nginx** + JWT (see report). **F2-CF-ORIGIN:** public resolver still Cloudflare misroute — handoff: `docs/superpowers/cursor-tasks/task-01-f2-http-jwt-smoke.md` |

---

## Orchestration (Phase 3) — Wave 1 (User service)

**Prerequisite:** Phase 2 program gates closed (**2026-04-12**).

**Dual prompts:** TASK-29…TASK-33 — Implementation then Validator; sync **P3-UA…P3-UE** per `PHASE3_TASK_DECOMPOSITION.md`.

**Docs:** `PHASE3_TASK_DECOMPOSITION.md`, `PHASE3_ORCHESTRATION_SUMMARY.md`.

```text
Phase2_closed → TASK-29 → TASK-30 → TASK-31 → TASK-32 → TASK-33
```

### TASK-29: User Service Scaffold

- **Implementation:** `docs/agents/AGENT29_USER_SERVICE_SCAFFOLD.md`
- **Validator:** `docs/agents/AGENT29V_USER_SERVICE_SCAFFOLD_VALIDATE.md`
- **Status:** ✅ Complete — `AGENT29V` **PASS** (**2026-04-12**); sync **P3-UA** **PASS**
- **Dependencies:** Phase 2 closed
- **Agent Type:** Infra/Docker Agent

### TASK-30: User Service — Design and API Contract

- **Implementation:** `docs/agents/AGENT30_USER_SERVICE_DESIGN.md`
- **Validator:** `docs/agents/AGENT30V_USER_SERVICE_DESIGN_VALIDATE.md`
- **Status:** ✅ Complete — **`AGENT30V` PASS** (**2026-04-12**); sync **P3-UB** **PASS** (contract includes UUID `authUserId` + `legacyPortalUserId` ETL note)
- **Dependencies:** TASK-29 + `AGENT29V` PASS
- **Agent Type:** Backend Service Agent (Design)

### TASK-31: User Service — Implementation

- **Implementation:** `docs/agents/AGENT31_USER_SERVICE_IMPLEMENTATION.md`
- **Validator:** `docs/agents/AGENT31V_USER_SERVICE_IMPLEMENTATION_VALIDATE.md`
- **Status:** ✅ Complete — **`AGENT31V` PASS** (**2026-04-12**); sync **P3-UC** **PASS** (build + route audit + logging; live `/health`/curl when DB up)
- **Dependencies:** TASK-30 + `AGENT30V` PASS
- **Agent Type:** Backend Service Agent (Implementation)

### TASK-32: User Service — Data Migration

- **Implementation:** `docs/agents/AGENT32_USER_SERVICE_MIGRATION.md`
- **Validator:** `docs/agents/AGENT32V_USER_SERVICE_MIGRATION_VALIDATE.md`
- **Status:** ✅ Complete — **`AGENT32V` PASS** (**2026-04-12**, script/doc + target schema smoke; **live ETL** executed **2026-04-12** per report **rev. c**). Sync **P3-UD** **PASS**
- **Dependencies:** TASK-31 + `AGENT31V` PASS
- **Agent Type:** Data Migration Agent

### TASK-33: User Wave — Program Validation & Cutover

- **Implementation:** `docs/agents/AGENT33_USER_PHASE3_VALIDATION.md`
- **Validator:** `docs/agents/AGENT33V_USER_PHASE3_VALIDATION_VALIDATE.md`
- **Status:** ✅ Complete — **`AGENT33V` PASS** (**2026-04-12**); `PHASE3_USER_VALIDATION_REPORT.md` (**rev. c**) + `PHASE3_USER_CUTOVER_CHECKLIST.md`; sync **P3-UE** **PASS** (traffic **GO**; F3-BACKUP / rollback **closed**; F3-AUTH-PARITY **waived** Wave 1)
- **Dependencies:** TASK-32 + `AGENT32V` PASS
- **Agent Type:** QA/Contract Validator Agent
- **Outputs (expected):** `PHASE3_USER_VALIDATION_REPORT.md` (**rev. c**), `PHASE3_USER_CUTOVER_CHECKLIST.md`

---

## Orchestration (Phase 3) — Wave 2 (Course service)

**Prerequisite:** Phase 3 Wave 1 closed (**TASK-33** + **`AGENT33V` PASS**, **2026-04-12**).

**Dual prompts:** TASK-34…TASK-38 — Implementation then Validator; sync **P3-CA…P3-CE** per [`PHASE3_WAVE2_COURSE_TASK_DECOMPOSITION.md`](PHASE3_WAVE2_COURSE_TASK_DECOMPOSITION.md).

**Docs:** `PHASE3_WAVE2_COURSE_TASK_DECOMPOSITION.md`, `PHASE3_ORCHESTRATION_SUMMARY.md`.

**Scope (ROADMAP §3.1):** `speakasap-course-service` — port **4205**, DB **`speakasap_course_db`**; legacy Django models **`products`**, **`offers`**, **`pricing`** only. **Out of scope this wave:** education-service (4206), `course_materials`, catalog/lessons/homework, AI-teacher (ROADMAP §3.2 / future wave).

```text
Wave1_closed → TASK-34 → TASK-35 → TASK-36 → TASK-37 → TASK-38
```

### TASK-34: Course Service Scaffold

- **Implementation:** `docs/agents/AGENT34_COURSE_SERVICE_SCAFFOLD.md`
- **Validator:** `docs/agents/AGENT34V_COURSE_SERVICE_SCAFFOLD_VALIDATE.md`
- **Status:** ✅ Complete — **`AGENT34V` PASS** (**2026-04-12**); sync **P3-CA** **PASS**
- **Dependencies:** Phase 3 Wave 1 complete
- **Agent Type:** Infra/Docker Agent

### TASK-35: Course Service — Design and API Contract

- **Implementation:** `docs/agents/AGENT35_COURSE_SERVICE_DESIGN.md`
- **Validator:** `docs/agents/AGENT35V_COURSE_SERVICE_DESIGN_VALIDATE.md`
- **Status:** ✅ Complete — **`AGENT35V` PASS** (**2026-04-12**); sync **P3-CB** **PASS** (`COURSE_API_CONTRACT.md`, `COURSE_DATA_MAPPING.md`)
- **Dependencies:** TASK-34 + `AGENT34V` PASS
- **Agent Type:** Backend Service Agent (Design)

### TASK-36: Course Service — Implementation

- **Implementation:** `docs/agents/AGENT36_COURSE_SERVICE_IMPLEMENTATION.md`
- **Validator:** `docs/agents/AGENT36V_COURSE_SERVICE_IMPLEMENTATION_VALIDATE.md`
- **Status:** ✅ Complete — **`AGENT36V` PASS** (**2026-04-12**); sync **P3-CC** **PASS** (Prisma migration + NestJS routes)
- **Dependencies:** TASK-35 + `AGENT35V` PASS
- **Agent Type:** Backend Service Agent (Implementation)

### TASK-37: Course Service — Data Migration

- **Implementation:** `docs/agents/AGENT37_COURSE_SERVICE_MIGRATION.md`
- **Validator:** `docs/agents/AGENT37V_COURSE_SERVICE_MIGRATION_VALIDATE.md`
- **Status:** ✅ Complete — **`AGENT37V` PASS** (**2026-04-12**); sync **P3-CD** **PASS** (`migrate-course-from-legacy.py` + `COURSE_DATA_MIGRATION_LOG.md` / `COURSE_DATA_VALIDATION.md`; **live ETL** pending operator)
- **Dependencies:** TASK-36 + `AGENT36V` PASS
- **Agent Type:** Data Migration Agent

### TASK-38: Course Wave — Program Validation & Cutover

- **Implementation:** `docs/agents/AGENT38_COURSE_PHASE3_VALIDATION.md`
- **Validator:** `docs/agents/AGENT38V_COURSE_PHASE3_VALIDATION_VALIDATE.md`
- **Status:** ✅ Complete — **`AGENT38V` PASS** (**2026-04-12**); `PHASE3_COURSE_VALIDATION_REPORT.md` + `PHASE3_COURSE_CUTOVER_CHECKLIST.md`; sync **P3-CE** **PASS** (deploy/HTTP **DEFERRED**)
- **Dependencies:** TASK-37 + `AGENT37V` PASS
- **Agent Type:** QA/Contract Validator Agent
- **Outputs (expected):** `PHASE3_COURSE_VALIDATION_REPORT.md`, `PHASE3_COURSE_CUTOVER_CHECKLIST.md`

---

## Orchestration (Phase 3) — Wave 3 (Education service)

**Prerequisite:** Phase 3 Wave 2 closed (**TASK-38** + **`AGENT38V` PASS**, **P3-CE**).

**Dual prompts:** TASK-39…TASK-43 — Implementation then Validator; sync **P3-EA…P3-EE** per [`PHASE3_WAVE3_EDUCATION_TASK_DECOMPOSITION.md`](PHASE3_WAVE3_EDUCATION_TASK_DECOMPOSITION.md).

**Docs:** `PHASE3_WAVE3_EDUCATION_TASK_DECOMPOSITION.md`, `PHASE3_ORCHESTRATION_SUMMARY.md`.

**Scope (ROADMAP §3.2):** `speakasap-education-service` — port **4206**, DB **`speakasap_education_db`**; legacy Django **`education`** (catalog, lessons, homework, groups, student courses, `course_materials`, seven, mini, native). **Out of scope:** `marathon`, payment/order execution (Phase 4).

```text
Wave2_closed → TASK-39 → TASK-40 → TASK-41 → TASK-42 → TASK-43
```

### TASK-39: Education Service Scaffold

- **Implementation:** `docs/agents/AGENT39_EDUCATION_SERVICE_SCAFFOLD.md`
- **Validator:** `docs/agents/AGENT39V_EDUCATION_SERVICE_SCAFFOLD_VALIDATE.md`
- **Status:** ✅ Complete — **`AGENT39V` PASS** (**2026-04-12**); sync **P3-EA** **PASS**
- **Dependencies:** Phase 3 Wave 2 complete
- **Agent Type:** Infra/Docker Agent

### TASK-40: Education Service — Design and API Contract

- **Implementation:** `docs/agents/AGENT40_EDUCATION_SERVICE_DESIGN.md`
- **Validator:** `docs/agents/AGENT40V_EDUCATION_SERVICE_DESIGN_VALIDATE.md`
- **Status:** ✅ Complete — **`AGENT40V` PASS** (**2026-04-12**); sync **P3-EB** **PASS**
- **Dependencies:** TASK-39 + `AGENT39V` PASS
- **Agent Type:** Backend Service Agent (Design)

### TASK-41: Education Service — Implementation

- **Implementation:** `docs/agents/AGENT41_EDUCATION_SERVICE_IMPLEMENTATION.md`
- **Validator:** `docs/agents/AGENT41V_EDUCATION_SERVICE_IMPLEMENTATION_VALIDATE.md`
- **Status:** ✅ Complete — **`AGENT41V` PASS** (**2026-04-12**); sync **P3-EC** **PASS**
- **Dependencies:** TASK-40 + `AGENT40V` PASS
- **Agent Type:** Backend Service Agent (Implementation)

### TASK-42: Education Service — Data Migration

- **Implementation:** `docs/agents/AGENT42_EDUCATION_SERVICE_MIGRATION.md`
- **Validator:** `docs/agents/AGENT42V_EDUCATION_SERVICE_MIGRATION_VALIDATE.md`
- **Status:** ✅ Complete — **`AGENT42V` PASS** (**2026-04-12**); sync **P3-ED** **PASS** (script + docs; **live ETL** operator)
- **Dependencies:** TASK-41 + `AGENT41V` PASS
- **Agent Type:** Data Migration Agent

### TASK-43: Education Wave — Program Validation & Cutover

- **Implementation:** `docs/agents/AGENT43_EDUCATION_PHASE3_VALIDATION.md`
- **Validator:** `docs/agents/AGENT43V_EDUCATION_PHASE3_VALIDATION_VALIDATE.md`
- **Status:** ✅ Complete — **`AGENT43V` PASS** (**2026-04-12**); `PHASE3_EDUCATION_VALIDATION_REPORT.md` + `PHASE3_EDUCATION_CUTOVER_CHECKLIST.md`; sync **P3-EE** **PASS** (HTTP/deploy **DEFERRED**)
- **Dependencies:** TASK-42 + `AGENT42V` PASS
- **Agent Type:** QA/Contract Validator Agent
- **Outputs (expected):** `PHASE3_EDUCATION_VALIDATION_REPORT.md`, `PHASE3_EDUCATION_CUTOVER_CHECKLIST.md`

---

## Phase 3+ (Aligned to ROADMAP)

- **Wave 1 (this repo):** User service — TASK-29…TASK-33 above.
- **Wave 2 (this repo):** Course service — TASK-34…TASK-38 above.
- **Wave 3 (this repo):** Education service — TASK-39…TASK-43 above (**closed 2026-04-12** — engineering **GO**; operator follow-up as in report).

---

## Orchestration (Phase 4) — Payment, Notification, Salary, Financial

**Status:** **Active** (opened **2026-04-13**). **Payment wave P4-OA…P4-OE** **PASS** **2026-04-13**. **Notification wave P4-NA…P4-NE** **PASS** **2026-04-13**. **Salary wave P4-SA…P4-SE** **PASS** **2026-04-14** (`AGENT54V`…`AGENT58V`, [`PHASE4_SALARY_VALIDATION_REPORT.md`](PHASE4_SALARY_VALIDATION_REPORT.md)). Remaining gates **P4-FA…P4-FE** open until validators PASS; see [`PHASE4_TASK_DECOMPOSITION.md`](PHASE4_TASK_DECOMPOSITION.md).

**Docs:** `PHASE4_TASK_DECOMPOSITION.md`, `PHASE4_ORCHESTRATION_SUMMARY.md`.

**Scope (`ROADMAP.md` §5 Phase 4):** `speakasap-payment-service` (**4208**, `speakasap_payment_db`); `speakasap-notification-service` (**4209**, `speakasap_notification_db`); `speakasap-salary-service` (**4212**, `speakasap_salary_db`); `speakasap-financial-service` (**4213**, `speakasap_financial_db`).

```text
Phase3_closed → TASK-44…48 → TASK-49…53 → TASK-54…58 → TASK-59…63
```

### TASK-44: Payment Service Scaffold

- **Implementation:** `docs/agents/AGENT44_PAYMENT_SERVICE_SCAFFOLD.md`
- **Validator:** `docs/agents/AGENT44V_PAYMENT_SERVICE_SCAFFOLD_VALIDATE.md`
- **Status:** **Complete** **2026-04-13** — sync **P4-OA** **PASS** (evidence in validator doc)
- **Dependencies:** Phase 3 complete (program gates)
- **Agent Type:** Infra/Docker Agent

### TASK-45: Payment Service — Design and API Contract

- **Implementation:** `docs/agents/AGENT45_PAYMENT_SERVICE_DESIGN.md`
- **Validator:** `docs/agents/AGENT45V_PAYMENT_SERVICE_DESIGN_VALIDATE.md`
- **Status:** **Complete** **2026-04-13** — sync **P4-OB** **PASS** (evidence in validator doc)
- **Dependencies:** TASK-44 + `AGENT44V` PASS
- **Agent Type:** Backend Service Agent (Design)

### TASK-46: Payment Service — Implementation

- **Implementation:** `docs/agents/AGENT46_PAYMENT_SERVICE_IMPLEMENTATION.md`
- **Validator:** `docs/agents/AGENT46V_PAYMENT_SERVICE_IMPLEMENTATION_VALIDATE.md`
- **Status:** **Complete** **2026-04-13** — sync **P4-OC** **PASS** (evidence in validator doc)
- **Dependencies:** TASK-45 + `AGENT45V` PASS
- **Agent Type:** Backend Service Agent (Implementation)

### TASK-47: Payment Service — Data Migration

- **Implementation:** `docs/agents/AGENT47_PAYMENT_SERVICE_MIGRATION.md`
- **Validator:** `docs/agents/AGENT47V_PAYMENT_SERVICE_MIGRATION_VALIDATE.md`
- **Status:** **Complete** **2026-04-13** — sync **P4-OD** **PASS** (evidence in validator doc)
- **Dependencies:** TASK-46 + `AGENT46V` PASS
- **Agent Type:** Data Migration Agent

### TASK-48: Payment Wave — Program Validation and Cutover

- **Implementation:** `docs/agents/AGENT48_PAYMENT_PHASE4_VALIDATION.md`
- **Validator:** `docs/agents/AGENT48V_PAYMENT_PHASE4_VALIDATION_VALIDATE.md`
- **Status:** **Complete** **2026-04-13** — sync **P4-OE** **PASS** ([`PHASE4_PAYMENT_VALIDATION_REPORT.md`](PHASE4_PAYMENT_VALIDATION_REPORT.md), [`AGENT48V`](../agents/AGENT48V_PAYMENT_PHASE4_VALIDATION_VALIDATE.md))
- **Dependencies:** TASK-47 + `AGENT47V` PASS
- **Agent Type:** QA/Contract Validator Agent
- **Outputs (expected):** `PHASE4_PAYMENT_VALIDATION_REPORT.md`, `PHASE4_PAYMENT_CUTOVER_CHECKLIST.md`

### TASK-49: Notification Service Scaffold

- **Implementation:** `docs/agents/AGENT49_NOTIFICATION_SERVICE_SCAFFOLD.md`
- **Validator:** `docs/agents/AGENT49V_NOTIFICATION_SERVICE_SCAFFOLD_VALIDATE.md`
- **Status:** ✅ Complete **2026-04-13** — sync **P4-NA** **PASS**
- **Dependencies:** TASK-48 + `AGENT48V` PASS (serial default)
- **Agent Type:** Infra/Docker Agent

### TASK-50: Notification Service — Design and API Contract

- **Implementation:** `docs/agents/AGENT50_NOTIFICATION_SERVICE_DESIGN.md`
- **Validator:** `docs/agents/AGENT50V_NOTIFICATION_SERVICE_DESIGN_VALIDATE.md`
- **Status:** ✅ Complete **2026-04-13** — sync **P4-NB** **PASS**
- **Dependencies:** TASK-49 + `AGENT49V` PASS
- **Agent Type:** Backend Service Agent (Design)

### TASK-51: Notification Service — Implementation

- **Implementation:** `docs/agents/AGENT51_NOTIFICATION_SERVICE_IMPLEMENTATION.md`
- **Validator:** `docs/agents/AGENT51V_NOTIFICATION_SERVICE_IMPLEMENTATION_VALIDATE.md`
- **Status:** ✅ Complete **2026-04-13** — sync **P4-NC** **PASS**
- **Dependencies:** TASK-50 + `AGENT50V` PASS
- **Agent Type:** Backend Service Agent (Implementation)

### TASK-52: Notification Service — Data Migration

- **Implementation:** `docs/agents/AGENT52_NOTIFICATION_SERVICE_MIGRATION.md`
- **Validator:** `docs/agents/AGENT52V_NOTIFICATION_SERVICE_MIGRATION_VALIDATE.md`
- **Status:** ✅ Complete **2026-04-13** — sync **P4-ND** **PASS**
- **Dependencies:** TASK-51 + `AGENT51V` PASS
- **Agent Type:** Data Migration Agent

### TASK-53: Notification Wave — Program Validation and Cutover

- **Implementation:** `docs/agents/AGENT53_NOTIFICATION_PHASE4_VALIDATION.md`
- **Validator:** `docs/agents/AGENT53V_NOTIFICATION_PHASE4_VALIDATION_VALIDATE.md`
- **Status:** ✅ Complete **2026-04-13** — sync **P4-NE** **PASS** (`PHASE4_NOTIFICATION_VALIDATION_REPORT.md`, `PHASE4_NOTIFICATION_CUTOVER_CHECKLIST.md`)
- **Dependencies:** TASK-52 + `AGENT52V` PASS
- **Agent Type:** QA/Contract Validator Agent
- **Outputs (expected):** `PHASE4_NOTIFICATION_VALIDATION_REPORT.md`, `PHASE4_NOTIFICATION_CUTOVER_CHECKLIST.md`

### TASK-54: Salary Service Scaffold

- **Implementation:** `docs/agents/AGENT54_SALARY_SERVICE_SCAFFOLD.md`
- **Validator:** `docs/agents/AGENT54V_SALARY_SERVICE_SCAFFOLD_VALIDATE.md`
- **Status:** ✅ Complete **2026-04-13** — sync **P4-SA** **PASS** (validator evidence backfilled **2026-04-14**)
- **Dependencies:** TASK-53 + `AGENT53V` PASS
- **Agent Type:** Infra/Docker Agent

### TASK-55: Salary Service — Design and API Contract

- **Implementation:** `docs/agents/AGENT55_SALARY_SERVICE_DESIGN.md`
- **Validator:** `docs/agents/AGENT55V_SALARY_SERVICE_DESIGN_VALIDATE.md`
- **Status:** ✅ Complete **2026-04-13** — sync **P4-SB** **PASS** (`SALARY_API_CONTRACT.md`, `SALARY_DATA_MAPPING.md` frozen; `AGENT55V` PASS)
- **Dependencies:** TASK-54 + `AGENT54V` PASS
- **Agent Type:** Backend Service Agent (Design)

### TASK-56: Salary Service — Implementation

- **Implementation:** `docs/agents/AGENT56_SALARY_SERVICE_IMPLEMENTATION.md`
- **Validator:** `docs/agents/AGENT56V_SALARY_SERVICE_IMPLEMENTATION_VALIDATE.md`
- **Status:** ✅ Complete — sync **P4-SC** **PASS** (`AGENT56V`)
- **Dependencies:** TASK-55 + `AGENT55V` PASS ✅
- **Agent Type:** Backend Service Agent (Implementation)

### TASK-57: Salary Service — Data Migration

- **Implementation:** `docs/agents/AGENT57_SALARY_SERVICE_MIGRATION.md`
- **Validator:** `docs/agents/AGENT57V_SALARY_SERVICE_MIGRATION_VALIDATE.md`
- **Status:** ✅ Complete — sync **P4-SD** **PASS** (`AGENT57V`)
- **Dependencies:** TASK-56 + `AGENT56V` PASS
- **Agent Type:** Data Migration Agent

### TASK-58: Salary Wave — Program Validation and Cutover

- **Implementation:** `docs/agents/AGENT58_SALARY_PHASE4_VALIDATION.md`
- **Validator:** `docs/agents/AGENT58V_SALARY_PHASE4_VALIDATION_VALIDATE.md`
- **Status:** ✅ Complete **2026-04-14** — sync **P4-SE** **PASS** ([`PHASE4_SALARY_VALIDATION_REPORT.md`](PHASE4_SALARY_VALIDATION_REPORT.md), [`AGENT58V`](../agents/AGENT58V_SALARY_PHASE4_VALIDATION_VALIDATE.md))
- **Dependencies:** TASK-57 + `AGENT57V` PASS
- **Agent Type:** QA/Contract Validator Agent
- **Outputs (expected):** `PHASE4_SALARY_VALIDATION_REPORT.md`, `PHASE4_SALARY_CUTOVER_CHECKLIST.md`

### TASK-59: Financial Service Scaffold

- **Implementation:** `docs/agents/AGENT59_FINANCIAL_SERVICE_SCAFFOLD.md`
- **Validator:** `docs/agents/AGENT59V_FINANCIAL_SERVICE_SCAFFOLD_VALIDATE.md`
- **Status:** Pending — sync **P4-FA** open
- **Dependencies:** TASK-58 + `AGENT58V` PASS
- **Agent Type:** Infra/Docker Agent

### TASK-60: Financial Service — Design and API Contract

- **Implementation:** `docs/agents/AGENT60_FINANCIAL_SERVICE_DESIGN.md`
- **Validator:** `docs/agents/AGENT60V_FINANCIAL_SERVICE_DESIGN_VALIDATE.md`
- **Status:** Pending — sync **P4-FB** open
- **Dependencies:** TASK-59 + `AGENT59V` PASS
- **Agent Type:** Backend Service Agent (Design)

### TASK-61: Financial Service — Implementation

- **Implementation:** `docs/agents/AGENT61_FINANCIAL_SERVICE_IMPLEMENTATION.md`
- **Validator:** `docs/agents/AGENT61V_FINANCIAL_SERVICE_IMPLEMENTATION_VALIDATE.md`
- **Status:** Pending — sync **P4-FC** open
- **Dependencies:** TASK-60 + `AGENT60V` PASS
- **Agent Type:** Backend Service Agent (Implementation)

### TASK-62: Financial Service — Data Migration

- **Implementation:** `docs/agents/AGENT62_FINANCIAL_SERVICE_MIGRATION.md`
- **Validator:** `docs/agents/AGENT62V_FINANCIAL_SERVICE_MIGRATION_VALIDATE.md`
- **Status:** Pending — sync **P4-FD** open
- **Dependencies:** TASK-61 + `AGENT61V` PASS
- **Agent Type:** Data Migration Agent

### TASK-63: Financial Wave — Program Validation and Cutover

- **Implementation:** `docs/agents/AGENT63_FINANCIAL_PHASE4_VALIDATION.md`
- **Validator:** `docs/agents/AGENT63V_FINANCIAL_PHASE4_VALIDATION_VALIDATE.md`
- **Status:** Pending — sync **P4-FE** open
- **Dependencies:** TASK-62 + `AGENT62V` PASS
- **Agent Type:** QA/Contract Validator Agent
- **Outputs (expected):** `PHASE4_FINANCIAL_VALIDATION_REPORT.md`, `PHASE4_FINANCIAL_CUTOVER_CHECKLIST.md`

---

## Phase 5+ (Aligned to ROADMAP)

- **Phase 5:** API gateway (**4210**) and frontend (**4211**) — decomposition TBD when phase opens (`ROADMAP.md` §5 Phase 5).
- **Phases 6–7:** Integration and legacy decommission — decomposition TBD when opened.
