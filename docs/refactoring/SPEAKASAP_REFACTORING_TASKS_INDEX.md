# SpeakASAP Refactoring - Tasks Index

This index lists the agent tasks for the SpeakASAP refactoring program. Each task has a dedicated agent prompt in `docs/agents/`.

**Lead orchestrator:** `docs/agents/master-prompt.md` (Phase 1 until TASK-16 GO; Phase 0 closed; Phase 2 ready after Phase 1 GO).

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

## Orchestration (Phase 1) — Active

Global dependency graph:

```text
Phase 0 (complete) → Phase 1 (Foundation + Content Service)
TASK-11 → TASK-12 → TASK-13 → (TASK-14 ∥ TASK-15) → TASK-16
```

Parallel batches:

- **After TASK-11:** TASK-12 only (contract freeze = Sync B prerequisite).
- **After TASK-12:** TASK-13 (implementation).
- **After TASK-13:** TASK-14 and TASK-15 **in parallel** (migration vs AI integration).
- **After TASK-11…TASK-15:** TASK-16 (validation / cutover GO).

Docs: `PHASE1_TASK_DECOMPOSITION.md`, `PHASE1_ORCHESTRATION_SUMMARY.md`.

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

**Remaining Items:** None (Phase 0 closed; continue with Phase 1 execution).

---

## Phase 1: Foundation & Infrastructure - Content Service

**Status:** 🔄 **In execution** — next runnable task: see `PHASE1_ORCHESTRATION_SUMMARY.md` and `PHASE1_COMPLETION_SUMMARY.md`

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
- **Status**: Phase 1 - Foundation
- **Dependencies**: Phase 0 completion
- **Agent Type**: Infra/Docker Agent

### TASK-12: Content Service Design and API Contract

- **Prompt**: `docs/agents/AGENT12_CONTENT_DESIGN.md`
- **Status**: Phase 1 - Design — **Lead Orchestrator GO 2026-04-09** (see sign-off in prompt)
- **Dependencies**: TASK-11
- **Agent Type**: Backend Service Agent (Design)

### TASK-13: Content Service Implementation

- **Prompt**: `docs/agents/AGENT13_CONTENT_IMPLEMENTATION.md`
- **Status**: Phase 1 - Implementation
- **Dependencies**: TASK-11, TASK-12
- **Agent Type**: Backend Service Agent (Implementation)

### TASK-14: Content Data Migration

- **Prompt**: `docs/agents/AGENT14_CONTENT_MIGRATION.md`
- **Status**: Phase 1 - Data Migration
- **Dependencies**: TASK-12, TASK-13
- **Agent Type**: Data Migration Agent

### TASK-15: AI Microservice Integration

- **Prompt**: `docs/agents/AGENT15_AI_INTEGRATION.md`
- **Status**: Phase 1 - Integration
- **Dependencies**: TASK-12, TASK-13
- **Agent Type**: Integration Adapter Agent

### TASK-16: Phase 1 Validation and Cutover Checklist

- **Prompt**: `docs/agents/AGENT16_PHASE1_VALIDATION.md`
- **Status**: Phase 1 - Validation
- **Dependencies**: TASK-11 through TASK-15
- **Agent Type**: QA/Contract Validator Agent

---

## Orchestration (Phase 2) — After Phase 1 GO (TASK-16)

**Prerequisite:** Phase 1 validation **GO** and cutover sign-off per Lead Orchestrator.

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

**Status:** Planned — start after **Phase 1 GO** (`AGENT16_PHASE1_VALIDATION.md`).

**Task Decomposition:** `docs/refactoring/PHASE2_TASK_DECOMPOSITION.md`

**Scope (ROADMAP Phase 2):**

- `speakasap-certification-service` — port **4202**, DB **`speakasap_certification_db`**
- `speakasap-assessment-service` — port **4203**, DB **`speakasap_assessment_db`**
- Legacy: certification apps + `language_tests` / `user_tests`; **`teacher_tests` out of scope**

### TASK-21: Phase 2 Service Scaffolds

- **Implementation:** `docs/agents/AGENT21_PHASE2_INFRA.md`
- **Validator:** `docs/agents/AGENT21V_PHASE2_INFRA_VALIDATE.md`
- **Dependencies:** Phase 1 GO
- **Agent Type:** Infra/Docker Agent

### TASK-22: Certification — Design and API Contract

- **Implementation:** `docs/agents/AGENT22_CERTIFICATION_DESIGN.md`
- **Validator:** `docs/agents/AGENT22V_CERTIFICATION_DESIGN_VALIDATE.md`
- **Dependencies:** TASK-21 + TASK-21V PASS
- **Agent Type:** Backend Service Agent (Design)

### TASK-23: Certification — Implementation

- **Implementation:** `docs/agents/AGENT23_CERTIFICATION_IMPLEMENTATION.md`
- **Validator:** `docs/agents/AGENT23V_CERTIFICATION_IMPLEMENTATION_VALIDATE.md`
- **Dependencies:** TASK-22 + TASK-22V PASS
- **Agent Type:** Backend Service Agent (Implementation)

### TASK-24: Certification — Data Migration

- **Implementation:** `docs/agents/AGENT24_CERTIFICATION_MIGRATION.md`
- **Validator:** `docs/agents/AGENT24V_CERTIFICATION_MIGRATION_VALIDATE.md`
- **Dependencies:** TASK-23 + TASK-23V PASS
- **Agent Type:** Data Migration Agent

### TASK-25: Assessment — Design and API Contract

- **Implementation:** `docs/agents/AGENT25_ASSESSMENT_DESIGN.md`
- **Validator:** `docs/agents/AGENT25V_ASSESSMENT_DESIGN_VALIDATE.md`
- **Dependencies:** TASK-21 + TASK-21V PASS
- **Agent Type:** Backend Service Agent (Design)

### TASK-26: Assessment — Implementation

- **Implementation:** `docs/agents/AGENT26_ASSESSMENT_IMPLEMENTATION.md`
- **Validator:** `docs/agents/AGENT26V_ASSESSMENT_IMPLEMENTATION_VALIDATE.md`
- **Dependencies:** TASK-25 + TASK-25V PASS
- **Agent Type:** Backend Service Agent (Implementation)

### TASK-27: Assessment — Data Migration

- **Implementation:** `docs/agents/AGENT27_ASSESSMENT_MIGRATION.md`
- **Validator:** `docs/agents/AGENT27V_ASSESSMENT_MIGRATION_VALIDATE.md`
- **Dependencies:** TASK-26 + TASK-26V PASS
- **Agent Type:** Data Migration Agent

### TASK-28: Phase 2 Program Validation & Cutover

- **Implementation:** `docs/agents/AGENT28_PHASE2_VALIDATION.md`
- **Validator:** `docs/agents/AGENT28V_PHASE2_VALIDATION_VALIDATE.md` (meta-validator)
- **Dependencies:** TASK-21…TASK-27 + all prior validators PASS
- **Agent Type:** QA/Contract Validator Agent

---

## Phase 3+ (Aligned to ROADMAP)

- Subsequent phases follow `docs/refactoring/ROADMAP.md` and will be decomposed when Phase 2 is complete (P2-E).
