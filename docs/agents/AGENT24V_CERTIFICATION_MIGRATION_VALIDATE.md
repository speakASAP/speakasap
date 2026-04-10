# AGENT24V: Validator — Certification Migration (TASK-24)

## Role

QA / Data Validator Agent.

## Objective

Verify certification migration artifacts are credible and aligned with `CERTIFICATION_DATA_MAPPING.md`.

---

## Preconditions

- TASK-23 validator **PASS**.
- Migration log and validation docs exist.

## Verification Scope

1. **Documentation**
   - `CERTIFICATION_DATA_MIGRATION_LOG.md` includes: when, who/tool, source → target, row counts or volumes, errors encountered.
   - `CERTIFICATION_DATA_VALIDATION.md` includes concrete checks (SQL or API-based) and results.

2. **Mapping adherence**
   - Sample records: legacy → new for at least one entity per major table group.

3. **Integrity**
   - Orphan checks or FK violations documented as **zero** or explained with waiver.

4. **Scope**
   - No assessment data imported into certification DB.

5. **Process**
   - Rollback or re-run path documented.

## Manual Checks

- [ ] Re-run at least one validation query independently (if DB access available)
- [ ] Compare legacy vs new counts for primary tables (or accept documented variance with reason)

## Verdict

**PASS** or **FAIL**.

### If FAIL

- List missing checks, inconsistent counts, undocumented gaps.
- **Return to:** `AGENT24_CERTIFICATION_MIGRATION.md`.

### If PASS

- Certification migration gate for **P2-D** satisfied (jointly with TASK-27).
