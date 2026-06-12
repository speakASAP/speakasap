# Source-To-Target Migration Mapping

Date: 2026-06-12

Goal chunk: 4.4 - Remaining source-to-target mapping.

Purpose: define the source tables, target Prisma models, identifier strategy, joins, orphan handling, and reconciliation checks that must guide all follow-up migration hardening.

## Global Rules

- Legacy source is `/home/ssf/Documents/Github/speakasap-portal` PostgreSQL unless a script names another read-only URL.
- Target writes must stay inside the owning service database.
- Dry run must be the default. Write mode must require an explicit `--load` or an owner-approved equivalent.
- Destructive `--truncate-first` behavior is not allowed for production-like data unless owner approval is recorded in `STATUS.md`.
- Reconciliation must report source counts, transformed target counts, skipped rows, orphan rows, duplicate keys, source IDs, and target IDs where applicable.
- Auth-owned UUIDs come from `auth-microservice`; SpeakASAP services may store mirrors or string references, but must not become the identity source of truth.

## Priority Chain For Lesson Recording

Lesson recording migration depends on three mappings before it can be safely promoted beyond read-only dry run:

| Order | Domain | Reason |
| --- | --- | --- |
| 1 | Education | `education_lessonrecord.lesson_id` must match target `education-service` lesson UUIDs. |
| 2 | User | Teacher/student access checks depend on migrated teacher, student, manager, and identity mirror rows. |
| 3 | Course | Offers/products and course context are referenced by surrounding lesson and entitlement workflows. |

## Education Service

Owner: `education-service`.

Current scripts:

- `education-service/scripts/migrate-education-from-legacy.py`
- `education-service/scripts/migrate-lesson-records-from-legacy.py`

| Legacy source | Target model/table | ID strategy | Required joins / notes | Orphan handling | Reconciliation |
| --- | --- | --- | --- | --- | --- |
| `education_group` | `Group` / `education_group` | Preserve legacy `uuid`. | Direct copy of `uuid`, `title`, `created`. | Group UUID conflicts must be listed before write. | Count source groups, target groups, duplicate UUIDs. |
| `education_group_students` | `GroupStudent` / `education_group_students` | Preserve legacy `id`; enforce unique `(group_id, student_id)`. | Requires `education_group.uuid`; `student_id` references user-service legacy student ID, not a local FK. | Missing group IDs block row; missing student IDs are cross-service warnings. | Count links, duplicate pairs, missing groups, missing students if user-service target is available. |
| `education_studentcourse` | `StudentCourse` / `education_studentcourse` | Preserve legacy `uuid`; patch `previous_id` after first pass. | Requires `group_id`; `previous_id` is self-reference and must be deferred. | Missing group blocks row; missing previous is reported and left null only with owner-approved policy. | Count courses, missing groups, previous links, cyclic/duplicate previous links. |
| `education_lesson` | `Lesson` / `education_lesson` | Preserve legacy `uuid`. | Requires `student_course_id`; `teacher_id` references user-service legacy teacher ID. | Missing student course blocks row; missing teacher is warning if lesson permits null teacher. | Count lessons, missing courses, missing teachers, duplicate UUIDs, lesson order per course. |
| `education_homework` | `Homework` / `education_homework` | Preserve legacy `uuid`; unique `(lesson_id, student_id)`. | Requires lesson UUID; student ID references user-service legacy student ID. | Missing lesson blocks row; missing student is cross-service warning. | Count homework rows, duplicate lesson/student pairs, missing lessons/students. |
| `education_lessonrecord` | Planned `LessonRecord` | Preserve legacy record `id` as `legacyRecordId`; target primary key should be deterministic or service UUID. | Requires lesson UUID. Current target schema has no model yet. | Missing lesson blocks load; duplicate legacy record for lesson must be listed. | Already partially implemented by dry-run script: source states, missing target lessons, duplicate records. |
| `education_lessonrecordpart` or JSONB `parts` | Planned `LessonRecordPart` or part JSON | Preserve part `id` or deterministic part key. | Requires record ID and object key. | Missing record blocks part; missing object key or orphan part is reported. | Dry run must list orphan parts, missing keys, storage-key classes, duplicate order/index values. |

Immediate hardening target:

- Replace counts-only education dry run with row-level report for groups, group links, student courses, lessons, and homework.
- Do not add lesson-record write mode until target lesson parity is proven.

## User Service

Owner: `user-service`, with auth lookup from auth-microservice database.

Current script: `user-service/scripts/migrate-user-from-legacy.py`.

| Legacy source | Target model/table | ID strategy | Required joins / notes | Orphan handling | Reconciliation |
| --- | --- | --- | --- | --- | --- |
| `auth_user` + auth DB `users` by lower-trimmed email | `UserIdentityMirror` / `user_identity_mirror` | Target `auth_user_id` is auth UUID; preserve `legacy_portal_user_id`. | Email match is case-insensitive. Source `auth_user` is behavior reference, not target identity owner. | Missing auth UUID skips row and must list legacy user ID/email. | Count auth users, matched, skipped, duplicate emails, auth UUID conflicts. |
| `students_student` + `auth_user` | `Student` / `students` | Preserve legacy student integer `id`; store auth UUID and `legacy_portal_user_id`. | `manager_id` should point to migrated manager ID when present. | Missing auth UUID skips row; missing manager should be reported and nulled only by policy. | Count students, skipped auth, missing manager, duplicate legacy/auth IDs. |
| `employees_teacher` + `auth_user` + `language_language` | `Teacher` / `teachers` | Preserve legacy teacher integer `id`; store auth UUID and `legacy_portal_user_id`. | Requires language code. | Missing auth UUID skips row; missing language code must be reported. | Count teachers, skipped auth, missing language, duplicate legacy/auth IDs. |
| `employees_teacher_additional_languages` + `language_language` | `TeacherAdditionalLanguage` / `teacher_additional_languages` | Composite `(teacher_id, language_code)`. | Current script clears all rows before reinsert; this must be gated. | Missing migrated teacher skips relation and reports teacher ID. | Count links, skipped missing teachers, duplicate pairs. |
| `employees_manager` + `auth_user` | `Manager` / `managers` | Preserve legacy manager integer `id`; store auth UUID and `legacy_portal_user_id`. | Used by students and notification group manager mapping. | Missing auth UUID skips row. | Count managers, skipped auth, duplicate legacy/auth IDs. |
| `employees_employeeprofile` + `auth_user` | `EmployeeProfile` / `employee_profiles` | Preserve legacy profile integer `id`; store auth UUID and `legacy_portal_user_id`. | Complements teacher/manager staff data. | Missing auth UUID skips row. | Count profiles, skipped auth, duplicate legacy/auth IDs. |

Immediate hardening target:

- Add a JSON dry-run report listing unresolved auth identities and duplicate source emails.
- Remove or require explicit owner approval for `--truncate-first`.
- Replace full `teacher_additional_languages` delete with scoped replacement or a preflight affected-ID report.

## Course Service

Owner: `course-service`.

Current scripts:

- `course-service/scripts/migrate-course-from-legacy.py`
- `education-service/scripts/migrate-course-from-legacy.py` appears to duplicate the same course-domain copy and should not be used until ownership is clarified.

| Legacy source | Target model/table | ID strategy | Required joins / notes | Orphan handling | Reconciliation |
| --- | --- | --- | --- | --- | --- |
| `products_category` | `Category` / `products_category` | Preserve legacy integer `id`. | Direct domain owner is course-service. | Duplicate ID/title conflicts reported. | Count categories, duplicate IDs. |
| `products_partpaymentcollection` | `PartPaymentCollection` / `products_partpaymentcollection` | Preserve legacy integer `id`. | Direct copy. | Duplicate ID conflicts reported. | Count collections, duplicate IDs. |
| `products_partpaymentoption` | `PartPaymentOption` / `products_partpaymentoption` | Preserve legacy integer `id`. | Requires `part_id` collection. | Missing collection blocks row. | Count options, missing collections. |
| `products_product` | `Product` / `products_product` | Preserve legacy integer `id`. | Requires category. `language_id` points to content-service language legacy ID. | Missing category blocks row; missing language is cross-service warning. | Count products, missing categories/languages, trashed rows. |
| `products_product_part_payments` | `ProductPartPayment` / `products_product_part_payments` | Composite `(product_id, partpaymentcollection_id)`. | Requires product and collection. | Missing product/collection blocks link. | Count links, duplicate pairs, missing endpoints. |
| `offers_extralessonsoffer` | `ExtraLessonsOffer` / `offers_extralessonsoffer` | Preserve legacy integer `id`. | Requires product; teacher IDs reference user-service teachers. | Missing product blocks row; missing teacher is cross-service warning. | Count extra lesson offers, missing products/teachers. |
| `offers_offer` | `Offer` / `offers_offer` | Preserve legacy UUID. | References student, teacher, offerer, course product, extra lessons, and order. Order points to payment-service legacy order ID. | Missing course product or extra lesson must be reported; missing payment order is cross-service warning. | Count offers, missing products, missing extra lessons, missing students/teachers/orders. |

Immediate hardening target:

- Make course migration idempotent with upserts or `ON CONFLICT`.
- Produce source-to-target conflict report before any write.
- Pick only `course-service` as the owner for course-domain migration unless a later owner decision says otherwise.

## Assessment Service

Owner: `assessment-service`.

Current script: `assessment-service/scripts/migrate-assessment-from-legacy.py`.

| Legacy source | Target model/table | ID strategy | Notes |
| --- | --- | --- | --- |
| `language_tests_languagetest` + `language_language` | `LanguageTest` | Preserve integer ID; also store language snapshots. | Report duplicate `(tag, language_id)` and `(tag, language_code)`. |
| `language_tests_level` | `Level` | Preserve integer ID. | Report duplicate IDs. |
| `language_tests_levelrecommendation` | `LevelRecommendation` | Preserve integer ID. | Requires level; language is stored as legacy ID. |
| `language_tests_question` | `LanguageQuestion` | Preserve integer ID. | Requires test and level. |
| `language_tests_answer` | `LanguageAnswer` | Preserve integer ID. | Requires question. |
| `language_tests_usertest` | `LanguageUserTest` | Preserve integer ID. | `userId` remains string legacy/auth reference depending current script; reconcile with user-service policy. |
| `language_tests_usertestquestion` | `LanguageUserTestQuestion` | Preserve integer ID. | Requires user test and question. |
| `language_tests_usertestquestion_answers` | `LanguageUserTestQuestionAnswer` | Composite source pair. | Requires both endpoints. |
| `language_tests_usertestresult` | `LanguageUserTestResult` | Primary key is user-test ID. | Requires user test and level. |
| `user_tests_usertest` | `AssetUserTest` | Preserve UUID. | JSON fields map directly. |

Required reconciliation: source counts, missing FK endpoints, duplicate unique keys, skipped user IDs.

## Certification Service

Owner: `certification-service`.

Current script: `certification-service/scripts/migrate-certification-from-legacy.py`.

| Legacy source | Target model/table | ID strategy | Notes |
| --- | --- | --- | --- |
| `certificates_certificate` + legacy course/student/auth joins | `CourseCertificate` | Preserve integer ID. | Requires legacy course and owner user lookup. |
| `education_certificates_certificate` + education/student/auth joins | `EducationCertificate` | Preserve integer ID. | Requires education student course and student link. |
| `quests_quest` | `QuestInstance` | Preserve UUID. | JSON fields map directly; student course references remain string/int snapshots. |
| `user_quest_questionnaire` | `Questionnaire` | Preserve integer ID. | Direct copy. |
| `user_quest_question` | `QuestionnaireQuestion` | Preserve integer ID. | Requires questionnaire. |
| `user_quest_userquestionnaire` | `UserQuestionnaire` | Preserve integer ID. | User ID policy must align with user-service/auth UUID mapping. |
| `user_quest_answer` | `UserQuestionnaireAnswer` | Composite `(user_questionnaire_id, question_id)`. | Requires both endpoints. |

Required reconciliation: certificate orphan courses/students, questionnaire orphan answers, user ID policy mismatches.

## Content Service

Owner: `content-service`.

Current script: none found.

| Legacy source | Target model/table | ID strategy | Notes |
| --- | --- | --- | --- |
| `language_language` | `Language` | Preserve integer ID. | Required by course, assessment, teacher language, grammar/phonetics/songs/words. |
| `grammar_grammarcourse` | `GrammarCourse` | Preserve integer ID. | Requires language. |
| `grammar_grammarlesson` | `GrammarLesson` | Preserve integer ID. | Requires grammar course. |
| `phonetics_phoneticscourse` | `PhoneticsCourse` | Preserve integer ID. | Requires language. |
| `phonetics_phoneticslesson` | `PhoneticsLesson` | Preserve integer ID. | Requires phonetics course. |
| `songs_songscourse` | `SongsCourse` | Preserve integer ID. | Requires language. |
| `songs_songslesson` | `SongsLesson` | Preserve integer ID. | Requires songs course. |
| Word/word-theme legacy tables | `Word`, `WordTheme`, `WordThemeRelation` | Preserve integer IDs where present. | Exact legacy table names must be confirmed before script creation. |

Required reconciliation: languages first, then content course/lesson FK endpoints. Since no script exists, Goal 4.5 should not start content writes before a dry-run-only script exists.

## Payment Service

Owner: `payment-service`.

Current script: `payment-service/scripts/migrate-payment-data.ts`.

| Legacy source | Target model/table | ID strategy | Notes |
| --- | --- | --- | --- |
| `orders_order` | `Order` | Deterministic UUID from legacy order ID. | Stores `user_id`, product ID, status, data, trash status. |
| `orders_payment` plus subtype tables | `PaymentAttempt` | Deterministic UUID from legacy payment ID; public UUID preserved. | Android payments are excluded by current script. |
| `discount_discounttemplate` | `DiscountTemplate` | Preserve uppercase code. | Discount type maps to enum. |
| `discount_discounttemplate_products` | `DiscountProduct` | Composite `(templateCode, productId)`. | Product IDs are string legacy product IDs. |
| `discount_discountorder` | `DiscountOrder` | Target order deterministic UUID. | Requires migrated order and template. |
| Invoice payment rows | `Invoice` | Deterministic UUID from legacy payment ID. | Requires order and invoice fields. |

Required reconciliation: paid order totals, skipped null-user orders, Android excluded payments, orphan payments, discount orphan links, invoice counts. Owner approval required before payment loads.

## Notification Service

Owner: `notification-service`.

Current script: `notification-service/scripts/migrate-notification-data.ts`.

| Legacy source | Target model/table | ID strategy | Notes |
| --- | --- | --- | --- |
| `notifications_notificationgroup` | `NotificationGroup` | Deterministic UUID from legacy group ID; unique machine name. | Direct group mapping. |
| `notifications_notificationtemplate` plus template files | `NotificationTemplate` | Deterministic UUID from legacy template ID; unique machine name. | Body comes from portal template files when present. |
| `notifications_notificationtemplate_groups` | `TemplateGroup` | Composite target template/group UUIDs. | Current load replaces scoped template links. |
| `notifications_notificationgroup_managers` + `employees_manager` | `NotificationGroupManager` | Composite group UUID and manager user ID string. | Requires manager mapping policy. |
| `notifications_commonemailsettings` plus optional student flags | `CommonEmailSettings` | User ID string. | `doNotContact` may come from student row. |
| `notifications_notificationsettings` | `TemplatePreference` | Target generated ID with unique `(userId, templateId)`. | Orphan template preferences must be reported. |
| `notifications_notification` | `InAppNotification` | Deterministic UUID from legacy notification ID. | Direct row mapping. |
| `notifications_letter` | `Letter` | Deterministic UUID from legacy letter ID. | Requires template; recipients are normalized from legacy text. |

Required reconciliation: missing template files, orphan letters/preferences, scoped deletions to be performed, manager ID mapping.

## Salary Service

Owner: `salary-service`.

Current script: `salary-service/scripts/migrate-salary-data.ts`.

| Legacy source | Target model/table | ID strategy | Notes |
| --- | --- | --- | --- |
| `expenses_salaryprofile` | `SalaryProfile` | Deterministic UUID from legacy profile ID; preserve `legacy_profile_id`. | Auth UUID currently null; legacy portal user ID preserved. |
| `expenses_salaryexpense` + `expenses_expense` | `SalaryExpense` | Deterministic UUID from legacy expense ID; preserve `legacy_expense_id`. | Requires salary profile by legacy user. |
| `education_lessonsalaryexpense` | `SalaryExpense.kind = lesson` | Same expense ID. | `lessonUuid` remains null until education backfill. |
| `expenses_supportbonusexpense` | `SalaryExpense.kind = support_bonus` | Same expense ID. | Stores legacy student/group IDs. |
| `employees_employeecontract` | `EmployeeContract` | Deterministic UUID from legacy contract ID; preserve `legacy_contract_id`. | Main/sub-contracts loaded in two phases. |
| Payroll period aggregation | Dry-run/report only currently | Not a persistent model in current ETL except summary. | Used for reconciliation. |

Required reconciliation: expenses without profiles, contracts without auth users, lesson expenses missing lessons, course lesson salary rows counted but not loaded.

## Financial Service

Owner: `financial-service`.

Current script: `financial-service/scripts/migrate-financial-data.ts`.

| Legacy source | Target model/table | ID strategy | Notes |
| --- | --- | --- | --- |
| `products_category` | `CategoryAxisSnapshot` | Upsert by `legacy_category_id`. | Snapshot title/product-for-offers. |
| `payment_stat_category` | `MonthlyRevenueByCategory` | Upsert by `(periodMonth, categoryKey)`. | Category key handles null/missing category. |
| `payment_stat_methods` | `MonthlyRevenueByMethod` | Upsert by `(periodMonth, methodKeyRaw)`. | Method key normalizes null/empty. |
| `orders_transaction` | `LedgerLine` | Upsert by `legacy_transaction_id`. | Stores user, amount, order, comment, external flag. |
| Derived rollup | `MonthlyFinancialRollup` | Upsert by period month. | Combines paid orders and transaction totals. |

Required reconciliation: orphan category FK count, non-salary expense count, ledger totals by month, rollup totals.

## Goal 4.5 Implementation Order

Recommended order for dry-run/reconciliation hardening:

1. `education-service/scripts/migrate-education-from-legacy.py`
2. `user-service/scripts/migrate-user-from-legacy.py`
3. `course-service/scripts/migrate-course-from-legacy.py`
4. `education-service/scripts/migrate-lesson-records-from-legacy.py` target checks, after education/user/course reports exist
5. Payment, salary, notification, assessment, certification, financial, and content after owner selects the next business domain

Goal 4.4 is complete when this file exists and `GOALS.md` points the active work to Goal 4.5.
