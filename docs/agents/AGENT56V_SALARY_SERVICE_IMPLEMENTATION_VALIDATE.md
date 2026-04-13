# AGENT56V: Validator — Salary Service Implementation (TASK-56)

## Role

QA / Backend Validator. Verify implementation matches frozen contract.

## Objective

Clear sync **P4-SC**.

## Preconditions

- TASK-56 complete; **P4-SB** was PASS.

## Verification Scope

1. Handlers align with `SALARY_API_CONTRACT.md` (routes, status codes, pagination cap 30).
2. No new hardcoded secrets or service URLs in `salary-service/src`.
3. External calls only to allowed dependencies per contract.
4. Integration points target speakasap services, not unrelated shared provider endpoints.
5. Logging includes timestamps and `duration_ms`.

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Route parity | compare code vs contract | route list |
| Hardcoded values | `rg` scan | no matches |
| Dependency boundary | inspect adapters/services | file paths |
| Logging fields | code scan | snippets |
| Build | run build | output |

## Commands (examples)

- `npm run build`
- `rg "duration_ms|SALARY|user-service|education-service|payment-service" salary-service/src`

## Verification results (evidence)

### Route parity (vs `docs/refactoring/SALARY_API_CONTRACT.md`)

| Contract path | Implementation |
| --- | --- |
| `GET /health` | `main.ts` global prefix excludes `health`; `AppController` `@Get('health')` → `/health` |
| `GET/PATCH …/salary-profiles`, list + detail | `@Controller('salary-profiles')` under `api/v1` |
| `GET/POST/PATCH …/salary-expenses` | `@Controller('salary-expenses')` |
| `GET/POST/PATCH …/contracts` | `@Controller('contracts')` |
| `POST/GET …/calculation-runs`, `POST …/finalize` | `@Controller('calculation-runs')` |
| `POST/GET …/payout-runs`, `POST …/commit` | `@Controller('payout-runs')` |
| `GET …/admin/summary/by-profile`, `…/months` | `@Controller('admin/summary')` + `by-profile`, `months` |

Global prefix: `app.setGlobalPrefix('api/v1', { exclude: ['health'] })` in `salary-service/src/main.ts`.

### Pagination cap 30

`salary-service/src/shared/list-response.ts`: `MAX_LIMIT = 30`, `parseListLimit` used from salary-profiles, salary-expenses, employee-contracts, calculation-runs, payout-runs services. List envelope matches `{ data, meta: { nextCursor, limit } }` pattern in those services.

### Hardcoded secrets / URLs (`salary-service/src`)

`rg` for `https?://`, obvious secrets: no production URLs or keys in `src`. Bases from `process.env`: `PAYMENT_SERVICE_URL`, `EDUCATION_SERVICE_URL`, `AUTH_SERVICE_URL` / `AUTH_MICROSERVICE_URL`, `LOGGING_SERVICE_URL`. No `USER_SERVICE_URL` references (see gaps).

### Dependency boundary

| Client | Targets |
| --- | --- |
| `deps/payment-client.service.ts` | `POST/GET ${PAYMENT_SERVICE_URL}/api/v1/internal/salary/disburse…` + `X-Internal-Token` |
| `deps/education-client.service.ts` | `${EDUCATION_SERVICE_URL}/api/v1/internal/salary/period-aggregates` + internal token |
| `auth-client/auth-client.service.ts` | Auth validate (JWT issuer) |

No `payments-microservice` / unrelated provider hosts in `src`.

### Logging (`timestamp`, `duration_ms`)

- `shared/remote-logger.ts`: `timestamp: new Date().toISOString()` on outbound log payload.
- `shared/request-context.middleware.ts`: access log lines include ISO prefix and `duration_ms=…` on `finish`.
- HTTP clients (`payment-client`, `education-client`, `auth-client`): log lines include `duration_ms=…`.

### Build

`cd speakasap/salary-service && npm run build` — **exit 0** (2026-04-14).

### Contract gaps (non-route) — summary

1. **Idempotency replay** — see [Detailed cause: idempotency replay](#detailed-cause-idempotency-replay) and [Solutions](#solutions-idempotency-and-user-service).
2. **`USER_SERVICE_URL`** — see [Detailed cause: user-service](#detailed-cause-user-service-not-wired).

---

## Detailed cause: idempotency replay

### What the frozen contract says

In `docs/refactoring/SALARY_API_CONTRACT.md`, the error model table includes:

| HTTP | `error.code` | When |
|------|----------------|------|
| 409 | `IDEMPOTENCY_REPLAY` | Same `Idempotency-Key` + same body → **409**; prior success in `error.details.originalResult` |

**Resolved (Solution A):** On `replay?.match`, **`calculation-runs.service.ts`** (create), **`payout-runs.service.ts`** (create + commit) throw **`idempotencyReplayException(replay.body)`** from `shared/salary-http.exception.ts` → **409** + `error.code === 'IDEMPOTENCY_REPLAY'` + `error.details.originalResult` = stored first response. **`SALARY_API_CONTRACT.md`** replay row and idempotency table aligned with this shape.

---

## Detailed cause: user-service not wired

### What the contract assumes

The same contract file lists **`USER_SERVICE_URL`** and names **speakasap-user-service** as an HTTP callee (read-only, staff JWT or internal token per user contract) for resolving teacher/staff display fields and `authUserId` ↔ `legacyPortalUserId` when not denormalized.

### What the repo does

There are **no** references to `USER_SERVICE_URL` or a user HTTP client under `salary-service/src`. Deps module only exports education + payment clients.

### When that is still OK

If TASK-56 explicitly stores every field salary needs on **`SalaryProfile`** (and related rows) so that **no live user-service call** is required for list/detail/admin paths, the omission can be **temporary**. The contract should then say “deferred” or the env row should be marked optional so validators do not flag it.

### When it is not OK

If any handler still assumes “hydrate from user-service” for names, emails, or `authUserId`, those calls are **missing** — not a validator false positive.

---

## Solutions (idempotency and user-service)

### A. Align implementation with the frozen contract (recommended if the table stays)

1. On `replay?.match` in **`calculation-runs.service.ts`** (create), **`payout-runs.service.ts`** (create + **commit**), **do not** `return replay.body` as a success value.
2. **Throw** a `HttpException` (or `salaryHttpException`) with:
   - **status** `409`
   - **body** matching the standard envelope: `error.code === 'IDEMPOTENCY_REPLAY'`, `message` human-readable, and **`details`** (or a field explicitly allowed by your API style) containing **`replay.body`** so clients still receive the “original result” without a second write.
3. If the contract requires the **top-level** response to mirror the first success (some APIs duplicate resource at root on 409), amend **`SALARY_API_CONTRACT.md`** in the same PR to show the **exact JSON shape** for `IDEMPOTENCY_REPLAY` (today the table only names code + condition).

**Nest detail:** returning a body from a service method becomes 200/201 via the controller. Throwing `HttpException` is the straightforward way to force **409** with a structured `error` object consistent with `HttpErrorFilter` / `salaryHttpException`.

### B. Align the contract with the implementation (recommended only if product prefers “idempotent success”)

1. In **`SALARY_API_CONTRACT.md`**, replace or narrow the `IDEMPOTENCY_REPLAY` row: e.g. “Same key + same body → **same HTTP status and body as the original successful response** (typically 201 for create, 200 for commit).”
2. Optionally add: “Clients MUST NOT treat a second 201 as a duplicate create error; use response body ids.”
3. Re-run AGENT56V; **P4-SC** can pass once doc and code match.

This matches many public APIs (Stripe-style: replay returns same 200/20x). It is **valid** if all consumers agree — but it is a **contract change**, not a “validator nitpick”.

### C. Hybrid (usually avoid)

Return 200/201 but add a header such as `Idempotency-Replay: true`. That **does not** satisfy the current frozen table (which names **409** + **code**). Only use if you also update the contract to mention the header.

### User-service gap — pick one

1. **Implement:** add `UserClientService` (same pattern as `education-client` / `payment-client`), env `USER_SERVICE_URL` + internal token, call only read endpoints needed by salary handlers; keep **no** shared DB.
2. **Defer in writing:** in `SALARY_API_CONTRACT.md` (or TASK-56 scope note), state that user HTTP integration is **post-TASK-56** and salary v1 relies on denormalized fields only; remove or mark `USER_SERVICE_URL` optional in the frozen doc until implemented.

---

## Sync gate (before TASK-57)

- **P4-SC:** **PASS** (idempotency replay) after Solution A + contract clarification. **User-service:** unchanged — FAIL only if TASK-56 promised live HTTP calls; otherwise doc/scope (**Solution** user-service §2).

## Verdict

**PASS** for idempotency vs contract. Matrix items unchanged. **`USER_SERVICE_URL`** still absent in `salary-service/src` — track per user-service section if not deferred in writing.

### If regressions

Return to `docs/agents/AGENT56_SALARY_SERVICE_IMPLEMENTATION.md`.
