# Phase 3 Task Decomposition — Wave 1 (User Service)

**Date:** 2026-04-12
**Lead Orchestrator:** `docs/agents/master-prompt.md`
**Summary:** `PHASE3_ORCHESTRATION_SUMMARY.md`
**Roadmap:** `ROADMAP.md` §Phase 3 — this wave covers **§3.3 User Service** only.

---

## Scope boundary

| In this wave | Out of scope (later Phase 3 waves) |
| ------------ | ----------------------------------- |
| `speakasap-user-service` (4207), DB `speakasap_user_db` | `speakasap-course-service` (4205), `speakasap-education-service` (4206) |
| Legacy: `students`, `employees` (teachers) per `ROADMAP.md` | Education AI-teacher features, products/offers |
| Integration with **auth-microservice** (JWT; no local auth) | nginx-microservice repo edits (forbidden) |

**Dual-prompt rule:** TASK-29…TASK-33 each run **Implementation** then **Validator** (`AGENT{NN}V_*_VALIDATE.md`). Sync **P3-UA…P3-UE** clear on Validator **PASS** (or documented **WAIVE**).

---

## Prerequisites

- Phase 2 program gates closed (**2026-04-12**, `AGENT28V` PASS).
- Ports: `docs/infrastructure/PORT_ALLOCATION.md` — **4207** / `speakasap_user_db`.

---

## Global dependency graph (Wave 1)

```text
Phase2_closed → TASK-29 → TASK-30 → TASK-31 → TASK-32 → TASK-33
```

No parallel tasks in Wave 1 (single service, serial critical path).

---

## Sync gates (User wave)

| Sync | After | Gate |
|------|-------|------|
| P3-UA | TASK-29 + `AGENT29V` PASS | Scaffold builds; `/health`; env keys; logging bootstrap |
| P3-UB | TASK-30 + `AGENT30V` PASS | `USER_API_CONTRACT.md` + `USER_DATA_MAPPING.md` frozen |
| P3-UC | TASK-31 + `AGENT31V` PASS | HTTP handlers match frozen contract; list limits ≤ 30 |
| P3-UD | TASK-32 + `AGENT32V` PASS | ETL script + `USER_DATA_MIGRATION_LOG.md` / `USER_DATA_VALIDATION.md` |
| P3-UE | TASK-33 + `AGENT33V` PASS | `PHASE3_USER_VALIDATION_REPORT.md` + `PHASE3_USER_CUTOVER_CHECKLIST.md`; GO/NO-GO |

**Gate status (2026-04-12):** **P3-UA** PASS (`AGENT29V`). **P3-UB:** TASK-30 artifacts delivered; **`AGENT30V` pending**. **P3-UC–P3-UE:** open.

---

## TASK-29: User service scaffold

**Agent:** Infra/Docker
**Implementation:** `docs/agents/AGENT29_USER_SERVICE_SCAFFOLD.md`
**Validator:** `docs/agents/AGENT29V_USER_SERVICE_SCAFFOLD_VALIDATE.md`
**Outputs:** `user-service/` (or `speakasap-user-service/` per repo naming convention — align with `content-service`), README, `.env.example`, compose/deploy hooks as required by repo patterns.

---

## TASK-30: User service design (contract + mapping)

**Agent:** Backend (Design)
**Dependencies:** TASK-29 + P3-UA
**Implementation:** `docs/agents/AGENT30_USER_SERVICE_DESIGN.md`
**Validator:** `docs/agents/AGENT30V_USER_SERVICE_DESIGN_VALIDATE.md`
**Outputs:** `docs/refactoring/USER_API_CONTRACT.md`, `docs/refactoring/USER_DATA_MAPPING.md`, optional Prisma schema draft in service tree.

---

## TASK-31: User service implementation

**Agent:** Backend (Implementation)
**Dependencies:** TASK-30 + P3-UB
**Implementation:** `docs/agents/AGENT31_USER_SERVICE_IMPLEMENTATION.md`
**Validator:** `docs/agents/AGENT31V_USER_SERVICE_IMPLEMENTATION_VALIDATE.md`

---

## TASK-32: User data migration

**Agent:** Data Migration
**Dependencies:** TASK-31 + P3-UC
**Implementation:** `docs/agents/AGENT32_USER_SERVICE_MIGRATION.md`
**Validator:** `docs/agents/AGENT32V_USER_SERVICE_MIGRATION_VALIDATE.md`
**Outputs:** `user-service/scripts/` ETL (or repo-standard path), migration log + validation markdown under `docs/refactoring/`.

---

## TASK-33: User wave program validation

**Agent:** QA / Contract Validator
**Dependencies:** TASK-32 + P3-UD
**Implementation:** `docs/agents/AGENT33_USER_PHASE3_VALIDATION.md`
**Validator:** `docs/agents/AGENT33V_USER_PHASE3_VALIDATION_VALIDATE.md`
**Outputs:** `PHASE3_USER_VALIDATION_REPORT.md`, `PHASE3_USER_CUTOVER_CHECKLIST.md`

---

## Future Phase 3 waves (not yet decomposed)

- **Course service** (4205): products, offers, pricing — separate TASK series when opened.
- **Education service** (4206): catalog, lessons, homework, AI-teacher — separate TASK series; depends on course + user per `ROADMAP.md`.
