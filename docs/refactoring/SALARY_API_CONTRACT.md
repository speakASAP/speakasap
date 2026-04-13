# Salary service API contract (frozen for TASK-56)

**Service:** `speakasap-salary-service` (`salary-service/`)  
**Base path:** `GET /health` (no prefix); other routes under `api/v1` (Nest global prefix, same as `payment-service`).  
**Auth:** JWT from `auth-microservice` on user/admin-facing routes unless noted. Internal routes use `X-Internal-Token` equal to **`SALARY_INTERNAL_API_TOKEN`** (key name only; value in monorepo `.env`).

## Out of scope (explicit)

- Helpdesk, analytics, marathon, catalog/warehouse microservices.
- Non-salary **`expenses.Expense`** rows (financial-service owns general expense analytics per `ROADMAP.md`).
- Editing **`auth-microservice`**, **`payments-microservice`**, **`notifications-microservice`**, or nginx configs.
- **Full analytics dashboards** beyond admin list/summary parity for `administrator/salary` (deep BI deferred).

## Cross-service identifiers (read-only references)

- **`authUserId`** — string UUID, auth `sub`, aligned with **`USER_API_CONTRACT.md`**.
- **`legacyPortalUserId`** — integer legacy `auth_user.id` (correlation with portal and migration).
- **`lessonUuid`** — education-service lesson primary key in API shape (see **`EDUCATION_API_CONTRACT.md`**).
- **`studentCourseUuid`** — education boundary where salary needs lesson context.
- Payment rail: **`payoutId`**, **`paymentServiceRef`** — opaque strings returned by **speakasap-payment-service** once disbursement endpoints exist (see **Payment integration** below).

## Environment (key names only)

Per `AGENT55_SALARY_SERVICE_DESIGN.md` and scaffold:

- `SALARY_SERVICE_PORT`
- `SALARY_DATABASE_URL`
- `SALARY_PAYOUT_LOCK_TTL_MS` — advisory TTL (ms) for distributed payout-step locks (implementation may use DB row + `updatedAt` or Redis; behavior: reject overlapping **commit** with `409 SALARY_PAYOUT_LOCKED`).
- `LOGGING_SERVICE_URL`
- `USER_SERVICE_URL` — HTTP base for **speakasap-user-service** (read-only calls).
- `EDUCATION_SERVICE_URL` — HTTP base for **speakasap-education-service** (read-only calls).
- `PAYMENT_SERVICE_URL` — HTTP base for **speakasap-payment-service** (payout initiation / status).
- `SALARY_INTERNAL_API_TOKEN` — protects salary’s own `/api/v1/internal/**` from other services/gateway.
- `USER_SERVICE_INTERNAL_TOKEN` / `PAYMENT_SERVICE_INTERNAL_TOKEN` (or shared `INTERNAL_API_TOKEN` if monorepo standardizes one token) — **must match** callee’s `X-Internal-Token` contract when calling their internal routes (exact names frozen at TASK-56 with `.env.example` sync).

---

## Pagination and sorting

- List endpoints accept `limit` (default 20, **maximum 30**) and `cursor` (opaque, optional).
- Response: `{ "data": [...], "meta": { "nextCursor": string | null, "limit": number } }`.
- Default sort: `createdAt` or `date` descending unless specified.

---

## Error model

HTTP status + JSON body:

```json
{
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable message",
    "details": {}
  }
}
```

**`IDEMPOTENCY_REPLAY` shape:** HTTP 409, same envelope as above, with `error.code` = `IDEMPOTENCY_REPLAY` and `error.details.originalResult` set to the object that would have been returned on the first successful `POST` (e.g. `{ calculationRunId, status, lineCount }` for calculation create).

| HTTP | `error.code` | When |
|------|----------------|------|
| 400 | `VALIDATION_FAILED` | DTO / query validation |
| 401 | `UNAUTHORIZED` | Missing/invalid JWT |
| 403 | `FORBIDDEN` | Missing staff permission for salary admin |
| 404 | `NOT_FOUND` | Profile, expense, contract, run, or payout id unknown |
| 409 | `CONFLICT` | Invalid state transition (e.g. finalize draft twice) |
| 409 | `IDEMPOTENCY_REPLAY` | Same `Idempotency-Key` + same body as a stored success → **409** (not a repeat 201/200); prior success JSON in `error.details.originalResult` |
| 409 | `SALARY_PAYOUT_LOCKED` | Another worker holds payout lock within `SALARY_PAYOUT_LOCK_TTL_MS` |
| 422 | `CALCULATION_INVALID` | Inputs rejected (missing contract window, zero rate policy, etc.) |
| 502 | `DEPENDENCY_UNAVAILABLE` | user/education/payment HTTP failure after retries |

---

## Idempotency and payout safety

| Operation | Rule |
|-----------|------|
| `POST` **calculation run** | Optional `Idempotency-Key`; duplicate key + same body → same `calculationRunId` and snapshot (no duplicate lines). |
| `POST` **payout run** / **payout line commit** | **Required** `Idempotency-Key` (UUID) on commit-to-paid path; store `(idempotencyKey, requestHash, responseSnapshot)` for **24h** minimum. |
| Distributed lock | Before transitioning a **payout run** from `processing` → `completed` (or per-line `paid`), acquire logical lock scoped by `payoutRunId` with TTL `SALARY_PAYOUT_LOCK_TTL_MS`; overlap → `409 SALARY_PAYOUT_LOCKED`. |
| Payment rail | Delegating to payment-service uses **same** `Idempotency-Key` passed through or derived as `salary:{payoutLineId}:{action}` so payment-side dedupe aligns. |
| Replays | Duplicate client retry (same key + body): **409** + `IDEMPOTENCY_REPLAY`; first response body in `error.details.originalResult`. |

**Retries:** Idempotent `GET` and `POST` with `Idempotency-Key` may retry on `502`/`503` with backoff.

### Payout reconciliation

- **Rail outcome:** **speakasap-payment-service** is authoritative for disbursement status tied to `payoutRef` (from `POST .../disburse`). Salary-service stores `paymentServiceRef` and advances per-line / run state from observed terminal or in-flight status.
- **Polling:** After commit initiates disburse, workers **poll** `GET /api/v1/internal/salary/disburse/:payoutRef` with bounded backoff until terminal `completed` or `failed` (or timeout → surface `failed` / manual follow-up per ops runbook). Polls are idempotent reads.
- **Visibility:** `GET /api/v1/payout-runs/:payoutRunId` aggregates line states vs run so staff can see paid vs stuck lines against calculation amounts.
- **Recovery:** If salary restarts after payment accepted the request, **re-poll** by stored `payoutRef` and converge line state to the polled terminal outcome; do **not** issue a second disburse for the same payout line without a new commit path and new `Idempotency-Key` scope.

---

## Calculation versioning

- Each **`CalculationRun`** is immutable after `status: finalized` (or `failed`). Lines reference **`rulesVersion`** (string, e.g. semver or git sha of formula pack) for audit.
- Corrections use a **new** run id; never mutate finalized lines (append-only adjustment expenses if product requires, out of scope unless reopened).

---

## Dependency boundaries (HTTP only)

**No shared DB:** **speakasap-user-service**, **speakasap-education-service**, and **speakasap-payment-service** are used **only via HTTP** as below. Salary-service **must not** query or mutate those services' databases (no shared schema, no cross-service SQL). Salary-owned data lives only under **`SALARY_DATABASE_URL`**.

| Callee | Purpose | Auth | Notes |
|--------|---------|------|-------|
| **speakasap-user-service** | Resolve teacher/staff display fields, `authUserId` ↔ `legacyPortalUserId` when not denormalized | Staff JWT or **`X-Internal-Token`** per **`USER_API_CONTRACT.md`** internal section | **Read-only**; no user mutations from salary-service. |
| **speakasap-education-service** | Lesson counts / durations for parity with legacy `get_expected_lessons_duration` / `get_real_lessons_duration` | Staff JWT or internal token per education contract | Use **`EDUCATION_API_CONTRACT.md`** lesson routes; salary does **not** change lesson state. |
| **speakasap-payment-service** | Execute / query teacher disbursement rail | `X-Internal-Token` per payment internal rules | Shapes below; **must be mirrored into `PAYMENT_API_CONTRACT.md`** when implemented (same PR wave as TASK-56 or documented addendum). |

---

## Payment integration (consumer contract — implement on payment-service)

Until merged into `PAYMENT_API_CONTRACT.md`, treat this table as the **normative** interface salary-service will call:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/internal/salary/disburse` | Body: `{ "idempotencyKey": string, "legacyPortalUserId": number, "amountMinor": number, "currency": "EUR" \| "CZK" \| "RUB", "metadata": { "salaryPayoutLineId": string, "period": string } }`. Response: `{ "payoutRef": string, "status": "queued" \| "processing" \| "completed" \| "failed" }`. |
| `GET` | `/api/v1/internal/salary/disburse/:payoutRef` | Status poll for above. |

**Explicit:** salary-service **does not** call `payments-microservice` directly; all provider rails go through **speakasap-payment-service**.

---

## Domain endpoints

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness, no auth. |

### Salary profiles (legacy `SalaryProfile`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/salary-profiles` | Staff list (filters: `dateFrom`, `dateTo` — profiles with salary activity in range; `filter=teachers\|other`; paginated). |
| `GET` | `/api/v1/salary-profiles/:profileId` | Detail: rates, `preferable_pm`, bank/paypal hints, flags `showAsTeacher`, `showAsOther`, `currency`, bounds. |
| `PATCH` | `/api/v1/salary-profiles/:profileId` | Staff update of `currency`, `preferable_pm`, `salary`, `rate`, visibility flags (parity with `EditProfileView`). |

**DTO (response core):** `id`, `legacyPortalUserId`, `authUserId?`, `currency`, `preferablePm`, `salary`, `rate`, `showAsTeacher`, `showAsOther`, `bankAccount`, `paypalAccount`, `workDurationLowerBound`, `workDurationUpperBound`, `createdAt`, `updatedAt`.

### Salary expenses (legacy `SalaryExpense` and subtypes)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/salary-expenses` | Staff list: `profileId`, `dateFrom`, `dateTo`, `cursor`. |
| `GET` | `/api/v1/salary-expenses/:expenseId` | Detail including `kind`: `generic` \| `lesson` \| `support_bonus`. |
| `POST` | `/api/v1/salary-expenses` | Staff create manual row (parity `AddSalaryExpenseView`). |
| `PATCH` | `/api/v1/salary-expenses/:expenseId` | Staff update (parity `UpdateSalaryExpenseView`). |

**DTO:** `id`, `profileId`, `legacyPortalUserId`, `date` (ISO date), `price` (decimal string), `qty`, `comment`, `currency`, `kind`, `lessonUuid?`, `studentId?` (legacy student id for support bonus — migrate as opaque int), `groupId?` (legacy course group id if present).

### Employee contracts (legacy `EmployeeContract`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/contracts` | Staff list by `legacyPortalUserId` or `profileId`, paginated. |
| `GET` | `/api/v1/contracts/:contractId` | Detail: `validFrom`, `validTill`, `verified`, `mainContractId`, `contractUid`, document storage key/URL via future attachment boundary (metadata only in v1). |
| `POST` | `/api/v1/contracts` | Staff create main or prolongation (parity employees API). |
| `PATCH` | `/api/v1/contracts/:contractId` | Staff update metadata / `verified`. |

### Calculation runs

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/calculation-runs` | Start run: body `{ "period": "YYYY-MM", "profileIds?": number[], "rulesVersion": string }`. Fetches education aggregates over HTTP; persists proposed lines in `draft`. |
| `GET` | `/api/v1/calculation-runs/:runId` | Run status + line counts. |
| `POST` | `/api/v1/calculation-runs/:runId/finalize` | Locks run to `finalized` (immutable). |
| `GET` | `/api/v1/calculation-runs` | Staff history, paginated. |

### Payout runs

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/payout-runs` | Create run from `finalized` calculation lines or selected `salary-expenses` window; `Idempotency-Key` optional on create. |
| `GET` | `/api/v1/payout-runs/:payoutRunId` | Status aggregate: `draft` \| `processing` \| `completed` \| `failed`, per-line states. |
| `POST` | `/api/v1/payout-runs/:payoutRunId/commit` | **Idempotency-Key required** — invokes payment-service disburse per line; respects payout lock TTL. |
| `GET` | `/api/v1/payout-runs` | Staff list, paginated. |

### Admin summaries (parity `administrator/salary`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/admin/summary/by-profile` | Query `dateFrom`, `dateTo`, same permission filters as legacy list views; returns totals per profile (qty sum, subtotals by `preferable_pm` + `currency`, grand totals). Excludes lines whose `comment` contains substring **`Salary`** to mirror legacy `.exclude(comment__contains='Salary')` aggregation semantics. |
| `GET` | `/api/v1/admin/summary/months` | Distinct months available in `LessonSalaryExpense` analogue (for UI month picker). |

---

## Events (optional outbound, TASK-56 if wired)

Align names with `ROADMAP.md`:

- `salary.calculated` — `{ calculationRunId, period, profileCount }`
- `salary.paid` — `{ payoutRunId, payoutLineId, legacyPortalUserId, amountMinor, currency }`

---

## Versioning

URL prefix `api/v1`. Breaking changes require `v2` and deprecation policy consistent with other speakasap services.
