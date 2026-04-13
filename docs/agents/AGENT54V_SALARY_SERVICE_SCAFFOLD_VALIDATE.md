# AGENT54V: Validator — Salary Service Scaffold (TASK-54)

## Role

QA / Infra Validator. **Read-only** verification of TASK-54. Do not implement features.

## Objective

Confirm **salary-service** scaffold meets sync **P4-SA** so TASK-55 may start.

## Preconditions

- Implementation agent reports TASK-54 complete.

## Verification Scope

1. `salary-service/` exists; layout consistent with `course-service/` / `user-service/`.
2. `npm run build` succeeds in `salary-service/`.
3. `/health` exists; README documents how to run locally.
4. No hardcoded production URLs, ports, or secrets; keys in **`speakasap/.env.example`** (values in **`speakasap/.env`** only; `ENV_MONOREPO.md`).
5. Port **4212** and DB **`speakasap_salary_db`** match `PORT_ALLOCATION.md`.
6. No forbidden shared microservice repo changes.

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Scaffold exists | inspect folder | file list |
| Build pass | run build | output |
| Health endpoint | inspect code | route path |
| Env root-only | inspect `.env.example` | key list |
| Shared repo isolation | changed path review | diff summary |

## Commands (examples)

- `npm run build`
- `rg "SALARY_SERVICE_PORT|SALARY_DATABASE_URL" /home/ssf/Documents/Github/speakasap/.env.example`

## Verification results (evidence)

Leave empty until execution.

## Manual Checks (record evidence)

- [ ] `npm run build` in `salary-service/`
- [ ] README port and DB name
- [ ] Grep `salary-service/src` for suspicious hardcoded URLs

## Sync gate (before TASK-55)

- **P4-SA:** _PENDING / PASS / FAIL_

## Verdict

_PENDING_

### If FAIL

- List defects with paths; **return to** `docs/agents/AGENT54_SALARY_SERVICE_SCAFFOLD.md`.
- Do not clear **P4-SA** until PASS.
