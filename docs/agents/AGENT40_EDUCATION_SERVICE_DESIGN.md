# AGENT40: Phase 3 Wave 3 — Education Service Design (API Contract + Data Mapping)

## Role

Backend Service Agent (Design): freeze **read/write API surface** and **legacy → target** data mapping for **`education`** domain per `ROADMAP.md` §3.2 (catalog, structure, lessons, homework, groups, student courses, materials, seven/mini/native). Obsolete **`courses`** app behavior consolidated here per ROADMAP.

## Objective

Produce contract artifacts so TASK-41 implementation has no ambiguous coupling. Document **course-service** and **user-service** references using **HTTP + frozen IDs** from `COURSE_API_CONTRACT.md` and `USER_API_CONTRACT.md` only. Document **AI-teacher** integration points against **ai-microservice** without modifying that service.

## Inputs

- `docs/refactoring/PHASE3_WAVE3_EDUCATION_TASK_DECOMPOSITION.md` — TASK-40
- `docs/refactoring/ROADMAP.md` — §3.2 Education Service (authoritative inclusion list)
- Legacy repo: `speakasap-portal` — app **`education`** (verify table names before freezing)
- `education-service/` scaffold from TASK-39
- `docs/refactoring/COURSE_API_CONTRACT.md`, `docs/refactoring/COURSE_DATA_MAPPING.md` (frozen — consumer references)
- `docs/refactoring/USER_API_CONTRACT.md`, `docs/refactoring/USER_DATA_MAPPING.md`
- `CERTIFICATION_API_CONTRACT.md` — cross-check `studentCourseId` / education ID semantics if applicable

## Scope

- Author `docs/refactoring/EDUCATION_API_CONTRACT.md` (routes, DTOs, errors, pagination, max **30** items per list request).
- Author `docs/refactoring/EDUCATION_DATA_MAPPING.md` (tables/fields, FKs, id formats; marathon explicitly **out**).
- Optional: draft Prisma schema outline under `education-service/prisma/` (migration execution in TASK-41 unless repo convention requires earlier).

## Do

- Reuse domain terms from legacy model names and `ROADMAP.md` §3.2; do not invent synonyms.
- Explicitly list **out-of-scope** areas: `marathon` product DB, payment/orders execution, financial billing (Phase 4).
- Call out how **`StudentCourse`** / group / lesson IDs align with certification and assessment contracts where those reference education.

## Do Not

- No implementation of handlers beyond stubs already in scaffold if any.
- Do not change `auth-microservice` code.
- No nginx-microservice edits.
- Do not re-scope Wave 2 course tables into education DB.

## Outputs

- `docs/refactoring/EDUCATION_API_CONTRACT.md`
- `docs/refactoring/EDUCATION_DATA_MAPPING.md`
- Optional Prisma draft in `education-service/`

## Exit Criteria

- Both markdown files complete and internally consistent.
- **Next:** `docs/agents/AGENT40V_EDUCATION_SERVICE_DESIGN_VALIDATE.md` → **PASS** before TASK-41.
