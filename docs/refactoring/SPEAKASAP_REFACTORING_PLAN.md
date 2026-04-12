# SpeakASAP Refactoring Plan

## Goal

Refactor the legacy Django monolith (`speakasap-portal`) into a modern, modular architecture using NestJS/Next.js and shared statex.cz microservices, starting with `marathon` as a standalone product extraction.

## Strategy

- Use a module-extraction (strangler) approach: replace legacy slices with new services while keeping legacy operational.
- Start with `marathon` because it is relatively isolated and explicitly called out in the roadmap.
- Keep integration minimal: thin legacy shim that routes to the new service.

## Scope

- New services live in `/Users/sergiystashok/Documents/GitHub/speakasap`.
- The `marathon` product lives in `/Users/sergiystashok/Documents/GitHub/marathon` with its own repo: `git@github.com:speakASAP/marathon.git`.
- Legacy integration changes live in `/Users/sergiystashok/Documents/GitHub/speakasap-portal` on branch `speakasap2.0`.
- Use shared microservices: auth, database-server, logging, notifications, payments, nginx, ai-microservice where needed.

## Out of Scope

- Analytics and monitoring (explicitly out of scope in roadmap).
- Helpdesk refactor (replaced by separate helpdesk-microservice).
- Automated tests (testing is manual, per roadmap).

## Constraints

- Do not modify production-ready services: database-server, auth-microservice, nginx-microservice, logging-microservice.
- No hardcoded configuration values. Use **`speakasap/.env`** as single source of truth; update **`speakasap/.env.example`** with keys only (`docs/infrastructure/ENV_MONOREPO.md`).
- Use centralized logging via `LOGGING_SERVICE_URL=http://logging-microservice:3367`.
- Respect request limit: max 30 items per request.
- No separate dev environment. Build and run directly on the future production server.

## Phase 0: Marathon Extraction — ✅ Complete (reference)

Phase 0 is **closed**. Evidence and checklists: `docs/refactoring/PHASE0_COMPLETION_CHECKLIST.md`, `docs/refactoring/MARATHON_PHASE0_VALIDATION.md`.

Original objectives (achieved for the marathon slice):

1. API contract for marathon and legacy integration.
2. `marathon` container (NestJS) with its own DB schema.
3. Legacy integration shim routing marathon flows to the new product.
4. Validation and cutover path for marathon traffic.
5. Legacy marathon code deprecation only after stable cutover (per runbook).

## Phase 1: Foundation & Content Service — ✅ **Complete** (2026-04-10)

**Goal:** Infrastructure foundation in `speakasap` plus **speakasap-content-service** (read-only), port **4201**, database **`speakasap_content_db`**, integrations: **logging**, **ai-microservice** (and notifications wiring per infra task). **Achieved.**

**Closure evidence:** `docs/refactoring/PHASE1_VALIDATION_REPORT.md`, `docs/refactoring/PHASE1_COMPLETION_SUMMARY.md`, `docs/refactoring/CONTENT_CUTOVER_CHECKLIST.md`.

**Orchestration (reference):** `docs/refactoring/PHASE1_TASK_DECOMPOSITION.md`, `docs/refactoring/PHASE1_ORCHESTRATION_SUMMARY.md`, `docs/refactoring/SPEAKASAP_REFACTORING_TASKS_INDEX.md`.

**Agent prompts (reference):** `docs/agents/AGENT11_INFRA_SETUP.md` … `docs/agents/AGENT16_PHASE1_VALIDATION.md`.

**Lead orchestrator prompt:** `docs/agents/master-prompt.md`.

## Phase 2: Certification & Assessment — **Current program focus**

**Prerequisite:** Phase 1 GO — **met 2026-04-10**.

**Goal:** Extract **speakasap-certification-service** (port **4202**, DB **`speakasap_certification_db`**) and **speakasap-assessment-service** (port **4203**, DB **`speakasap_assessment_db`**) per `docs/refactoring/ROADMAP.md` Phase 2.

**Orchestration:** `docs/refactoring/PHASE2_TASK_DECOMPOSITION.md`, `docs/refactoring/PHASE2_ORCHESTRATION_SUMMARY.md`, `docs/refactoring/SPEAKASAP_REFACTORING_TASKS_INDEX.md`.

**Agent prompts:** TASK-21…TASK-28 — each task has **two** prompts under `docs/agents/`: Implementation (`AGENT{NN}_*.md`) and Validator (`AGENT{NN}V_*_VALIDATE.md`). Validators must **PASS** before sync gates P2-A…P2-E advance.

**Assessment note:** `teacher_tests` is obsolete and **out of scope** (see ROADMAP Phase 2.2).

## Phase 0 Sync Points (Hard Gates)

Sync A: API contract + data mapping frozen

- Requires: `MARATHON_API_CONTRACT.md`, `MARATHON_DATA_MAPPING.md` approved

Sync B: Infra + env config validated

- Requires: `MARATHON_INFRA_PLAN.md` validated, env keys documented

Sync C: Legacy integration shim verified

- Requires: shim design and rollback path documented

Sync D: Cutover checklist approved

- Requires: `MARATHON_PHASE0_VALIDATION.md` GO decision

## Roadmap Alignment

The work aligns with the phased roadmap in `docs/refactoring/ROADMAP.md`:

- Phase 0: Marathon extraction (separate product).
- Phase 1+: Follow roadmap phases for other services (content, certification, assessment, core education, payments, notifications, frontend, integration).

## Data Strategy

- Define mapping from legacy marathon models to new service schema.
- Use a migration plan that supports dual-write or controlled cutover.
- Maintain data integrity with validation steps before traffic switch.

## Deployment Prep

- Docker-based production runtime and deployment manifests in `speakasap`.
- Runbook for production-only deployment on the new server (`ssh alfares`) with no execution until approved.

## Deliverables

- Top-level plan (this document).
- Task index and per-agent prompts in `docs/agents/`.
- Updated Lead Orchestrator prompt aligned to SpeakASAP refactor.
