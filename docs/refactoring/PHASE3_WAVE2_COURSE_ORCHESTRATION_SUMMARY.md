# Phase 3 Orchestration Summary — Wave 2 (Course Service)

**Last updated:** 2026-04-12
**Lead Orchestrator:** `docs/agents/master-prompt.md`
**Decomposition:** `PHASE3_WAVE2_COURSE_TASK_DECOMPOSITION.md`
**Tasks index:** `SPEAKASAP_REFACTORING_TASKS_INDEX.md`

---

## Prerequisites

- **Wave 1 (user):** ✅ Closed — **P3-UE** PASS (`AGENT33V`); see `PHASE3_USER_VALIDATION_REPORT.md`.
- **Ports / DB:** `docs/infrastructure/PORT_ALLOCATION.md` — **4205** / `speakasap_course_db`.

---

## Dependency graph

```text
TASK-34 (scaffold) → TASK-35 (design) → TASK-36 (impl) → TASK-37 (migration) → TASK-38 (validation)
```

---

## Parallel batches

| Batch | Tasks | Parallel? |
| ----- | ----- | --------- |
| Wave2 | TASK-34…TASK-38 | **NO** (single-service serial path) |

---

## Task execution order

1. **TASK-34** + `AGENT34V` → **P3-CA**
2. **TASK-35** + `AGENT35V` → **P3-CB**
3. **TASK-36** + `AGENT36V` → **P3-CC**
4. **TASK-37** + `AGENT37V` → **P3-CD**
5. **TASK-38** + `AGENT38V` → **P3-CE**

---

## Success metrics (Wave 2)

- Contract docs frozen before implementation that consumes them.
- No hardcoded URLs/secrets; `LOGGING_SERVICE_URL` wired like prior services.
- List endpoints enforce limit ≤ 30.
- `PHASE3_COURSE_VALIDATION_REPORT.md` records engineering + traffic GO before education wave assumes course APIs exist.
- No blocking dependency on **speakasap-education-service** until that wave opens (optional env URL only).

---

## Next actions (orchestrator)

1. Lead sign-off on Wave 2 scope/timing.
2. Author agent prompts `AGENT34`…`AGENT38` + validators (stubs or full) under `docs/agents/`.
3. Run TASK-34…TASK-38 in order; clear **P3-CA…P3-CE** only on Validator PASS.
4. After **P3-CE**, run **education** wave **TASK-39…TASK-43** (`PHASE3_WAVE3_EDUCATION_TASK_DECOMPOSITION.md`).
