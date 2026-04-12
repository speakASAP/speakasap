# Phase 3 user wave — validation report (TASK-33)

**Report version:** 2026-04-12 (rev. **c** — operator ETL + deploy + HTTP matrix + F3 close-out)  
**Scope:** Program-level validation for **speakasap-user-service** (Wave 1) per `SPEAKASAP_REFACTORING_PLAN.md` Phase 3 / `USER_API_CONTRACT.md`.

## Executive summary

| Track | Engineering gates (P3-UA–P3-UD) | Target DB | HTTP / routing |
|-------|-----------------------------------|-----------|----------------|
| User service | **PASS** (validators + schema) | **PASS** (migrations applied; orphan SQL **0**; post-ETL counts recorded) | **PASS** — `speakasap-user-green` healthy on `nginx-network`; **U3** + **U4** executed **2026-04-12** (see §3) |

**Program decision:** **GO** for **Wave 1 user-service engineering completion through P3-UD** (scaffold, frozen contracts, NestJS implementation, migration script + validation docs, `speakasap_user_db` schema applied on **alfares** `db-server-postgres`).

**Operator pass (2026-04-12):** Live ETL (`migrate-user-from-legacy.py`), `speakasap` blue/green deploy (green stack includes **user-service**), logging hostname fix (**network alias** `logging-microservice` on `logging-microservice` backend compose). `speakasap/.env`: `SOURCE_DATABASE_URL`, `TARGET_DATABASE_URL`, `AUTH_DATABASE_URL` (host paths `127.0.0.1:5432` for target/auth when ETL runs on alfares), `INTERNAL_API_TOKEN` for user-service.

**Traffic cutover (Wave 1, rev. c):** **DB backup policy** agreed — logical `pg_dump` from `db-server-postgres`, copy off-box before any destructive re-import (`PHASE3_USER_OPERATOR_RUNBOOK.md` §2). **Rollback drill** executed same day — dump → scratch restore → row check → teardown (`PHASE3_USER_OPERATOR_RUNBOOK.md` §3). **Auth full parity** **waived** for this wave — sparse target and skips remain documented in `USER_DATA_VALIDATION.md` §1a until a later auth backfill + ETL re-run.

---

## Prior gates (TASK-29…TASK-32)

| Task | Implementation | Validator | Gate / date |
|------|------------------|-----------|---------------|
| TASK-29 | Done | AGENT29V PASS | P3-UA — 2026-04-12 |
| TASK-30 | Done | AGENT30V PASS | P3-UB — 2026-04-12 |
| TASK-31 | Done | AGENT31V PASS | P3-UC — 2026-04-12 |
| TASK-32 | Done | AGENT32V PASS; live ETL executed **2026-04-12** | P3-UD — 2026-04-12 |

---

## §3 HTTP / parity matrix

**Legend:** `PASS` = executed with evidence. `DEF` = deferred (no routed service or no token this run).

| # | Check | Evidence | Result |
|---|--------|----------|--------|
| U1 | Target DB exists | `speakasap_user_db` created; Prisma migration `20260412190000_init_user_tables` applied (**alfares**, **2026-04-12**) | PASS |
| U2 | Schema smoke | `USER_DATA_VALIDATION.md` §3–§4 SQL: orphan counts **0**; `auth_user_id` null counts **0** on empty tables | PASS |
| U3 | User-service `/health` | `docker exec speakasap-user-green wget -qO- http://127.0.0.1:4207/health` → `{"status":"ok"}`; container **healthy** (**2026-04-12**) | PASS |
| U4 | Authenticated `/api/v1/students/me` etc. | HS256 JWT from auth `JWT_SECRET` + first `users.id`/`email`; `curl` to published host port mapping `4207/tcp` → **200** JSON student profile (**2026-04-12**) | PASS |

---

## §4 Database evidence (alfares)

**Host:** `db-server-postgres` · **Database:** `speakasap_user_db` · **UTC:** 2026-04-12

### Row counts (post-ETL snapshot, operator pass)

| Table | Count |
|-------|------:|
| students | 2 |
| teachers | 1 |
| teacher_additional_languages | 2 |
| managers | 1 |
| employee_profiles | 1 |
| user_identity_mirror | 2 |

*Skips unchanged vs `USER_DATA_VALIDATION.md` §1a — **2** auth `users` at import time.*

### Referential integrity (same snapshot)

Orphan queries from `USER_DATA_VALIDATION.md` §3: **0** / **0**.

---

## §5 Follow-ups

| ID | Item | Owner | Status |
|----|------|--------|--------|
| F3-SSH | `Host speakasap` + tunnel `15432→127.0.0.1:5432` for legacy `portal_db` | Operator | **Done** (2026-04-12 run) |
| F3-ETL | `migrate-user-from-legacy.py` dry-run + import | Operator | **Done** (2026-04-12) |
| F3-DEPLOY | `speakasap/scripts/deploy.sh` (green includes user-service) | Operator | **Done** (2026-04-12) |
| F3-BACKUP | Snapshot / backup policy for `speakasap_user_db` before destructive re-import | Operator | **Closed** — logical `pg_dump -Fc` + off-box copy (2026-04-12); see `PHASE3_USER_OPERATOR_RUNBOOK.md` §2 |
| F3-ROLLBACK | DB rollback drill (`pg_dump` → scratch `pg_restore` → verify → teardown) | Operator | **Done** (2026-04-12); see `PHASE3_USER_OPERATOR_RUNBOOK.md` §3 |
| F3-AUTH-PARITY | Backfill auth `users` for portal emails if target counts must match legacy | Operator | **Waived for Wave 1 cutover** (2026-04-12) — accept documented sparse ETL; re-open when product requires full legacy parity (`PHASE3_USER_OPERATOR_RUNBOOK.md` §4, `USER_DATA_VALIDATION.md` §1a) |

**§5 sign-off (2026-04-12):** F3-BACKUP **agreed and evidenced** (drill included `pg_restore` validation). Rollback drill **DB leg complete**; blue/green flip remains standard deploy procedure. F3-AUTH-PARITY **not a blocker** for Wave 1 traffic GO — checklist updated to **GO** in `PHASE3_USER_CUTOVER_CHECKLIST.md`.
