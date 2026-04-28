# SpeakASAP Refactoring Tasks Index

This is the canonical task index for the SpeakASAP refactoring program.
Execution is orchestrated by `docs/agents/master-prompt.md`.

## Current Active Window (authoritative)

- Active phase: Phase 5 (API gateway + frontend).
- Current focus from state: close `P5-GC` via `AGENT66V`, then proceed to `TASK-67`.
- Active decomposition source: `docs/refactoring/PHASE5_TASK_DECOMPOSITION.md`.

Phase 5 task chain:

```text
TASK-64 -> TASK-65 -> TASK-66 -> TASK-67 -> TASK-68 -> TASK-69 -> TASK-70 -> TASK-71 -> TASK-72 -> TASK-73
```

Dual-prompt rule applies to every task:

1. Implementation prompt: `docs/agents/AGENT{NN}_*.md`
2. Validator prompt: `docs/agents/AGENT{NN}V_*_VALIDATE.md`

## Phase 5 Task Prompts

### Gateway wave (`P5-GA...P5-GE`)

- TASK-64: `docs/agents/AGENT64_API_GATEWAY_SCAFFOLD.md`
- TASK-64V: `docs/agents/AGENT64V_API_GATEWAY_SCAFFOLD_VALIDATE.md`
- TASK-65: `docs/agents/AGENT65_GATEWAY_CONTRACT_DESIGN.md`
- TASK-65V: `docs/agents/AGENT65V_GATEWAY_CONTRACT_DESIGN_VALIDATE.md`
- TASK-66: `docs/agents/AGENT66_GATEWAY_IMPLEMENTATION.md`
- TASK-66V: `docs/agents/AGENT66V_GATEWAY_IMPLEMENTATION_VALIDATE.md`
- TASK-67: `docs/agents/AGENT67_GATEWAY_INTEGRATION_VALIDATION.md`
- TASK-67V: `docs/agents/AGENT67V_GATEWAY_INTEGRATION_VALIDATE.md`
- TASK-68: `docs/agents/AGENT68_GATEWAY_PHASE5_VALIDATION.md`
- TASK-68V: `docs/agents/AGENT68V_GATEWAY_PHASE5_VALIDATION_VALIDATE.md`

### Frontend wave (`P5-FA...P5-FE`)

- TASK-69: `docs/agents/AGENT69_FRONTEND_SCAFFOLD.md`
- TASK-69V: `docs/agents/AGENT69V_FRONTEND_SCAFFOLD_VALIDATE.md`
- TASK-70: `docs/agents/AGENT70_FRONTEND_GATEWAY_CONTRACT_MAPPING.md`
- TASK-70V: `docs/agents/AGENT70V_FRONTEND_GATEWAY_CONTRACT_MAPPING_VALIDATE.md`
- TASK-71: `docs/agents/AGENT71_FRONTEND_IMPLEMENTATION.md`
- TASK-71V: `docs/agents/AGENT71V_FRONTEND_IMPLEMENTATION_VALIDATE.md`
- TASK-72: `docs/agents/AGENT72_FRONTEND_INTEGRATION_AUTH_FLOW_VALIDATION_MATRIX.md`
- TASK-72V: `docs/agents/AGENT72V_FRONTEND_INTEGRATION_AUTH_FLOW_VALIDATION_MATRIX_VALIDATE.md`
- TASK-73: `docs/agents/AGENT73_PHASE5_PROGRAM_VALIDATION_AND_CUTOVER.md`
- TASK-73V: `docs/agents/AGENT73V_PHASE5_PROGRAM_VALIDATION_AND_CUTOVER_VALIDATE.md`

## Closed Phases (historical references)

Closed phases are retained for traceability and remediation-only scenarios:

- Phase 0: TASK-01...TASK-09 (Marathon extraction)
- Phase 1: TASK-11...TASK-16 (Foundation + content)
- Phase 2: TASK-21...TASK-28 (Certification + assessment)
- Phase 3: TASK-29...TASK-43 (User/course/education waves)
- Phase 4: TASK-44...TASK-63 (Payment/notification/salary/financial waves)

Use historical artifacts only when explicit regression or scope reopen is approved.

## Key references

- `docs/agents/master-prompt.md`
- `docs/refactoring/ROADMAP.md`
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`
- `docs/refactoring/PHASE5_TASK_DECOMPOSITION.md`
- `TASKS.md`
- `STATE.json`
