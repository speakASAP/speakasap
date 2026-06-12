# PLAN: SpeakASAP Refactoring

## Current Phase: Intent-Preserved Legacy Portal Refactor

The previous growth-and-retention plan is superseded for this workstream by the owner instruction from 2026-06-12: move/refactor the legacy SpeakASAP portal into the new Alpharis/SpeakASAP platform using the internal intent preservation system before changing implementation code.

## Active Goal

**Goal 4 - Data Migration And Reconciliation**

Review auth bootstrap dry-run evidence and prepare the write-gated apply/rollback path. Auth-owned dry-run code exists in `auth-microservice`; no auth writes have been executed.

## Roadmap

1. Goal 1 - Intent Preservation And Refactor Governance
2. Goal 2 - Legacy Portal Inventory And Parity Map
3. Goal 3 - Service Ownership And API Contract Mapping
4. Goal 4 - Data Migration And Reconciliation
5. Goal 5 - Lesson Recording And Private Media Migration
6. Goal 6 - Gateway, Auth, And Frontend Parity
7. Goal 7 - Operational Cutover Readiness
8. Goal 8 - Controlled Cutover And Legacy Decommission

## Execution Rule

Work one goal chunk at a time. Do not change legacy production behavior, schema, auth, payment, or recording access until the relevant goal has acceptance criteria and verification evidence in `docs/orchestrator/STATUS.md`.

## Out Of Scope Unless Explicitly Approved

- Upgrading the legacy portal runtime from Python 3.4 / Django 1.11.2.
- Changing payments ownership away from `payments-microservice`.
- Changing auth ownership away from `auth-microservice`.
- Making lesson recordings public or bypassing presigned/private access.
- Destructive migration or legacy data deletion.
