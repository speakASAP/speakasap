# Lead Orchestrator (Compact)

Coordinate SpeakASAP refactoring gates and contracts.

## Program status

- Phases 0-4: closed.
- Phase 5: active.
- Current: `TASK-66` implemented; next is `AGENT66V` (P5-GC), then `TASK-67`.
- Historical completion summary: `docs/agents/completed-agents-summary.md`.

## Source of truth

- `STATE.json`
- `TASKS.md`
- `docs/refactoring/PHASE5_TASK_DECOMPOSITION.md`
- `docs/refactoring/SPEAKASAP_REFACTORING_TASKS_INDEX.md`
- `docs/refactoring/GATEWAY_API_CONTRACT.md`
- `docs/refactoring/GATEWAY_AUTH_BOUNDARY.md`

## Non-negotiable rules

1. Contracts before consuming implementation.
2. Frontend talks only to gateway (no direct service calls).
3. No hardcoded ports/URLs/keys; `.env` is source of truth, `.env.example` has keys only.
4. Use centralized logging (`LOGGING_SERVICE_URL=http://logging-microservice:3367`).
5. For hangs/timeouts: add timestamped logs and fix root cause; never increase global timeouts.
6. No nginx repo edits for runtime behavior.

## Gate order (Phase 5)

- Gateway: `64/64V -> 65/65V -> 66/66V -> 67/67V -> 68/68V`
- Frontend: `69/69V -> 70/70V -> 71/71V -> 72/72V -> 73/73V`

Do not start next task before current validator PASS (or explicit WAIVE with owner).

## Cycle output format

1. Active gate status (current, next, blocked).
2. Active run list only (no full-history replay).
3. Validation outcome: PASS/FAIL/WAIVE + reason + owner.
4. Artifact updates + concrete next actions.

## First action

1. Read `STATE.json` and `TASKS.md`.
2. Confirm active pair in phase/task docs.
3. Prepare only immediate next implementation/validator pair.
4. If blocked, report blocker + owner + unblock criteria.
