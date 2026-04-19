# Phase 5 Task Decomposition — API Gateway and Frontend

**Date:** 2026-04-19  
**Lead Orchestrator:** `docs/agents/master-prompt.md`  
**Roadmap source:** `ROADMAP.md` §5.1-§5.2  
**Prerequisite:** Phase 4 program gates closed (`P4-OA...P4-FE` PASS).

## Goal

Deliver a gateway-first integration layer and then frontend surfaces that consume only the gateway contract.

## Dual-prompt rule

Every task in **TASK-64...TASK-73** runs in strict order:

1. Implementation prompt: `docs/agents/AGENT{NN}_*.md`
2. Validator prompt: `docs/agents/AGENT{NN}V_*_VALIDATE.md`

Sync gates clear only on Validator **PASS** (or documented **WAIVE** with Lead sign-off).

## Cross-cutting constraints

- Keep shared microservices external and read/write only through their HTTP contracts.
- Do not modify nginx repository directly; all runtime config stays in service/app code and env.
- No hardcoded URLs, keys, or ports; use `speakasap/.env` and keep key names in `speakasap/.env.example`.
- Enforce list limits (`limit <= 30`) in gateway list endpoints.
- For hangs/timeouts: add timestamped logs and identify the blocking call; do not increase global timeouts.
- Manual validation only unless explicitly requested otherwise.

## Global dependency graph

```text
Phase4_closed
  → TASK-64 → TASK-65 → TASK-66 → TASK-67 → TASK-68
  → TASK-69 → TASK-70 → TASK-71 → TASK-72 → TASK-73
```

## Wave 1 — API Gateway (`speakasap-api-gateway`, port 4210)

### Sync gates

| Sync  | After | Gate |
| ----- | ----- | ---- |
| P5-GA | TASK-64 + AGENT64V | Gateway scaffold complete |
| P5-GB | TASK-65 + AGENT65V | Route ownership and API contract frozen |
| P5-GC | TASK-66 + AGENT66V | Auth/rate-limit/versioning implementation matches contract |
| P5-GD | TASK-67 + AGENT67V | Gateway integration smoke and logging validation complete |
| P5-GE | TASK-68 + AGENT68V | Gateway wave program validation report + cutover checklist |

### TASK-64: Gateway scaffold

- **Objective:** Bootstrap `speakasap-api-gateway` service with health endpoint, env wiring, logging.
- **Deliverables:** service skeleton, compose wiring, README, `/health`.
- **Acceptance criteria:** build passes; port 4210 reserved; no hardcoded config.

### TASK-65: Gateway contract and route ownership matrix

- **Objective:** Freeze gateway routes and ownership boundaries for all Phase 1-4 services.
- **Deliverables:** `GATEWAY_ROUTE_OWNERSHIP_MATRIX.md`, gateway API contract doc, auth boundary notes.
- **Acceptance criteria:** no duplicate writable ownership; explicit upstream mapping per endpoint group.

### TASK-66: Gateway implementation (core middleware + routing)

- **Objective:** Implement routing, auth middleware integration, rate limiting, versioning, request/response logging.
- **Deliverables:** gateway modules, middleware chain, upstream client adapters, env-driven base URLs.
- **Acceptance criteria:** contract parity; centralized logging with durations; no bypass routes.

### TASK-67: Gateway integration validation

- **Objective:** Validate gateway-to-service connectivity and failure behavior.
- **Deliverables:** smoke matrix doc for `/health`, auth-required routes, error mapping, timeout behavior.
- **Acceptance criteria:** documented PASS/DEFERRED rows with owner and unblock criteria.

### TASK-68: Gateway program validation and cutover prep

- **Objective:** Produce wave-level GO/NO-GO for gateway readiness.
- **Deliverables:** `PHASE5_GATEWAY_VALIDATION_REPORT.md`, `PHASE5_GATEWAY_CUTOVER_CHECKLIST.md`.
- **Acceptance criteria:** gate table P5-GA...P5-GD and explicit decision.

## Wave 2 — Frontend (`speakasap-frontend`, port 4211)

### Sync gates

| Sync  | After | Gate |
| ----- | ----- | ---- |
| P5-FA | TASK-69 + AGENT69V | Frontend scaffold complete |
| P5-FB | TASK-70 + AGENT70V | Frontend contract mapped to gateway routes |
| P5-FC | TASK-71 + AGENT71V | Student/teacher/admin portal implementation matches contract |
| P5-FD | TASK-72 + AGENT72V | Frontend integration and auth-flow validation complete |
| P5-FE | TASK-73 + AGENT73V | Phase 5 program validation report + cutover checklist |

### TASK-69: Frontend scaffold

- **Objective:** Bootstrap Next.js frontend with shared layout and env wiring for gateway URL.
- **Deliverables:** app scaffold, baseline routing, auth/session plumbing shell, README.
- **Acceptance criteria:** build passes; no direct service calls bypassing gateway.

### TASK-70: Frontend-to-gateway contract mapping

- **Objective:** Freeze page-level contract usage for student, teacher, and admin portals.
- **Deliverables:** frontend contract mapping doc referencing gateway endpoints and auth requirements.
- **Acceptance criteria:** every planned page/action maps to a gateway route; unresolved gaps listed as blockers.

### TASK-71: Frontend implementation

- **Objective:** Implement initial student/teacher/admin flows against frozen gateway contract.
- **Deliverables:** portal pages/components, API client layer, role-aware navigation.
- **Acceptance criteria:** no hardcoded backend URLs; auth flow follows gateway contract only.

### TASK-72: Frontend integration validation

- **Objective:** Validate end-to-end UI flows through gateway for key paths.
- **Deliverables:** manual validation matrix, defect list, deferred rows with owners.
- **Acceptance criteria:** auth, route guards, and core CRUD/read flows verified or explicitly deferred.

### TASK-73: Phase 5 program validation and cutover prep

- **Objective:** Final GO/NO-GO for Phase 5.
- **Deliverables:** `PHASE5_VALIDATION_REPORT.md`, `PHASE5_CUTOVER_CHECKLIST.md`.
- **Acceptance criteria:** complete gate matrix P5-GA...P5-FE, rollback notes, and operator actions.

## Out of scope

- Phase 6 integration/decommission tasks.
- Shared monitoring platform implementation.
- New shared microservice development.
