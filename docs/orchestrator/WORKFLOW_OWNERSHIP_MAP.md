# SpeakASAP Workflow Ownership Map

Date: 2026-06-12

Status: Goal 3.3 complete at route-group level.

Source inputs:

- `docs/orchestrator/PORTAL_SURFACE_INVENTORY.md`
- `docs/refactoring/GATEWAY_ROUTE_OWNERSHIP_MATRIX.md`
- `api-gateway/src/proxy/upstream-resolve.ts`
- `speakasap-portal/portal/urls.py`
- `speakasap-portal/speakasap_site/urls.py`
- `speakasap-portal/rest/urls.py`

## Rule

Every migrated workflow needs one owning service, one gateway route group, one auth mode, and one verification path. Ambiguous workflows must remain `defer` or `reference-only` until owner approval clarifies them.

## Route-Group Ownership

| Legacy workflow group | Legacy evidence | Decision | Target owner | Gateway group |
|---|---|---|---|---|
| Lesson recordings | `education/lesson_records`, `cabinet/teacher`, `cabinet/student`, `education/tasks.py` | migrate first | `education-service` | `/api/v1/lessons/:lessonUuid/record*` |
| Student courses and lessons | `education`, `cabinet/student`, `rest/v2 education` | migrate | `education-service` | `/api/v1/student-courses`, `/api/v1/lessons` |
| Groups and teacher lesson management | `education`, `cabinet/teacher`, `cabinet/manager` | migrate | `education-service` | `/api/v1/groups`, `/api/v1/lessons` |
| Homework | `education/homework`, `courses/homework`, `src/incab/homework` | migrate | `education-service` | `/api/v1/homeworks` |
| Course/product catalog | `courses`, `course_materials`, `products`, `speakasap_site` course pages | migrate | `course-service`, `content-service` | `/api/v1/products`, `/api/v1/categories`, content routes |
| Public course content | `grammar`, `phonetics`, `songs`, `dictionary`, `books`, `seven` | migrate/defer by active product | `content-service` | `/api/v1/grammar`, `/api/v1/phonetics`, `/api/v1/songs`, `/api/v1/dictionary` |
| Offers and part-payment options | `offers`, `products`, `discount` | migrate | `course-service`, `payment-service` for payment-owned data | `/api/v1/offers`, `/api/v1/part-payment-collections`, `/api/v1/discounts` |
| Orders, invoices, subscriptions | `orders`, `orders.invoice`, `orders.webpay`, `orders.paypal`, `orders.cs` | migrate with payment boundary | `payment-service`; external processing in `payments-microservice` | `/api/v1/orders`, `/api/v1/invoices`, `/api/v1/subscriptions`, `/api/v1/webhooks/payments` |
| Students, teachers, managers, employee profiles | `students`, `employees`, `cabinet`, `speakasap_site` profile routes | migrate with auth boundary | `user-service`; login/JWT in `auth-microservice` | `/api/v1/students`, `/api/v1/teachers`, `/api/v1/managers`, `/api/v1/employee-profiles` |
| Profile and mobile auth compatibility | `rest/urls.py`, `speakasap_site` auth/profile routes | migrate/defer by current client usage | `user-service` plus `auth-microservice` | existing user/auth gateway group; compatibility routes need explicit contract before implementation |
| Questionnaires and quests | `quests`, `user_quest`, certification-related questionnaire routes | migrate | `certification-service` | `/api/v1/quests`, `/api/v1/questionnaires`, `/api/v1/user-questionnaires`, `/api/v1/manager/user-questionnaires` |
| Language tests, user tests, teacher tests, asset tests | `language_tests`, `user_tests`, `teacher_tests`, `seven_test` | migrate | `assessment-service`, `certification-service` where certificate eligibility applies | `/api/v1/language-user-tests`, `/api/v1/admin/language-tests`, `/api/v1/asset-user-tests` |
| Certificates | `certificates`, `education_certificates` | migrate | `certification-service` | `/api/v1/education-certificates`, `/api/v1/course-certificates` |
| Notifications, templates, letters, in-app | `notifications`, `ses`, notification tasks | migrate with delivery boundary | `notification-service`; delivery in `notifications-microservice` | `/api/v1/templates`, `/api/v1/letters`, `/api/v1/in-app`, `/api/v1/dispatch`, `/api/v1/preferences/me`, `/api/v1/notification-groups` |
| Helpdesk/support | `helpdesk`, `src/incab/helpdesk` | defer | future support owner or `user-service` integration | no current route; do not add until owner prioritizes |
| Salary, expenses, teacher payouts | `expenses`, `employees`, salary commands | migrate/defer by current operational need | `salary-service`, `financial-service` | `/api/v1/salary-*`, `/api/v1/calculation-runs`, `/api/v1/payout-runs`, `/api/v1/contracts` |
| Financial reporting, investors, revenue | `investors`, `expenses`, financial reports | migrate/defer | `financial-service` | `/api/v1/dashboard/overview`, `/api/v1/revenue`, `/api/v1/expenses` |
| Delivery/email courses | `delivery`, `ses`, delivery commands | defer/migrate if still active | `notification-service`, `content-service` | no new route until active usage confirmed |
| Marathons | `marathon`, `src/marathons` | defer/migrate by product priority | `course-service`, `content-service`, `assessment-service` depending on feature | no current route; needs specific contract |
| Public marketing/legal/SEO | `speakasap_site`, `redirecter`, legal templates, robots/Bing routes | migrate selected | `frontend`, nginx/ingress for redirects | frontend routes, not gateway unless API-backed |
| Admin/ops/reporting | `administrator`, `big_brother`, `portal` commands | defer/reference-only | service-specific admin APIs or monitoring | no general gateway route until narrowed |
| Dev/debug/old UI shells | `dev`, `inspinia`, obsolete templates | retire/reference-only | none | no route |

## Ambiguous Or Deferred Workflows

These need owner or runtime evidence before implementation:

- `helpdesk` ownership: support domain may not belong inside SpeakASAP core services.
- `big_brother`, `actions`, `flow`: likely analytics/automation; active usage not proven.
- `delivery`: could be content delivery, notification delivery, or commercial delivery depending on active product usage.
- `marathon`: spans content, education, assessment, and marketing.
- `seven` / `seven_test`: may be public content, assessment, or legacy standalone product.
- legacy mobile auth compatibility endpoints under `/ru/api/...`: requires current client usage check before changing.

## First Implementation Sequence

1. Lesson recordings in `education-service`.
2. Lesson-record data migration dry-run/reconciliation.
3. Gateway/frontend parity for recording state/upload/playback.
4. Runtime smoke checks for notification + merge flows from legacy ISSUE-106 through ISSUE-109.
5. Then continue education/course/homework surfaces before broader commercial and marketing work.

## Verification Evidence

This map intentionally uses route groups rather than every concrete legacy URL. Detailed route-level contracts must be created inside each implementation goal before code changes.
