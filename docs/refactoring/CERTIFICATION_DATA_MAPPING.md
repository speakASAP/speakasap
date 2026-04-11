# Certification Service — Legacy Django → Target persistence mapping

**Legacy:** `speakasap-portal` (`certificates`, `education_certificates`, `quests`, `user_quest`). **Target:** `speakasap/certification-service` DB `speakasap_certification_db` (PostgreSQL). Optional draft Prisma: `certification-service/prisma/schema.prisma`.

---

## 1. Legacy model inventory

### 1.1 `certificates.Certificate`

| Django field | Type | Notes |
|--------------|------|--------|
| `id` | Auto PK | |
| `course` | FK → `education.StudentCourse` | `related_name='certificate_set'` |
| `image` | ImageField | Stored under `certificates/` on `materials_fs` |

**Behavior:** `generate_certificate` returns existing row if one exists for same course (unless `force_base`). Requires finished course and `base_course.gives_certificate`. Text layout from `get_cert_text` (translations, product rules).

**Not migrated as DB columns:** Notification side effects, `BonusStudentCourse` assignment — owned by education / notifications domains; certification stores **artifact + links**.

### 1.2 `education_certificates.Certificate`

| Django field | Type | Notes |
|--------------|------|--------|
| `id` | Auto PK | |
| `student_course` | FK → `education.StudentCourse` | Group course instance |
| `student` | FK → `students.Student` | |
| `image` | ImageField | Same storage pattern |

**Behavior:** `generate_certificate` iterates `get_finished_students()`; skip if not finished (unless `force_base`); skip duplicate `(student_course, student)` unless forcing.

### 1.3 `quests.Quest`

| Django field | Type | Notes |
|--------------|------|--------|
| `uuid` | UUID, PK | |
| `user` | FK → `AUTH_USER_MODEL` | |
| `created` | DateTime | |
| `completed` | DateTime, nullable | Set on PATCH submit |
| `code` | CharField | Must exist in Python `QUESTS` dict (`quests/assets/quests.py`) |
| `questions` | JSONField | Default `{}`; populated from template + `render_quest_titles` |
| `answers` | JSONField | |
| `identifier` | JSONField | Course UUID string, lesson keys, etc. |

**De-duplication:** `get_or_create` on `(user, code, identifier)`; `MultipleObjectsReturned` prefers row with answers, else latest.

### 1.4 `user_quest` models

| Model | Fields | Constraints |
|--------|--------|-------------|
| `Questionnaire` | `title` | |
| `Question` | `questionnaire` FK, `text`, `header` | `order_with_respect_to` |
| `UserQuestionnaire` | `questionnaire`, `user`, `created`, `finished`, `notification_template` | |
| `Answer` | `user_questionnaire`, `question`, `text` | **unique_together** `(user_questionnaire, question)` |

**Bug note (legacy):** `UserQuestionnaire.set_answer` assigns `answer.text = answer` (variable shadowing) — new service implements correct upsert without copying the bug.

---

## 2. Target tables (logical)

| Logical entity | Legacy source | Purpose |
|----------------|----------------|---------|
| `CourseCertificate` | `certificates.Certificate` | Individual completion PNG + metadata |
| `EducationCertificate` | `education_certificates.Certificate` | Per-student-in-group PNG |
| `QuestInstance` | `quests.Quest` | Runtime quest state |
| `Questionnaire` | `user_quest.Questionnaire` | Template |
| `QuestionnaireQuestion` | `user_quest.Question` | Ordered questions |
| `UserQuestionnaire` | `user_quest.UserQuestionnaire` | User attempt |
| `UserQuestionnaireAnswer` | `user_quest.Answer` | One row per question |

**Quest templates (`QUESTS`):** Source of truth today is **code** in legacy repo. Migration options: (a) bundle JSON in certification-service release artifact versioned with code, or (b) copy into DB table `QuestTemplate` in TASK-24 — not required for read-only template if bundle chosen.

---

## 3. Field mapping (legacy → target)

| Legacy | Target | Transform |
|--------|--------|-----------|
| `Certificate.course_id` | `CourseCertificate.studentCourseId` | Same integer FK to education DB during strangler; long-term UUID if education moves |
| `Certificate.image` | `CourseCertificate.imagePath` | Store relative path; URL built with env base |
| `EducationCertificate.student_course_id` | `EducationCertificate.studentCourseId` | |
| `EducationCertificate.student_id` | `EducationCertificate.studentId` | |
| `Quest.uuid` | `QuestInstance.id` | UUID string |
| `Quest.questions` / `answers` | JSON columns | Direct JSON |
| `Questionnaire.id` | `Questionnaire.id` | |
| `Question.id` | `QuestionnaireQuestion.id` | Preserve order in `order` column replacing `order_with_respect_to` |
| `UserQuestionnaire.finished` | `finishedAt` | nullable timestamp |

**User FK:** Legacy integer user id → store `userId` (number) until auth domain supplies stable external id; align with auth-microservice subject mapping in TASK-23.

---

## 4. Relationships

- `CourseCertificate` N:1 `studentCourseId` (reference only — no FK across DBs if education has separate database).
- `EducationCertificate` N:1 `studentCourseId`, N:1 `studentId`.
- `QuestInstance` N:1 `userId`; optional unique index on `(userId, code, identifier)` using **canonical JSON** for `identifier` (Postgres `jsonb` equality) to mirror `get_or_create`.
- `UserQuestionnaire` N:1 `Questionnaire`, N:1 `userId`.
- `UserQuestionnaireAnswer` N:1 `UserQuestionnaire`, N:1 `QuestionnaireQuestion`.

---

## 5. Signed public URLs

Legacy uses `django.core.signing.Signer` on certificate PK. Target: **short-lived JWT** or **HMAC token** encoding `certificateKind`, `id`, `exp` — implementation detail frozen in TASK-23; mapping stores `signedViewToken` as opaque string.

---

## 6. Files / storage

Legacy writes under `materials/certificates/` and `ImageField` relative paths. Target: same relative prefix acceptable if shared volume; otherwise object storage key in `imagePath` + `ASSETS_BASE_URL` / `MATERIALS_PUBLIC_BASE_URL` in `.env` (keys only in `.env.example`).

---

## 7. Cutover notes

- Dual-write period: new service accepts writes only after education emits `studentCourse` events or API confirms finish — orchestration in TASK-24.
- Read path: portal may call certification-service for lists while HTML pages remain until frontend cutover.
