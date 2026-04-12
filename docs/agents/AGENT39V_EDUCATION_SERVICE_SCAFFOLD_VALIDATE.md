# AGENT39V: Validator — Education Service Scaffold (TASK-39)

## Role

QA / Infra Validator. **Read-only** verification of TASK-39. Do not implement features.

## Objective

Confirm education-service scaffold meets sync **P3-EA** so TASK-40 (design) may start.

## Preconditions

- Implementation reports TASK-39 complete.

## Verification Scope

1. `education-service/` exists; layout consistent with `course-service/` / `user-service/`.
2. `npm run build` succeeds in `education-service/`.
3. `/health` exists; README documents how to run locally.
4. No hardcoded production URLs, ports, or secrets; keys live in **`speakasap/.env.example`** (values in **`speakasap/.env`** only; see `docs/infrastructure/ENV_MONOREPO.md`).
5. Port **4206** and DB **`speakasap_education_db`** match `PORT_ALLOCATION.md`.
6. No forbidden shared microservice repo changes.

## Manual Checks (record date + outcome)

- [ ] `npm run build` in `education-service/`
- [ ] README DB name and port
- [ ] Grep `education-service/src` for suspicious hardcoded URLs

## Verification results (evidence)

_Record findings, paths, and command output references when run._

## Sync gate (before TASK-40)

- **P3-EA:** **PASS** or **FAIL** — TASK-40 proceeds only on **PASS**.

## Verdict

**PENDING** — set to **PASS** or **FAIL** after checks.

### If FAIL

- List defects with paths; **return to** `AGENT39_EDUCATION_SERVICE_SCAFFOLD.md`.
- Do not clear **P3-EA** until PASS.
