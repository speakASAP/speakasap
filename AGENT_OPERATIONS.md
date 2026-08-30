# Agent Operations

## roles

- Readiness scanner: classifies work as ready now, dependency-gated, blocked, complete, or owner-input required
- Worker agent: handles one bounded implementation goal with explicit scope
- Worker monitor: checks active work, blockers, and shared-file conflicts
- Integration validator: checks acceptance criteria, validation evidence, and current-task regressions

## before work

Before implementation, confirm:

- the active goal matches repository intent
- required reading is complete
- task/state traceability is present
- blockers and owner decisions are explicit
- validation commands are known and narrow

## parallel work

Keep parallel workstreams separate by file ownership and validation owner. Shared-file edits require one integration owner and an explicit merge order.

## validation debt

Use `docs/orchestrator/VALIDATION_DEBT.md` to record known out-of-scope validation failures. Validation debt does not replace current-task evidence or acceptance checks.

## handoff

Every handoff must include the active goal, current blockers, validation results, and the next concrete action.

## project-specific operations

- State is tracked in both root `STATE.json` and `docs/orchestrator/STATE.json`/`IMPLEMENTATION_STATE.md`; consult both before choosing the next action
- Continuation is state-driven, not chat-driven — use `docs/orchestrator/GOALS.md` and `docs/orchestrator/PLAN.md`
- Owner-facing updates must state the current goal, what was changed/verified, evidence, and end with a sentence beginning 'The next step is'
