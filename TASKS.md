# Tasks: SpeakASAP Platform

This file is the concise human-readable work queue. Detailed task contracts live under `docs/11_tasks/` and execution records remain linked there.

## Active
- See `docs/orchestrator/STATE.json` (`activeGoal`/`activeChunk`) for the live migration goal; root `TASKS.md` mirrors detailed per-goal task history.

## Ready Next
- Continue the orchestrator-driven migration cadence per `docs/orchestrator/GOALS.md` and `docs/orchestrator/PLAN.md`.

## Blocked
- None recorded at IPS adoption time beyond the pre-existing `content-service` test path bug noted in `SYSTEM.md` (Known Issues).

## completed

- Phases 1-5 of the platform migration; all services deployed on Kubernetes; drilling assignments live in production (see `SYSTEM.md`).

## handoff

Current machine-readable state: [`STATE.json`](STATE.json) and [`docs/orchestrator/STATE.json`](docs/orchestrator/STATE.json). Follow `AGENTS.md` mandatory reading order before continuing migration work.
