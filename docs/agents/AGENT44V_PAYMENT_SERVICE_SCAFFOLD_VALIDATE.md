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

- **2026-04-13:** `npm run build` in `speakasap/payment-service/` — **PASS** (exit 0; `prisma generate` + `tsc`).
- **Layout:** `payment-service/` with `src/`, `shared/*`, Prisma, `Dockerfile`, aligned with Phase 3 Nest patterns (`course-service/` reference).
- **`/health`:** `src/app.controller.ts` `@Get('health')`; `main.ts` excludes `health` from `api/v1` prefix → **`GET /health`**.
- **Env:** Root `speakasap/.env.example` includes `PAYMENT_SERVICE_PORT`, `PAYMENT_DB_NAME`, `PAYMENT_DATABASE_URL`, `PAYMENTS_MICROSERVICE_URL`, `LOGGING_*`, `AUTH_MICROSERVICE_URL`.
- **Secrets / URLs in src:** `rg 'https?://|localhost' payment-service/src` — **no matches**.
- **Port / DB:** `docs/infrastructure/PORT_ALLOCATION.md` — **4208**, **`speakasap_payment_db`**; README matches.
- **Compose:** `docker-compose.blue.yml` / `docker-compose.green.yml` — `payment-service` wired; **follow-up:** `docker-compose.template.yml` build path corrected to `./payment-service` + `Dockerfile` (same as blue/green) for manual template runs.
- **Forbidden repos:** No cross-repo edits required for this gate (scope `speakasap` only).

## Manual Checks (record evidence)

- [x] Build in `payment-service/` passes.
- [x] README includes port `4208`, DB `speakasap_payment_db`.
- [x] No hardcoded secrets/URLs in `payment-service/src`.
- [x] Compose includes payment service wiring.

## Sync gate (before TASK-45)

- **P4-OA:** **PASS** (2026-04-13)

## Verdict

**PASS** — TASK-44 closed; TASK-45 may proceed.

### If FAIL

- List defects with exact paths.
- Return to `docs/agents/AGENT44_PAYMENT_SERVICE_SCAFFOLD.md`.
- Do not clear **P4-OA** until re-validation PASS.
