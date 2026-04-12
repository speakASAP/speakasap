# Phase 2 Orchestration Summary

**Last updated:** 2026-04-12 (data path evidence on alfares)
**Lead Orchestrator:** `docs/agents/master-prompt.md`
**Decomposition:** `PHASE2_TASK_DECOMPOSITION.md`

---

## Quick Reference

- **Roadmap:** `docs/refactoring/ROADMAP.md` — Phase 2 (Certification, Assessment)
- **Tasks index:** `docs/refactoring/SPEAKASAP_REFACTORING_TASKS_INDEX.md`
- **Ports / DBs:** `docs/infrastructure/PORT_ALLOCATION.md` — 4202 / `speakasap_certification_db`, 4203 / `speakasap_assessment_db`

---

## Prerequisites

- **Phase 1:** ✅ **Complete** — TASK-16 **GO**, Lead Orchestrator sign-off **2026-04-10** (`PHASE1_VALIDATION_REPORT.md`, `PHASE1_COMPLETION_SUMMARY.md`). Proceed with TASK-21.
- **Dual prompts:** Each TASK-21…TASK-28 runs **Implementation** agent, then **Validator** agent (`AGENT{NN}V_*_VALIDATE.md`). Sync gates require Validator **PASS**.

---

## Phase 2 Overview

**Goal:** Extract certification and assessment into independent NestJS services with frozen contracts, migrations, and program-level validation.

**Sync status:** **P2-B cleared 2026-04-11** — TASK-22, TASK-25, `AGENT22V`, `AGENT25V` PASS; contracts and mappings frozen. **P2-C cleared 2026-04-11** — TASK-23, TASK-26, `AGENT23V`, `AGENT26V` PASS (`npm run build` on both services; endpoint/config/logging review vs frozen contracts). **Note:** Validator manual HTTP smoke (health + sample 400 envelope) should still be run against a running stack with DB before TASK-24/27 execution if not already done in your environment.

**P2-D cleared 2026-04-11** — TASK-24 ∥ TASK-27 per parallelism gate (`AGENT23V` + `AGENT26V` PASS; separate DBs; no shared runner). Deliverables: Python ETL scripts in `certification-service/scripts/` and `assessment-service/scripts/`, migration + validation markdown under `docs/refactoring/`, Prisma migration aligning `studentCourseId` with legacy UUID strings, contract/mapping doc updates. **`AGENT24V` / `AGENT27V`:** PASS on code + doc review; operators still run count/orphan SQL from validation docs after live import.

**P2-E (TASK-28 / AGENT28V):** **Cleared 2026-04-12** — production DB counts + orphan integrity on alfares `db-server-postgres`; edge `GET https://speakasap.statex.cz/health` **200**; **`AGENT28V` PASS**. Dedicated cert/assessment API HTTP smoke deferred **non-blocking** (see validation report §3).

**Timeline (indicative):** Sequential critical path ~3–4 weeks with parallelism on contracts and possibly migrations; adjust per team velocity.

---

## Dependency Graph

```text
Phase1_GO
  → TASK-21 (scaffolds)
    → TASK-22 (cert contract) ──→ TASK-23 (cert impl) ──→ TASK-24 (cert migration)
    → TASK-25 (assess contract) ─→ TASK-26 (assess impl) ─→ TASK-27 (assess migration)
  → TASK-28 (program validation + cutover)
```

---

## Task Execution Order

### Step 1: Scaffolds (TASK-21)

**Agent:** Infra/Docker
**Duration:** ~1–2 days
**Sync:** P2-A
**Output:** `certification-service` + `assessment-service` build, `/health`, env keys documented.

**Then:** Run `AGENT21V_PHASE2_INFRA_VALIDATE.md` → must PASS before TASK-22 / TASK-25.

---

### Step 2: Parallel contracts (TASK-22 ∥ TASK-25)

**Agents:** Backend (Design) × 2
**Duration:** ~2–4 days each (can overlap)
**Sync:** P2-B when **both** tasks + **both** validators PASS.

**Outputs:**

- `CERTIFICATION_API_CONTRACT.md`, `CERTIFICATION_DATA_MAPPING.md`
- `ASSESSMENT_API_CONTRACT.md`, `ASSESSMENT_DATA_MAPPING.md`

---

### Step 3: Parallel implementation (TASK-23 ∥ TASK-26)

**Agents:** Backend (Implementation) × 2
**Duration:** ~5–10 days each (can overlap)
**Dependencies:** Respective contract frozen
**Sync:** P2-C when **both** validators PASS.

---

### Step 4: Migrations (TASK-24, TASK-27)

**Agents:** Data Migration × 2
**Duration:** ~3–6 days each
**Parallel?** Allowed **only if** parallelism gate in `PHASE2_TASK_DECOMPOSITION.md` is satisfied; otherwise sequential.
**Sync:** P2-D when **both** validators PASS.

---

### Step 5: Program validation (TASK-28)

**Agent:** QA/Contract Validator
**Duration:** ~2–4 days
**Sync:** P2-E
**Output:** `PHASE2_VALIDATION_REPORT.md`, `PHASE2_CUTOVER_CHECKLIST.md`, GO/NO-GO.

**Then:** Run `AGENT28V_PHASE2_VALIDATION_VALIDATE.md` (meta-validator).

---

## Critical Path (if no parallel execution)

```text
TASK-21 → TASK-22 → TASK-23 → TASK-24 → TASK-25 → TASK-26 → TASK-27 → TASK-28
```

(Adjust order of certification vs assessment tracks if one domain is prioritized; the decomposition allows contract and implementation parallelism across tracks.)

**Minimum serial depth (with max parallelism):**

```text
TASK-21 → max(TASK-22→TASK-23→TASK-24, TASK-25→TASK-26→TASK-27) → TASK-28
```

---

## Parallel Batches Summary

| Batch | Tasks | Parallel? | Depends on |
| ----- | ----- | --------- | ---------- |
| B1 | TASK-22, TASK-25 | YES | TASK-21 + P2-A |
| B2 | TASK-23, TASK-26 | YES | P2-B |
| B3 | TASK-24, TASK-27 | YES (gated) | P2-C |
| Final | TASK-28 | NO | P2-D |

---

## Success Metrics

- Both services implement frozen contracts; list endpoints enforce limit ≤ 30.
- Migrations validated; assessment excludes `teacher_tests`.
- No hardcoded URLs/secrets; logging integrated.
- `PHASE2_VALIDATION_REPORT.md` = **GO** and cutover checklist approved.

---

## Next Actions (orchestrator)

1. Confirm Phase 1 **GO** (TASK-16). ✅
2. Spawn TASK-21 Implementation → TASK-21 Validator. ✅ (P2-A)
3. Spawn TASK-22 and TASK-25 Implementation → Validators (parallel). ✅ (P2-B **2026-04-11**)
4. Spawn TASK-23 and TASK-26 Implementation → `AGENT23V` / `AGENT26V` (parallel) for **P2-C**. ✅ **2026-04-11**
5. TASK-24 ∥ TASK-27 + `AGENT24V` / `AGENT27V` for **P2-D**. ✅ **2026-04-11** (parallelism gate satisfied).
6. TASK-28 + `AGENT28V` for **P2-E**. ✅ **2026-04-12**
7. **Current:** Phase 3 planning per `ROADMAP.md` (Lead Orchestrator opens next decomposition when ready); keep `SPEAKASAP_REFACTORING_TASKS_INDEX.md` aligned with execution.
