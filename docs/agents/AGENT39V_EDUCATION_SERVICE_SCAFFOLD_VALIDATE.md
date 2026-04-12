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

- [x] `npm run build` in `education-service/` — PASS (**2026-04-12**)
- [x] README DB name and port — PASS
- [x] Grep `education-service/src` for suspicious hardcoded URLs — PASS

## Verification results (evidence)

**2026-04-12:** `education-service/` NestJS scaffold; `npm run build` OK; port **4206** / DB **`speakasap_education_db`** in README; compose blocks in `docker-compose.blue.yml` / `green`; `.env.example` keys `EDUCATION_*`.

## Sync gate (before TASK-40)

- **P3-EA:** **PASS** — TASK-40 may proceed.

## Verdict

**PASS**

### If FAIL

- List defects with paths; **return to** `AGENT39_EDUCATION_SERVICE_SCAFFOLD.md`.
- Do not clear **P3-EA** until PASS.
