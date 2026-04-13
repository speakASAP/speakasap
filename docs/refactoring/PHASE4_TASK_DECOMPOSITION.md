# Phase 4 Task Decomposition — Payment, Notification, Salary, Financial

**Date:** 2026-04-13  
**Lead Orchestrator:** `docs/agents/master-prompt.md`  
**Summary:** `PHASE4_ORCHESTRATION_SUMMARY.md`  
**Roadmap:** `ROADMAP.md` Section 5 — Phase 4 (§4.1 Payment, §4.2 Notification, §4.3 Salary, §4.5 Financial)

**Prerequisites:** Phase 3 gates **P3-UE**, **P3-CE**, **P3-EE** are closed in `SPEAKASAP_REFACTORING_TASKS_INDEX.md`.

## Dual-prompt rule

Every task in **TASK-44…TASK-63** runs in strict order:

1. Implementation prompt: `docs/agents/AGENT{NN}_*.md`
2. Validator prompt: `docs/agents/AGENT{NN}V_*_VALIDATE.md`

Sync gates clear only on Validator **PASS** (or documented **WAIVE** with Lead sign-off).

## Cross-cutting constraints

- Use shared dependencies via HTTP only: `payments-microservice`, `notifications-microservice`, `auth-microservice`, `logging-microservice`.
- Never modify shared microservice repositories.
- Do not use `orders-microservice` unless scope explicitly reopens.
- Keep config in `speakasap/.env`; keep key names in `speakasap/.env.example`.
- List endpoints enforce `limit <= 30`.
- For hangs/timeouts: add timestamped logs; do not increase global timeouts.

## Financial `products` boundary

`ROADMAP.md` maps `products` to both course and financial contexts. TASK-60 must freeze one model:

- Course is source of truth; financial consumes via read API/events, or
- Financial owns projection with explicit ETL ownership and immutability rules.

No duplicate writable source of truth.

## Global dependency graph

```text
Phase3_closed → TASK-44..48 → TASK-49..53 → TASK-54..58 → TASK-59..63
```

## Wave 1 — Payment (`speakasap-payment-service`)

**Port:** 4208  
**DB:** `speakasap_payment_db`  
**Legacy apps:** `orders`, `discount`, `subscription`

### Sync gates

| Sync  | After | Gate |
| ----- | ----- | ---- |
| P4-OA | TASK-44 + AGENT44V | Scaffold complete |
| P4-OB | TASK-45 + AGENT45V | Contract + mapping frozen |
| P4-OC | TASK-46 + AGENT46V | Implementation matches contract |
| P4-OD | TASK-47 + AGENT47V | Migration artifacts validated |
| P4-OE | TASK-48 + AGENT48V | Program report + cutover checklist |

**Gate log:** **P4-OA** — **PASS** **2026-04-13** — evidence: `docs/agents/AGENT44V_PAYMENT_SERVICE_SCAFFOLD_VALIDATE.md`.

### TASK-44: Payment scaffold

- **Objective:** Create service skeleton aligned with Phase 3 patterns.
- **Inputs:** `ROADMAP.md`, `PORT_ALLOCATION.md`, service templates from `course-service/` and `user-service/`.
- **Deliverables:** `payment-service/` scaffold, `/health`, compose wiring, README.
- **Acceptance criteria:** `npm run build` pass; env keys defined; logs wired to `LOGGING_SERVICE_URL`.
- **Integration matrix:** none beyond future client stubs.
- **Risks/decisions:** avoid accidental nginx edits.
- **Handoff:** `AGENT44V_PAYMENT_SERVICE_SCAFFOLD_VALIDATE.md` for **P4-OA**.

### TASK-45: Payment design

- **Objective:** Freeze `PAYMENT_API_CONTRACT.md` and `PAYMENT_DATA_MAPPING.md`.
- **Inputs:** legacy `orders`, `discount`, `subscription`; Phase 3 contracts where required.
- **Deliverables:** contract doc, mapping doc, error model, pagination rules.
- **Acceptance criteria:** explicit webhook endpoints; idempotency and retry behavior documented; list limit max 30.
- **Integration matrix:** `payments-microservice` HTTP API, optional read-only dependencies on user/course/education identifiers.
- **Risks/decisions:** subscription ownership (payment-only vs education hooks).
- **Handoff:** `AGENT45V_PAYMENT_SERVICE_DESIGN_VALIDATE.md` for **P4-OB**.

### TASK-46: Payment implementation

- **Objective:** Implement controllers/services/repos exactly per frozen contract.
- **Inputs:** `PAYMENT_API_CONTRACT.md`, `PAYMENT_DATA_MAPPING.md`, scaffold.
- **Deliverables:** modules, DTOs, Prisma schema updates, webhook controller, provider client adapter.
- **Acceptance criteria:** build passes; webhook idempotency implemented; no hardcoded URLs/credentials.
- **Integration matrix:** payment capture/refund/status via `payments-microservice`; optional notification trigger events/contracts as defined.
- **Risks/decisions:** signature verification, replay attacks, duplicate webhook delivery.
- **Handoff:** `AGENT46V_PAYMENT_SERVICE_IMPLEMENTATION_VALIDATE.md` for **P4-OC**.

### TASK-47: Payment migration

- **Objective:** Migrate legacy order/payment/subscription data with deterministic replay-safe flow.
- **Inputs:** `PAYMENT_DATA_MAPPING.md`, legacy schema verification.
- **Deliverables:** ETL script, migration log, validation report, rollback notes.
- **Acceptance criteria:** counts reconciled, FK orphans reported, dry-run mode documented.
- **Integration matrix:** no runtime shared-service calls required for migration.
- **Risks/decisions:** duplicate rows, inconsistent status enums, historical invoice references.
- **Handoff:** `AGENT47V_PAYMENT_SERVICE_MIGRATION_VALIDATE.md` for **P4-OD**.

### TASK-48: Payment program validation

- **Objective:** Provide GO/NO-GO decision for payment wave.
- **Inputs:** TASK-44..47 outputs and validator evidence.
- **Deliverables:** `PHASE4_PAYMENT_VALIDATION_REPORT.md`, `PHASE4_PAYMENT_CUTOVER_CHECKLIST.md`.
- **Acceptance criteria:** gate summary table present; deferred items clearly marked with owner.
- **Integration matrix:** smoke matrix includes `/health` and core payment routes.
- **Risks/decisions:** deferred production routing, webhook external dependency windows.
- **Handoff:** `AGENT48V_PAYMENT_PHASE4_VALIDATION_VALIDATE.md` for **P4-OE**.

## Wave 2 — Notification (`speakasap-notification-service`)

**Port:** 4209  
**DB:** `speakasap_notification_db`  
**Legacy apps:** `notifications`, `ses`, SmartResponder boundaries

### Sync gates

| Sync  | After | Gate |
| ----- | ----- | ---- |
| P4-NA | TASK-49 + AGENT49V | Scaffold complete |
| P4-NB | TASK-50 + AGENT50V | Contract + mapping frozen |
| P4-NC | TASK-51 + AGENT51V | Implementation matches contract |
| P4-ND | TASK-52 + AGENT52V | Migration artifacts validated |
| P4-NE | TASK-53 + AGENT53V | Program report + cutover checklist |

### TASK-49: Notification scaffold

- **Objective:** Bootstrap notification service with standard infra and health endpoint.
- **Inputs:** Phase 3 scaffold patterns, roadmap notification scope.
- **Deliverables:** `notification-service/` skeleton, env keys, compose entries, README.
- **Acceptance criteria:** build pass, `/health` works, centralized logging active.
- **Integration matrix:** no delivery logic yet.
- **Risks/decisions:** avoid embedding provider logic in scaffold.
- **Handoff:** `AGENT49V_NOTIFICATION_SERVICE_SCAFFOLD_VALIDATE.md` for **P4-NA**.

### TASK-50: Notification design

- **Objective:** Freeze API and data mapping for templates, preferences, dispatch requests.
- **Inputs:** legacy notification entities, payment contract for order-state variables.
- **Deliverables:** `NOTIFICATION_API_CONTRACT.md`, `NOTIFICATION_DATA_MAPPING.md`.
- **Acceptance criteria:** clear separation between template management and shared delivery transport.
- **Integration matrix:** delivery only through `notifications-microservice`; no duplicate Telegram bot implementation.
- **Risks/decisions:** template variable taxonomy and backward compatibility.
- **Handoff:** `AGENT50V_NOTIFICATION_SERVICE_DESIGN_VALIDATE.md` for **P4-NB**.

### TASK-51: Notification implementation

- **Objective:** Implement template/preference/dispatch APIs with strict contract adherence.
- **Inputs:** frozen notification contract and mapping.
- **Deliverables:** DTOs, modules, persistence, provider adapter client.
- **Acceptance criteria:** build pass; outbound request logging with `duration_ms`; no hardcoded provider URLs.
- **Integration matrix:** `notifications-microservice` only for actual dispatch.
- **Risks/decisions:** retry loops and duplicate send prevention.
- **Handoff:** `AGENT51V_NOTIFICATION_SERVICE_IMPLEMENTATION_VALIDATE.md` for **P4-NC**.

### TASK-52: Notification migration

- **Objective:** Migrate legacy templates/preferences/history references needed for parity.
- **Inputs:** mapping doc and legacy inventory.
- **Deliverables:** ETL script + migration log + validation notes.
- **Acceptance criteria:** transformation rules for legacy channel types documented.
- **Integration matrix:** migration is internal DB workflow.
- **Risks/decisions:** incompatible placeholder syntax from legacy templates.
- **Handoff:** `AGENT52V_NOTIFICATION_SERVICE_MIGRATION_VALIDATE.md` for **P4-ND**.

### TASK-53: Notification program validation

- **Objective:** Publish wave-level GO/NO-GO with explicit deferred items.
- **Inputs:** TASK-49..52 outputs.
- **Deliverables:** `PHASE4_NOTIFICATION_VALIDATION_REPORT.md`, `PHASE4_NOTIFICATION_CUTOVER_CHECKLIST.md`.
- **Acceptance criteria:** smoke matrix for template CRUD + dispatch paths.
- **Integration matrix:** dispatch smoke may be DEFERRED if shared transport route unavailable.
- **Risks/decisions:** external transport availability at cutover time.
- **Handoff:** `AGENT53V_NOTIFICATION_PHASE4_VALIDATION_VALIDATE.md` for **P4-NE**.

## Wave 3 — Salary (`speakasap-salary-service`)

**Port:** 4212  
**DB:** `speakasap_salary_db`  
**Legacy apps:** `expenses` (salary slice), employee contract data

### Sync gates

| Sync  | After | Gate |
| ----- | ----- | ---- |
| P4-SA | TASK-54 + AGENT54V | Scaffold complete |
| P4-SB | TASK-55 + AGENT55V | Contract + mapping frozen |
| P4-SC | TASK-56 + AGENT56V | Implementation matches contract |
| P4-SD | TASK-57 + AGENT57V | Migration artifacts validated |
| P4-SE | TASK-58 + AGENT58V | Program report + cutover checklist |

### TASK-54: Salary scaffold

- **Objective:** Create salary service skeleton aligned to monorepo standards.
- **Inputs:** roadmap scope, existing service scaffolds.
- **Deliverables:** `salary-service/` bootstrap, `/health`, env keys, compose entries, README.
- **Acceptance criteria:** build pass, logging integration, no hardcoded config.
- **Integration matrix:** no business integrations yet.
- **Risks/decisions:** ensure naming parity with admin salary area.
- **Handoff:** `AGENT54V_SALARY_SERVICE_SCAFFOLD_VALIDATE.md` for **P4-SA**.

### TASK-55: Salary design

- **Objective:** Define salary domain contracts (calculation runs, payouts, summaries).
- **Inputs:** `expenses` salary slice, contract/user references, roadmap admin parity.
- **Deliverables:** `SALARY_API_CONTRACT.md`, `SALARY_DATA_MAPPING.md`.
- **Acceptance criteria:** payout idempotency and calculation versioning documented.
- **Integration matrix:** read-only dependencies on `speakasap-user-service`, `speakasap-education-service`, `speakasap-payment-service`.
- **Risks/decisions:** contract types and edge-case compensation formulas.
- **Handoff:** `AGENT55V_SALARY_SERVICE_DESIGN_VALIDATE.md` for **P4-SB**.

### TASK-56: Salary implementation

- **Objective:** Implement salary workflows according to frozen contract.
- **Inputs:** salary contract/mapping and scaffold.
- **Deliverables:** controllers/services/repositories, calculation engine modules, payout tracking.
- **Acceptance criteria:** build pass; list limits enforced; structured duration logging for external calls.
- **Integration matrix:** HTTP calls only to speakasap services documented by contract.
- **Risks/decisions:** double payout protection and partial-failure handling.
- **Handoff:** `AGENT56V_SALARY_SERVICE_IMPLEMENTATION_VALIDATE.md` for **P4-SC**.

### TASK-57: Salary migration

- **Objective:** Migrate salary-relevant expense history and employee contract references.
- **Inputs:** mapping doc, legacy schema checks.
- **Deliverables:** ETL script, migration log, validation report.
- **Acceptance criteria:** totals reconciliation by period; orphan employee references flagged.
- **Integration matrix:** migration logic uses salary DB only.
- **Risks/decisions:** historical data with missing contract snapshots.
- **Handoff:** `AGENT57V_SALARY_SERVICE_MIGRATION_VALIDATE.md` for **P4-SD**.

### TASK-58: Salary program validation

- **Objective:** Produce wave-level readiness package.
- **Inputs:** TASK-54..57 evidence.
- **Deliverables:** `PHASE4_SALARY_VALIDATION_REPORT.md`, `PHASE4_SALARY_CUTOVER_CHECKLIST.md`.
- **Acceptance criteria:** GO/NO-GO statement with deferred operator steps if needed.
- **Integration matrix:** smoke includes salary calculation and payout status endpoints.
- **Risks/decisions:** dependency windows with payment service availability.
- **Handoff:** `AGENT58V_SALARY_PHASE4_VALIDATION_VALIDATE.md` for **P4-SE**.

## Wave 4 — Financial (`speakasap-financial-service`)

**Port:** 4213  
**DB:** `speakasap_financial_db`  
**Legacy apps:** billing categories, revenue analytics, expense analytics

### Sync gates

| Sync  | After | Gate |
| ----- | ----- | ---- |
| P4-FA | TASK-59 + AGENT59V | Scaffold complete |
| P4-FB | TASK-60 + AGENT60V | Contract + mapping frozen; products boundary resolved |
| P4-FC | TASK-61 + AGENT61V | Implementation matches contract |
| P4-FD | TASK-62 + AGENT62V | Migration artifacts validated |
| P4-FE | TASK-63 + AGENT63V | Program report + cutover checklist |

### TASK-59: Financial scaffold

- **Objective:** Initialize financial service with monorepo conventions.
- **Inputs:** roadmap financial scope, scaffold templates.
- **Deliverables:** `financial-service/` bootstrap, `/health`, compose and env wiring, README.
- **Acceptance criteria:** build pass and logging integration.
- **Integration matrix:** none yet.
- **Risks/decisions:** naming and module structure should match analytics intent.
- **Handoff:** `AGENT59V_FINANCIAL_SERVICE_SCAFFOLD_VALIDATE.md` for **P4-FA**.

### TASK-60: Financial design

- **Objective:** Freeze API/data mapping and resolve `products` single-source decision.
- **Inputs:** legacy billing categories/revenue tables, course contract, payment and salary contracts.
- **Deliverables:** `FINANCIAL_API_CONTRACT.md`, `FINANCIAL_DATA_MAPPING.md`, `COURSE_API_CONTRACT.md` addendum if needed.
- **Acceptance criteria:** explicit ownership statement for billing categories; read model ingestion strategy documented.
- **Integration matrix:** read dependencies on `speakasap-payment-service` and `speakasap-salary-service`; optional `speakasap-course-service` metadata boundary.
- **Risks/decisions:** duplicate writable models, inconsistent category IDs across domains.
- **Handoff:** `AGENT60V_FINANCIAL_SERVICE_DESIGN_VALIDATE.md` for **P4-FB**.

### TASK-61: Financial implementation

- **Objective:** Implement financial reporting and category APIs per frozen contract.
- **Inputs:** financial contract/mapping, scaffold.
- **Deliverables:** domain modules, aggregation services, query endpoints, persistence updates.
- **Acceptance criteria:** build pass; no direct DB joins into other services; route semantics match contract.
- **Integration matrix:** HTTP/event ingestion from payment and salary services; optional category metadata from course service as defined by TASK-60.
- **Risks/decisions:** aggregation latency and stale snapshot handling.
- **Handoff:** `AGENT61V_FINANCIAL_SERVICE_IMPLEMENTATION_VALIDATE.md` for **P4-FC**.

### TASK-62: Financial migration

- **Objective:** Migrate financial historical data and normalize category mappings.
- **Inputs:** financial mapping doc and legacy extracts.
- **Deliverables:** ETL script, migration log, validation report.
- **Acceptance criteria:** revenue/expense totals reconcile by period and category.
- **Integration matrix:** migration local to financial DB.
- **Risks/decisions:** missing category mappings in old records.
- **Handoff:** `AGENT62V_FINANCIAL_SERVICE_MIGRATION_VALIDATE.md` for **P4-FD**.

### TASK-63: Financial program validation

- **Objective:** Final GO/NO-GO for Phase 4 completion.
- **Inputs:** TASK-59..62 evidence and validators.
- **Deliverables:** `PHASE4_FINANCIAL_VALIDATION_REPORT.md`, `PHASE4_FINANCIAL_CUTOVER_CHECKLIST.md`.
- **Acceptance criteria:** complete gate matrix P4-FA..P4-FE and deferred operator tasks list.
- **Integration matrix:** smoke includes category APIs and key reporting endpoints.
- **Risks/decisions:** cutover timing with upstream service freshness.
- **Handoff:** `AGENT63V_FINANCIAL_PHASE4_VALIDATION_VALIDATE.md` for **P4-FE**.

## Out of scope

- `helpdesk-microservice`, analytics (`big_brother`, `actions`), marathon extraction.
- `catalog-microservice`, `warehouse-microservice`, `suppliers-microservice`, `orders-microservice` unless reopened.

## Phase 5+ pointer

Phase 5 (API gateway + frontend) and Phases 6–7 (integration and decommissioning) get separate decomposition docs when opened.
