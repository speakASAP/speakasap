# Phase 2 Task Decomposition

**Date:** 2026-04-10
**Last updated:** 2026-04-10
**Status:** Ready for execution after Phase 1 GO (TASK-16)
**Phase:** Independent Services — Certification & Assessment
**Lead Orchestrator:** `docs/agents/master-prompt.md`
**Summary:** `PHASE2_ORCHESTRATION_SUMMARY.md`

---

## Phase 2 Overview

**Goal:** Extract two low-coupling services from `speakasap-portal`: **Certification** and **Assessment**, with contracts before code, manual validation, and a thin legacy shim only when required.

**Roadmap reference:** `docs/refactoring/ROADMAP.md` — Phase 2 (Independent Services).

| Service | Port | Database |
| ------- | ---- | -------- |
| speakasap-certification-service | 4202 | speakasap_certification_db |
| speakasap-assessment-service | 4203 | speakasap_assessment_db |

**Legacy apps (Django) — certification:**

- `certificates`, `education_certificates`, `quests`, `user_quest`

**Legacy apps (Django) — assessment:**

- `language_tests`, `user_tests`
- **Out of scope:** `teacher_tests` (obsolete; do not migrate or model)

**Dual-prompt rule:** For every TASK-21…TASK-28, run the **Implementation** agent prompt first, then the **Validator** prompt (`AGENT{NN}V_*_VALIDATE.md`). The Lead Orchestrator clears sync gates only when the Validator outcome is **PASS** (or documented **WAIVE** with owner sign-off).

---

## Global Dependency Graph

```text
Phase 1 GO (TASK-16) → Phase 2
TASK-21 → TASK-22 ∥ TASK-25
TASK-22 → TASK-23 → TASK-24
TASK-25 → TASK-26 → TASK-27
(TASK-24 and TASK-27 may run in parallel after TASK-23 and TASK-26 validators PASS, if no shared migration tooling conflict)
TASK-24 + TASK-27 → TASK-28
```

---

## Phase 2 Task Groups

### Group A: Phase 2 Infrastructure Scaffold (Sequential)

**Parallel?** NO — must complete before contract tasks.
**Dependencies:** Phase 1 GO (orchestrator sign-off: TASK-16 validation/cutover).
**Outputs:** Two NestJS service scaffolds, compose/deploy alignment, env keys, `/health`, logging bootstrap.
**Agents:** 1 (Infra/Docker) + 1 Validator.

**Tasks:** TASK-21

---

### Group B: Certification Track

**Parallel?** Contract (TASK-22) can run in parallel with Assessment contract (TASK-25) after TASK-21.
**Dependencies:** TASK-21 → TASK-22 → TASK-23 → TASK-24.
**Outputs:** Contract docs, implementation, migration artifacts.
**Agents:** Implementation + Validator per task.

**Tasks:** TASK-22, TASK-23, TASK-24

---

### Group C: Assessment Track

**Parallel?** Same as Group B; TASK-25 parallel with TASK-22 after TASK-21.
**Dependencies:** TASK-21 → TASK-25 → TASK-26 → TASK-27.
**Outputs:** Contract docs, implementation, migration artifacts.
**Agents:** Implementation + Validator per task.

**Tasks:** TASK-25, TASK-26, TASK-27

---

### Group D: Phase 2 Program Validation

**Parallel?** NO — after TASK-24 and TASK-27.
**Dependencies:** TASK-21…TASK-27 (all prior validators PASS).
**Outputs:** `PHASE2_VALIDATION_REPORT.md`, `PHASE2_CUTOVER_CHECKLIST.md`, GO/NO-GO.
**Agents:** 1 (QA/Contract Validator) + meta-validator.

**Tasks:** TASK-28

---

## Parallelism Gate (TASK-24 ∥ TASK-27)

TASK-24 and TASK-27 **may** execute in parallel only if:

1. `AGENT23V_CERTIFICATION_IMPLEMENTATION_VALIDATE.md` and `AGENT26V_ASSESSMENT_IMPLEMENTATION_VALIDATE.md` are both **PASS**.
2. No single shared migration runner or DB session blocks both (separate databases: certification vs assessment).
3. Lead Orchestrator records the decision in `PHASE2_ORCHESTRATION_SUMMARY.md` or validation notes.

If uncertain, run TASK-24 then TASK-27 sequentially.

---

## Individual Agent Tasks

### TASK-21: Phase 2 Service Scaffolds (Certification + Assessment)

**Agent Type:** Infra/Docker Agent
**Dependencies:** Phase 1 GO (TASK-16)
**Parallel Execution:** NO

#### Objective

Add **speakasap-certification-service** and **speakasap-assessment-service** as NestJS scaffolds in `speakasap`, aligned with `content-service` patterns (logging, env validation, health, Docker/deploy hooks at repo level).

#### Scope

- Create service directories under `speakasap/` (e.g. `certification-service/`, `assessment-service/`).
- Wire into root `docker-compose.yml` / deploy story per existing Phase 1 patterns.
- Reserve ports **4202** and **4203** per `docs/infrastructure/PORT_ALLOCATION.md`.
- `.env.example` keys only (no secrets); document DB names `speakasap_certification_db`, `speakasap_assessment_db`.
- Centralized logging via `LOGGING_SERVICE_URL`.
- `/health` endpoint on each scaffold.

#### Inputs

- `docs/refactoring/ROADMAP.md` Phase 2
- `docs/infrastructure/PORT_ALLOCATION.md`
- `docs/infrastructure/SHARED_SERVICES.md`
- `speakasap/content-service/` as structural reference
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`

#### Do

- Scaffold NestJS apps that **build** (`npm run build`) with minimal modules (app module + health).
- Use env-driven config; extend root `.env.example` with Phase 2 keys.
- Document service README stubs pointing to upcoming contracts.

#### Do Not

- Do not implement domain APIs (TASK-23 / TASK-26).
- Do not modify database-server, auth-microservice, nginx-microservice, logging-microservice **codebases**.
- Do not hardcode URLs, ports, or secrets.
- Do not add automated tests unless explicitly requested.

#### Outputs

- `speakasap/certification-service/` — scaffold + `README.md` + `.env.example`
- `speakasap/assessment-service/` — scaffold + `README.md` + `.env.example`
- Root compose / deploy documentation updates as needed
- Optional: `docs/refactoring/PHASE2_INFRA_NOTES.md` if cross-service notes are required

#### Exit Criteria

- Both services build locally.
- Both expose `/health` (behavior documented).
- Ports 4202 / 4203 and DB names documented.
- Validator PASS for TASK-21.

#### Agent Prompts

- Implementation: `docs/agents/AGENT21_PHASE2_INFRA.md`
- Validator: `docs/agents/AGENT21V_PHASE2_INFRA_VALIDATE.md`

---

### TASK-22: Certification — Design and API Contract

**Agent Type:** Backend Service Agent (Design)
**Dependencies:** TASK-21
**Parallel Execution:** YES — with TASK-25 after TASK-21

#### Objective

Freeze **Certification** API contract and legacy→new data mapping for models under `certificates`, `education_certificates`, `quests`, `user_quest`.

#### Scope

- Analyze legacy Django models and user-facing flows (certificate issuance, PDF generation, quests/gamification).
- Define REST API (read/write as required by parity — not limited to read-only).
- Pagination: max **30** items per list request.
- Error shapes and idempotency notes for write operations where relevant.
- PDF generation: document template storage, rendering approach, and async/sync expectations in contract.
- Legacy URL / route mapping table (legacy → new).

#### Inputs

- Legacy repo: `/Users/sergiystashok/Documents/GitHub/speakasap-portal`
- `docs/refactoring/ROADMAP.md` § 2.1
- `docs/refactoring/PHASE2_TASK_DECOMPOSITION.md` (this file)

#### Do

- Produce `docs/refactoring/CERTIFICATION_API_CONTRACT.md`.
- Produce `docs/refactoring/CERTIFICATION_DATA_MAPPING.md`.
- Optional draft: `speakasap/certification-service/prisma/schema.prisma` (if Prisma is used — align with TASK-23).

#### Do Not

- Do not implement business logic beyond schema draft (TASK-23).
- Do not migrate data (TASK-24).
- Do not invent new domain terms; reuse legacy names where possible.

#### Outputs

- `docs/refactoring/CERTIFICATION_API_CONTRACT.md`
- `docs/refactoring/CERTIFICATION_DATA_MAPPING.md`
- Optional: draft Prisma schema under `certification-service/`

#### Exit Criteria

- Lead Orchestrator freezes contract (Sync P2-B partial — certification side).
- Validator PASS for TASK-22.

#### Agent Prompts

- Implementation: `docs/agents/AGENT22_CERTIFICATION_DESIGN.md`
- Validator: `docs/agents/AGENT22V_CERTIFICATION_DESIGN_VALIDATE.md`

---

### TASK-23: Certification — Implementation

**Agent Type:** Backend Service Agent (Implementation)
**Dependencies:** TASK-21, TASK-22
**Parallel Execution:** YES — with TASK-26 after TASK-25 (independent tracks)

#### Objective

Implement **speakasap-certification-service** per frozen `CERTIFICATION_API_CONTRACT.md` and data model.

#### Scope

- NestJS modules, persistence, controllers/services.
- Integrate centralized logging (timestamps, `duration_ms` on outbound calls).
- Dockerfile / service-level deploy alignment with repo patterns.

#### Inputs

- `docs/refactoring/CERTIFICATION_API_CONTRACT.md`
- `docs/refactoring/CERTIFICATION_DATA_MAPPING.md`
- `docs/infrastructure/SHARED_SERVICES.md`

#### Do

- Implement all endpoints from the frozen contract.
- Enforce max 30 items per request on list endpoints.
- Use `.env` for all external configuration.

#### Do Not

- Do not change frozen contract without orchestrator-approved revision and validator re-run.
- Do not modify forbidden shared microservices.
- Do not run production cutover (TASK-28).

#### Outputs

- `speakasap/certification-service/src/` — full implementation
- Service `README.md` updated with endpoints and env vars

#### Exit Criteria

- `npm run build` passes.
- Manual smoke per contract checklist (documented in validator).
- Validator PASS for TASK-23.

#### Agent Prompts

- Implementation: `docs/agents/AGENT23_CERTIFICATION_IMPLEMENTATION.md`
- Validator: `docs/agents/AGENT23V_CERTIFICATION_IMPLEMENTATION_VALIDATE.md`

---

### TASK-24: Certification — Data Migration

**Agent Type:** Data Migration Agent
**Dependencies:** TASK-22, TASK-23
**Parallel Execution:** YES — with TASK-27 only if parallelism gate (above) is satisfied

#### Objective

Migrate legacy certification-related data into `speakasap_certification_db` with validation and rollback notes.

#### Scope

- ETL or migration scripts/processes **inside speakasap repo** (reuse Phase 1 migration patterns if present).
- Row counts / checksums / spot checks vs legacy.
- Document failures and remediation.

#### Inputs

- `docs/refactoring/CERTIFICATION_DATA_MAPPING.md`
- Legacy DB access patterns from `speakasap-portal`
- Running certification-service schema (from TASK-23)

#### Do

- Produce migration log and validation doc.
- Preserve referential integrity per mapping.

#### Do Not

- Do not migrate `teacher_tests` or other assessment models here.
- Do not increase timeouts to mask hangs; log with timestamps to find blockers.

#### Outputs

- `docs/refactoring/CERTIFICATION_DATA_MIGRATION_LOG.md`
- `docs/refactoring/CERTIFICATION_DATA_VALIDATION.md`

#### Exit Criteria

- Validation doc shows parity criteria met or lists explicit gaps with owner sign-off.
- Validator PASS for TASK-24.

#### Agent Prompts

- Implementation: `docs/agents/AGENT24_CERTIFICATION_MIGRATION.md`
- Validator: `docs/agents/AGENT24V_CERTIFICATION_MIGRATION_VALIDATE.md`

---

### TASK-25: Assessment — Design and API Contract

**Agent Type:** Backend Service Agent (Design)
**Dependencies:** TASK-21
**Parallel Execution:** YES — with TASK-22 after TASK-21

#### Objective

Freeze **Assessment** API contract and data mapping for `language_tests` and `user_tests`. Explicitly exclude `teacher_tests`.

#### Scope

- Test definition, assignment, attempt, scoring, and reporting flows per legacy behavior.
- Admin vs student (or teacher-facing) endpoints as required for parity.
- Pagination max 30; error shapes; scoring rules documented.

#### Inputs

- Legacy repo: `/Users/sergiystashok/Documents/GitHub/speakasap-portal`
- `docs/refactoring/ROADMAP.md` § 2.2

#### Do

- Produce `docs/refactoring/ASSESSMENT_API_CONTRACT.md`.
- Produce `docs/refactoring/ASSESSMENT_DATA_MAPPING.md`.
- State **exclusion** of `teacher_tests` in both documents.
- Optional draft: `speakasap/assessment-service/prisma/schema.prisma`.

#### Do Not

- Do not scope `teacher_tests`.
- Do not implement service logic (TASK-26).

#### Outputs

- `docs/refactoring/ASSESSMENT_API_CONTRACT.md`
- `docs/refactoring/ASSESSMENT_DATA_MAPPING.md`
- Optional: draft Prisma schema under `assessment-service/`

#### Exit Criteria

- Contract frozen (Sync P2-B partial — assessment side).
- Validator PASS for TASK-25.

#### Agent Prompts

- Implementation: `docs/agents/AGENT25_ASSESSMENT_DESIGN.md`
- Validator: `docs/agents/AGENT25V_ASSESSMENT_DESIGN_VALIDATE.md`

---

### TASK-26: Assessment — Implementation

**Agent Type:** Backend Service Agent (Implementation)
**Dependencies:** TASK-21, TASK-25
**Parallel Execution:** YES — with TASK-23 after respective contracts

#### Objective

Implement **speakasap-assessment-service** per frozen assessment contract.

#### Scope

- NestJS implementation, persistence, scoring logic per contract.
- Logging and env discipline.

#### Inputs

- `docs/refactoring/ASSESSMENT_API_CONTRACT.md`
- `docs/refactoring/ASSESSMENT_DATA_MAPPING.md`

#### Do

- Implement endpoints and rules exactly as frozen contract.
- Max 30 items on list endpoints.

#### Do Not

- Do not add `teacher_tests`.
- Do not drift from contract without orchestrator-approved update.

#### Outputs

- `speakasap/assessment-service/src/` — full implementation
- Updated service `README.md`

#### Exit Criteria

- Build passes; manual smoke per validator checklist.
- Validator PASS for TASK-26.

#### Agent Prompts

- Implementation: `docs/agents/AGENT26_ASSESSMENT_IMPLEMENTATION.md`
- Validator: `docs/agents/AGENT26V_ASSESSMENT_IMPLEMENTATION_VALIDATE.md`

---

### TASK-27: Assessment — Data Migration

**Agent Type:** Data Migration Agent
**Dependencies:** TASK-25, TASK-26
**Parallel Execution:** YES — with TASK-24 if parallelism gate satisfied

#### Objective

Migrate `language_tests` and `user_tests` data into `speakasap_assessment_db` with validation.

#### Scope

- Migration tooling, logs, validation, rollback notes.
- Confirm no `teacher_tests` data imported.

#### Inputs

- `docs/refactoring/ASSESSMENT_DATA_MAPPING.md`
- Legacy portal DB

#### Do

- Produce log + validation artifacts.

#### Do Not

- Do not migrate `teacher_tests`.

#### Outputs

- `docs/refactoring/ASSESSMENT_DATA_MIGRATION_LOG.md`
- `docs/refactoring/ASSESSMENT_DATA_VALIDATION.md`

#### Exit Criteria

- Validator PASS for TASK-27.

#### Agent Prompts

- Implementation: `docs/agents/AGENT27_ASSESSMENT_MIGRATION.md`
- Validator: `docs/agents/AGENT27V_ASSESSMENT_MIGRATION_VALIDATE.md`

---

### TASK-28: Phase 2 Validation, Cutover, and Legacy Shim

**Agent Type:** QA/Contract Validator Agent (program level)
**Dependencies:** TASK-21…TASK-27 (all prior validators PASS)
**Parallel Execution:** NO

#### Objective

Prove parity vs legacy for certification and assessment flows, document GO/NO-GO, and define thin legacy shim + rollback on `speakasap-portal` branch `speakasap2.0` **only if required**.

#### Scope

- End-to-end manual matrix: legacy vs new APIs (representative flows).
- Confirm logging, env, pagination, and no forbidden shared-service code changes.
- `PHASE2_VALIDATION_REPORT.md`, `PHASE2_CUTOVER_CHECKLIST.md`.
- Shim design doc if portal changes are needed.

#### Inputs

- All Phase 2 artifacts and prior validator outcomes
- `docs/refactoring/SPEAKASAP_REFACTORING_PLAN.md`

#### Do

- Record evidence (timestamps, sample requests, key metrics).
- List blocking defects with TASK ownership.

#### Do Not

- Do not declare GO with open critical defects.
- Do not broaden scope to Phase 3.

#### Outputs

- `docs/refactoring/PHASE2_VALIDATION_REPORT.md`
- `docs/refactoring/PHASE2_CUTOVER_CHECKLIST.md`
- Optional: `docs/refactoring/PHASE2_PORTAL_SHIM.md`

#### Exit Criteria

- GO/NO-GO recorded.
- Meta-validator PASS for TASK-28.

#### Agent Prompts

- Implementation: `docs/agents/AGENT28_PHASE2_VALIDATION.md`
- Validator: `docs/agents/AGENT28V_PHASE2_VALIDATION_VALIDATE.md`

---

## Phase 2 Sync Points

### Sync P2-A: Phase 2 scaffolds ready

**When:** After TASK-21 + validator PASS
**Gate:** TASK-22 and TASK-25 may start

### Sync P2-B: Contracts frozen (certification + assessment)

**When:** After TASK-22 and TASK-25 + validators PASS
**Gate:** TASK-23 and TASK-26 may start
**Status:** ✅ Cleared **2026-04-11** (`AGENT22V`, `AGENT25V` PASS).

### Sync P2-C: Implementation matches contracts

**When:** After TASK-23 and TASK-26 + validators PASS
**Gate:** TASK-24 and TASK-27 may start (subject to parallelism gate)

### Sync P2-D: Migrations validated

**When:** After TASK-24 and TASK-27 + validators PASS
**Gate:** TASK-28 may start

### Sync P2-E: Phase 2 program GO

**When:** After TASK-28 + meta-validator PASS
**Gate:** Phase 2 cutover or Phase 3 planning

---

## Phase 2 Success Criteria

Phase 2 is **COMPLETE** when:

1. Both services run with `/health` and implemented APIs per frozen contracts.
2. Data migrated with documented validation; `teacher_tests` absent from assessment scope.
3. No hardcoded secrets/URLs; `.env.example` keys aligned.
4. Centralized logging used for critical operations.
5. `PHASE2_VALIDATION_REPORT.md` states **GO** (or NO-GO with explicit fix tasks).
6. `PHASE2_CUTOVER_CHECKLIST.md` approved by Lead Orchestrator.

---

## Agent Prompts (canonical)

Per task: run **Implementation** then **Validator**.

| Task | Implementation | Validator |
| ---- | -------------- | --------- |
| TASK-21 | `docs/agents/AGENT21_PHASE2_INFRA.md` | `docs/agents/AGENT21V_PHASE2_INFRA_VALIDATE.md` |
| TASK-22 | `docs/agents/AGENT22_CERTIFICATION_DESIGN.md` | `docs/agents/AGENT22V_CERTIFICATION_DESIGN_VALIDATE.md` |
| TASK-23 | `docs/agents/AGENT23_CERTIFICATION_IMPLEMENTATION.md` | `docs/agents/AGENT23V_CERTIFICATION_IMPLEMENTATION_VALIDATE.md` |
| TASK-24 | `docs/agents/AGENT24_CERTIFICATION_MIGRATION.md` | `docs/agents/AGENT24V_CERTIFICATION_MIGRATION_VALIDATE.md` |
| TASK-25 | `docs/agents/AGENT25_ASSESSMENT_DESIGN.md` | `docs/agents/AGENT25V_ASSESSMENT_DESIGN_VALIDATE.md` |
| TASK-26 | `docs/agents/AGENT26_ASSESSMENT_IMPLEMENTATION.md` | `docs/agents/AGENT26V_ASSESSMENT_IMPLEMENTATION_VALIDATE.md` |
| TASK-27 | `docs/agents/AGENT27_ASSESSMENT_MIGRATION.md` | `docs/agents/AGENT27V_ASSESSMENT_MIGRATION_VALIDATE.md` |
| TASK-28 | `docs/agents/AGENT28_PHASE2_VALIDATION.md` | `docs/agents/AGENT28V_PHASE2_VALIDATION_VALIDATE.md` |

---

**Last Updated:** 2026-04-11
