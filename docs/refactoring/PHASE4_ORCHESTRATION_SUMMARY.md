# Phase 4 Orchestration Summary — Payment, Notification, Salary, Financial

**Last updated:** 2026-04-13
**Lead Orchestrator:** `docs/agents/master-prompt.md`
**Decomposition:** `PHASE4_TASK_DECOMPOSITION.md`
**Tasks index:** `SPEAKASAP_REFACTORING_TASKS_INDEX.md`

---

## Prerequisites

- **Phase 3:** Waves 1–3 closed per index (`P3-UE`, `P3-CE`, `P3-EE` with validator PASS).
- **Ports / DB:** `docs/infrastructure/PORT_ALLOCATION.md` — **4208** / `speakasap_payment_db`, **4209** / `speakasap_notification_db`, **4212** / `speakasap_salary_db`, **4213** / `speakasap_financial_db`.

---

## Serial critical path (default)

```text
TASK-44 → TASK-45 → TASK-46 → TASK-47 → TASK-48
  → TASK-49 → TASK-50 → TASK-51 → TASK-52 → TASK-53
  → TASK-54 → TASK-55 → TASK-56 → TASK-57 → TASK-58
  → TASK-59 → TASK-60 → TASK-61 → TASK-62 → TASK-63
```

No parallel tasks inside a single wave (one service, serial scaffold → design → impl → migration → validation).

Per-task detail (objective, deliverables, acceptance criteria, integration matrix, risks, handoff) is defined in `PHASE4_TASK_DECOMPOSITION.md` under **TASK-44** through **TASK-63**.

---

## Sync gates at a glance

| Wave         | Gates      | Program validation task |
| ------------ | ---------- | ------------------------- |
| Payment      | P4-OA…OE | TASK-48 + `AGENT48V`      |
| Notification | P4-NA…NE | TASK-53 + `AGENT53V`      |
| Salary       | P4-SA…SE | TASK-58 + `AGENT58V`      |
| Financial    | P4-FA…FE | TASK-63 + `AGENT63V`      |

---

## Operator deferral pattern (same as Phase 3)

Wave validation reports may mark **HTTP smoke**, **production routing**, or **live ETL** as **DEFERRED** with reason, while engineering **GO** is recorded for contract/build/migration artifacts. Operators complete deferred rows before full traffic cutover; Lead signs **WAIVE** only with written rationale.

---

## Next actions (Lead)

1. Confirm **subscription vs education-service** boundary (see `PHASE4_TASK_DECOMPOSITION.md`).
2. Run **TASK-44** + `AGENT44V` → **P4-OA**.
3. Proceed strictly **Implementation → Validator** per task; do not skip gates.
4. Before **TASK-60**, enforce **products / billing categories** single-source rule with course-service or ETL-only projection.

---

## Optional parallel (exception)

If documented by Lead: after **P4-OA**, **TASK-49** (notification scaffold) may overlap with payment design/implementation. Default remains **full serial** waves.
