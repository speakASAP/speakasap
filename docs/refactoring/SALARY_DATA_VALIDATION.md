# Salary data migration validation (TASK-57 / P4-SD)

Use after `npm run migrate:salary-data -- --dry-run` and again after `--load`.

**Mapping:** `SALARY_DATA_MAPPING.md` · **API:** `SALARY_API_CONTRACT.md`

---

## Enum and field normalization (legacy → salary-service)

### `SalaryProfile.preferablePm`

| Legacy `expenses_salaryprofile.preferable_pm` | Target |
|-----------------------------------------------|--------|
| `transfergo`, `account`, `cash` | Same string |
| `null`, empty, whitespace | `null` |

### `SalaryExpense.kind`

| Legacy signal | Target |
|---------------|--------|
| Row in `education_lessonsalaryexpense` | `lesson` |
| Row in `expenses_supportbonusexpense` | `support_bonus` |
| Else | `generic` |

### `lessonUuid`

ETL sets `null`. Populate later via HTTP or batch job using `EDUCATION_SERVICE_URL` (no cross-service SQL).

### `EmployeeContract.documentStorageKey`

Legacy `FileField` path string is copied as-is when non-empty; binary files are not copied in this script (reference-only until attachment pipeline exists).

---

## Orphans and integrity checks

Run on **legacy** (read-only):

```sql
-- Salary expenses whose user has no salary profile (skipped by ETL)
SELECT COUNT(*) FROM expenses_salaryexpense se
WHERE NOT EXISTS (SELECT 1 FROM expenses_salaryprofile sp WHERE sp.user_id = se.user_id);

-- Contracts for users missing from auth (flagged in dry-run stats)
SELECT COUNT(*) FROM employees_employeecontract ec
WHERE NOT EXISTS (SELECT 1 FROM auth_user u WHERE u.id = ec.user_id);

-- Lesson salary rows pointing at deleted lessons (if table exists)
SELECT COUNT(*) FROM education_lessonsalaryexpense lse
WHERE NOT EXISTS (SELECT 1 FROM education_lesson l WHERE l.uuid = lse.lesson_id);
```

Run on **target** after load:

```sql
SELECT COUNT(*) FROM salary_expenses e
WHERE NOT EXISTS (SELECT 1 FROM salary_profiles p WHERE p.id = e.profile_id);

SELECT COUNT(*) FROM employee_contracts c
WHERE c.main_contract_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM employee_contracts m WHERE m.id = c.main_contract_id);
```

Expect zero orphan `salary_expenses` if legacy profiles cover all salary expense users. Prolongations with broken `main_id` in legacy may yield `main_contract_id` null.

---

## Payroll period reconciliation

Dry-run JSON includes `transform.payrollPeriodSample`: legacy `SUM(price * qty)` and row counts grouped by `to_char(date, 'YYYY-MM')` and `currency`. Compare against administrator salary aggregates for the same windows if discrepancies are suspected.

---

## Rollback (target DB only)

**Warning:** destroys migrated salary-service domain rows. Take a DB snapshot before first `--load`.

```sql
BEGIN;
TRUNCATE TABLE
  payout_lines,
  payout_runs,
  calculation_lines,
  calculation_runs,
  salary_expenses,
  employee_contracts,
  salary_profiles,
  idempotency_records
RESTART IDENTITY CASCADE;
COMMIT;
```

Re-run `--load` after truncate; deterministic IDs repopulate the same logical rows.

---

## Validator (P4-SD)

- [ ] `npm run migrate:salary-data -- --dry-run` completes; JSON logs show expected `stats` / `transform` counts.
- [ ] Orphan SQL counts on legacy reviewed (non-zero requires data fix or documented acceptance).
- [ ] After `--load`, target orphan SQL returns zero for `salary_expenses` → `salary_profiles`.
- [ ] `SALARY_DATA_MIGRATION_LOG.md` updated when using `--write-docs` on the canonical run.

**Next:** `docs/agents/AGENT57V_SALARY_SERVICE_MIGRATION_VALIDATE.md`.
