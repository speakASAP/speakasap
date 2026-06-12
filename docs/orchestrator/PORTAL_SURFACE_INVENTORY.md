# Legacy Portal Surface Inventory And Parity Matrix

Date: 2026-06-12

Status: Goal 2 complete at domain level. Detailed code-level inventories should be created inside each implementation goal before changing that domain.

## Source Evidence

Legacy repository: `/home/ssf/Documents/Github/speakasap-portal`

New platform repository: `/home/ssf/Documents/Github/speakasap`

Commands used:

```bash
find . -maxdepth 2 -name urls.py -print | sort
find . -maxdepth 3 -name tasks.py -print | sort
find . -path "*/management/commands/*.py" -print | sort | head -n 240
find . -maxdepth 2 -type d \( -name templates -o -name static -o -name assets -o -name locale \) -print | sort
find src -maxdepth 2 -type d | sort
rg -n "include\(|url\(" portal/urls.py speakasap_site/urls.py rest/urls.py -g "*.py" | head -n 220
```

## Legacy Runtime And Deploy Surface

| Surface | Evidence | Parity decision | Target |
|---|---|---|---|
| Django runtime | `requirements.txt`, `manage.py`, `portal/settings.py`, `tox.ini` | reference-only | Preserve as behavior reference; do not upgrade without owner approval. |
| React/Webpack runtime | `package.json`, `webpack.config.js`, `src/*` | migrate selected screens | New `frontend`; use legacy UI as behavior reference, not as runtime dependency. |
| Deploy/process | `scripts/deploy.sh`, `setup/supervisord.conf`, `setup/nginx_portal*.conf`, `setup/server.conf` | reference-only until cutover | Kubernetes manifests in `speakasap/k8s`; cutover covered by Goal 7. |
| Static/templates/locales | app `templates`, `static`, `assets`, `locale`; root `templates`, `locale` | migrate/defer by domain | New `frontend` and relevant service-owned content. |

## Root URL Surface

Sources: `portal/urls.py`, `speakasap_site/urls.py`, `rest/urls.py`

Important includes:

- Payments: `orders.cs`, `orders.paypal`, `orders.invoice`, `orders.webpay`, payment webhook.
- Public site/course routes: `speakasap_site.urls`.
- Education dashboards: `cabinet.teacher`, `cabinet.manager`, `cabinet.student`.
- API: `rest.urls`, `rest.v2_urls`, mobile auth compatibility endpoints.
- Commercial/support: `products`, `offers`, `helpdesk`, `notifications`, `books`, `quests`, `investors`, `ses`.
- Course/content routes: `seven`, `seven_test`, `marathon`, `language_tests`, `delivery`, `administrator`, `redirecter`.

## URL Modules Found

`administrator`, `big_brother`, `books`, `delivery`, `dev`, `employees`, `helpdesk`, `investors`, `language_tests`, `marathon`, `notifications`, `offers`, `orders`, `portal`, `products`, `redirecter`, `rest`, `ses`, `seven`, `seven_test`, `speakasap_site`, `user_quest`.

## Celery Task Files Found

`actions`, `administrator`, `big_brother`, `course_parser`, `courses`, `delivery`, `discount`, `education`, `education_certificates`, `employees`, `expenses`, `helpdesk`, `marathon`, `notifications`, `offers`, `orders`, `portal`, `seven`, `seven_test`, `user_tests`.

Task parity rule: every task must be classified as one of `migrate`, `defer`, `retire`, or `reference-only` before its domain is cut over. Any task that sends messages, changes money, deletes files, or mutates lesson/student state needs direct verification.

## Management Command Surface

Commands found in these domains:

- Content/course generation: `courses`, `course_parser`, `dictionary`, `grammar`, `phonetics`, `seven`, `songs`, `quests`, `language`.
- Education operations: `education`, including `merge_stuck_records.py`, `migrate_records_s3_keys.py`, `show_record_storage.py`, and `update_lesson_record_key.py`.
- Certificates: `certificates`, `education_certificates`.
- Commercial/payment/finance: `delivery`, `discount`, `expenses`, `investors`, `orders`.
- Notifications/email/helpdesk: `notifications`, `ses`, `helpdesk`.
- Users/admin/ops: `students`, `employees`, `administrator`, `portal`, `redirecter`.

Command parity rule: commands are not automatically migrated. Commands used only for historical one-off maintenance are `reference-only` unless a live operational need is proven.

## React Source Surface

Legacy React/JS directories found under `src`:

- API/utilities: `src/api`, `src/utils`, `src/currency`.
- Public/commercial UI: `src/portal`, `src/course_details`, `src/custom_course`, `src/delivery`, `src/demo`, `src/demo_new`.
- Cabinet UI: `src/incab`, including `manager`, `student`, `teacher`, `homework`, `offers`, `quests`, `helpdesk`.
- Product/course experiences: `src/marathons`, `src/seven_test`, `src/user_tests`, `src/speakasap-ui`.

Frontend parity rule: migrate workflows into the new `frontend` only after their gateway/service contract is defined. Do not port legacy React 15 patterns directly as architecture.

## Role And Workflow Matrix

| Role/workflow | Legacy evidence | Decision | New owner |
|---|---|---|---|
| Anonymous public visitor | `speakasap_site`, public course routes, policy pages, marketing pages | migrate/defer by page | `frontend`, `content-service`, `course-service` |
| Student learning | `cabinet/student`, `education`, `courses`, homework APIs, lesson record playback | migrate | `education-service`, `course-service`, `content-service`, `frontend` |
| Teacher workflow | `cabinet/teacher`, lesson management, recordings, homework, student views | migrate | `education-service`, `user-service`, `frontend`, `api-gateway` |
| Manager/admin workflow | `cabinet/manager`, `administrator`, reports, appstats | migrate/defer by operational value | `education-service`, `user-service`, `financial-service`, `frontend` |
| Assessment/testing | `language_tests`, `teacher_tests`, `user_tests`, `seven_test` | migrate | `assessment-service`, `certification-service`, `frontend` |
| Certification | `certificates`, `education_certificates` | migrate | `certification-service`, `frontend` |
| Payments/orders/offers/products | `orders`, `offers`, `products`, `discount`, payment URL includes | migrate with boundary | `payment-service` for SpeakASAP domain data, `payments-microservice` for external processing, `course-service` for products/offers as needed |
| Notifications/email | `notifications`, `ses`, `djcelery_email`, notification tasks | migrate with boundary | `notification-service` for SpeakASAP-specific state; `notifications-microservice` for delivery |
| Helpdesk/support | `helpdesk` | defer unless needed for cutover | likely separate support/helpdesk service or `frontend` integration |
| Finance/salary/expenses/investors | `expenses`, `investors`, `employees`, course salary commands | migrate/defer by current usage | `salary-service`, `financial-service`, `user-service` |
| Delivery/email courses | `delivery`, `ses`, related commands | defer/migrate by active product usage | `notification-service`, `content-service` |
| Analytics/big brother/actions/flow | `big_brother`, `actions`, `flow` | defer/reference-only until owner confirms active usage | monitoring/analytics or retired |
| Redirects/SEO/legal/static pages | `redirecter`, `robots.txt`, legal templates, static pages | migrate selected | `frontend`, nginx/ingress as needed |
| Dev/debug surfaces | `dev`, `inspinia`, old app templates | reference-only/retire | none unless owner approves |

## Domain Parity Matrix

| Legacy domain | Key evidence | Decision | Target service(s) | Notes |
|---|---|---|---|---|
| Lesson recordings | `education/lesson_records`, `cabinet/record_playback.py`, `education/tasks.py`, `portal/utils/records_storage.py` | migrate | `education-service`, `api-gateway`, `frontend`, MinIO | First migration target; detailed in `LESSON_RECORDING_INVENTORY.md`. |
| Core education lessons/groups/homework | `education`, `cabinet/student`, `cabinet/teacher`, `cabinet/manager` | migrate | `education-service`, `frontend` | Partial Prisma/schema migration already exists; remaining contracts need review. |
| Course/product catalog | `courses`, `course_materials`, `products`, public course URLs | migrate | `course-service`, `content-service`, `frontend` | Separate sellable products from lesson content. |
| Assessment/tests | `language_tests`, `teacher_tests`, `user_tests`, `seven_test` | migrate | `assessment-service`, `certification-service` | Preserve result history and certificate eligibility. |
| Certificates | `certificates`, `education_certificates` | migrate | `certification-service` | Existing migration script exists; parity needs validation. |
| Student/user profile | `students`, `speakasap_site` profile/auth routes, `social_auth` | migrate with auth boundary | `user-service`, `auth-microservice`, `frontend` | Auth ownership must remain outside SpeakASAP. |
| Orders/payments | `orders`, `offers`, `discount`, payment webhooks | migrate with payment boundary | `payment-service`, `payments-microservice`, `frontend` | External payment processing stays in `payments-microservice`. |
| Notifications/email | `notifications`, `ses`, notification tasks | migrate with delivery boundary | `notification-service`, `notifications-microservice` | Delivery ownership stays in shared notification service. |
| Salary/financial/expenses | `expenses`, `employees`, `investors`, course salary commands | migrate/defer | `salary-service`, `financial-service` | Need current usage check before implementation. |
| Public marketing/site pages | `speakasap_site`, templates/static/locales | defer/migrate selected | `frontend`, `content-service` | Do not block education workflow migration on all marketing pages. |
| Marathons/quests/seven/demo products | `marathon`, `quests`, `seven`, `demo`, `delivery` | defer/migrate by active product | `course-service`, `content-service`, `assessment-service` | Needs owner prioritization after core learning flows. |
| Helpdesk/support | `helpdesk` | defer | future support service or external tool | Backlog issues mention log-analysis commands, not a new target yet. |
| Admin/ops/reporting | `administrator`, `big_brother`, `portal` management commands | defer/reference-only | service-specific admin APIs, monitoring | Migrate only reports needed for operations/cutover. |
| Redirects/legal/SEO | `redirecter`, legal templates, robots/Bing routes | migrate selected | `frontend`, nginx/ingress | Preserve SEO/legal pages that are still live. |
| Legacy dev/test utilities | `dev`, `inspinia`, obsolete templates | retire/reference-only | none | Keep only as behavior evidence unless owner approves. |

## Current Known Risks From Legacy Backlog

Source: `speakasap-portal/TASKS.md`

- ISSUE-106: targeted runtime checks for notification and merge flows remain open.
- ISSUE-107: last-hour logs after deployment remain to be verified.
- ISSUE-108: S3 delete credential/region/endpoint checks may still be needed if delete fails.
- ISSUE-109: grouped log-analyze command note remains open.

These issues directly affect lesson recording migration and must be carried into Goal 3/5 acceptance criteria.

## New Platform Target Surface

Current services in `/home/ssf/Documents/Github/speakasap`:

- `api-gateway`
- `assessment-service`
- `certification-service`
- `content-service`
- `course-materials-service`
- `course-service`
- `education-service`
- `financial-service`
- `frontend`
- `notification-service`
- `payment-service`
- `salary-service`
- `user-service`

## Goal 3 Inputs

Start with the lesson recording contract:

1. `education-service` schema and endpoints for `LessonRecord` and `LessonRecordPart`.
2. Gateway route contract for teacher presign/commit and student/teacher playback.
3. Auth/RBAC matrix for teacher, student, manager/admin, and tokenized media access.
4. MinIO private object access contract with SigV4 path-style and short-lived URLs/streaming.
5. Notification event contract for record-ready or lesson-finished behavior.
6. Migration dry-run/reconciliation requirements for legacy record rows and object keys.
