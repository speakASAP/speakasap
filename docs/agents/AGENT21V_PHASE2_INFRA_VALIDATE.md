# AGENT21V: Validator — Phase 2 Infrastructure (TASK-21)

## Role

QA / Infra Validator Agent. **Read-only verification** of TASK-21 deliverables. Do not implement features.

## Objective

Confirm certification and assessment **scaffolds** meet Sync **P2-A** so contract tasks may start.

---

## Preconditions

- Implementation agent reports TASK-21 complete.
- Repository: `/Users/sergiystashok/Documents/GitHub/speakasap`.

## Verification Scope

1. **Directory structure**
   - `certification-service/` and `assessment-service/` exist with NestJS layout consistent with `content-service`.

2. **Build**
   - In each service: `npm run build` succeeds (or document equivalent if workspace differs).

3. **Health**
   - `/health` route exists and behavior is documented in each service README.

4. **Configuration**
   - No hardcoded production URLs, ports, or secrets in new code.
   - `.env.example` lists required keys (DB URL, port, `LOGGING_SERVICE_URL`, service name) — values empty or placeholders only.

5. **Port allocation**
   - `docs/infrastructure/PORT_ALLOCATION.md` still consistent; services use **4202** / **4203** as documented.

6. **Forbidden edits**
   - Confirm no changes under forbidden shared microservice repos (if touched → **FAIL**).

## Manual Checks (record evidence)

- [ ] `npm run build` in `certification-service`
- [ ] `npm run build` in `assessment-service`
- [ ] Grep for obvious hardcoded `http://` / `https://` in new scaffold code (allow only documented exceptions)
- [ ] README states DB names: `speakasap_certification_db`, `speakasap_assessment_db`

## Verdict

State **PASS** or **FAIL**.

### If FAIL

- List **defects** with file paths and required fix.
- **Return to:** Implementation agent using `AGENT21_PHASE2_INFRA.md`.
- Do not clear **Sync P2-A** until PASS.

## Output Artifact (optional)

Add a short subsection to `docs/refactoring/PHASE2_VALIDATION_REPORT.md` later, or attach notes for Lead Orchestrator: TASK-21 validator result + date.
