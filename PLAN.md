# PLAN: SpeakASAP Refactoring

## Current Phase: Intent-Preserved Legacy Portal Refactor

The previous growth-and-retention plan is superseded for this workstream by the owner instruction from 2026-06-12: move/refactor the legacy SpeakASAP portal into the new Alpharis/SpeakASAP platform using the internal intent preservation system before changing implementation code.

## Where The Work Actually Is (read this first)

Two workstreams run in this repo and they are documented in different places.

- **`TASKS.md` is the live front.** The lesson-API / drilling workstream is tracked
  there and is current to 2026-08-10. Start there.
- **`docs/orchestrator/` is the goal backlog.** `GOALS.md` holds Goals 1-10 and their
  chunk status. `STATUS.md` is an append-only evidence log whose last entry is
  **2026-06-24**; it is history, not current state. Do not infer "nothing happened
  since June" from it — the drilling work after that date was recorded in `TASKS.md`
  and in `docs/superpowers/plans/`.

## Active Goals

**Goal 9 - Salary And Recording-Duration Payroll Migration** (active, chunk 9.6)

Goal 9.5 is complete at scoped-smoke level. 9.6 is open: write gates, rollback
evidence, deploy/rerun evidence, and payment-boundary approval before any broader
salary calculation or payout.

The live blocker is recorded in `TASKS.md`: `internal-salary.service.ts` still
aggregates the **frozen** `education_lesson` copy (182,600 rows, last start
2026-06-26), so finished lessons after that date are missing from teacher payout
aggregation and the gap grows daily.

**Goal 10 - Seven-Lesson Course Frontend Migration** (paused, chunks 10.3/10.4/10.6)

Schema, importer, and public frontend are in. Outstanding: DB-backed no-write
report, owner-approved apply with rollback SQL, and visual-parity verification.

## Cutover Status

**Cutover has not happened.** `speakasap.com` still resolves to the legacy Django
portal on a separate host (136.243.102.222). The new platform serves
`speakasap.alfares.cz` only. Goal 8 is marked done because the controlled-cutover
*validation* ran and the owner chose legacy retention as fallback/reference — not
because traffic moved.

## Roadmap

1. Goal 1 - Intent Preservation And Refactor Governance — done
2. Goal 2 - Legacy Portal Inventory And Parity Map — done
3. Goal 3 - Service Ownership And API Contract Mapping — done
4. Goal 4 - Data Migration And Reconciliation — done
5. Goal 5 - Lesson Recording And Private Media Migration — done
6. Goal 6 - Gateway, Auth, And Frontend Parity — done
7. Goal 7 - Operational Cutover Readiness — done
8. Goal 8 - Controlled Cutover And Legacy Decommission — done (validation only; see above)
9. Goal 9 - Salary And Recording-Duration Payroll Migration — **active**
10. Goal 10 - Seven-Lesson Course Frontend Migration — paused
11. Goal 11 - Legacy Retirement And Domain Cutover — not started (see `TASKS.md`)

## Execution Rule

Work one goal chunk at a time. Do not change legacy production behavior, schema, auth, payment, or recording access until the relevant goal has acceptance criteria and verification evidence in `docs/orchestrator/STATUS.md`.

## Out Of Scope Unless Explicitly Approved

- Upgrading the legacy portal runtime from Python 3.4 / Django 1.11.2.
- Changing payments ownership away from `payments-microservice`.
- Changing auth ownership away from `auth-microservice`.
- Making lesson recordings public or bypassing presigned/private access.
- Destructive migration or legacy data deletion.
