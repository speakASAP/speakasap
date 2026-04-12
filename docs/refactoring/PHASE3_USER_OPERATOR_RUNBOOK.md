# Phase 3 user wave — minimal operator runbook

**Purpose:** Close the three items still open after engineering GO (`PHASE3_USER_CUTOVER_CHECKLIST.md` unchecked rows, `PHASE3_USER_VALIDATION_REPORT.md` §5 **F3-BACKUP** / **F3-AUTH-PARITY**, rollback drill).

**Prereq reads:** `USER_DATA_MIGRATION_LOG.md` (ETL), `USER_DATA_VALIDATION.md` §1a (auth parity), `PHASE3_USER_VALIDATION_REPORT.md` §3 (U3/U4 smoke pattern).

---

## 1. Quick verify (green user-service on app server)

Green container name: **`speakasap-user-green`**. Published host port is **dynamic** (example `0.0.0.0:32773->4207/tcp`); health checks use **4207 inside the container**.

```bash
docker ps -a --filter name=speakasap-user-green --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker inspect speakasap-user-green --format '{{.State.Health.Status}}'
docker exec speakasap-user-green wget -qO- http://127.0.0.1:4207/health
```

Expected: status **Up (healthy)**, health **`healthy`**, body **`{"status":"ok"}`**.

JWT smoke (U4): issue HS256 JWT from auth `JWT_SECRET` and call `/api/v1/students/me` the same way as recorded in `PHASE3_USER_VALIDATION_REPORT.md` §3 — re-run after deploy or auth changes.

---

## 2. F3-BACKUP — `speakasap_user_db` before destructive work

**Rule:** No `--truncate-first` / no mass re-import on production target without a **recoverable snapshot**.

**Minimal options (pick one and document who/when):**

- **Logical dump:** from a host that can reach Postgres, e.g. `pg_dump -Fc -d speakasap_user_db -f speakasap_user_db_$(date -u +%Y%m%dT%H%MZ).dump` (use your admin URL; store off-box).
- **Infra snapshot:** VM or volume snapshot per your `database-server` / hosting standard — reference ticket ID in `USER_DATA_MIGRATION_LOG.md` execution record if you extend it.

After policy is agreed, tick the cutover checklist row: *`speakasap_user_db` backups / snapshot policy agreed*.

---

## 3. Rollback drill (once)

**Goal:** Prove you can return to last known good **app image** and **DB** without improvising.

Suggested dry run (adapt to your blue/green procedure):

1. Note current **green** image digest for `user-service` (`docker image inspect …`).
2. Restore **only** `speakasap_user_db` from the backup taken in §2 into a **scratch** DB or a maintenance window — or document “restore to new DB + repoint `USER_DATABASE_URL`” if that is your standard.
3. Run `speakasap/scripts/deploy.sh` (or nginx switch) to confirm previous color still serves traffic if you flip back.
4. Record date + operator in `PHASE3_USER_CUTOVER_CHECKLIST.md` post-cutover row (rollback drill).

---

## 4. F3-AUTH-PARITY — auth `users` vs portal emails

**Cause:** ETL maps legacy rows to target `auth_user_id` via **email** in auth `public.users`. If auth has almost no rows, target stays sparse by design (`USER_DATA_VALIDATION.md` §1a).

**Operator sequence:**

1. Backfill or sync portal users into **auth-microservice** DB (`users`) so emails match legacy `auth_user`.
2. Re-run ETL per `USER_DATA_MIGRATION_LOG.md` (dry-run → optional `--truncate-first` only after §2 snapshot → import).
3. Re-run `USER_DATA_VALIDATION.md` §1 counts and §3 orphan SQL; update execution table if counts change materially.

---

## 5. Traffic GO

When §2 policy is agreed, §3 drill done (or waived in writing by Lead), and §4 done **if** full parity is required — set **cutover GO for traffic** in `PHASE3_USER_CUTOVER_CHECKLIST.md` and add one line to `PHASE3_USER_VALIDATION_REPORT.md` §5 closing **F3-BACKUP** / **F3-AUTH-PARITY** / drill as applicable.
