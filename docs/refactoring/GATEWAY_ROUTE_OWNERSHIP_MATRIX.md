# Gateway Route Ownership Matrix (Phase 5 / TASK-65 freeze)

**Date:** 2026-04-19  
**Status:** Frozen for Phase 5 gateway contract work  
**Scope:** SpeakASAP services from Phase 1-4 contracts

## Source contracts

- `CONTENT_API_CONTRACT.md`
- `CERTIFICATION_API_CONTRACT.md`
- `ASSESSMENT_API_CONTRACT.md`
- `USER_API_CONTRACT.md`
- `COURSE_API_CONTRACT.md`
- `EDUCATION_API_CONTRACT.md`
- `PAYMENT_API_CONTRACT.md`
- `NOTIFICATION_API_CONTRACT.md`
- `SALARY_API_CONTRACT.md`
- `FINANCIAL_API_CONTRACT.md`

## Freeze rules

1. Gateway is the public entrypoint, but never becomes business data owner.
2. Each writable aggregate has exactly one owning microservice.
3. Internal routes (`/api/v1/internal/**`) stay internal by default; no browser exposure.
4. Health endpoints (`/health`) remain direct service-ops probes; gateway has its own `/health`.

## Route ownership matrix

| Domain slice | Gateway route prefix | Upstream owner service | External methods via gateway | Internal-only routes | Auth mode | Contract source |
| --- | --- | --- | --- | --- | --- | --- |
| Content catalog | `/api/v1/languages`, `/api/v1/grammar`, `/api/v1/phonetics`, `/api/v1/songs`, `/api/v1/dictionary` | `speakasap-content-service` | `GET` only | none | JWT | `CONTENT_API_CONTRACT.md` |
| Certification | `/api/v1/course-certificates`, `/api/v1/education-certificates`, `/api/v1/quests`, `/api/v1/questionnaires`, `/api/v1/user-questionnaires`, `/api/v1/manager/user-questionnaires` | `speakasap-certification-service` | `GET`, `PATCH`, `POST` (submit) per contract | none declared | JWT | `CERTIFICATION_API_CONTRACT.md` |
| Assessment (admin + user tests) | `/api/v1/admin/language-tests`, `/api/v1/language-user-tests`, `/api/v1/asset-user-tests`, `/api/v1/admin/language-user-tests` | `speakasap-assessment-service` | `GET`, `POST`, `PATCH`, `DELETE` per route | none declared | JWT (admin role where required) | `ASSESSMENT_API_CONTRACT.md` |
| User profiles | `/api/v1/students`, `/api/v1/teachers`, `/api/v1/managers`, `/api/v1/employee-profiles` | `speakasap-user-service` | `GET`, `PATCH` per route | `/api/v1/internal/*` (migration/support) | JWT; internal token for `/internal` | `USER_API_CONTRACT.md` |
| Course catalog and offers | `/api/v1/categories`, `/api/v1/products`, `/api/v1/part-payment-collections`, `/api/v1/offers` | `speakasap-course-service` | `GET` only (Wave 2 read mirror) | `/api/v1/internal/financial/products-metadata` | JWT for public; internal token for `/internal` | `COURSE_API_CONTRACT.md` |
| Education read APIs | `/api/v1/groups`, `/api/v1/student-courses`, `/api/v1/lessons`, `/api/v1/homeworks` | `speakasap-education-service` | `GET` only | none declared | JWT | `EDUCATION_API_CONTRACT.md` |
| Orders and checkout | `/api/v1/orders`, `/api/v1/orders/:orderId/pay`, `/api/v1/orders/:orderId/mark-paid` | `speakasap-payment-service` | `GET`, `POST`, `PATCH` | admin/internal reconciliation path handled by owner guards | JWT + role/internal guards | `PAYMENT_API_CONTRACT.md` |
| Discounts | `/api/v1/discounts/templates`, `/api/v1/orders/:orderId/discounts/*` | `speakasap-payment-service` | `GET`, `POST`, `DELETE` | none declared | JWT (admin where required) | `PAYMENT_API_CONTRACT.md` |
| Subscriptions and invoices | `/api/v1/subscriptions`, `/api/v1/invoices` | `speakasap-payment-service` | `GET`, `POST`, `PATCH` | none declared | JWT | `PAYMENT_API_CONTRACT.md` |
| Payment webhook ingress | `/api/v1/webhooks/payments` | `speakasap-payment-service` | `POST` | provider-native webhooks remain outside this service | signature + bridge trust policy | `PAYMENT_API_CONTRACT.md` |
| Notification templates and groups | `/api/v1/templates`, `/api/v1/notification-groups` | `speakasap-notification-service` | `GET`, `POST`, `PATCH`, `DELETE` | none declared | JWT (staff/admin rules per contract) | `NOTIFICATION_API_CONTRACT.md` |
| Notification preferences and dispatch | `/api/v1/preferences/me/*`, `/api/v1/dispatch/email*` | `speakasap-notification-service` | `GET`, `PATCH`, `POST` | none declared | JWT; idempotency key on dispatch | `NOTIFICATION_API_CONTRACT.md` |
| Notification inbox/history | `/api/v1/in-app*`, `/api/v1/letters*` | `speakasap-notification-service` | `GET`, `PATCH`, `POST` | none declared | JWT | `NOTIFICATION_API_CONTRACT.md` |
| Salary master data | `/api/v1/salary-profiles`, `/api/v1/salary-expenses`, `/api/v1/contracts` | `speakasap-salary-service` | `GET`, `POST`, `PATCH` | none declared | JWT (staff/admin) | `SALARY_API_CONTRACT.md` |
| Salary calculation and payouts | `/api/v1/calculation-runs*`, `/api/v1/payout-runs*`, `/api/v1/admin/summary/*` | `speakasap-salary-service` | `GET`, `POST` | `/api/v1/internal/salary/disburse*` | JWT for staff/admin; internal token for `/internal` | `SALARY_API_CONTRACT.md` |
| Financial read models and dashboards | `/api/v1/revenue/*`, `/api/v1/expenses/*`, `/api/v1/dashboard/overview` | `speakasap-financial-service` | `GET` | `/api/v1/internal/financial/*` | JWT for read APIs; internal token for `/internal` | `FINANCIAL_API_CONTRACT.md` |

## Single-writer ownership (no duplicate writable truth)

- Content entities: `speakasap-content-service`
- Certification entities: `speakasap-certification-service`
- Assessment entities: `speakasap-assessment-service`
- User identity/profile mirrors: `speakasap-user-service` (auth identity remains in `auth-microservice`)
- Product/category/offer catalog: `speakasap-course-service`
- Education progression entities: `speakasap-education-service`
- Orders/discounts/subscriptions/invoices: `speakasap-payment-service`
- Templates/preferences/dispatch state: `speakasap-notification-service`
- Salary contracts/expenses/calculation/payout state: `speakasap-salary-service`
- Financial aggregations/expense read models: `speakasap-financial-service`

## Gateway contract implications (for TASK-66+)

- Default gateway mapping is pass-through by route prefix to one upstream owner service.
- Internal prefixes are blocked from public gateway routes unless explicitly enabled for trusted service callers.
- Auth propagation model:
  - Browser/client calls: JWT at gateway, forwarded as bearer to upstream.
  - Service-to-service internal calls: `X-Internal-Token` model stays service-local and never exposed to browser clients.
