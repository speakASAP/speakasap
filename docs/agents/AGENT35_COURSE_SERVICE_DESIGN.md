# AGENT35: Phase 3 Wave 2 — Course Service Design (API Contract + Data Mapping)

## Role

Backend Service Agent (Design): freeze **read/write API surface** and **legacy → target** data mapping for **products**, **offers**, and **pricing** per ROADMAP §3.1.

## Objective

Produce contract artifacts so TASK-36 implementation has no ambiguous coupling. Document **future education-service consumer** assumptions (IDs, resolution) without requiring that service to exist.

## Inputs

- `docs/refactoring/PHASE3_WAVE2_COURSE_TASK_DECOMPOSITION.md` — TASK-35
- `docs/refactoring/ROADMAP.md` — §3.1 Course Service (authoritative inclusion list)
- Legacy repo: `speakasap-portal` — apps/models for **`products`**, **`offers`**, **`pricing`** (verify actual table names in legacy before freezing)
- `course-service/` scaffold from TASK-34
- `USER_API_CONTRACT.md` or `CERTIFICATION_API_CONTRACT.md` — style reference for contract layout

## Scope

- Author `docs/refactoring/COURSE_API_CONTRACT.md` (routes, DTOs, errors, pagination, max **30** items per list request).
- Author `docs/refactoring/COURSE_DATA_MAPPING.md` (tables/fields, FKs, id formats, references to user identities only where legacy requires — align with `USER_DATA_MAPPING.md` / UUID rules if applicable).
- Optional: draft Prisma schema outline under `course-service/prisma/` (no migration execution required in this task unless repo convention demands it — clarify in exit notes).

## Do

- Reuse domain terms from legacy model names and `ROADMAP.md` §3.1; do not invent synonyms.
- Explicitly list **out-of-scope** legacy areas (education catalog, `course_materials`, financial billing categories, Phase 4).
- Call out ROADMAP executive-summary rows that may contradict §3.1; **§3.1 wins** for Wave 2.

## Do Not

- No implementation of handlers beyond stubs already in scaffold if any.
- Do not change `auth-microservice` code.
- No nginx-microservice edits.
- Do not scope education-service or AI-teacher implementation.

## Outputs

- `docs/refactoring/COURSE_API_CONTRACT.md`
- `docs/refactoring/COURSE_DATA_MAPPING.md`
- Optional Prisma draft in `course-service/`

## Exit Criteria

- Both markdown files complete and internally consistent.
- **Next:** `docs/agents/AGENT35V_COURSE_SERVICE_DESIGN_VALIDATE.md` → **PASS** before TASK-36.
