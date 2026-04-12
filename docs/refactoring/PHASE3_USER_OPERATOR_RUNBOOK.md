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

**Agreed policy (2026-04-12, speakasap / alfares):** **Logical dump** as primary control. Before any destructive re-import on `speakasap_user_db`, take a custom-format dump from the Postgres container, then copy the file **off the host** (object storage or ops vault — not only container `/tmp`).

```bash
docker exec db-server-postgres pg_dump -U dbadmin -Fc -d speakasap_user_db \
  -f /tmp/speakasap_user_db_$(date -u +%Y%m%dT%H%MZ).dump
# Then scp/rsync the .dump off-box; container /tmp is not durable storage.
```

**Alternative (if ops later standardizes it):** VM or volume snapshot per `database-server` / hosting — reference ticket ID in `USER_DATA_MIGRATION_LOG.md` if used instead of or in addition to the dump.

After policy is agreed, tick the cutover checklist row: *`speakasap_user_db` backups / snapshot policy agreed*.

---

## 3. Rollback drill (once)

**Goal:** Prove you can return to last known good **app image** and **DB** without improvising.

**Executed 2026-04-12 (alfares):** DB path proven end-to-end: `pg_dump` → `pg_restore` into scratch DB `speakasap_user_db_drill_scratch` → `SELECT COUNT(*) FROM students` = **2** (matches live target) → `DROP DATABASE` scratch. Dump file during drill: `/tmp/speakasap_user_db_rollback_drill_20260412.dump` inside `db-server-postgres` (**deleted after drill**, **2026-04-12** — production dumps must still be copied off-box per §2). **Green image recorded:** `speakasap_green-user-service:latest` @ `sha256:cc0f7d6823a368630f9dae9c555ef2aad11815544a8935a863d2ed1f1ebd9bdb`. **Traffic color flip** not re-run this session (same procedure as prior successful `speakasap/scripts/deploy.sh` / blue-green); treat as standard ops when rollback is required.

Suggested dry run (adapt to your blue/green procedure):

1. Note current **green** image digest for `user-service` (`docker image inspect …`).
2. Restore **only** `speakasap_user_db` from the backup taken in §2 into a **scratch** DB or a maintenance window — or document “restore to new DB + repoint `USER_DATABASE_URL`” if that is your standard.
3. Run `speakasap/scripts/deploy.sh` (or nginx switch) to confirm previous color still serves traffic if you flip back.
4. Record date + operator in `PHASE3_USER_CUTOVER_CHECKLIST.md` post-cutover row (rollback drill).

---

## 4. F3-AUTH-PARITY — auth `users` vs portal emails

**Cause:** ETL maps legacy rows to target `auth_user_id` via **email** in auth `public.users`. If auth has almost no rows, target stays sparse by design (`USER_DATA_VALIDATION.md` §1a).

**Program decision (2026-04-12):** **Not required for Wave 1 user-service cutover.** Sparse target (2 students, etc.) is **accepted** with documented skips until a separate initiative backfills auth `users` for portal emails and ETL is re-run. **Full parity** remains the operator sequence below when product requires all legacy identities in `speakasap_user_db`.

**Operator sequence (when full parity is required):**

1. Backfill or sync portal users into **auth-microservice** DB (`users`) so emails match legacy `auth_user`.
2. Re-run ETL per `USER_DATA_MIGRATION_LOG.md` (dry-run → optional `--truncate-first` only after §2 snapshot → import).
3. Re-run `USER_DATA_VALIDATION.md` §1 counts and §3 orphan SQL; update execution table if counts change materially.

---

## 5. Traffic GO

When §2 policy is agreed, §3 drill done (or waived in writing by Lead), and §4 is either executed **or** explicitly waived for the wave (see §4 program decision) — set **cutover GO for traffic** in `PHASE3_USER_CUTOVER_CHECKLIST.md` and add one line to `PHASE3_USER_VALIDATION_REPORT.md` §5 closing **F3-BACKUP** / **F3-AUTH-PARITY** / drill as applicable.
