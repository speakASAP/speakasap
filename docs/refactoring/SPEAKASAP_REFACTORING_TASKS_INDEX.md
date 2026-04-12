# SpeakASAP Refactoring - Tasks Index

This index lists the agent tasks for the SpeakASAP refactoring program. Each task has a dedicated agent prompt in `docs/agents/`.

**Lead orchestrator:** `docs/agents/master-prompt.md` (Phase 0–2 closed **2026-04-12**; **Phase 3 Wave 1 (user-service)** program gates **P3-UA…P3-UE** closed **2026-04-12**; **F3** follow-ups **closed / waived** in `PHASE3_USER_VALIDATION_REPORT.md` **rev. c** + cutover **GO**).

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
| **F2-HTTP-JWT** | Dedicated certification + assessment HTTP/JWT matrix (`PHASE2_VALIDATION_REPORT.md` §3: C2–C8, A2–A8) | After both services are deployed and **routed** via standard service `deploy.sh` / blue-green (no hand-edited nginx) | Complete §3 rows; tick `PHASE2_CUTOVER_CHECKLIST.md` § Deploy/smoke — **handoff:** `docs/superpowers/cursor-tasks/task-01-f2-http-jwt-smoke.md`; **probe 2026-04-12:** §3.1 in report (HTTPS misrouted; assessment restarting) — matrix stays **DEF** until fixed |

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

## Phase 3+ (Aligned to ROADMAP)

- **Wave 1 (this repo):** User service — TASK-29…TASK-33 above.
- **Future waves:** Course (4205) and Education (4206) per `docs/refactoring/ROADMAP.md` §3.1–3.2 — decompose as **TASK-34+** (or separate index subsection) when Lead opens scope.
