# Phase 3 Orchestration Summary — Wave 1 (User Service)

**Last updated:** 2026-04-12
**Lead Orchestrator:** `docs/agents/master-prompt.md`
**Decomposition:** `PHASE3_TASK_DECOMPOSITION.md`
**Tasks index:** `SPEAKASAP_REFACTORING_TASKS_INDEX.md`

---

## Prerequisites

- **Phase 2:** ✅ Closed **2026-04-12** (`PHASE2_VALIDATION_REPORT.md`, `AGENT28V` PASS).
- **Ports / DB:** `docs/infrastructure/PORT_ALLOCATION.md` — **4207** / `speakasap_user_db`.

---

## Dependency graph

```text
TASK-29 (scaffold) → TASK-30 (design) → TASK-31 (impl) → TASK-32 (migration) → TASK-33 (validation)
```

---

## Parallel batches

| Batch | Tasks | Parallel? |
| ----- | ----- | --------- |
| Wave1 | TASK-29…TASK-33 | **NO** (single-service serial path) |

---

## Task execution order

1. **TASK-29** + `AGENT29V` → **P3-UA**
2. **TASK-30** + `AGENT30V` → **P3-UB**
3. **TASK-31** + `AGENT31V` → **P3-UC**
4. **TASK-32** + `AGENT32V` → **P3-UD**
5. **TASK-33** + `AGENT33V` → **P3-UE**

---

## Success metrics (Wave 1)

- Contract docs frozen before implementation that consumes them.
- No hardcoded URLs/secrets; `LOGGING_SERVICE_URL` wired like Phase 1/2 services.
- List endpoints enforce limit ≤ 30.
- `PHASE3_USER_VALIDATION_REPORT.md` issues **GO** before education/course waves assume user APIs exist.

---

## Next actions (orchestrator)

1. **P3-UA** ✅ — `AGENT29V` **PASS** (**2026-04-12**); TASK-29 scaffold validated.
2. **P3-UB** ✅ — `AGENT30V` **PASS** (**2026-04-12**); contracts + mapping frozen (UUID `authUserId` aligned with auth-microservice).
3. **P3-UC** ✅ — `AGENT31V` **PASS** (**2026-04-12**).
4. **P3-UD** ✅ — `AGENT32V` **PASS** (**2026-04-12**, script/doc + empty-target SQL; live ETL pending `ssh speakasap` key).
5. **P3-UE** ✅ — `AGENT33V` **PASS** (**2026-04-12**); `PHASE3_USER_VALIDATION_REPORT.md` + `PHASE3_USER_CUTOVER_CHECKLIST.md`.
6. **Wave 1 user-service:** engineering gates closed — operator ETL (`ssh speakasap`), deploy, and cutover checklist remain before customer traffic.
7. Proceed to **Wave 2 (course)** only after Lead sign-off on Wave 1 scope/timing.
