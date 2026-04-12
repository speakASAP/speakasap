# AGENT30: Phase 3 Wave 1 — User Service Design (API Contract + Data Mapping)

## Role

Backend Service Agent (Design): freeze **read/write API surface** and **legacy → target** data mapping for user domain.

## Objective

Produce contract artifacts so TASK-31 implementation has no ambiguous coupling.

## Inputs

- `docs/refactoring/PHASE3_TASK_DECOMPOSITION.md` — TASK-30
- `docs/refactoring/ROADMAP.md` — §3.3 User Service
- Legacy repo: `speakasap-portal` — apps `students`, `employees` (and related models referenced in roadmap)
- `user-service/` scaffold from TASK-29
- `CERTIFICATION_API_CONTRACT.md` — style reference for contract layout

## Scope

- Author `docs/refactoring/USER_API_CONTRACT.md` (routes, DTOs, errors, pagination, max **30** items per list request).
- Author `docs/refactoring/USER_DATA_MAPPING.md` (tables/fields, FKs, id formats, auth-microservice identity linkage).
- Optional: draft Prisma schema outline under `user-service/prisma/` (no migration execution required in this task unless repo convention demands it — clarify in exit notes).

## Do

- Reuse domain terms from legacy app names and `ROADMAP.md`; do not invent synonyms.
- Document JWT expectations (**auth-microservice** as issuer/validation — consumer-side only in this service).
- Explicitly exclude out-of-scope legacy apps.

## Do Not

- No implementation of handlers beyond stubs already in scaffold if any.
- Do not change `auth-microservice` code.
- No nginx-microservice edits.

## Outputs

- `docs/refactoring/USER_API_CONTRACT.md`
- `docs/refactoring/USER_DATA_MAPPING.md`
- Optional Prisma draft in `user-service/`

## Exit Criteria

- Both markdown files complete and internally consistent.
- **Next:** `AGENT30V_USER_SERVICE_DESIGN_VALIDATE.md` → **PASS** before TASK-31.
