# Gateway Route Ownership Matrix

Date: 2026-06-12

Source of truth: `api-gateway/src/proxy/upstream-resolve.ts`.

## Routing Rule

The API gateway uses longest-prefix ownership by ordered matching. A request is forwarded when the request path equals a configured prefix or starts with `<prefix>/`. If no route matches, the gateway returns `NOT_FOUND`.

## Ownership Matrix

| Prefix | Upstream env | Owning service | Boundary |
|---|---|---|---|
| `/api/v1/internal/financial/products-metadata` | `COURSE_SERVICE_URL` | `course-service` | Internal financial product metadata slice. |
| `/api/v1/internal/financial/orders-paid-slice` | `PAYMENT_SERVICE_URL` | `payment-service` | Internal financial paid-order slice; external payment processing remains in `payments-microservice`. |
| `/api/v1/internal/financial/transactions-slice` | `PAYMENT_SERVICE_URL` | `payment-service` | Internal transaction slice. |
| `/api/v1/internal/financial/period-salary-totals` | `SALARY_SERVICE_URL` | `salary-service` | Internal salary totals. |
| `/api/v1/internal/financial/refresh-window` | `FINANCIAL_SERVICE_URL` | `financial-service` | Internal financial refresh. |
| `/api/v1/internal/financial` | `FINANCIAL_SERVICE_URL` | `financial-service` | Internal financial APIs. |
| `/api/v1/internal/salary` | `SALARY_SERVICE_URL` | `salary-service` | Internal salary APIs. |
| `/api/v1/internal` | `USER_SERVICE_URL` | `user-service` | Internal default. |
| `/api/v1/manager/user-questionnaires` | `CERTIFICATION_SERVICE_URL` | `certification-service` | Manager questionnaire workflow. |
| `/api/v1/user-questionnaires` | `CERTIFICATION_SERVICE_URL` | `certification-service` | User questionnaire workflow. |
| `/api/v1/questionnaires` | `CERTIFICATION_SERVICE_URL` | `certification-service` | Questionnaire definitions. |
| `/api/v1/quests` | `CERTIFICATION_SERVICE_URL` | `certification-service` | Quest/certification workflow. |
| `/api/v1/education-certificates` | `CERTIFICATION_SERVICE_URL` | `certification-service` | Education certificates. |
| `/api/v1/course-certificates` | `CERTIFICATION_SERVICE_URL` | `certification-service` | Course certificates. |
| `/api/v1/admin/language-user-tests` | `ASSESSMENT_SERVICE_URL` | `assessment-service` | Admin language user-test management. |
| `/api/v1/admin/language-tests` | `ASSESSMENT_SERVICE_URL` | `assessment-service` | Admin language-test management. |
| `/api/v1/language-user-tests` | `ASSESSMENT_SERVICE_URL` | `assessment-service` | Language user tests. |
| `/api/v1/asset-user-tests` | `ASSESSMENT_SERVICE_URL` | `assessment-service` | Asset user tests. |
| `/api/v1/employee-profiles` | `USER_SERVICE_URL` | `user-service` | Employee profiles. |
| `/api/v1/managers` | `USER_SERVICE_URL` | `user-service` | Manager identity/profile data. |
| `/api/v1/teachers` | `USER_SERVICE_URL` | `user-service` | Teacher identity/profile data. |
| `/api/v1/students` | `USER_SERVICE_URL` | `user-service` | Student identity/profile data. |
| `/api/v1/part-payment-collections` | `COURSE_SERVICE_URL` | `course-service` | Course/product payment options, not external processing. |
| `/api/v1/offers` | `COURSE_SERVICE_URL` | `course-service` | SpeakASAP offers/catalog domain. |
| `/api/v1/products` | `COURSE_SERVICE_URL` | `course-service` | SpeakASAP products/catalog domain. |
| `/api/v1/categories` | `COURSE_SERVICE_URL` | `course-service` | Product categories. |
| `/api/v1/student-courses` | `EDUCATION_SERVICE_URL` | `education-service` | Student course assignments/progress. |
| `/api/v1/homeworks` | `EDUCATION_SERVICE_URL` | `education-service` | Homework workflow. |
| `/api/v1/lessons` | `EDUCATION_SERVICE_URL` | `education-service` | Lessons and lesson-recording workflow. |
| `/api/v1/groups` | `EDUCATION_SERVICE_URL` | `education-service` | Education groups. |
| `/api/v1/dictionary` | `CONTENT_SERVICE_URL` | `content-service` | Dictionary content. |
| `/api/v1/songs` | `CONTENT_SERVICE_URL` | `content-service` | Song content. |
| `/api/v1/phonetics` | `CONTENT_SERVICE_URL` | `content-service` | Phonetics content. |
| `/api/v1/grammar` | `CONTENT_SERVICE_URL` | `content-service` | Grammar content. |
| `/api/v1/languages` | `CONTENT_SERVICE_URL` | `content-service` | Language/content metadata. |
| `/api/v1/webhooks/payments` | `PAYMENT_SERVICE_URL` | `payment-service` | Public webhook exception; guarded by payment verification in service. |
| `/api/v1/discounts` | `PAYMENT_SERVICE_URL` | `payment-service` | Discounts. |
| `/api/v1/invoices` | `PAYMENT_SERVICE_URL` | `payment-service` | Invoices. |
| `/api/v1/subscriptions` | `PAYMENT_SERVICE_URL` | `payment-service` | Subscriptions. |
| `/api/v1/orders` | `PAYMENT_SERVICE_URL` | `payment-service` | SpeakASAP order domain; external processing boundary remains shared payments. |
| `/api/v1/notification-groups` | `NOTIFICATION_SERVICE_URL` | `notification-service` | SpeakASAP notification groups. |
| `/api/v1/preferences/me` | `NOTIFICATION_SERVICE_URL` | `notification-service` | User notification preferences. |
| `/api/v1/dispatch` | `NOTIFICATION_SERVICE_URL` | `notification-service` | Notification dispatch intent. |
| `/api/v1/in-app` | `NOTIFICATION_SERVICE_URL` | `notification-service` | In-app notifications. |
| `/api/v1/letters` | `NOTIFICATION_SERVICE_URL` | `notification-service` | Letter/email records. |
| `/api/v1/templates` | `NOTIFICATION_SERVICE_URL` | `notification-service` | Notification templates. |
| `/api/v1/admin/summary` | `SALARY_SERVICE_URL` | `salary-service` | Admin salary summary. |
| `/api/v1/salary-profiles` | `SALARY_SERVICE_URL` | `salary-service` | Salary profiles. |
| `/api/v1/salary-expenses` | `SALARY_SERVICE_URL` | `salary-service` | Salary expenses. |
| `/api/v1/calculation-runs` | `SALARY_SERVICE_URL` | `salary-service` | Salary calculation runs. |
| `/api/v1/payout-runs` | `SALARY_SERVICE_URL` | `salary-service` | Payout runs. |
| `/api/v1/contracts` | `SALARY_SERVICE_URL` | `salary-service` | Salary/teacher contracts. |
| `/api/v1/dashboard/overview` | `FINANCIAL_SERVICE_URL` | `financial-service` | Financial dashboard. |
| `/api/v1/revenue` | `FINANCIAL_SERVICE_URL` | `financial-service` | Revenue reporting. |
| `/api/v1/expenses` | `FINANCIAL_SERVICE_URL` | `financial-service` | Financial expenses. |

## Lesson Recording Addendum

The first migration target is covered by the existing `/api/v1/lessons` route:

| Contract route | Owner | Notes |
|---|---|---|
| `GET /api/v1/lessons/:lessonUuid/record` | `education-service` | Record state. |
| `POST /api/v1/lessons/:lessonUuid/record/presign` | `education-service` | Teacher-scoped short-lived upload target. |
| `POST /api/v1/lessons/:lessonUuid/record/commit` | `education-service` | Commit uploaded lesson or part records. |
| `GET /api/v1/lessons/:lessonUuid/record/playback` | `education-service` | Private playback stream or short-lived GET URL. |

Details are in `docs/orchestrator/LESSON_RECORDING_CONTRACT.md`.

## Drift Rule

Any change to `api-gateway/src/proxy/upstream-resolve.ts` must update this file in the same change. Gateway route ownership is part of intent preservation: a route move is a service ownership decision, not a mechanical proxy edit.
