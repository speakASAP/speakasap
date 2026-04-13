# Legacy → speakasap-salary-service data mapping (TASK-55)

**Sources verified (workspace):** `speakasap-portal/expenses/models.py`, `speakasap-portal/education/models.py` (`LessonSalaryExpense`), `speakasap-portal/employees/models/contracts.py`, `speakasap-portal/administrator/views/salary.py`.  
**Related program docs:** `USER_DATA_MAPPING.md` § excluded (`EmployeeContract`, `SalaryProfile`), `ROADMAP.md` §4.3 / expenses split.

**Split reminder:** General **`Expense`** rows without salary semantics stay with **financial-service** when non-salary; this mapping covers **salary slice only** (`SalaryExpense` hierarchy, `SalaryProfile`, `EmployeeContract`).

---

## Enum normalization

### `currency`

| Legacy `expenses` / `SalaryProfile.currency` | Target |
|---------------------------------------------|--------|
| `EUR`, `CZK`, `RUB` | Same uppercase strings |

### `preferable_pm` (legacy `SalaryProfile.preferable_pm`)

| Legacy `METHODS` key | Target `preferablePm` |
|----------------------|------------------------|
| `transfergo` | `transfergo` |
| `account` | `account` |
| `cash` | `cash` |
| `null` / empty | `null` |

### Salary expense `kind` (discriminated subtype)

| Legacy model / signal | Target `kind` |
|------------------------|---------------|
| Row is `education.LessonSalaryExpense` (OneToOne `lesson`) | `lesson` |
| Row is `expenses.SupportBonusExpense` | `support_bonus` |
| Row is `expenses.SalaryExpense` without above | `generic` |

---

## Table mapping (conceptual Prisma / SQL)

### `SalaryProfile` ← `expenses_salaryprofile`

| Legacy column | Target field | Notes |
|---------------|--------------|-------|
| `id` | `id` (new UUID) + `legacyProfileId` int **unique** | TASK-57 chooses UUID pk + legacy int |
| `user_id` | `legacyPortalUserId` | FK logical to user-service / `auth_user.id` |
| *(from user-service ETL)* | `authUserId` | Nullable until linked |
| `currency` | `currency` | |
| `preferable_pm` | `preferablePm` | |
| `salary` | `salary` | Decimal monthly wage |
| `rate` | `rate` | Decimal hourly |
| `show_as_teacher` | `showAsTeacher` | |
| `show_as_other` | `showAsOther` | |
| `bank_account` | `bankAccount` | Text |
| `paypal_account` | `paypalAccount` | |
| `work_duration_lower_bound` | `workDurationLowerBound` | |
| `work_duration_upper_bound` | `workDurationUpperBound` | |

### `SalaryExpense` base ← `expenses_expense` + `expenses_salaryexpense`

Multi-table inheritance: child row **`expenses_salaryexpense`** PK = **`expenses_expense`** PK (`salaryexpense_ptr` parent link in historical migrations; current schema uses shared pk chain — verify on live DB in TASK-57).

| Legacy column | Target field | Notes |
|---------------|--------------|-------|
| `expenses_expense.id` | `legacyExpenseId` int **unique** | |
| `expenses_salaryexpense.user_id` | `legacyPortalUserId` | Must match profile’s user |
| `date` | `date` | Date (UTC date-only stored) |
| `price` | `price` | `Decimal(8,2)` |
| `qty` | `qty` | |
| `comment` | `comment` | Substring **`Salary`** excluded in some admin aggregates per legacy queryset |
| `currency` | `currency` | |

### `LessonSalaryExpense` extension ← `education_lessonsalaryexpense`

| Legacy | Target | Notes |
|--------|--------|-------|
| `lesson_id` | *(join only)* → `kind = lesson`; `lessonUuid` | `SalaryExpense` has no `legacyLessonId` column. TASK-57 ETL uses the extension table only to classify rows and set `lessonUuid` to `null`. Backfill `lessonUuid` later (education-service, HTTP or batch); add a dedicated legacy int column to the schema only if a future task requires storing portal `lesson_id` in salary DB. |
| *(base salary expense columns)* | same `SalaryExpense` row | Single logical expense row |

### `SupportBonusExpense` extension ← `expenses_supportbonusexpense`

| Legacy | Target | Notes |
|--------|--------|-------|
| `student_id` | `legacyStudentId` nullable | User-service / student correlation |
| `group_id` | `legacyStudentGroupId` nullable | Course group FK legacy |

### `EmployeeContract` ← `employees_employeecontract`

| Legacy column | Target field | Notes |
|---------------|--------------|-------|
| `id` | `id` UUID + `legacyContractId` int unique | |
| `user_id` | `legacyPortalUserId` | |
| `document` | `documentStorageKey` or URL | File lives in legacy storage; TASK-57 defines copy vs reference |
| `verified` | `verified` | bool |
| `created` | `createdAt` | |
| `valid_till` | `validTill` | date nullable |
| `valid_from` | `validFrom` | date nullable |
| `main_id` | `mainContractId` | Nullable self-FK |
| `contract_uid` | `contractUid` | string; prolongation UIDs computed in legacy — denormalize `displayUid` optional |

---

## Aggregate parity (administrator salary)

Legacy `TeacherListSalaryView` / `TeacherSalaryView`:

- Filter teachers vs others via **`show_as_teacher`**, **`show_as_other`**, and Django permissions — target service enforces equivalent **staff claims** (exact claim in TASK-56).
- **Subtotals** group by `preferable_pm` + `currency` and exclude `comment` containing **`Salary`** for quantity money rows — replicate in **`GET .../admin/summary/by-profile`** (see API contract).

---

## Orphans and validation (TASK-57)

- **`SalaryExpense.user_id`** with no matching **`SalaryProfile.user_id`**: flag in migration report (data error).
- **`LessonSalaryExpense`** with missing **`Lesson`**: flag orphan; line may still migrate with null `lessonUuid`.
- **`EmployeeContract.user_id`** not in portal users: flag orphan.

---

## Out of scope (mapping)

- **`notifications`** templates for contract events — remain notifications wave; salary stores contract only.
- **Helpdesk, marathon, warehouse** — not in salary DB.
- **Non-salary `Expense`** children (if any other subclasses) — financial wave.

---

## Prisma / SQL hints

- Monetary: `Decimal` / `NUMERIC(12,2)` aligned with legacy `max_digits=8, decimal_places=2` where possible; minor-unit ints reserved for **payment-service** disburse API boundary.
- All timestamps: ISO-8601 in API; store UTC in DB.
