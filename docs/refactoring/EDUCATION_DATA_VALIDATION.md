# Education Data Validation

Run against **target** `speakasap_education_db` after ETL. Replace connection via `psql` or admin client.

## Row counts (sanity)

```sql
SELECT 'education_group' AS t, COUNT(*) FROM education_group
UNION ALL SELECT 'education_group_students', COUNT(*) FROM education_group_students
UNION ALL SELECT 'education_studentcourse', COUNT(*) FROM education_studentcourse
UNION ALL SELECT 'education_lesson', COUNT(*) FROM education_lesson
UNION ALL SELECT 'education_homework', COUNT(*) FROM education_homework;
```

Compare to legacy source counts from `--dry-run` log.

## Orphans

```sql
-- Group students pointing to missing group
SELECT gs.id FROM education_group_students gs
LEFT JOIN education_group g ON g.uuid = gs.group_id
WHERE g.uuid IS NULL;

-- Student courses pointing to missing group
SELECT sc.uuid FROM education_studentcourse sc
LEFT JOIN education_group g ON g.uuid = sc.group_id
WHERE g.uuid IS NULL;

-- Lessons pointing to missing student course
SELECT l.uuid FROM education_lesson l
LEFT JOIN education_studentcourse sc ON sc.uuid = l.student_course_id
WHERE sc.uuid IS NULL;

-- Homework pointing to missing lesson
SELECT h.uuid FROM education_homework h
LEFT JOIN education_lesson l ON l.uuid = h.lesson_id
WHERE l.uuid IS NULL;
```

Expect **zero rows** in each orphan query.

## `previous_id` chain

```sql
SELECT COUNT(*) FROM education_studentcourse
WHERE previous_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM education_studentcourse p WHERE p.uuid = education_studentcourse.previous_id);
```

Expect **zero**.
