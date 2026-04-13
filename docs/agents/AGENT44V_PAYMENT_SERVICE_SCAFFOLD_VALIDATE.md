# AGENT44V: Validator — Payment Service Scaffold (TASK-44)

## Role

QA / Infra Validator. **Read-only** verification of TASK-44. Do not implement features.

## Objective

Confirm **payment-service** scaffold meets sync **P4-OA** so TASK-45 may start.

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Scaffold exists | Inspect `payment-service/` layout | file list |
| Build passes | run `npm run build` in service | command output |
| `/health` endpoint exists | controller/module inspection | code path |
| Env keys are root-scoped | verify `speakasap/.env.example` | key names only |
| No forbidden repo edits | scan git diff paths | path list |

## Preconditions

- Implementation agent reports TASK-44 complete.

## Verification Scope

1. `payment-service/` exists; layout consistent with `course-service/` / `user-service/`.
2. `npm run build` succeeds in `payment-service/`.
3. `/health` exists; README documents how to run locally.
4. No hardcoded production URLs, ports, or secrets; keys in **`speakasap/.env.example`** (values in **`speakasap/.env`** only; `ENV_MONOREPO.md`).
5. Port **4208** and DB **`speakasap_payment_db`** match `PORT_ALLOCATION.md`.
6. No forbidden shared microservice repo changes.

## Commands (examples)

- `npm run build`
- `rg "http://|https://|localhost" src`
- `rg "PAYMENT_SERVICE_PORT|PAYMENT_DATABASE_URL" /home/ssf/Documents/Github/speakasap/.env.example`

## Verification results (evidence)

Leave this section empty until execution.

## Manual Checks (record evidence)

- [ ] Build in `payment-service/` passes.
- [ ] README includes port `4208`, DB `speakasap_payment_db`.
- [ ] No hardcoded secrets/URLs in `payment-service/src`.
- [ ] Compose includes payment service wiring.

## Sync gate (before TASK-45)

- **P4-OA:** _PENDING / PASS / FAIL_

## Verdict

_PENDING_

### If FAIL

- List defects with exact paths.
- Return to `docs/agents/AGENT44_PAYMENT_SERVICE_SCAFFOLD.md`.
- Do not clear **P4-OA** until re-validation PASS.
