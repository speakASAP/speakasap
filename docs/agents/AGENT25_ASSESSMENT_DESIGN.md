# AGENT25: Assessment — API Contract & Data Mapping (Design)

## Role

Backend Service Agent (Design) for **speakasap-assessment-service**.

## Objective

Freeze `ASSESSMENT_API_CONTRACT.md` and `ASSESSMENT_DATA_MAPPING.md` for legacy apps `language_tests` and `user_tests`. **Explicitly exclude** `teacher_tests` (obsolete).

---

## Inputs

- Legacy repo: `/Users/sergiystashok/Documents/GitHub/speakasap-portal`
- `docs/refactoring/ROADMAP.md` § 2.2
- `docs/refactoring/PHASE2_TASK_DECOMPOSITION.md` — TASK-25
- `speakasap/assessment-service/` scaffold (TASK-21)

## Scope

- Test definition, delivery, attempt, scoring, results — per legacy behavior.
- Roles: document which operations are student vs staff if legacy distinguishes them.
- Pagination: list endpoints **max 30** items.
- Scoring rules: document algorithm inputs/outputs; edge cases.

## Do

- State **Out of scope: `teacher_tests`** in both contract and mapping (prominent section).
- Legacy route → new API mapping table.
- Optional draft `assessment-service/prisma/schema.prisma` if Prisma is used.

## Do Not

- Do not include `teacher_tests` models, endpoints, or migrations.
- Do not implement service code (TASK-26).
- Do not migrate data (TASK-27).

## Outputs

- `docs/refactoring/ASSESSMENT_API_CONTRACT.md`
- `docs/refactoring/ASSESSMENT_DATA_MAPPING.md`
- Optional: `speakasap/assessment-service/prisma/schema.prisma` (draft)

## Exit Criteria

- Assessment side ready for freeze (part of **P2-B**).
- **Next:** `docs/agents/AGENT25V_ASSESSMENT_DESIGN_VALIDATE.md` → **PASS** ✅ **2026-04-11** (P2-B assessment side).
