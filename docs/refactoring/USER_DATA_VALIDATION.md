# User data validation (TASK-32)

Run against **target** `speakasap_user_db` after migration. Replace URLs with your admin connection strings.

## 1. Row counts (manual)

**Legacy** (portal DB):

```sql
SELECT 'students_student' AS t, COUNT(*) FROM students_student
UNION ALL SELECT 'employees_teacher', COUNT(*) FROM employees_teacher
UNION ALL SELECT 'employees_teacher_additional_languages', COUNT(*) FROM employees_teacher_additional_languages
UNION ALL SELECT 'employees_manager', COUNT(*) FROM employees_manager
UNION ALL SELECT 'employees_employeeprofile', COUNT(*) FROM employees_employeeprofile
UNION ALL SELECT 'auth_user', COUNT(*) FROM auth_user;
```

**Target** (speakasap_user_db):

```sql
SELECT 'students' AS t, COUNT(*) FROM students
UNION ALL SELECT 'teachers', COUNT(*) FROM teachers
UNION ALL SELECT 'teacher_additional_languages', COUNT(*) FROM teacher_additional_languages
UNION ALL SELECT 'managers', COUNT(*) FROM managers
UNION ALL SELECT 'employee_profiles', COUNT(*) FROM employee_profiles
UNION ALL SELECT 'user_identity_mirror', COUNT(*) FROM user_identity_mirror;
```

**Acceptance:** target counts **≤** legacy per entity where email could not be mapped to auth UUID (skipped rows). Document skip totals from migration log.

## 2. Orphan checks (target)

```sql
SELECT COUNT(*) FROM students s
  LEFT JOIN managers m ON m.id = s.manager_id
 WHERE s.manager_id IS NOT NULL AND m.id IS NULL;

SELECT COUNT(*) FROM teacher_additional_languages x
  LEFT JOIN teachers t ON t.id = x.teacher_id
 WHERE t.id IS NULL;
```

**Acceptance:** both counts **0**.

## 3. Auth linkage

```sql
SELECT COUNT(*) FROM students WHERE auth_user_id IS NULL;
SELECT COUNT(*) FROM teachers WHERE auth_user_id IS NULL;
```

**Acceptance:** both **0** (schema requires UUID; import should not insert nulls).

## 4. Verdict checklist (AGENT32V)

| Check | Result |
|-------|--------|
| Counts / explained skips | *(PASS/FAIL + notes)* |
| Orphan queries | *(PASS/FAIL)* |
| Auth UUID presence | *(PASS/FAIL)* |
