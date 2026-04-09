# SpeakASAP Refactoring - Tasks Index

This index lists the agent tasks for the SpeakASAP refactoring program. Each task has a dedicated agent prompt in `docs/agents/`.

**Lead orchestrator:** `docs/agents/master-prompt.md` (Phase 1 is active; Phase 0 is closed).

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

**Status:** 🔄 **In execution** — next: **TASK-11** (see `PHASE1_ORCHESTRATION_SUMMARY.md`)

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

## Phase 2+ (Aligned to ROADMAP)

- Subsequent phases follow `docs/refactoring/ROADMAP.md` and will be decomposed into agent tasks after Phase 1 completion.
