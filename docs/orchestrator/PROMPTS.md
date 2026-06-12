# SpeakASAP Orchestrator Prompts

## Resume Refactor Work

Read `BUSINESS.md`, `SYSTEM.md`, `docs/orchestrator/MASTER_PROMPT.md`, `INTENT.md`, `GOALS.md`, `PLAN.md`, `STATUS.md`, `TASKS.md`, and `STATE.json`. Identify the earliest active or pending chunk. Restate the preserved SpeakASAP intent and the ownership boundaries affected by the chunk. Implement only that chunk, verify it, append status evidence, and end the owner-facing report with `The next step is ...`.

## Start A Migration Chunk

Select one legacy workflow from `speakasap-portal`, map it to a target service in `speakasap`, define gateway/auth/data/storage boundaries, and create acceptance criteria before changing code. Preserve Python 3.4 / Django 1.11.2 compatibility for legacy-side reference checks.

## Verify A Migration Chunk

Run the build, static check, smoke test, or direct runtime verification named in `docs/orchestrator/PLAN.md` or the selected goal. Record exact command outcomes in `docs/orchestrator/STATUS.md`. If a command cannot run, record the blocker and the safest next verification path.

## Owner Report Format

Report:

- Current goal/chunk.
- What changed.
- Evidence or verification.
- Risks or blockers.
- `The next step is ...`
