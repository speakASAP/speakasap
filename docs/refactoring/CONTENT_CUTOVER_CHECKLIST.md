# Content Service Cutover Checklist

**Updated:** 2026-04-10  
**Owner:** Phase 1 validation / cutover team

## Lead Orchestrator sign-off

- **Phase 1 (TASK-11..TASK-16):** ✅ **Complete** — Sync D closed **2026-04-10**.
- **Validation report:** `PHASE1_VALIDATION_REPORT.md` — **GO** (full program closure; optional follow-ups listed there).
- **Accepted follow-up (non-blocking):** formal p95/p99 export, optional automated smoke script, deployment dry-run.

---

## Part A — Validation gate (satisfied)

Evidence recorded in `PHASE1_VALIDATION_REPORT.md` and migration docs.

- [x] Translation routes live on target runtime (AGENT17 — stale container rebuild).
- [x] `PHASE1_VALIDATION_REPORT.md` at **GO** for Phase 1 closure.
- [x] Content migration parity (10 entities) per `CONTENT_DATA_MIGRATION_LOG.md` / `CONTENT_DATA_VALIDATION.md`.
- [x] GET endpoint smoke matrix — §1 of validation report (production matrix).
- [x] Negative-path checks — invalid IDs 400, missing entities 404, error body shape (validation report §3).
- [x] AI probes — translate success, 400 validation, 504 on timeout; logging with timestamps and `duration_ms` (validation report §4).
- [x] `MAX_PAGE_SIZE <= 30` and env-driven integration config (validation report §1, §6).
- [x] Rollback procedure documented — **Part D** below (execute if needed at go-live).
- [ ] Formal **p95/p99** baseline export — **deferred** (sample latencies in validation report §5).

---

## Part B — Production cutover execution (when scheduling traffic switch)

Run these when you intentionally cut consumer traffic or freeze legacy writes.

- [ ] Freeze legacy content writes (or explicitly accept delta sync policy).
- [ ] Execute final migration sync (if needed) and validate counts.
- [ ] Deploy content-service release using existing service deploy script.
- [ ] Switch traffic to new content-service route.
- [ ] Post-switch smoke: health, languages list, one endpoint per domain.
- [ ] Verify centralized logging receives request and error streams.
- [ ] Confirm rollback tooling and access immediately before switch.

---

## Part C — Post-cutover monitoring (first 60 minutes)

- [ ] Monitor error rate and 5xx spikes.
- [ ] Monitor response latency for list endpoints.
- [ ] Monitor AI translation error/timeout rate.
- [ ] Spot-check data correctness (languages, grammar, dictionary).
- [ ] Confirm no regression in dependent consumers.

---

## Part D — Rollback procedure

- [ ] Trigger rollback if any critical condition is hit:
  - sustained 5xx above threshold
  - broken core endpoints
  - data mismatch affecting users
- [ ] Repoint traffic to previous stable target.
- [ ] Restore prior deployment artifact/environment.
- [ ] If rollback is data-related, restore target DB state using documented rollback process.
- [ ] Publish incident note with root cause and recovery plan.

---

## Success criteria (go-live)

- [ ] All core endpoints return expected contract shape.
- [ ] Error handling conforms to standardized error format.
- [ ] Data parity confirmed after final sync.
- [ ] AI translation endpoints work with correct failure behavior.
- [ ] No critical alerts during first 60 minutes post-cutover.

---

## Verification artifacts to attach (go-live)

- [ ] Curl/output log for endpoint matrix.
- [ ] Migration count comparison snapshot.
- [ ] AI success/failure probe outputs.
- [ ] Logging/latency excerpts with timestamps.
- [ ] Final operational GO for traffic switch.

---

## Runtime bootstrapping (if blocked)

- [ ] Verify deployed route config and app version expose translate endpoints before timeout/config tuning.
- [ ] Confirm runtime health and container state (`docker ps`, `/health`).
- [ ] Re-run Part A smoke matrix from `PHASE1_VALIDATION_REPORT.md` template.
