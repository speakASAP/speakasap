# Phase 5 Frontend to Gateway Contract Mapping (TASK-70)

**Date:** 2026-04-26  
**Wave:** Phase 5 - Wave 2 (`speakasap-frontend`)  
**Gate target:** `P5-FB`

## Objective

Freeze page-level frontend integration so all learner/teacher/admin actions call gateway routes only.

## Baseline

- Frontend scaffold routes: `/`, `/learner`, `/teacher`, `/admin`.
- Gateway base path: `/api/v1` via `NEXT_PUBLIC_API_URL`.
- Auth policy source: `GATEWAY_AUTH_BOUNDARY.md`.

## Global mapping rules

1. Frontend never calls domain services directly; only `NEXT_PUBLIC_API_URL + /api/v1/*`.
2. Public unauthenticated frontend access is limited to gateway `GET /health` checks.
3. Portal business actions require JWT bearer flow through gateway.
4. Any internal route family (`/api/v1/internal/**`) is out of scope for browser clients.

## Learner portal mapping (`/learner`)

| Frontend action | Gateway route family | Method(s) | Auth | Notes |
| --- | --- | --- | --- | --- |
| Load language/content catalog widgets | `/api/v1/languages`, `/api/v1/grammar`, `/api/v1/phonetics`, `/api/v1/songs`, `/api/v1/dictionary` | `GET` | JWT | Read-only content feed |
| Load enrolled learning progress | `/api/v1/student-courses`, `/api/v1/lessons`, `/api/v1/homeworks` | `GET` | JWT | Learner dashboard data |
| Load learner assessment attempts | `/api/v1/language-user-tests`, `/api/v1/asset-user-tests` | `GET` | JWT | Learner test history |
| Submit questionnaire/feedback | `/api/v1/user-questionnaires` | `POST` | JWT | Contract uses submit-style paths |
| View certificates/quests | `/api/v1/course-certificates`, `/api/v1/education-certificates`, `/api/v1/quests` | `GET` | JWT | Learner achievements |
| Manage learner notification prefs | `/api/v1/preferences/me/*` | `GET`, `PATCH` | JWT | Notification settings |

## Teacher portal mapping (`/teacher`)

| Frontend action | Gateway route family | Method(s) | Auth | Notes |
| --- | --- | --- | --- | --- |
| Load teacher profile summary | `/api/v1/teachers`, `/api/v1/employee-profiles` | `GET` | JWT | Teacher identity data |
| Review assigned groups and lessons | `/api/v1/groups`, `/api/v1/lessons`, `/api/v1/homeworks` | `GET` | JWT | Teaching workload view |
| View course catalog/offers for assignment context | `/api/v1/categories`, `/api/v1/products`, `/api/v1/offers` | `GET` | JWT | Read-only in current contract |
| Access notification inbox and letters | `/api/v1/in-app*`, `/api/v1/letters*` | `GET`, `PATCH` | JWT | Teacher comms |
| View salary-related summaries (role-gated) | `/api/v1/admin/summary/*`, `/api/v1/salary-profiles` | `GET` | JWT (staff/admin rules) | UI hides unless authorized upstream |

## Admin portal mapping (`/admin`)

| Frontend action | Gateway route family | Method(s) | Auth | Notes |
| --- | --- | --- | --- | --- |
| Manage assessment catalog | `/api/v1/admin/language-tests`, `/api/v1/admin/language-user-tests` | `GET`, `POST`, `PATCH`, `DELETE` | JWT (admin) | Full admin test flows |
| Manage notification templates and groups | `/api/v1/templates`, `/api/v1/notification-groups` | `GET`, `POST`, `PATCH`, `DELETE` | JWT (staff/admin) | Messaging admin |
| Manage payment/discount/subscription operations | `/api/v1/orders`, `/api/v1/discounts/templates`, `/api/v1/subscriptions`, `/api/v1/invoices` | mixed per contract | JWT (admin/staff) | E-commerce admin |
| Review financial dashboards | `/api/v1/dashboard/overview`, `/api/v1/revenue/*`, `/api/v1/expenses/*` | `GET` | JWT (admin/staff) | Financial read models |
| Manage manager/employee entities | `/api/v1/managers`, `/api/v1/employee-profiles` | `GET`, `PATCH` | JWT (admin/staff) | User domain admin |

## Auth and route-guard expectations for TASK-71

- Frontend stores/forwards bearer JWT for protected calls.
- Route guards in frontend are UX-only; backend authorization remains source of truth.
- Any call to `/api/v1/internal/**` from frontend is prohibited.

## Blockers and open gaps

| ID | Gap | Impact | Owner | Unblock condition |
| --- | --- | --- | --- | --- |
| P5-FB-01 | Exact page IA and final user journeys are not frozen yet | Medium | Product/UX owner | Provide approved IA/screen list to finalize action-level mapping |
| P5-FB-02 | Role matrix (learner vs teacher vs admin/staff) not fully codified in a single frontend auth spec | Medium | Platform/auth owner | Publish role-capability matrix aligned with gateway/upstream auth semantics |
| P5-FB-03 | Live JWT/session integration method for frontend runtime (cookie vs storage model) not selected in Phase 5 docs | Medium | Frontend/auth implementation owner | Select and document session transport model before TASK-71 auth implementation |

## Verdict

`P5-FB` readiness: **PASS (engineering)** with blockers tracked for TASK-71 planning.
