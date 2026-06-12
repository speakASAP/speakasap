# SpeakASAP Auth And RBAC Matrix

Date: 2026-06-12

Status: Goal 3.4 complete at route-group level.

## Auth Ownership Rule

`auth-microservice` owns identity and JWT validation. `api-gateway` validates bearer tokens and forwards authenticated requests. SpeakASAP services own domain-specific authorization.

## Auth Modes

| Auth mode | Meaning | Gateway behavior | Service behavior |
|---|---|---|---|
| `public` | Anonymous public page or static content | no bearer required only if route is outside protected API or explicitly allowed | no private data |
| `bearer` | Authenticated user | validate JWT through `auth-microservice` | apply domain access |
| `student` | Student-owned workflow | bearer required | verify student owns/has access to resource |
| `teacher` | Teacher workflow | bearer required | verify teacher assignment or role |
| `manager` | Manager/staff workflow | bearer required | verify manager/staff/admin role |
| `admin` | Administrative workflow | bearer required | verify admin/staff role and audit writes |
| `internal` | service-to-service route | require `x-internal-token` | verify internal contract and token |
| `webhook` | external provider callback | gateway exception only when explicit | service verifies provider signature/secret |
| `media-token` | scoped playback without session cookie | bearer not required when signed token valid | verify token scope, age, and resource |

## Route-Group RBAC Matrix

| Gateway/route group | Owner | Auth mode | Domain check |
|---|---|---|---|
| `/api/v1/lessons/:lessonUuid/record/presign` | `education-service` | `teacher` / `manager` | assigned teacher for lesson/student, or staff/admin acting explicitly. |
| `/api/v1/lessons/:lessonUuid/record/commit` | `education-service` | `teacher` / `manager` | assigned teacher for lesson/student, object metadata verified before state change. |
| `/api/v1/lessons/:lessonUuid/record/playback` | `education-service` | `student` / `teacher` / `manager` / `media-token` | paid student access and lesson availability, assigned teacher, staff/admin, or scoped one-hour token. |
| `/api/v1/lessons`, `/api/v1/student-courses`, `/api/v1/groups` | `education-service` | `student` / `teacher` / `manager` | access only to owned/assigned/managed education resources. Existing staff-only MVP must be expanded per route. |
| `/api/v1/homeworks` | `education-service` | `student` / `teacher` / `manager` | student sees own homework; teacher sees assigned lesson homework; manager/staff as allowed. |
| `/api/v1/students`, `/api/v1/teachers`, `/api/v1/managers`, `/api/v1/employee-profiles` | `user-service` | `student` / `teacher` / `manager` / `admin` | profile owner or staff/admin; sensitive fields need explicit field-level rules. |
| `/api/v1/products`, `/api/v1/categories` | `course-service` | `public` for reads where intended; `admin` for writes | writes require staff/admin; product visibility rules for reads. |
| `/api/v1/offers`, `/api/v1/part-payment-collections` | `course-service` | `student` / `teacher` / `manager` / `admin` | offer owner/recipient or staff/admin; payment options not external processing. |
| `/api/v1/orders`, `/api/v1/invoices`, `/api/v1/subscriptions`, `/api/v1/discounts` | `payment-service` | `student` / `manager` / `admin` | student sees own orders; staff/admin manage; external processing remains with `payments-microservice`. |
| `/api/v1/webhooks/payments` | `payment-service` | `webhook` | service verifies provider signature/secret; no arbitrary unauthenticated writes. |
| `/api/v1/templates`, `/api/v1/letters`, `/api/v1/in-app`, `/api/v1/dispatch`, `/api/v1/preferences/me`, `/api/v1/notification-groups` | `notification-service` | `bearer` / `student` / `manager` / `admin` | user can manage own preferences; dispatch/templates require staff/admin or internal service contract. |
| `/api/v1/questionnaires`, `/api/v1/user-questionnaires`, `/api/v1/manager/user-questionnaires`, `/api/v1/quests` | `certification-service` | `student` / `manager` / `admin` | student sees own attempts; manager/admin review as authorized. |
| `/api/v1/education-certificates`, `/api/v1/course-certificates` | `certification-service` | `student` / `manager` / `admin` | student sees own certificates; staff/admin issue/manage. |
| `/api/v1/language-user-tests`, `/api/v1/asset-user-tests` | `assessment-service` | `student` / `teacher` / `manager` | owner/assigned teacher/staff access. |
| `/api/v1/admin/language-tests`, `/api/v1/admin/language-user-tests` | `assessment-service` | `admin` / `manager` | staff/admin only. |
| `/api/v1/languages`, `/api/v1/grammar`, `/api/v1/phonetics`, `/api/v1/songs`, `/api/v1/dictionary` | `content-service` | `public` for reads where intended; `admin` for writes | reads can be public or student-scoped by product; writes staff/admin only. |
| `/api/v1/salary-*`, `/api/v1/calculation-runs`, `/api/v1/payout-runs`, `/api/v1/contracts`, `/api/v1/admin/summary` | `salary-service` | `teacher` / `manager` / `admin` | teacher sees own salary data only; staff/admin manage. |
| `/api/v1/dashboard/overview`, `/api/v1/revenue`, `/api/v1/expenses` | `financial-service` | `manager` / `admin` | financial data staff/admin only unless owner approves narrower roles. |
| `/api/v1/internal/...` | owning service | `internal` | `x-internal-token` and service contract required. |

## Legacy Public Routes

Public marketing/legal/static routes from `speakasap_site`, `redirecter`, `robots.txt`, and legal templates should be implemented in `frontend` or ingress/nginx, not as protected gateway APIs unless they need dynamic private data.

## High-Risk Gates

Owner approval or explicit implementation-goal acceptance criteria required before changing:

- payment webhooks or external payment processing behavior
- private lesson recordings or MinIO object deletion
- student personal data exports or destructive writes
- salary/financial reporting and payouts
- auth/login/JWT behavior
- legacy data deletion or cutover

## Verification Requirements

Each code-bearing implementation chunk must include:

- unauthorized check (`401`)
- authenticated but unauthorized check (`403`)
- not-found/private-resource check (`404`) where relevant
- one authorized happy path
- log/status evidence with actor, route, and decision

Lesson-recording-specific checks are detailed in `LESSON_RECORDING_CONTRACT.md`.
