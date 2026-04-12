# Course Service Data Mapping (TASK-35)

**Target database:** `speakasap_course_db` (PostgreSQL on `database-server`). **Source:** legacy Django `speakasap-portal` Postgres (export via ETL script TASK-37).

**Scope:** ROADMAP §3.1 — **`products`**, **`offers`**, and **pricing** interpreted as **`products_partpayment*`** + price fields on **`products_product`**. No `pricing` Django app exists.

---

## 1. `products_category` → `Category`

| Legacy column | Target column | Type | Notes |
|---------------|---------------|------|-------|
| `id` | `id` | serial PK | |
| `title` | `title` | varchar(64) | |
| `product_for_offers` | `product_for_offers` | boolean | |

---

## 2. `products_product` → `Product`

| Legacy column | Target column | Type | Notes |
|---------------|---------------|------|-------|
| `id` | `id` | serial PK | Preserve legacy id |
| `title` | `title` | varchar(255) | |
| `en_title` | `en_title` | varchar(255) | default '' |
| `price` | `price` | integer | |
| `tags` | `tags` | varchar(255) nullable | |
| `language_id` | `language_id` | integer nullable | No FK to `language` table in course DB |
| `category_id` | `category_id` | integer | FK → `products_category.id` |
| `label` | `label` | varchar(255) nullable | |
| `android_id` | `android_id` | varchar(255) nullable | |
| `material_language` | `material_language` | varchar(2) | default `ru` |
| `trashed` | `trashed` | boolean | default false |

**Out of scope for row copy:** STI subclasses (`marathonproduct`, `studentcourseproduct`, …) — only the **base `products_product`** row is migrated in Wave 2; subclass extra columns live in education/marathon waves unless Lead extends §3.1.

---

## 3. `products_partpaymentcollection` / `products_partpaymentoption`

| Legacy table.column | Target | Notes |
|---------------------|--------|-------|
| `products_partpaymentcollection.*` | `PartPaymentCollection` | 1:1 column names |
| `products_partpaymentoption.part_id` | `part_id` | FK → collection |
| `price`, `day`, `open_steps` | same | |

---

## 4. `products_product_part_payments` (M2M)

| Legacy column | Target | Notes |
|---------------|--------|-------|
| `product_id` | `product_id` | FK → `products_product.id` ON DELETE CASCADE |
| `partpaymentcollection_id` | `partpaymentcollection_id` | FK → `products_partpaymentcollection.id` ON DELETE CASCADE |

Composite PK `(product_id, partpaymentcollection_id)`.

---

## 5. `offers_extralessonsoffer` → `ExtraLessonsOffer`

| Legacy column | Target | Notes |
|---------------|--------|-------|
| `id` | `id` | serial PK |
| `product_id` | `product_id` | FK → `products_product.id` |
| `teacher_id` | `teacher_id` | integer nullable — no FK to `teachers` in course DB |
| `lessons` | `lessons` | integer |
| `teacher_native_id` | `teacher_native_id` | integer nullable |
| `lessons_native` | `lessons_native` | integer |
| `comment` | `comment` | text nullable |

---

## 6. `offers_offer` → `Offer`

| Legacy column | Target | Type | Notes |
|---------------|--------|------|-------|
| `uuid` | `uuid` | uuid PK | |
| `student_id` | `student_id` | integer | Opaque legacy id; no `students` table in course DB |
| `teacher_id` | `teacher_id` | integer nullable | |
| `offerer_id` | `offerer_id` | integer nullable | Legacy `auth_user.id` |
| `course_product_id` | `course_product_id` | integer nullable | FK → `products_product.id` |
| `extra_lessons_id` | `extra_lessons_id` | integer nullable unique | FK → `offers_extralessonsoffer.id` |
| `order_id` | `order_id` | integer nullable | No FK to `orders` in course DB |
| `created` | `created` | timestamptz | |
| `opened` | `opened` | timestamptz nullable | |

---

## 7. Identity / auth linkage

- Course DB **does not** store auth UUIDs on products/offers (except `offerer_id` as legacy integer).
- **user-service** remains the system of record for `authUserId` ↔ portal user; education wave may join offers by `student_id` / `offerer_id` to migrated students.

---

## 8. ETL ordering

1. `products_category`
2. `products_partpaymentcollection` + `products_partpaymentoption`
3. `products_product`
4. `products_product_part_payments`
5. `offers_extralessonsoffer`
6. `offers_offer`

---

## 9. Explicit exclusions

- `orders_*`, `discount_*`, `education_*` (except FK integers already on `products_product` / offers), `marathon_*` product subclasses data not on base product row.
- Financial / invoice tables (Phase 4).
