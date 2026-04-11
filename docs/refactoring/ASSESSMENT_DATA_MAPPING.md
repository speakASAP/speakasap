# Assessment Service — Legacy Django → Target persistence mapping

**Legacy:** `speakasap-portal` apps **`language_tests`**, **`user_tests`**. **Target:** `speakasap/assessment-service` DB `speakasap_assessment_db`. Optional draft Prisma: `assessment-service/prisma/schema.prisma`.

## Out of scope: `teacher_tests`

The **`teacher_tests`** app is **explicitly excluded** from this mapping (obsolete). No rows, endpoints, or foreign keys from `teacher_tests` are migrated into `speakasap_assessment_db`.

---

## 1. Legacy model inventory

### 1.1 `language_tests`

| Model | Key fields | Notes |
|-------|------------|--------|
| `LanguageTest` | `name`, `tag`, `language` FK | **unique_together** `(tag, language)` |
| `Level` | `name`, `difficult` | Shared across tests via questions |
| `LevelRecommendation` | `level`, `language`, `title`, `description`, `link` | |
| `Question` | `test`, `text`, `level` | TrashMixin → soft delete |
| `Answer` | `question`, `text`, `right` | TrashMixin |
| `UserTest` | `test`, `user`, `created`, `ended` | |
| `UserTestQuestion` | `user_test`, `question`, `complete`, `created` | M2M `answers` → `Answer` |
| `UserTestResult` | `user_test` OneToOne, `score`, `level` | Lazy-created |

### 1.2 `user_tests`

| Model | Key fields | Notes |
|-------|------------|--------|
| `UserTest` | `uuid` PK, `user`, `created`, `completed`, `questions` JSON, `answers` JSON, `due_date`, `errors` ArrayField, `asset` | `create_test` loads `user_tests/assets/<asset>.json` |

Constants: `QUESTIONS_NUM=10`, `ANSWERS_NUM=4`, `MAX_TEST_ATTEMPTS=5`.

---

## 2. Target tables (logical)

| Logical entity | Legacy source |
|----------------|---------------|
| `LanguageTest` | `language_tests.LanguageTest` |
| `Level` | `language_tests.Level` |
| `LevelRecommendation` | `language_tests.LevelRecommendation` |
| `LanguageQuestion` | `language_tests.Question` |
| `LanguageAnswer` | `language_tests.Answer` |
| `LanguageUserTest` | `language_tests.UserTest` |
| `LanguageUserTestQuestion` | `language_tests.UserTestQuestion` |
| `LanguageUserTestQuestionSelection` | M2M `UserTestQuestion.answers` |
| `LanguageUserTestResult` | `language_tests.UserTestResult` |
| `AssetUserTest` | `user_tests.UserTest` |

---

## 3. Field mapping

### 3.1 Language test tree

| Legacy | Target | Transform |
|--------|--------|-----------|
| `LanguageTest.language_id` | `languageId` | FK; align with content-service `Language.id` or portal `language.Language` PK during migration |
| `Question.text` | `text` | |
| `Answer.right` | `isCorrect` | boolean |
| `UserTest.ended` | `endedAt` | nullable |
| `UserTestQuestion.complete` | `isComplete` | |
| `UserTestResult.score` | `score` | int |
| `UserTestResult.level_id` | `levelId` | |

**Computed (not stored or stored snapshot):** `UserTest.score`, `UserTest.level`, `position`, `slider_value` — either store snapshot on `LanguageUserTestResult` (legacy creates row with score + level) or recompute; contract expects persisted **result row** mirroring legacy.

### 3.2 Asset user test

| Legacy | Target | Transform |
|--------|--------|-----------|
| `uuid` | `id` UUID | string in JSON API |
| `questions` | JSONB | direct |
| `answers` | JSONB | direct |
| `errors` | text[] | |
| `asset` | string | |

---

## 4. Relationships

- `LanguageQuestion` N:1 `LanguageTest`; N:1 `Level`.
- `LanguageAnswer` N:1 `LanguageQuestion`.
- `LanguageUserTest` N:1 `LanguageTest`, N:1 `userId`.
- `LanguageUserTestQuestion` N:1 `LanguageUserTest`, N:1 `LanguageQuestion`; M2M to `LanguageAnswer` for picks.
- `LanguageUserTestResult` 1:1 `LanguageUserTest`.
- `LevelRecommendation` N:1 `Level`, N:1 `languageId`.

**Asset tests** are isolated per user; no FK to language tests.

---

## 5. Scoring implementation notes (for TASK-26)

- Port `UserTest.get_stat`, `UserTest.score`, `UserTest.level` numerically identical to legacy to avoid user-visible regression.
- `UserTestQuestion.is_right`: equality of chosen answer id set vs set of answers where `right=true` for question (supports multi-select).
- `CurrentQuestionView` random choice: `possible_questions_id[randint(0, n-1)]` — use cryptographically safe RNG optional improvement; **default** reproduce `random.randint` distribution for parity.

---

## 6. Asset files

JSON templates under `user_tests/assets/*.json` must be copied into assessment-service **or** read from mounted volume path in `.env` (`USER_TEST_ASSETS_DIR`). Keys without secrets.

---

## 7. Cutover

- Freeze tag/language pairs before migration import.
- `user_tests` UUID PK preserved as string ids in API responses.
