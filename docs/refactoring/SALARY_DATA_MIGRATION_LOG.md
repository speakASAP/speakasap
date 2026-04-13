# Salary data migration log (TASK-57 / P4-SD)

Append-only log of ETL runs. Each run is appended when `salary-service` migration is executed with `--write-docs`, or paste JSON lines from stdout below.

**Script:** `cd salary-service && npm run migrate:salary-data -- --dry-run --write-docs` (dry) or `--load --write-docs` (apply).

**Env:** `SALARY_LEGACY_DATABASE_URL` (read-only legacy), `SALARY_DATABASE_URL` (target). Credentials must never be committed; use `speakasap/.env` only.

**Idempotency:** Deterministic UUIDv5 for `salary_profiles.id`, `salary_expenses.id`, `employee_contracts.id` from legacy integer keys; `createMany` with `skipDuplicates: true` on unique legacy columns. Safe rerun without duplicate key errors.

**Not merged into this ETL:** Historical `courses_singlelessonsalaryexpense` / `courses_grouplessonsalaryexpense` rows (counts only in dry-run JSON). `lessonUuid` stays null until a separate education backfill maps `education_lesson` → education-service UUID (see `SALARY_DATA_MAPPING.md`).

**Rollback:** See `SALARY_DATA_VALIDATION.md` (truncate target tables only; snapshot DB before first `--load`).

---

## Runs

## Run 2026-04-13T22:27:26.962Z

```json
{
  "dryRun": true,
  "load": false,
  "stats": {
    "salaryProfiles": 386,
    "salaryExpenseBaseRows": 104956,
    "lessonSalaryExpenseRows": 99484,
    "supportBonusRows": 179,
    "employeeContracts": 632,
    "authUsers": 214109,
    "contractsUserMissingAuth": 0,
    "expensesUserWithoutProfile": 1338,
    "lessonExpenseMissingLesson": 0,
    "courseSingleLessonSalaryRows": 24152,
    "courseGroupLessonSalaryRows": 1250
  },
  "transform": {
    "salaryProfiles": 386,
    "salaryExpenses": 103618,
    "employeeContracts": 632,
    "expensesSkippedNoProfile": 1338,
    "payrollPeriodRows": 244,
    "payrollPeriodSample": [
      {
        "period": "2026-04",
        "currency": "CZK",
        "row_count": "1",
        "qty_sum": "1.00",
        "amount_sum": "350.0000"
      },
      {
        "period": "2026-04",
        "currency": "EUR",
        "row_count": "45",
        "qty_sum": "44.00",
        "amount_sum": "645.0000"
      },
      {
        "period": "2026-03",
        "currency": "CZK",
        "row_count": "20",
        "qty_sum": "36.00",
        "amount_sum": "26675.0000"
      },
      {
        "period": "2026-03",
        "currency": "EUR",
        "row_count": "187",
        "qty_sum": "350.00",
        "amount_sum": "5136.0000"
      },
      {
        "period": "2026-02",
        "currency": "CZK",
        "row_count": "8",
        "qty_sum": "10.80",
        "amount_sum": "25445.0000"
      },
      {
        "period": "2026-02",
        "currency": "EUR",
        "row_count": "250",
        "qty_sum": "468.45",
        "amount_sum": "93649.3200"
      },
      {
        "period": "2026-01",
        "currency": "CZK",
        "row_count": "11",
        "qty_sum": "17.66",
        "amount_sum": "26189.4000"
      },
      {
        "period": "2026-01",
        "currency": "EUR",
        "row_count": "130",
        "qty_sum": "227.60",
        "amount_sum": "8032.8300"
      },
      {
        "period": "2025-12",
        "currency": "CZK",
        "row_count": "5",
        "qty_sum": "6.75",
        "amount_sum": "25347.5000"
      },
      {
        "period": "2025-12",
        "currency": "EUR",
        "row_count": "210",
        "qty_sum": "384.51",
        "amount_sum": "28412.8900"
      },
      {
        "period": "2025-11",
        "currency": "CZK",
        "row_count": "6",
        "qty_sum": "6.85",
        "amount_sum": "25382.5000"
      },
      {
        "period": "2025-11",
        "currency": "EUR",
        "row_count": "268",
        "qty_sum": "496.22",
        "amount_sum": "81891.0200"
      },
      {
        "period": "2025-10",
        "currency": "CZK",
        "row_count": "8",
        "qty_sum": "10.63",
        "amount_sum": "26705.5000"
      },
      {
        "period": "2025-10",
        "currency": "EUR",
        "row_count": "354",
        "qty_sum": "661.73",
        "amount_sum": "100877.6000"
      },
      {
        "period": "2025-09",
        "currency": "CZK",
        "row_count": "8",
        "qty_sum": "12.73",
        "amount_sum": "27440.5000"
      },
      {
        "period": "2025-09",
        "currency": "EUR",
        "row_count": "338",
        "qty_sum": "619.14",
        "amount_sum": "72781.5500"
      },
      {
        "period": "2025-08",
        "currency": "CZK",
        "row_count": "18",
        "qty_sum": "32.47",
        "amount_sum": "34349.5000"
      },
      {
        "period": "2025-08",
        "currency": "EUR",
        "row_count": "297",
        "qty_sum": "526.04",
        "amount_sum": "94441.8100"
      },
      {
        "period": "2025-07",
        "currency": "CZK",
        "row_count": "16",
        "qty_sum": "28.85",
        "amount_sum": "33082.5000"
      },
      {
        "period": "2025-07",
        "currency": "EUR",
        "row_count": "353",
        "qty_sum": "636.29",
        "amount_sum": "85816.9800"
      },
      {
        "period": "2025-06",
        "currency": "CZK",
        "row_count": "20",
        "qty_sum": "36.80",
        "amount_sum": "35865.0000"
      },
      {
        "period": "2025-06",
        "currency": "EUR",
        "row_count": "374",
        "qty_sum": "665.61",
        "amount_sum": "49601.4500"
      },
      {
        "period": "2025-05",
        "currency": "CZK",
        "row_count": "23",
        "qty_sum": "39.75",
        "amount_sum": "36897.5000"
      },
      {
        "period": "2025-05",
        "currency": "EUR",
        "row_count": "417",
        "qty_sum": "744.18",
        "amount_sum": "62230.3700"
      },
      {
        "period": "2025-04",
        "currency": "CZK",
        "row_count": "23",
        "qty_sum": "42.63",
        "amount_sum": "37905.5000"
      },
      {
        "period": "2025-04",
        "currency": "EUR",
        "row_count": "413",
        "qty_sum": "745.60",
        "amount_sum": "61796.6700"
      },
      {
        "period": "2025-03",
        "currency": "CZK",
        "row_count": "28",
        "qty_sum": "50.80",
        "amount_sum": "40765.0000"
      },
      {
        "period": "2025-03",
        "currency": "EUR",
        "row_count": "420",
        "qty_sum": "745.61",
        "amount_sum": "70703.5300"
      },
      {
        "period": "2025-02",
        "currency": "CZK",
        "row_count": "38",
        "qty_sum": "67.04",
        "amount_sum": "32515.8000"
      },
      {
        "period": "2025-02",
        "currency": "EUR",
        "row_count": "414",
        "qty_sum": "736.72",
        "amount_sum": "90155.7400"
      },
      {
        "period": "2025-01",
        "currency": "CZK",
        "row_count": "24",
        "qty_sum": "44.90",
        "amount_sum": "38700.0000"
      },
      {
        "period": "2025-01",
        "currency": "EUR",
        "row_count": "401",
        "qty_sum": "673.84",
        "amount_sum": "96598.2900"
      },
      {
        "period": "2024-12",
        "currency": "CZK",
        "row_count": "25",
        "qty_sum": "39.78",
        "amount_sum": "34458.0000"
      },
      {
        "period": "2024-12",
        "currency": "EUR",
        "row_count": "403",
        "qty_sum": "721.39",
        "amount_sum": "146706.4800"
      },
      {
        "period": "2024-11",
        "currency": "CZK",
        "row_count": "19",
        "qty_sum": "34.67",
        "amount_sum": "35119.5000"
      },
      {
        "period": "2024-11",
        "currency": "EUR",
        "row_count": "464",
        "qty_sum": "793.83",
        "amount_sum": "137850.6700"
      },
      {
        "period": "2024-10",
        "currency": "CZK",
        "row_count": "11",
        "qty_sum": "19.25",
        "amount_sum": "6737.5000"
      },
      {
        "period": "2024-10",
        "currency": "EUR",
        "row_count": "448",
        "qty_sum": "509.82",
        "amount_sum": "82588.9700"
      },
      {
        "period": "2024-09",
        "currency": "CZK",
        "row_count": "13",
        "qty_sum": "23.59",
        "amount_sum": "8256.5000"
      },
      {
        "period": "2024-09",
        "currency": "EUR",
        "row_count": "389",
        "qty_sum": "417.89",
        "amount_sum": "80860.4000"
      },
      {
        "period": "2024-08",
        "currency": "CZK",
        "row_count": "30",
        "qty_sum": "56.81",
        "amount_sum": "19883.5000"
      },
      {
        "period": "2024-08",
        "currency": "EUR",
        "row_count": "356",
        "qty_sum": "392.44",
        "amount_sum": "98491.8400"
      },
      {
        "period": "2024-07",
        "currency": "CZK",
        "row_count": "42",
        "qty_sum": "79.51",
        "amount_sum": "27828.5000"
      },
      {
        "period": "2024-07",
        "currency": "EUR",
        "row_count": "455",
        "qty_sum": "825.08",
        "amount_sum": "262763.9800"
      },
      {
        "period": "2024-06",
        "currency": "CZK",
        "row_count": "32",
        "qty_sum": "60.00",
        "amount_sum": "21000.0000"
      },
      {
        "period": "2024-06",
        "currency": "EUR",
        "row_count": "440",
        "qty_sum": "787.76",
        "amount_sum": "158264.9600"
      },
      {
        "period": "2024-05",
        "currency": "CZK",
        "row_count": "34",
        "qty_sum": "63.91",
        "amount_sum": "22368.5000"
      },
      {
        "period": "2024-05",
        "currency": "EUR",
        "row_count": "451",
        "qty_sum": "800.71",
        "amount_sum": "286748.9600"
      },
      {
        "period": "2024-04",
        "currency": "CZK",
        "row_count": "16",
        "qty_sum": "25.19",
        "amount_sum": "8816.5000"
      },
      {
        "period": "2024-04",
        "currency": "EUR",
        "row_count": "544",
        "qty_sum": "953.08",
        "amount_sum": "293415.6100"
      },
      {
        "period": "2024-03",
        "currency": "CZK",
        "row_count": "8",
        "qty_sum": "13.51",
        "amount_sum": "4728.5000"
      },
      {
        "period": "2024-03",
        "currency": "EUR",
        "row_count": "550",
        "qty_sum": "966.89",
        "amount_sum": "275617.3600"
      },
      {
        "period": "2024-02",
        "currency": "CZK",
        "row_count": "22",
        "qty_sum": "39.90",
        "amount_sum": "13965.0000"
      },
      {
        "period": "2024-02",
        "currency": "EUR",
        "row_count": "554",
        "qty_sum": "961.43",
        "amount_sum": "262113.9500"
      },
      {
        "period": "2024-01",
        "currency": "CZK",
        "row_count": "17",
        "qty_sum": "27.77",
        "amount_sum": "9719.5000"
      },
      {
        "period": "2024-01",
        "currency": "EUR",
        "row_count": "532",
        "qty_sum": "926.28",
        "amount_sum": "216498.0000"
      },
      {
        "period": "2023-12",
        "currency": "CZK",
        "row_count": "11",
        "qty_sum": "17.62",
        "amount_sum": "6167.0000"
      },
      {
        "period": "2023-12",
        "currency": "EUR",
        "row_count": "511",
        "qty_sum": "879.30",
        "amount_sum": "227318.7300"
      },
      {
        "period": "2023-11",
        "currency": "CZK",
        "row_count": "24",
        "qty_sum": "41.99",
        "amount_sum": "14696.5000"
      },
      {
        "period": "2023-11",
        "currency": "EUR",
        "row_count": "593",
        "qty_sum": "1046.75",
        "amount_sum": "218457.5100"
      },
      {
        "period": "2023-10",
        "currency": "CZK",
        "row_count": "14",
        "qty_sum": "25.38",
        "amount_sum": "8883.0000"
      },
      {
        "period": "2023-10",
        "currency": "EUR",
        "row_count": "652",
        "qty_sum": "1175.83",
        "amount_sum": "272894.6400"
      },
      {
        "period": "2023-09",
        "currency": "CZK",
        "row_count": "12",
        "qty_sum": "21.66",
        "amount_sum": "7581.0000"
      },
      {
        "period": "2023-09",
        "currency": "EUR",
        "row_count": "603",
        "qty_sum": "1050.91",
        "amount_sum": "211385.2200"
      },
      {
        "period": "2023-08",
        "currency": "CZK",
        "row_count": "23",
        "qty_sum": "43.35",
        "amount_sum": "15172.5000"
      },
      {
        "period": "2023-08",
        "currency": "EUR",
        "row_count": "572",
        "qty_sum": "1006.01",
        "amount_sum": "202875.5700"
      },
      {
        "period": "2023-07",
        "currency": "CZK",
        "row_count": "17",
        "qty_sum": "32.00",
        "amount_sum": "11200.0000"
      },
      {
        "period": "2023-07",
        "currency": "EUR",
        "row_count": "547",
        "qty_sum": "930.15",
        "amount_sum": "155888.0700"
      },
      {
        "period": "2023-06",
        "currency": "CZK",
        "row_count": "31",
        "qty_sum": "59.28",
        "amount_sum": "20748.0000"
      },
      {
        "period": "2023-06",
        "currency": "EUR",
        "row_count": "585",
        "qty_sum": "1022.90",
        "amount_sum": "172577.5300"
      },
      {
        "period": "2023-05",
        "currency": "CZK",
        "row_count": "49",
        "qty_sum": "90.48",
        "amount_sum": "31668.0000"
      },
      {
        "period": "2023-05",
        "currency": "EUR",
        "row_count": "722",
        "qty_sum": "1297.03",
        "amount_sum": "250698.9400"
      }
    ]
  },
  "legacyTableFlags": {
    "lesson": true,
    "support": true
  },
  "note": "Lesson rows keep lessonUuid null until education-service backfill; see SALARY_DATA_MAPPING.md. Historical courses_* lesson expense tables are counted only — not merged into this ETL."
}
```

## Run 2026-04-13T22:31:33.852Z

```json
{
  "dryRun": false,
  "load": true,
  "stats": {
    "salaryProfiles": 386,
    "salaryExpenseBaseRows": 104956,
    "lessonSalaryExpenseRows": 99484,
    "supportBonusRows": 179,
    "employeeContracts": 632,
    "authUsers": 214109,
    "contractsUserMissingAuth": 0,
    "expensesUserWithoutProfile": 1338,
    "lessonExpenseMissingLesson": 0,
    "courseSingleLessonSalaryRows": 24152,
    "courseGroupLessonSalaryRows": 1250
  },
  "transform": {
    "salaryProfiles": 386,
    "salaryExpenses": 103618,
    "employeeContracts": 632,
    "expensesSkippedNoProfile": 1338,
    "payrollPeriodRows": 244,
    "payrollPeriodSample": [
      {
        "period": "2026-04",
        "currency": "CZK",
        "row_count": "1",
        "qty_sum": "1.00",
        "amount_sum": "350.0000"
      },
      {
        "period": "2026-04",
        "currency": "EUR",
        "row_count": "45",
        "qty_sum": "44.00",
        "amount_sum": "645.0000"
      },
      {
        "period": "2026-03",
        "currency": "CZK",
        "row_count": "20",
        "qty_sum": "36.00",
        "amount_sum": "26675.0000"
      },
      {
        "period": "2026-03",
        "currency": "EUR",
        "row_count": "187",
        "qty_sum": "350.00",
        "amount_sum": "5136.0000"
      },
      {
        "period": "2026-02",
        "currency": "CZK",
        "row_count": "8",
        "qty_sum": "10.80",
        "amount_sum": "25445.0000"
      },
      {
        "period": "2026-02",
        "currency": "EUR",
        "row_count": "250",
        "qty_sum": "468.45",
        "amount_sum": "93649.3200"
      },
      {
        "period": "2026-01",
        "currency": "CZK",
        "row_count": "11",
        "qty_sum": "17.66",
        "amount_sum": "26189.4000"
      },
      {
        "period": "2026-01",
        "currency": "EUR",
        "row_count": "130",
        "qty_sum": "227.60",
        "amount_sum": "8032.8300"
      },
      {
        "period": "2025-12",
        "currency": "CZK",
        "row_count": "5",
        "qty_sum": "6.75",
        "amount_sum": "25347.5000"
      },
      {
        "period": "2025-12",
        "currency": "EUR",
        "row_count": "210",
        "qty_sum": "384.51",
        "amount_sum": "28412.8900"
      },
      {
        "period": "2025-11",
        "currency": "CZK",
        "row_count": "6",
        "qty_sum": "6.85",
        "amount_sum": "25382.5000"
      },
      {
        "period": "2025-11",
        "currency": "EUR",
        "row_count": "268",
        "qty_sum": "496.22",
        "amount_sum": "81891.0200"
      },
      {
        "period": "2025-10",
        "currency": "CZK",
        "row_count": "8",
        "qty_sum": "10.63",
        "amount_sum": "26705.5000"
      },
      {
        "period": "2025-10",
        "currency": "EUR",
        "row_count": "354",
        "qty_sum": "661.73",
        "amount_sum": "100877.6000"
      },
      {
        "period": "2025-09",
        "currency": "CZK",
        "row_count": "8",
        "qty_sum": "12.73",
        "amount_sum": "27440.5000"
      },
      {
        "period": "2025-09",
        "currency": "EUR",
        "row_count": "338",
        "qty_sum": "619.14",
        "amount_sum": "72781.5500"
      },
      {
        "period": "2025-08",
        "currency": "CZK",
        "row_count": "18",
        "qty_sum": "32.47",
        "amount_sum": "34349.5000"
      },
      {
        "period": "2025-08",
        "currency": "EUR",
        "row_count": "297",
        "qty_sum": "526.04",
        "amount_sum": "94441.8100"
      },
      {
        "period": "2025-07",
        "currency": "CZK",
        "row_count": "16",
        "qty_sum": "28.85",
        "amount_sum": "33082.5000"
      },
      {
        "period": "2025-07",
        "currency": "EUR",
        "row_count": "353",
        "qty_sum": "636.29",
        "amount_sum": "85816.9800"
      },
      {
        "period": "2025-06",
        "currency": "CZK",
        "row_count": "20",
        "qty_sum": "36.80",
        "amount_sum": "35865.0000"
      },
      {
        "period": "2025-06",
        "currency": "EUR",
        "row_count": "374",
        "qty_sum": "665.61",
        "amount_sum": "49601.4500"
      },
      {
        "period": "2025-05",
        "currency": "CZK",
        "row_count": "23",
        "qty_sum": "39.75",
        "amount_sum": "36897.5000"
      },
      {
        "period": "2025-05",
        "currency": "EUR",
        "row_count": "417",
        "qty_sum": "744.18",
        "amount_sum": "62230.3700"
      },
      {
        "period": "2025-04",
        "currency": "CZK",
        "row_count": "23",
        "qty_sum": "42.63",
        "amount_sum": "37905.5000"
      },
      {
        "period": "2025-04",
        "currency": "EUR",
        "row_count": "413",
        "qty_sum": "745.60",
        "amount_sum": "61796.6700"
      },
      {
        "period": "2025-03",
        "currency": "CZK",
        "row_count": "28",
        "qty_sum": "50.80",
        "amount_sum": "40765.0000"
      },
      {
        "period": "2025-03",
        "currency": "EUR",
        "row_count": "420",
        "qty_sum": "745.61",
        "amount_sum": "70703.5300"
      },
      {
        "period": "2025-02",
        "currency": "CZK",
        "row_count": "38",
        "qty_sum": "67.04",
        "amount_sum": "32515.8000"
      },
      {
        "period": "2025-02",
        "currency": "EUR",
        "row_count": "414",
        "qty_sum": "736.72",
        "amount_sum": "90155.7400"
      },
      {
        "period": "2025-01",
        "currency": "CZK",
        "row_count": "24",
        "qty_sum": "44.90",
        "amount_sum": "38700.0000"
      },
      {
        "period": "2025-01",
        "currency": "EUR",
        "row_count": "401",
        "qty_sum": "673.84",
        "amount_sum": "96598.2900"
      },
      {
        "period": "2024-12",
        "currency": "CZK",
        "row_count": "25",
        "qty_sum": "39.78",
        "amount_sum": "34458.0000"
      },
      {
        "period": "2024-12",
        "currency": "EUR",
        "row_count": "403",
        "qty_sum": "721.39",
        "amount_sum": "146706.4800"
      },
      {
        "period": "2024-11",
        "currency": "CZK",
        "row_count": "19",
        "qty_sum": "34.67",
        "amount_sum": "35119.5000"
      },
      {
        "period": "2024-11",
        "currency": "EUR",
        "row_count": "464",
        "qty_sum": "793.83",
        "amount_sum": "137850.6700"
      },
      {
        "period": "2024-10",
        "currency": "CZK",
        "row_count": "11",
        "qty_sum": "19.25",
        "amount_sum": "6737.5000"
      },
      {
        "period": "2024-10",
        "currency": "EUR",
        "row_count": "448",
        "qty_sum": "509.82",
        "amount_sum": "82588.9700"
      },
      {
        "period": "2024-09",
        "currency": "CZK",
        "row_count": "13",
        "qty_sum": "23.59",
        "amount_sum": "8256.5000"
      },
      {
        "period": "2024-09",
        "currency": "EUR",
        "row_count": "389",
        "qty_sum": "417.89",
        "amount_sum": "80860.4000"
      },
      {
        "period": "2024-08",
        "currency": "CZK",
        "row_count": "30",
        "qty_sum": "56.81",
        "amount_sum": "19883.5000"
      },
      {
        "period": "2024-08",
        "currency": "EUR",
        "row_count": "356",
        "qty_sum": "392.44",
        "amount_sum": "98491.8400"
      },
      {
        "period": "2024-07",
        "currency": "CZK",
        "row_count": "42",
        "qty_sum": "79.51",
        "amount_sum": "27828.5000"
      },
      {
        "period": "2024-07",
        "currency": "EUR",
        "row_count": "455",
        "qty_sum": "825.08",
        "amount_sum": "262763.9800"
      },
      {
        "period": "2024-06",
        "currency": "CZK",
        "row_count": "32",
        "qty_sum": "60.00",
        "amount_sum": "21000.0000"
      },
      {
        "period": "2024-06",
        "currency": "EUR",
        "row_count": "440",
        "qty_sum": "787.76",
        "amount_sum": "158264.9600"
      },
      {
        "period": "2024-05",
        "currency": "CZK",
        "row_count": "34",
        "qty_sum": "63.91",
        "amount_sum": "22368.5000"
      },
      {
        "period": "2024-05",
        "currency": "EUR",
        "row_count": "451",
        "qty_sum": "800.71",
        "amount_sum": "286748.9600"
      },
      {
        "period": "2024-04",
        "currency": "CZK",
        "row_count": "16",
        "qty_sum": "25.19",
        "amount_sum": "8816.5000"
      },
      {
        "period": "2024-04",
        "currency": "EUR",
        "row_count": "544",
        "qty_sum": "953.08",
        "amount_sum": "293415.6100"
      },
      {
        "period": "2024-03",
        "currency": "CZK",
        "row_count": "8",
        "qty_sum": "13.51",
        "amount_sum": "4728.5000"
      },
      {
        "period": "2024-03",
        "currency": "EUR",
        "row_count": "550",
        "qty_sum": "966.89",
        "amount_sum": "275617.3600"
      },
      {
        "period": "2024-02",
        "currency": "CZK",
        "row_count": "22",
        "qty_sum": "39.90",
        "amount_sum": "13965.0000"
      },
      {
        "period": "2024-02",
        "currency": "EUR",
        "row_count": "554",
        "qty_sum": "961.43",
        "amount_sum": "262113.9500"
      },
      {
        "period": "2024-01",
        "currency": "CZK",
        "row_count": "17",
        "qty_sum": "27.77",
        "amount_sum": "9719.5000"
      },
      {
        "period": "2024-01",
        "currency": "EUR",
        "row_count": "532",
        "qty_sum": "926.28",
        "amount_sum": "216498.0000"
      },
      {
        "period": "2023-12",
        "currency": "CZK",
        "row_count": "11",
        "qty_sum": "17.62",
        "amount_sum": "6167.0000"
      },
      {
        "period": "2023-12",
        "currency": "EUR",
        "row_count": "511",
        "qty_sum": "879.30",
        "amount_sum": "227318.7300"
      },
      {
        "period": "2023-11",
        "currency": "CZK",
        "row_count": "24",
        "qty_sum": "41.99",
        "amount_sum": "14696.5000"
      },
      {
        "period": "2023-11",
        "currency": "EUR",
        "row_count": "593",
        "qty_sum": "1046.75",
        "amount_sum": "218457.5100"
      },
      {
        "period": "2023-10",
        "currency": "CZK",
        "row_count": "14",
        "qty_sum": "25.38",
        "amount_sum": "8883.0000"
      },
      {
        "period": "2023-10",
        "currency": "EUR",
        "row_count": "652",
        "qty_sum": "1175.83",
        "amount_sum": "272894.6400"
      },
      {
        "period": "2023-09",
        "currency": "CZK",
        "row_count": "12",
        "qty_sum": "21.66",
        "amount_sum": "7581.0000"
      },
      {
        "period": "2023-09",
        "currency": "EUR",
        "row_count": "603",
        "qty_sum": "1050.91",
        "amount_sum": "211385.2200"
      },
      {
        "period": "2023-08",
        "currency": "CZK",
        "row_count": "23",
        "qty_sum": "43.35",
        "amount_sum": "15172.5000"
      },
      {
        "period": "2023-08",
        "currency": "EUR",
        "row_count": "572",
        "qty_sum": "1006.01",
        "amount_sum": "202875.5700"
      },
      {
        "period": "2023-07",
        "currency": "CZK",
        "row_count": "17",
        "qty_sum": "32.00",
        "amount_sum": "11200.0000"
      },
      {
        "period": "2023-07",
        "currency": "EUR",
        "row_count": "547",
        "qty_sum": "930.15",
        "amount_sum": "155888.0700"
      },
      {
        "period": "2023-06",
        "currency": "CZK",
        "row_count": "31",
        "qty_sum": "59.28",
        "amount_sum": "20748.0000"
      },
      {
        "period": "2023-06",
        "currency": "EUR",
        "row_count": "585",
        "qty_sum": "1022.90",
        "amount_sum": "172577.5300"
      },
      {
        "period": "2023-05",
        "currency": "CZK",
        "row_count": "49",
        "qty_sum": "90.48",
        "amount_sum": "31668.0000"
      },
      {
        "period": "2023-05",
        "currency": "EUR",
        "row_count": "722",
        "qty_sum": "1297.03",
        "amount_sum": "250698.9400"
      }
    ]
  },
  "legacyTableFlags": {
    "lesson": true,
    "support": true
  },
  "note": "Lesson rows keep lessonUuid null until education-service backfill; see SALARY_DATA_MAPPING.md. Historical courses_* lesson expense tables are counted only — not merged into this ETL."
}
```
