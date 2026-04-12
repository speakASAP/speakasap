# User Service — Legacy Django → Target persistence mapping (TASK-30)

**Legacy:** `speakasap-portal` — apps **`students`**, **`employees`** (teachers + managers + employee profile). **Shared identity:** `portal.User` (`AUTH_USER_MODEL`, DB table **`auth_user`** per `portal.models.User.Meta`). **Target:** `speakasap-user-service` PostgreSQL database **`speakasap_user_db`**. Optional draft Prisma: `user-service/prisma/schema.prisma` (physical `@@map` names are **new** PostgreSQL tables — not legacy Django table names; TASK-31 migrations materialize them).

**Auth-microservice:** **System of record for credentials and OAuth/social login** (`ROADMAP.md` §3.3). During strangler migration, **`authUserId`** in user-service tables **equals** legacy **`auth_user.id`** so certification/assessment/education FKs that pointed at integer user id stay alignable. JWT `sub` must resolve to that same id.

---

## 1. Legacy model inventory

### 1.1 `portal.User` (`auth_user`)

| Django field | Type | Notes |
|--------------|------|--------|
| `id` | int PK | **Canonical `authUserId`** |
| `password`, `last_login`, `is_superuser`, `is_staff`, `is_active`, `username`, `first_name`, `last_name`, `email`, `date_joined` | AbstractUser | **Auth domain**; user-service may **mirror** display fields for read/API until auth exposes them on every token. |
| `image` | ImageField | Avatar storage path; URL via env + relative path |
| `language` | CharField | UI / notifications language |
| `phone`, `validated_phone`, `translated_name`, `country` | CharField | |

**Not owned long-term by user-service:** password hashes, admin flags — remain in auth when cut over.

### 1.2 `students.Student` (`students_student`)

| Django field | Type | Notes |
|--------------|------|--------|
| `id` | int PK | Public student id in APIs |
| `user_id` | OneToOne → `auth_user` | **Unique** |
| `not_loyal`, `spam_bot`, `do_not_contact` | boolean | |
| `email_additional` | EmailField | |
| `manager_id` | FK → `employees.Manager`, nullable | |
| `telegram`, `whatsapp`, `phone_additional` | CharField | |
| `read_help` | boolean | Legacy low-value flag |
| `motivation`, `portrait`, `sales_info` | TextField | |
| `country` | CharField | Student-specific country code |
| `invoice_address` | TextField | |

**Not migrated here:** methods hitting `orders`, `education`, `notifications` — those stay in respective services.

### 1.3 `employees.Teacher` (`employees_teacher`)

Django **`Employee` is `abstract=True`** — fields live on the concrete child table.

| Logical source | Notes |
|----------------|--------|
| All `Employee` fields on teacher row | `user_id`, `description`, `position`, `contract_name`, `passport_number`, `address`, `postal_code`, `city`, `address_cz`, `city_cz` |
| `language_id` | FK → `language.Language` — map to **`languageCode`** = `Language.code` |
| `additional_languages` | M2M → join table `employees_teacher_additional_languages` (Django default name; confirm on live DB in TASK-32) |
| `russian`, `native`, `language_support`, `can_get_students` | boolean |
| `coordinator_info` | TextField |
| `work_since`, `contract_end` | Date, nullable |

**Not migrated in user-service Wave 1:** `SalaryProfile` (`expenses` app), `EmployeeContract` (`employees.models.contracts`), payment method preferences tied to salary — **`speakasap-salary-service`**.

### 1.4 `employees.Manager` (`employees_manager`)

| Field | Notes |
|-------|--------|
| `id`, `user_id` | OneToOne user |
| Employee field columns | Same as on Teacher concrete table for that subclass |

### 1.5 `employees.EmployeeProfile` (`employees_employeeprofile`)

| Field | Notes |
|-------|--------|
| `id`, `user_id` | OneToOne |
| `additional_info`, `description`, `position` | Text |

### 1.6 `employees.TeacherMaterial`

**Out of scope** for Wave 1 user DB (files + catalog; possible future content/education split).

---

## 2. Target tables (logical)

| Logical table | Legacy source | Purpose |
|---------------|---------------|---------|
| `UserIdentityMirror` | `auth_user` (subset) | Optional denormalized copy for **TASK-32** import and until all reads use JWT + auth API; **unique `authUserId`**. |
| `Student` | `students_student` + optional mirror | Learner profile; **unique `authUserId`**. |
| `Teacher` | `employees_teacher` | Teacher profile; **unique `authUserId`**. |
| `Manager` | `employees_manager` | Staff manager row; **unique `authUserId`**. |
| `EmployeeProfile` | `employees_employeeprofile` | **unique `authUserId`**. |
| `TeacherAdditionalLanguage` | M2M | `(teacherId, languageCode)` |

**Constraints:** At most one of `Teacher` / `Manager` per user in legacy practice is common but not enforced by DB; migration keeps **both** if rare collisions exist; API `…/me` picks role-specific endpoints.

---

## 3. Field mapping (legacy → target)

### 3.1 Keys

| Legacy | Target column | Transform |
|--------|---------------|-----------|
| `auth_user.id` | `authUserId` everywhere | Integer; JWT `sub` parsed to int |
| `students_student.id` | `Student.id` | Preserve int PK for URL `/students/:id` |
| `employees_teacher.id` | `Teacher.id` | Preserve |
| `employees_manager.id` | `Manager.id` | Preserve |

### 3.2 `UserIdentityMirror` (optional but recommended for TASK-32)

| Legacy | Target | Notes |
|--------|--------|-------|
| `first_name`, `last_name`, `email`, `phone`, `language`, `country` | same | |
| `image` | `avatarStorageKey` or `avatarUrl` | Store raw path or absolute per migration policy |

### 3.3 `Student`

| Legacy | Target | Transform |
|--------|--------|------------|
| `user_id` | `authUserId` | Direct |
| All other `Student` columns | camelCase JSON / snake DB | 1:1 types |

### 3.4 `Teacher`

| Legacy | Target | Transform |
|--------|--------|------------|
| `user_id` | `authUserId` | |
| `language.code` | `languageCode` | Join `language_language` at ETL |
| M2M | `TeacherAdditionalLanguage` | One row per language code |

### 3.5 Excluded legacy (documented)

| Area | Reason |
|------|--------|
| `employees.EmployeeContract` | **Salary service** |
| `expenses.SalaryProfile` | **Salary service** |
| Django `auth_group`, `auth_user_groups` | **Auth / gateway** |
| `notifications.*` side effects | **notifications-microservice** |
| `orders`, `discount`, billing | **Payment / financial waves** |
| `helpdesk`, `teacher_tests`, analytics | **Out of scope** per program docs |

---

## 4. Cross-service references (read-only pointers)

| This service stores | Points to | Notes |
|---------------------|------------|--------|
| `Student.managerId` | `employees.Manager.id` | Legacy FK; same value in target `Manager.id` after migration |
| `authUserId` | auth-microservice user | No FK constraint across DBs |

**No direct SQL** from user-service to portal DB in production target state; **TASK-32** ETL reads legacy once.

---

## 5. Prisma / SQL types (implementation hint)

- Use `Int` for legacy ids, `String` for emails/phones/codes, `Boolean`, `DateTime` (UTC) for audit fields if added at TASK-31.
- Text fields unlimited in legacy → `TEXT` in PostgreSQL.
- M2M: explicit join table with composite unique `(teacherId, languageCode)`.

---

## 6. Alignment with `ROADMAP.md` §3.3

- **Extract models:** `students`, **`employees` (teachers)** — satisfied by `Student`, `Teacher`, `EmployeeProfile`; **managers** included because they share `employees` app and `Student.manager` FK.
- **Integrate auth-microservice:** identity boundary and JWT; no local auth tables.
- **User profile / teacher management:** covered by public HTTP contract (`USER_API_CONTRACT.md`).
- **Social auth:** implemented only in **auth-microservice**; user-service **does not** store provider tokens.
