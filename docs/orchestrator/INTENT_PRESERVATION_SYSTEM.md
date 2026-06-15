# SpeakASAP Intent Preservation System

## Purpose

This document defines the minimum process for preserving SpeakASAP product intent during the legacy Django portal to new microservice platform refactor.

SpeakASAP intent means online language education with private student data, course and lesson continuity, assessments, certifications, payments, notifications, and teacher/student workflows. Migration work must move behavior deliberately from speakasap-portal into the new platform without silently changing product behavior, data ownership, access rules, or rollback ability.

## Preserved Intent Chain

Every implementation chunk must keep this chain explicit:

1. Legacy behavior and data source.
2. New service owner and API boundary.
3. Target schema or contract.
4. No-write reconciliation evidence.
5. Approval status for writes, object mutation, deployment, and route retirement.
6. Verification evidence after each approved action.
7. Rollback path.
8. State documentation update.

## Local Sources Of Truth

Read and update these files before migration work is considered complete:

- BUSINESS.md
- SYSTEM.md
- TASKS.md
- STATE.json
- docs/orchestrator/MASTER_PROMPT.md
- docs/orchestrator/IMPLEMENTATION_ORCHESTRATOR.md
- docs/orchestrator/INTENT.md
- docs/orchestrator/GOALS.md
- docs/orchestrator/PLAN.md
- docs/orchestrator/IMPLEMENTATION_STATE.md
- docs/orchestrator/STATE.json
- docs/orchestrator/STATUS.md

Use RAG first when reachable. If RAG is unavailable, continue from repository evidence and record the outage in STATUS.md.

## Stage 0 - Intake

Record the owner request, exact scope, excluded scope, and active goal. Do not expand the goal silently.

For write/deploy work, identify whether the requested action touches target DB rows, object storage, public routes, secrets, payments, notifications, private media, or legacy retirement.

## Stage 1 - Legacy Evidence

Before designing target behavior, collect repository-backed evidence from speakasap-portal or other legacy sources:

- models and migrations;
- fixtures and data export paths;
- templates and template tags;
- CSS/SCSS and static assets;
- URL/API behavior;
- private/public access rules;
- media and storage paths;
- edge cases and known data exceptions.

Record file paths and report artifacts in STATUS.md or a goal-specific evidence document.

## Stage 2 - Ownership

Map each legacy behavior to exactly one target owner:

- content-service for public educational content;
- course-service for commercial product/offering ownership;
- education-service for private learner progress, access, and lesson records;
- assessment-service and certification-service for tests and certificates;
- payment-service, salary-service, and notification-service for their bounded domains;
- api-gateway for public routing and auth enforcement;
- frontend for presentation only.

If ownership is unclear, stop before writes/deploys and document the decision needed.

## Stage 3 - Plan And Gates

Every migration plan must separate these gates:

- code/schema preparation;
- schema-only apply;
- no-write DB reconciliation;
- data apply;
- media/object mutation;
- deployment;
- browser/runtime validation;
- legacy route retirement.

Each gate needs fresh evidence and explicit approval when it can mutate production state.

## Stage 4 - Implementation

Keep changes scoped to the active goal and service owner. Preserve existing product behavior unless the owner explicitly approves a behavior change.

For frontend migrations, preserve learner-visible typography, spacing, and readability when the legacy page was intentionally tuned for the audience.

For importers and migration scripts:

- dry-run must be the default;
- apply must require explicit write flags;
- rollback SQL or rollback procedure must be produced before writes;
- reports must include source counts, target counts, conflicts, skipped rows, and blocking issues;
- scripts must refuse unsafe rendered HTML, unresolved templates, or unsupported legacy constructs when relevant.

## Stage 5 - Verification

Required evidence scales with risk:

- static compile/build checks for touched services;
- Prisma validation for schema changes;
- no-write reconciliation before and after data writes;
- smoke checks for deployed API/frontend routes;
- browser checks for user-facing frontend changes;
- access-control checks for private data and media;
- media availability checks for public assets.

Save report paths in /tmp and summarize them in STATUS.md.

## Stage 6 - Approval Status

No migration step may infer approval from prior unrelated work. Record exactly what was approved and what remains unapproved.

Write-gated actions include:

- database schema migrations;
- data imports or backfills;
- object storage copy/delete/mutation;
- image build/push and Kubernetes deployment;
- public route changes or cutover;
- legacy route retirement;
- rollback execution or destructive cleanup.

## Stage 7 - Rollback

Before approved writes or deploys, define the rollback path:

- schema rollback or forward-fix approach;
- data rollback SQL path;
- media/object cleanup or restore process;
- deployment rollback command or previous image/manifests;
- legacy fallback route status.

Rollback plans must not depend on chat memory alone.

## Stage 8 - State Update

After each chunk, update the orchestrator state files with:

- active goal and chunk;
- changed/verified behavior;
- evidence report paths;
- approval status;
- remaining blockers;
- next action.

## Required Commit Message Block

Migration commits must include this block:

~~~text
Intent:
- <owner request and preserved product behavior>

Legacy evidence:
- <legacy files/data/reports used>

Ownership:
- <target service/API/frontend ownership>

Verification:
- <builds, dry-runs, reports, smoke/browser checks>

Approval:
- <approved writes/deploys or no write/deploy approval used>

Rollback:
- <rollback SQL/procedure/deployment fallback>
~~~

## Completion Standard

A migration chunk is complete only when implementation, evidence, approval status, rollback path, and orchestrator state are all recorded. If production-impacting approval is still missing, the chunk is prepared but not complete.
