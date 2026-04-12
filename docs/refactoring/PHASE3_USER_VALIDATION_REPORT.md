# Phase 3 user wave — validation report (TASK-33)

**Report version:** 2026-04-12  
**Scope:** Program-level validation for **speakasap-user-service** (Wave 1) per `SPEAKASAP_REFACTORING_PLAN.md` Phase 3 / `USER_API_CONTRACT.md`.

## Executive summary

| Track | Engineering gates (P3-UA–P3-UD) | Target DB | HTTP / routing |
|-------|-----------------------------------|-----------|----------------|
| User service | **PASS** (validators + schema) | **PASS** (migrations applied; orphan SQL **0** on current snapshot) | **Deferred** — dedicated `user-service` container not in active deploy inventory this run; contract routes require JWT + running service |

**Program decision:** **GO** for **Wave 1 user-service engineering completion through P3-UD** (scaffold, frozen contracts, NestJS implementation, migration script + validation docs, `speakasap_user_db` schema applied on **alfares** `db-server-postgres`).

**Non-blocking / operator before customer cutover:** (1) `ssh speakasap` with deploy key → run `migrate-user-from-legacy.py` and refresh `USER_DATA_VALIDATION.md` §1 counts; (2) deploy **user-service** (blue/green) and record authenticated smoke against `/api/v1/**` when routed.

---

## Prior gates (TASK-29…TASK-32)

| Task | Implementation | Validator | Gate / date |
|------|------------------|-----------|---------------|
| TASK-29 | Done | AGENT29V PASS | P3-UA — 2026-04-12 |
| TASK-30 | Done | AGENT30V PASS | P3-UB — 2026-04-12 |
| TASK-31 | Done | AGENT31V PASS | P3-UC — 2026-04-12 |
| TASK-32 | Done | AGENT32V PASS (script/doc + schema smoke; live ETL pending SSH) | P3-UD — 2026-04-12 |

---

## §3 HTTP / parity matrix

**Legend:** `PASS` = executed with evidence. `DEF` = deferred (no routed service or no token this run).

| # | Check | Evidence | Result |
|---|--------|----------|--------|
| U1 | Target DB exists | `speakasap_user_db` created; Prisma migration `20260412190000_init_user_tables` applied (**alfares**, **2026-04-12**) | PASS |
| U2 | Schema smoke | `USER_DATA_VALIDATION.md` §3–§4 SQL: orphan counts **0**; `auth_user_id` null counts **0** on empty tables | PASS |
| U3 | User-service `/health` | Not executed on a long-running user-service container in this run | DEF |
| U4 | Authenticated `/api/v1/students/me` etc. | Requires deployed service + JWT | DEF |

---

## §4 Database evidence (alfares)

**Host:** `db-server-postgres` · **Database:** `speakasap_user_db` · **UTC:** 2026-04-12

### Row counts (pre-ETL snapshot)

| Table | Count |
|-------|------:|
| students | 0 |
| teachers | 0 |
| teacher_additional_languages | 0 |
| managers | 0 |
| employee_profiles | 0 |
| user_identity_mirror | 0 |

*Re-run after live ETL; expect counts ≤ legacy with documented skips (email → auth UUID mapping).*

### Referential integrity (same snapshot)

Orphan queries from `USER_DATA_VALIDATION.md` §3: **0** / **0**.

---

## §5 Follow-ups (non-blocking)

| ID | Item | Owner |
|----|------|--------|
| F3-SSH | Add `IdentityFile` for `Host speakasap` on import runners; run ETL | Operator |
| F3-ETL | Execute `user-service/scripts/migrate-user-from-legacy.py` (dry-run → optional `--truncate-first` → import) | Operator |
| F3-DEPLOY | Build/deploy **user-service** on `nginx-network`; repeat U3–U4 | Operator |
