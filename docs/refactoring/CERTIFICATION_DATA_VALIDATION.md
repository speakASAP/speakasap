# Certification data validation (TASK-24)

Run against **target** `speakasap_certification_db` after migration. Replace connection with your admin URL.

## 1. Row counts vs legacy (manual)

On **legacy** DB:

```sql
SELECT 'certificates_certificate' AS t, COUNT(*) FROM certificates_certificate
UNION ALL SELECT 'education_certificates_certificate', COUNT(*) FROM education_certificates_certificate
UNION ALL SELECT 'quests_quest', COUNT(*) FROM quests_quest
UNION ALL SELECT 'user_quest_questionnaire', COUNT(*) FROM user_quest_questionnaire
UNION ALL SELECT 'user_quest_question', COUNT(*) FROM user_quest_question
UNION ALL SELECT 'user_quest_userquestionnaire', COUNT(*) FROM user_quest_userquestionnaire
UNION ALL SELECT 'user_quest_answer', COUNT(*) FROM user_quest_answer;
```

On **target** DB:

```sql
SELECT 'CourseCertificate' AS t, COUNT(*) FROM "CourseCertificate"
UNION ALL SELECT 'EducationCertificate', COUNT(*) FROM "EducationCertificate"
UNION ALL SELECT 'QuestInstance', COUNT(*) FROM "QuestInstance"
UNION ALL SELECT 'Questionnaire', COUNT(*) FROM "Questionnaire"
UNION ALL SELECT 'QuestionnaireQuestion', COUNT(*) FROM "QuestionnaireQuestion"
UNION ALL SELECT 'UserQuestionnaire', COUNT(*) FROM "UserQuestionnaire"
UNION ALL SELECT 'UserQuestionnaireAnswer', COUNT(*) FROM "UserQuestionnaireAnswer";
```

**Acceptance:** counts match per paired row (education rows may be ≤ legacy if join to `education_group_students` filters orphans — document variance).

## 2. No assessment leakage

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename ILIKE '%language%';
```

**Acceptance:** no `language_tests` / `user_tests` tables in certification DB.

## 3. Orphan checks (target)

```sql
SELECT COUNT(*) FROM "UserQuestionnaireAnswer" a
  LEFT JOIN "UserQuestionnaire" u ON u.id = a."userQuestionnaireId"
 WHERE u.id IS NULL;

SELECT COUNT(*) FROM "UserQuestionnaire" uq
  LEFT JOIN "Questionnaire" q ON q.id = uq."questionnaireId"
 WHERE q.id IS NULL;

SELECT COUNT(*) FROM "QuestionnaireQuestion" qq
  LEFT JOIN "Questionnaire" q ON q.id = qq."questionnaireId"
 WHERE q.id IS NULL;
```

**Acceptance:** all three counts **0**.

## 4. Sample parity (spot)

Pick one `CourseCertificate.id` from target and compare `imagePath` + `studentCourseId` to legacy row with same `id` (legacy `certificates_certificate.id` preserved on import).

## Verdict checklist (AGENT24V)

| Check | Result |
|-------|--------|
| Count parity / explained gaps | **Pending import** — alfares `2026-04-11`: target counts all **0** (no ETL yet). Legacy count SQL not run (no legacy DB on shared `db-server-postgres` instance for portal monolith). |
| Orphan queries | **PASS** (all three counts **0** on target after migration). |
| Assessment tables absent | **PASS** (`ILIKE '%language%'` on `pg_tables` returned **0** rows). |
| Rollback path understood | Documented in `CERTIFICATION_DATA_MIGRATION_LOG.md` (operator). |

**Validator outcome:** **Conditional** — structural checks **PASS** on empty target; full **PASS** after live import + count parity vs legacy on the same environment that ran ETL.
