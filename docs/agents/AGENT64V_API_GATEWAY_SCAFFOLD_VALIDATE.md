# AGENT64V: Validator — API Gateway Scaffold (TASK-64)

## Role

QA / Infra Validator. **Read-only** verification of TASK-64. Do not implement features.

## Objective

Confirm **api-gateway** scaffold meets sync **P5-GA** so TASK-65 may start.

## Preconditions

- Implementation agent reports TASK-64 complete.

## Verification Scope

1. `api-gateway/` exists; layout consistent with `course-service/` / `user-service/`.
2. `npm run build` succeeds in `api-gateway/`.
3. `/health` exists; README documents how to run locally.
4. No hardcoded production URLs, ports, or secrets; keys in **`speakasap/.env.example`** (values in **`speakasap/.env`** only; `ENV_MONOREPO.md`).
5. Port **4210** matches `PORT_ALLOCATION.md`.
6. No forbidden shared microservice repo changes.

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Scaffold layout | inspect `api-gateway/` | file list |
| Build pass | run build | output |
| Health route | code inspection | path |
| Env keys in root | inspect `.env.example` | keys |
| Port allocation | inspect docs + README | matching values |
| Repo isolation | path review | diff summary |

## Commands (examples)

- `npm run build`
- `rg "API_GATEWAY_PORT|AUTH_SERVICE_URL" /home/ssf/Documents/Github/speakasap/.env.example`
- `rg "http://|https://|localhost" api-gateway/src`

## Manual Checks (record evidence)

- [ ] `npm run build` in `api-gateway/`
- [ ] README port **4210**
- [ ] Grep `api-gateway/src` for suspicious hardcoded URLs

## Sync gate (before TASK-65)

- **P5-GA:** PASS / FAIL

## Verdict

PASS or FAIL with evidence.

### If FAIL

- List defects with paths; **return to** `docs/agents/AGENT64_API_GATEWAY_SCAFFOLD.md`.
- Do not clear **P5-GA** until PASS.
