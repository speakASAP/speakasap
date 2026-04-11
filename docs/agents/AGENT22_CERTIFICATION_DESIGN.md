# AGENT22: Certification — API Contract & Data Mapping (Design)

## Role

Backend Service Agent (Design) for **speakasap-certification-service**.

## Objective

Freeze `CERTIFICATION_API_CONTRACT.md` and `CERTIFICATION_DATA_MAPPING.md` from legacy apps: `certificates`, `education_certificates`, `quests`, `user_quest`.

---

## Inputs

- Legacy repo: `/Users/sergiystashok/Documents/GitHub/speakasap-portal`
- `docs/refactoring/ROADMAP.md` § 2.1
- `docs/refactoring/PHASE2_TASK_DECOMPOSITION.md` — TASK-22
- `speakasap/certification-service/` — scaffold from TASK-21

## Scope

- Model and API design for certificate issuance, education certificates, quests, user quest progress, PDF generation touchpoints.
- Pagination: list endpoints **max 30** items per request.
- Error response shape aligned with `content-service` conventions where applicable.
- Legacy route → new API mapping table.

## Do

- Analyze Django models and critical views/serializers for the four apps above.
- Document REST resources, methods, query params, request/response DTOs.
- Document idempotency or concurrency notes for writes if legacy relies on them.
- Document PDF pipeline: templates, storage, sync/async expectations.
- Produce optional draft `certification-service/prisma/schema.prisma` if Prisma is the chosen stack (match repo precedent).

## Do Not

- Do not implement controllers/services (TASK-23).
- Do not migrate data (TASK-24).
- Do not invent new domain vocabulary without mapping to legacy.
- Do not scope assessment apps here.

## Outputs

- `docs/refactoring/CERTIFICATION_API_CONTRACT.md`
- `docs/refactoring/CERTIFICATION_DATA_MAPPING.md`
- Optional: `speakasap/certification-service/prisma/schema.prisma` (draft)

## Exit Criteria

- Lead Orchestrator can freeze certification contract (part of **P2-B**).
- **Next:** `docs/agents/AGENT22V_CERTIFICATION_DESIGN_VALIDATE.md` → **PASS** ✅ **2026-04-11** (P2-B certification side).
