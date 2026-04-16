# task-01-f2-http-jwt-smoke — F2-HTTP-JWT (Phase 2 follow-up)

## Context

- **Program:** Phase 2 follow-up **F2-HTTP-JWT** (`SPEAKASAP_REFACTORING_TASKS_INDEX.md`). Aligns with **`docs/agents/AGENT28_PHASE2_VALIDATION.md`** / cutover themes: evidence-backed HTTP + JWT checks for certification and assessment.
- **Artifacts to update:** `docs/refactoring/PHASE2_VALIDATION_REPORT.md` §3 (rows **C2–C8**, **A2–A8**), `docs/refactoring/PHASE2_CUTOVER_CHECKLIST.md` § **Deploy / smoke**.
- **Contracts:** `docs/refactoring/CERTIFICATION_API_CONTRACT.md`, `docs/refactoring/ASSESSMENT_API_CONTRACT.md`.
- **Prerequisite (mandatory):** Public HTTPS for `speakasap-certification.alfares.cz` and `speakasap-assessment.alfares.cz` (or whatever DOMAIN each service’s standard **`./scripts/deploy.sh`** / blue-green emits) must reach the **Nest** certification and assessment apps — verify **`GET /health`** returns the simple certification/assessment body (e.g. `{"status":"ok"}`), **not** `auth-microservice` JSON. If prerequisite fails, **leave matrix rows as DEF** and only append a dated note to §3.1 (do not fake PASS).
- **JWT:** Obtain a bearer token the same way as other speakasap services (HS256 with shared `JWT_SECRET` from auth; see Phase 3 user runbook pattern in `docs/refactoring/PHASE3_USER_OPERATOR_RUNBOOK.md` JWT smoke). Redact tokens in any pasted evidence.

## What to do

1. **Pre-flight (blocking):** From alfares (or operator host with DNS to production):
   - `curl -sS -L "https://<certification-DOMAIN>/health"` — must match certification-service health shape.
   - Same for assessment DOMAIN.
   - If either shows **`service":"auth-microservice"`** or API paths return **404** from the wrong app, stop: open a **routing/upstream** fix in the **service deploy path** only (per workspace rule: no hand-edited nginx product rules). Re-run deploy until pre-flight passes.

2. **Stability:** Confirm `docker ps` shows assessment (and certification) **Up** (not **Restarting**). If assessment loops, fix cause from container logs first — **A2–A8** stay DEF until stable.

3. **Matrix (JWT-backed):** For each legacy bucket in the report’s §3 numbering, execute at least one representative **`GET`** or **`POST`** against the new surface per contract (e.g. certification: list `GET /api/v1/course-certificates?page=1&limit=1` with bearer; assessment: student or admin list per role). Capture HTTP status, **redacted** `Authorization` header (omit token value), and **one-line** response shape (e.g. `items[]` length or `error.code`).

4. **Docs:** When pre-flight + stability + matrix succeed:
   - Set §3 rows **C2–C8** and **A2–A8** **Result** column to **PASS** with evidence (UTC date, host, status codes).
   - Tick **`PHASE2_CUTOVER_CHECKLIST.md`** § **Deploy / smoke** items (deploy + `/health` + sample authenticated calls).
   - Short line in **`PHASE2_VALIDATION_REPORT.md`** § **Scheduled follow-up: F2-HTTP-JWT** that F2 is **done** (date).

5. If any prerequisite fails at step 1 or 2: **do not** tick cutover boxes; extend **`PHASE2_VALIDATION_REPORT.md` §3.1** with a new dated probe row only.

## Verify

From monorepo root (`speakasap/`):

```bash
grep -n 'C2–C8\|A2–A8\|§3.1' docs/refactoring/PHASE2_VALIDATION_REPORT.md
grep -n 'Deploy / smoke' -A8 docs/refactoring/PHASE2_CUTOVER_CHECKLIST.md
test -f docs/superpowers/cursor-tasks/task-01-f2-http-jwt-smoke.md && echo OK
```

After PASS: `curl -sS -L -o /dev/null -w '%{http_code}\n' "https://<cert-DOMAIN>/api/v1/course-certificates?page=1&limit=1"` with valid bearer should be **200** (or **403**/empty list per data), never **404** from wrong upstream.
