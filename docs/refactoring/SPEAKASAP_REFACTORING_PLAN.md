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
- No hardcoded configuration values. Use `.env` as single source of truth; update `.env.example` with keys only.
- Use centralized logging via `LOGGING_SERVICE_URL=http://logging-microservice:3367`.
- Respect request limit: max 30 items per request.
- No separate dev environment. Build and run directly on the future production server.

## Phase 0: Marathon Extraction (Immediate Focus)

1. Define API contract for marathon and legacy integration.
2. Implement `marathon` container (NestJS) with its own DB schema.
3. Add legacy integration shim to route marathon flows to the new product.
4. Validate feature parity and switch traffic to new service for marathons.
5. Deprecate legacy marathon code after stable cutover.

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
