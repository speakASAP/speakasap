# Education Service Data Mapping (Phase 3 Wave 3)

**Legacy:** Django app **`education`** (+ **`education.homework`**) in `speakasap-portal` on PostgreSQL. **Target:** `speakasap_education_db` — Prisma models in `education-service/prisma/schema.prisma`.

**Source of truth for model semantics:** `speakasap-portal/education/models.py`, `speakasap-portal/education/homework/models.py`.

---

## 1. `education_group` → `Group`

| Legacy column | Target column | Notes |
| ------------- | ------------- | ----- |
| uuid | uuid | UUID PK |
| title | title | varchar(255) |
| created | created | timestamp → Prisma `createdAt` |

---

## 2. `education_group_students` (M2M) → `GroupStudent`

| Legacy column | Target column | Notes |
| ------------- | ------------- | ----- |
| id | id | serial surrogate |
| group_id | groupUuid | UUID FK → group |
| student_id | studentId | int FK to portal student |

---

## 3. `education_studentcourse` → `StudentCourse`

| Legacy column | Target column | Notes |
| ------------- | ------------- | ----- |
| uuid | uuid | UUID PK |
| course_class | courseClass | varchar — Python import path string |
| course_display_title | courseDisplayTitle | varchar |
| created | createdAt | |
| open_strategy_class | openStrategyClass | varchar |
| group_id | groupUuid | UUID FK |
| previous_id | previousUuid | nullable self-FK |
| is_finished | isFinished | |
| end_date | endDate | nullable |
| is_new | isNew | |
| is_paused | isPaused | |
| auto_pause | autoPause | |
| pause_date | pauseDate | nullable |

**Not migrated in Wave 3 core script (extend later):** ancillary tables (tickets, cancellations, salary expenses, lesson records app, etc.) per Lead scope.

---

## 4. `education_lesson` → `Lesson`

| Legacy column | Target column | Notes |
| ------------- | ------------- | ----- |
| uuid | uuid | |
| order | order | |
| teacher_id | teacherId | nullable int → `employees` teacher PK in legacy |
| start | start | nullable |
| lesson_change_start_count | lessonChangeStartCount | |
| is_finished | isFinished | |
| student_course_id | studentCourseUuid | UUID FK |
| module_class | moduleClass | varchar |
| needs_teacher | needsTeacher | |
| assign_teacher_automatically | assignTeacherAutomatically | |
| recommendation | recommendation | text |
| to_manager | toManager | text |

---

## 5. `education_homework` → `Homework`

| Legacy column | Target column | Notes |
| ------------- | ------------- | ----- |
| uuid | uuid | |
| lesson_id | lessonUuid | UUID FK |
| student_id | studentId | int |
| content_student | contentStudent | text |
| content_teacher | contentTeacher | text |
| ready | ready | |
| comment | comment | nullable |
| checked | checked | |

Unique `(lesson_id, student_id)` preserved.

---

## Import order (FK safety)

1. `education_group`
2. `education_group_students`
3. `education_studentcourse` (ordered so `previous_id` rows reference already-inserted UUIDs, or insert with NULL previous then update — script documents chosen strategy)
4. `education_lesson`
5. `education_homework`

---

## Out of scope

- **`marathon`** tables and marathon-specific product subclasses.
- **`course_materials`** module bodies — materials service / content domain.
- **`orders_*`**, payments execution.
- Full **`education_lessonrecord`** / recording media — future task.
