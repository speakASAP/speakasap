# Phase 3 Orchestration Summary — Waves 1–3

**Last updated:** 2026-04-12 (Wave 3 education decomposition + prompts added; execution **pending**)
**Lead Orchestrator:** `docs/agents/master-prompt.md`
**Decomposition (Wave 1):** `PHASE3_TASK_DECOMPOSITION.md`
**Decomposition (Wave 2 — course):** `PHASE3_WAVE2_COURSE_TASK_DECOMPOSITION.md`
**Decomposition (Wave 3 — education):** `PHASE3_WAVE3_EDUCATION_TASK_DECOMPOSITION.md`
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
- `PHASE3_USER_VALIDATION_REPORT.md` **rev. c** records engineering + traffic **GO** (F3 close-out §5) before education/course waves assume user APIs exist.

---

## Next actions (orchestrator)

1. **P3-UA** ✅ — `AGENT29V` **PASS** (**2026-04-12**); TASK-29 scaffold validated.
2. **P3-UB** ✅ — `AGENT30V` **PASS** (**2026-04-12**); contracts + mapping frozen (UUID `authUserId` aligned with auth-microservice).
3. **P3-UC** ✅ — `AGENT31V` **PASS** (**2026-04-12**).
4. **P3-UD** ✅ — `AGENT32V` **PASS** (**2026-04-12**, script/doc + target schema; **live ETL** done **2026-04-12** per validation report **rev. c**).
5. **P3-UE** ✅ — `AGENT33V` **PASS** (**2026-04-12**); `PHASE3_USER_VALIDATION_REPORT.md` **rev. c** + `PHASE3_USER_CUTOVER_CHECKLIST.md` (cutover **GO**).
6. **Wave 1 user-service:** engineering + operator close-out complete — F3-BACKUP / rollback drill **closed**; F3-AUTH-PARITY **waived** Wave 1; traffic **GO** per checklist.
7. Proceed to **Wave 2 (course)** only after Lead sign-off on Wave 2 execution timing (Wave 1 cutover **GO** already recorded; prompts **TASK-34…TASK-38** ready in `docs/agents/`).

---

## Wave 2 (Course service) — TASK-34…TASK-38

**Prerequisites:** Wave 1 complete (**P3-UE** PASS). **Port / DB:** `docs/infrastructure/PORT_ALLOCATION.md` — **4205** / `speakasap_course_db`. **Scope:** ROADMAP §3.1 (`products`, `offers`, `pricing`).

### Dependency graph

```text
TASK-34 (scaffold) → TASK-35 (design) → TASK-36 (impl) → TASK-37 (migration) → TASK-38 (validation)
```

### Parallel batches

| Batch | Tasks | Parallel? |
| ----- | ----- | --------- |
| Wave2 | TASK-34…TASK-38 | **NO** (single-service serial path) |

### Task execution order

1. **TASK-34** + `AGENT34V` → **P3-CA**
2. **TASK-35** + `AGENT35V` → **P3-CB**
3. **TASK-36** + `AGENT36V` → **P3-CC**
4. **TASK-37** + `AGENT37V` → **P3-CD**
5. **TASK-38** + `AGENT38V` → **P3-CE**

### Success metrics (Wave 2)

- `COURSE_API_CONTRACT.md` + `COURSE_DATA_MAPPING.md` frozen before TASK-36.
- List endpoints enforce limit ≤ 30; logging and env discipline match Wave 1.
- `PHASE3_COURSE_VALIDATION_REPORT.md` + `PHASE3_COURSE_CUTOVER_CHECKLIST.md` record GO/NO-GO before education wave (**TASK-39…TASK-43**) assumes course APIs exist.

### Next actions (orchestrator)

1. **P3-CA** ✅ — `AGENT34V` PASS (**2026-04-12**).
2. **P3-CB** ✅ — `AGENT35V` PASS (**2026-04-12**).
3. **P3-CC** ✅ — `AGENT36V` PASS (**2026-04-12**).
4. **P3-CD** ✅ — `AGENT37V` PASS (**2026-04-12**; live ETL pending operator).
5. **P3-CE** ✅ — `AGENT38V` PASS (**2026-04-12**); `PHASE3_COURSE_VALIDATION_REPORT.md` + `PHASE3_COURSE_CUTOVER_CHECKLIST.md` (deploy/HTTP smoke **DEFERRED**).
6. **Operator:** `prisma migrate deploy` on target, ETL dry-run/full import, deploy stack, curl smoke with JWT.
7. **Wave 3 (education):** TASK-39…TASK-43 per `PHASE3_WAVE3_EDUCATION_TASK_DECOMPOSITION.md` — **pending** until **P3-EA…P3-EE** each **PASS**.

---

## Wave 3 (Education service) — TASK-39…TASK-43

**Prerequisites:** Wave 2 complete (**P3-CE** PASS). **Port / DB:** `docs/infrastructure/PORT_ALLOCATION.md` — **4206** / `speakasap_education_db`. **Scope:** `ROADMAP.md` §3.2 — Django **`education`** (not `marathon`).

### Dependency graph

```text
TASK-39 (scaffold) → TASK-40 (design) → TASK-41 (impl) → TASK-42 (migration) → TASK-43 (validation)
```

### Parallel batches

| Batch | Tasks | Parallel? |
| ----- | ----- | --------- |
| Wave3 | TASK-39…TASK-43 | **NO** (single-service serial path) |

### Task execution order

1. **TASK-39** + `AGENT39V` → **P3-EA**
2. **TASK-40** + `AGENT40V` → **P3-EB**
3. **TASK-41** + `AGENT41V` → **P3-EC**
4. **TASK-42** + `AGENT42V` → **P3-ED**
5. **TASK-43** + `AGENT43V` → **P3-EE**

### Success metrics (Wave 3)

- `EDUCATION_API_CONTRACT.md` + `EDUCATION_DATA_MAPPING.md` frozen before TASK-41.
- List endpoints enforce limit ≤ 30; logging and env discipline match prior waves.
- `PHASE3_EDUCATION_VALIDATION_REPORT.md` + `PHASE3_EDUCATION_CUTOVER_CHECKLIST.md` record GO/NO-GO before Phase 4 waves assume education APIs exist.

### Next actions (orchestrator)

1. **P3-EA** — pending (`AGENT39` → `AGENT39V`).
2. **P3-EB** — pending (`AGENT40` → `AGENT40V`).
3. **P3-EC** — pending (`AGENT41` → `AGENT41V`).
4. **P3-ED** — pending (`AGENT42` → `AGENT42V`; live ETL may follow operator schedule).
5. **P3-EE** — pending (`AGENT43` → `AGENT43V`).
