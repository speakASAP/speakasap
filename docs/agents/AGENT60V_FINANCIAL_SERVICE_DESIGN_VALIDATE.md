# AGENT60V: Validator — Financial Service Design (TASK-60)

## Role

QA / Contract Validator. Read-only review of TASK-60.

## Objective

Clear sync **P4-FB** — contract + mapping frozen.

## Preconditions

- TASK-60 implementation submitted (`FINANCIAL_API_CONTRACT.md`, `FINANCIAL_DATA_MAPPING.md`).

## Verification Scope

1. Both markdown files exist under `docs/refactoring/`.
2. List endpoints specify max **30** items per request.
3. Out-of-scope and obsolete legacy areas explicitly listed.
4. Integration points document **speakasap-payment-service** and **speakasap-salary-service** as HTTP-only read dependencies (no shared DB).
5. **`products` / billing categories**: explicit single-source decision vs **speakasap-course-service** (API addendum or financial-owned projection) per `PHASE4_TASK_DECOMPOSITION.md`.

## Verification matrix

| Check | Method | Evidence |
| --- | --- | --- |
| Contract/mapping files | file check | paths |
| Endpoint completeness | contract scan | section list |
| Read model boundaries | integration scan | payment/salary references |
| Products decision | explicit statement search | contract/mapping note |
| Pagination cap | endpoint scan | limits |

## Commands (examples)

- `rg "products|billing categories|single source" docs/refactoring/FINANCIAL_*`
- `rg "payment-service|salary-service|course-service" docs/refactoring/FINANCIAL_API_CONTRACT.md`

## Verification results (evidence)

| Check | Result | Evidence |
| --- | --- | --- |
| Contract/mapping files | PASS | `speakasap/docs/refactoring/FINANCIAL_API_CONTRACT.md`, `FINANCIAL_DATA_MAPPING.md` present |
| Endpoint completeness | PASS | Contract lists health, revenue (matrix / by-method / summary), expenses (summary / operating-lines), dashboard, internal refresh; upstream payment/salary/course consumer sections |
| Read model boundaries | PASS | `FINANCIAL_API_CONTRACT.md` §Read-model strategy L79–87: no direct PostgreSQL to payment/salary DBs; `FINANCIAL_DATA_MAPPING.md` §Read dependencies L102–108: **speakasap-payment-service**, **speakasap-salary-service**, course-service, HTTP + `X-Internal-Token` |
| Products decision | PASS | `FINANCIAL_API_CONTRACT.md` §Products / billing category ownership L15–19: **speakasap-course-service** SoT for `products.Category` / `Product`; financial stores reporting keys + snapshots only |
| Pagination cap | PASS | Global rule L45–48: `limit` default 20, **maximum 30**; internal `orders-paid-slice` / `transactions-slice` L99–100 explicit max 30; `operating-lines` is paginated list under same rule (L150) |

**Note:** Shorthand `payment-service` / `salary-service` in contract headings; full **`speakasap-*`** names in mapping §Read dependencies — both docs align on HTTP-only reads.

## Sync gate (before TASK-61)

- **P4-FB:** PASS

## Verdict

**PASS** — TASK-60 artifacts satisfy the verification matrix; safe to proceed to TASK-61 implementation per frozen contract.

### If FAIL

Return to `docs/agents/AGENT60_FINANCIAL_SERVICE_DESIGN.md`.
