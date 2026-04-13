# AGENT49V: Validator — Notification Service Scaffold (TASK-49)

## Role

QA / Infra Validator. **Read-only** verification of TASK-49. Do not implement features.

## Objective

Confirm **notification-service** scaffold meets sync **P4-NA** so TASK-50 may start.

## Preconditions

- Implementation agent reports TASK-49 complete.

## Verification Scope

1. `notification-service/` exists; layout consistent with `course-service/` / `user-service/`.
2. `npm run build` succeeds in `notification-service/`.
3. `/health` exists; README documents how to run locally.
4. No hardcoded production URLs, ports, or secrets; keys in **`speakasap/.env.example`** (values in **`speakasap/.env`** only; `ENV_MONOREPO.md`).
5. Port **4209** and DB **`speakasap_notification_db`** match `PORT_ALLOCATION.md`.
6. No forbidden shared microservice repo changes.

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Scaffold structure | inspect `notification-service/` | file list |
| Build | run `npm run build` | command output |
| Health endpoint | inspect code | path |
| Env root usage | verify `.env.example` keys | key names |
| Shared repo isolation | check changed paths | diff/path list |

## Commands (examples)

- `npm run build`
- `rg "NOTIFICATION_SERVICE_PORT|NOTIFICATION_DATABASE_URL" /home/ssf/Documents/Github/speakasap/.env.example`
- `rg "http://|https://|localhost" notification-service/src`

## Verification results (evidence)

Leave empty until execution.

## Manual Checks (record evidence)

- [ ] `npm run build` in `notification-service/`
- [ ] README port and DB name
- [ ] Grep `notification-service/src` for suspicious hardcoded URLs

## Sync gate (before TASK-50)

- **P4-NA:** _PENDING / PASS / FAIL_

## Verdict

_PENDING_

### If FAIL

- List defects with paths; **return to** `docs/agents/AGENT49_NOTIFICATION_SERVICE_SCAFFOLD.md`.
- Do not clear **P4-NA** until PASS.
