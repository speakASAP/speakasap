# SpeakASAP Refactoring - Tasks Index

This index lists the agent tasks for the SpeakASAP refactoring program. Each task has a dedicated agent prompt in `docs/agents/`.

## Task Structure

Each task file contains:

- Status and objective
- Inputs and dependencies
- Implementation steps
- Outputs and acceptance criteria

## Orchestration (Phase 0)

Global dependency graph:

```text
Phase 0 (Marathon) → Phase 1+ (per ROADMAP)
```

Task groups (parallel batches):

- Contract + Data: TASK-01, TASK-03 (parallel after TASK-01 starts)
- Infra: TASK-04 (depends on TASK-01)
- Integration: TASK-02 (depends on TASK-01)
- Validation: TASK-05 (depends on TASK-01 through TASK-04)

Sync points are documented in:

- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`
- `docs/refactoring/MARATHON_PHASE0_VALIDATION.md`

## Phase 0: Marathon Extraction (Immediate)

Note: `marathon` is a standalone product in `/Users/sergiystashok/Documents/GitHub/marathon` with repo `git@github.com:speakASAP/marathon.git`.

Phase 0 outputs:

- `docs/refactoring/MARATHON_API_CONTRACT.md`
- `docs/refactoring/MARATHON_DATA_MAPPING.md`
- `docs/refactoring/MARATHON_INFRA_PLAN.md`
- `docs/refactoring/MARATHON_PHASE0_VALIDATION.md`

### TASK-01: Marathon Design and API Contract

- **Prompt**: `docs/agents/AGENT01_MARATHON_SERVICE.md`
- **Status**: Phase 0 - Foundation
- **Dependencies**: None

### TASK-02: Legacy Integration Shim for Marathon

- **Prompt**: `docs/agents/AGENT02_LEGACY_INTEGRATION_SHIM.md`
- **Status**: Phase 0 - Integration
- **Dependencies**: TASK-01

### TASK-03: Data Mapping and Migration Plan

- **Prompt**: `docs/agents/AGENT03_DATA_MIGRATION_CONTRACTS.md`
- **Status**: Phase 0 - Data
- **Dependencies**: TASK-01

### TASK-04: Infra and Docker Setup for Marathon

- **Prompt**: `docs/agents/AGENT04_INFRA_DOCKER.md`
- **Status**: Phase 0 - Infrastructure
- **Dependencies**: TASK-01

### TASK-05: Validation and Cutover Checklist

- **Prompt**: `docs/agents/AGENT05_VALIDATION.md`
- **Status**: Phase 0 - Verification
- **Dependencies**: TASK-01 through TASK-04

### TASK-09: Marathon Shim Audit Fixes

- **Prompt**: `docs/agents/AGENT09_MARATHON_SHIM_FIXES.md`
- **Status**: Phase 0 - Bug Fixes
- **Dependencies**: TASK-02, TASK-05
- **Agent Type**: Integration Adapter Agent

## Phase 0 Completion

**Status:** 🟡 95% Complete - Awaiting Cutover Execution

**Completion Checklist:** `docs/refactoring/PHASE0_COMPLETION_CHECKLIST.md`

**Remaining Items:**

- Cutover execution and validation
- `.env` + `.env.example` synchronization (local + prod)
- Service stability monitoring (1 week minimum)
- Final sign-off

---

## Phase 1: Foundation & Infrastructure - Content Service

**Status:** 📋 Planning Complete - Ready for Execution

**Task Decomposition:** `docs/refactoring/PHASE1_TASK_DECOMPOSITION.md`

**Scope:**

- Infrastructure setup and foundation
- Content Service extraction (read-only)
- AI microservice integration
- Notifications-microservice integration

**Task Groups:**

- Group A: Infrastructure Setup (TASK-11) - Sequential
- Group B: Content Service (TASK-12, TASK-13, TASK-14, TASK-15) - Parallel after Group A
- Group C: Validation (TASK-16) - After Group B

### TASK-11: Project Setup and Infrastructure Foundation

- **Prompt**: `docs/agents/AGENT11_INFRA_SETUP.md`
- **Status**: Phase 1 - Foundation
- **Dependencies**: Phase 0 completion
- **Agent Type**: Infra/Docker Agent

### TASK-12: Content Service Design and API Contract

- **Prompt**: `docs/agents/AGENT12_CONTENT_DESIGN.md`
- **Status**: Phase 1 - Design
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
