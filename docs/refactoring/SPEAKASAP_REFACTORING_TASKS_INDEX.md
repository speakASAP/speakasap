# SpeakASAP Refactoring - Tasks Index

This index lists the agent tasks for the SpeakASAP refactoring program. Each task has a dedicated agent prompt in `docs/agents/`.

## Task Structure

Each task file contains:

- Status and objective
- Inputs and dependencies
- Implementation steps
- Outputs and acceptance criteria

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

## Phase 1+ (Aligned to ROADMAP)

- Subsequent phases follow `docs/refactoring/ROADMAP.md` and will be decomposed into agent tasks once Phase 0 is completed.
