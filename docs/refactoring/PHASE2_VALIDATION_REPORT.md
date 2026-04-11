# Phase 2 validation report (TASK-28)

**When:** 2026-04-11 (UTC, alfares operator pass)  
**Environment:** Production host **alfares** — Postgres `db-server-postgres` (`127.0.0.1:5432` from host for CLI).  
**Repo path:** `/home/ssf/Documents/Github/speakasap` (pulled `origin/main` — was **behind 2**).

## GO / NO-GO

**NO-GO** for Phase 2 data cutover until:

1. Read-only **`SOURCE_DATABASE_URL`** for the legacy Django monolith is defined and reachable from the import host (alfares or a job container on `nginx-network`).
2. Certification and assessment ETL scripts complete **dry-run** then **full import**; migration log execution tables updated with row summaries.
3. Legacy vs target **count parity** (or documented variance) from `CERTIFICATION_DATA_VALIDATION.md` / `ASSESSMENT_DATA_VALIDATION.md` is recorded after import.

Structural / schema work completed in this pass is **not** sufficient for program GO.

## Prior gates (TASK-21…TASK-27)

| Task | Implementation | Validator | Notes |
|------|------------------|-----------|--------|
| TASK-21 | Done | AGENT21V PASS 2026-04-10 | P2-A |
| TASK-22 | Done | AGENT22V PASS 2026-04-11 | P2-B |
| TASK-25 | Done | AGENT25V PASS 2026-04-11 | P2-B |
| TASK-23 | Done | AGENT23V PASS 2026-04-11 | P2-C |
| TASK-26 | Done | AGENT26V PASS 2026-04-11 | P2-C |
| TASK-24 | Done | AGENT24V PASS 2026-04-11 (doc/script review) | Live parity **pending** |
| TASK-27 | Done | AGENT27V PASS 2026-04-11 (doc/script review) | Live parity **pending** |

## Evidence (this run)

### Prisma

| Service | Command | Result |
|---------|---------|--------|
| Certification | `npx prisma migrate deploy` (host `127.0.0.1` in `DATABASE_URL`) | Applied `20260411203000_student_course_uuid_string` after `git pull`. |
| Assessment | Same pattern | Created `speakasap_assessment_db` + applied `20260411120000_init`. |

**Note:** Running Prisma from the alfares shell without rewriting the hostname fails (**P1001** to `db-server-postgres`). Use `127.0.0.1` or run inside a container on the Docker network.

### ETL (Python)

| Script | `--dry-run` | Full import |
|--------|-------------|---------------|
| `migrate-certification-from-legacy.py` | Failed smoke test (no valid `SOURCE_DATABASE_URL` on server; legacy tables not on target) | **Not executed** |
| `migrate-assessment-from-legacy.py` | **Not executed** (same blocker) | **Not executed** |

### SQL validation (target DBs only)

Executed via `docker exec db-server-postgres psql -U dbadmin -d <db> …` on alfares.

**Certification (`speakasap_certification_db`):** target row counts all **0**; orphan checks **0**; no `language%` tables in `public`.

**Assessment (`speakasap_assessment_db`):** counts all **0**; no `%teacher%` tables; orphan smoke **0** / **0**; certification-pattern query noted in `ASSESSMENT_DATA_VALIDATION.md` (false positives on `*Question*` names).

### E2E HTTP / JWT

**Not run** — services not exercised in this pass; recommend `/health` + contract smoke from a running stack after data import.

## Blocking defects

| ID | Item | Owner |
|----|------|-------|
| B1 | No `SOURCE_DATABASE_URL` (legacy portal Postgres) on alfares for ETL | Infra / DBA |
| B2 | Data import and count parity vs legacy not completed | Data migration |
| B3 | `assessment-service/.env` line 30: unquoted value breaks `source .env` (`HH:mm:ss: command not found`) | Service operator |

## Non-blocking

- Prisma major-version upgrade notices (CLI only).

## AGENT28V meta-validation (P2-E)

Per `docs/agents/AGENT28V_PHASE2_VALIDATION_VALIDATE.md`:

**Verdict: FAIL**

- E2E matrix lacks real request/response evidence against running services.
- GO is not stated as PASS; blocking items B1–B3 remain.
- This report documents **NO-GO** until B1–B2 are cleared and re-validated.

**Return to:** `docs/agents/AGENT28_PHASE2_VALIDATION.md` after legacy `SOURCE_DATABASE_URL` is available and ETL + parity SQL are complete.
