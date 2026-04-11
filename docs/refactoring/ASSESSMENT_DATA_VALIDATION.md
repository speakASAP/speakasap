# Assessment data validation (TASK-27)

## 1. `teacher_tests` exclusion (code + data)

- **Code review:** `grep -r teacher_tests assessment-service/src` — only README/schema comments allowed.
- **Data:** target DB must not contain tables from `teacher_tests` app.

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename ILIKE '%teacher%';
```

**Acceptance:** no unexpected teacher-test tables (ideally zero rows returned).

## 2. Count parity (legacy vs target)

**Legacy:**

```sql
SELECT 'language_tests_languagetest' AS t, COUNT(*) FROM language_tests_languagetest
UNION ALL SELECT 'language_tests_level', COUNT(*) FROM language_tests_level
UNION ALL SELECT 'language_tests_usertest', COUNT(*) FROM language_tests_usertest
UNION ALL SELECT 'user_tests_usertest', COUNT(*) FROM user_tests_usertest;
```

**Target:**

```sql
SELECT 'LanguageTest', COUNT(*) FROM "LanguageTest"
UNION ALL SELECT 'Level', COUNT(*) FROM "Level"
UNION ALL SELECT 'LanguageUserTest', COUNT(*) FROM "LanguageUserTest"
UNION ALL SELECT 'AssetUserTest', COUNT(*) FROM "AssetUserTest";
```

Compare language test / asset counts to logical sums (questions+answers+attempt rows are additional — document expected ratios).

## 3. No certification tables

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND (tablename ILIKE '%certificate%' OR tablename ILIKE '%quest%');
```

**Acceptance:** none of the certification Prisma table names present.

## 4. FK / orphan smoke (target)

```sql
SELECT COUNT(*) FROM "LanguageUserTest" ut
  LEFT JOIN "LanguageTest" t ON t.id = ut."testId"
 WHERE t.id IS NULL;

SELECT COUNT(*) FROM "LanguageUserTestQuestion" q
  LEFT JOIN "LanguageUserTest" ut ON ut.id = q."userTestId"
 WHERE ut.id IS NULL;
```

**Acceptance:** both **0**.

## Verdict (AGENT27V)

| Check | Result |
|-------|--------|
| teacher_tests absent | |
| Counts / documented variance | |
| No certification tables | |
| Orphan queries | |

**PASS** when satisfied.
