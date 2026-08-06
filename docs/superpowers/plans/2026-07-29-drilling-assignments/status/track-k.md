# Track K — Rollout

**State:** COMPLETE for K.1–K.3 and K.5. **K.4 (browser reproduction) NOT RUN — see below.**
**Date:** 2026-08-06 · **Deploy tag:** `faffc0f`
**Plan:** [`../14-rollout.md`](../14-rollout.md)

---

## The plan was written against a state that had already moved

Track K was documented as not started, but production disagreed. Before this
session, services were already running image `f430482` — the newest drills
commit — and `speakasap_education_db` held **5 COMPLETED and 1 CANCELLED**
assignment. Real students had finished real drills.

So K.1 (migrations) and K.3 (deploys) had effectively happened through the
ordinary per-commit deploy flow. Nobody wrote the status file, which is why the
plan still read as untouched.

**What had genuinely never run was K.2, the data migrations.** All 40 drill
items in production were `sourceType = AI`. The imported grammar and
course-material banks were empty, and `CourseVocabulary` had zero rows.

## Two errors in the plan's own verification steps

Both would make a correct system look broken:

1. **Database names.** The plan says `speakasap_content` and
   `speakasap_education`. The real names carry a `_db` suffix. The plan's
   commands fail with `database "speakasap_content" does not exist`.

2. **Table name case.** The plan's verification SQL looks for `drill_item`,
   `drill_set` and so on. At the time, `content-service` had *no* `@@map`
   directives, so Postgres held PascalCase names — `"DrillItem"`. The
   verification query returned zero rows against a fully populated database.

Item 2 is fixed for good: see the rename below. Item 1 is corrected in
`14-rollout.md`.

Also wrong: `backups-microservice/scripts/backup-db.sh` does not exist. The
backup was taken with `pg_dump` through the postgres pod, as the plan's own
fallback instructs. Note the pod superuser is `dbadmin`, not `postgres`.

---

## K.1 — Migrations

Already applied before this session. Confirmed present in `_prisma_migrations`:

| Database | Migration |
|---|---|
| `speakasap_content_db` | `20260730014739_drill_bank` |
| `speakasap_content_db` | `20260730152915_course_vocabulary` |
| `speakasap_content_db` | `20260801093000_drill_library` |
| `speakasap_education_db` | `20260731044037_drill_assignments` |
| `speakasap_education_db` | `20260803120000_drill_notification_timestamps` |

## K.2 — Data migrations (the actual gap; run this session)

Backup first: `backups/speakasap_content_db-pre-k2-20260806-142727.sql`,
3.6 MB, 21 tables, 21 `COPY` blocks — verified before any write.

| Step | Result |
|---|---|
| `import-grammar-bank.ts --dry-run` | 19 files, 903 classes, 24,102 insertable |
| `import-grammar-bank.ts` apply | **inserted 24,102**, 114 dup-in-batch, 592 skipped no-blanks |
| Grammar re-run (idempotence gate) | **inserted 0**, 24,216 duplicateInDb — hash stable ✅ |
| `import-seven-bank.ts --dry-run` | 20 files, 382 classes, 3,477 insertable |
| `import-seven-bank.ts` apply | **inserted 3,477**, 3 dup, 85 skipped no-blanks |
| Seven re-run (idempotence gate) | **inserted 0**, 3,480 duplicateInDb — hash stable ✅ |
| `build-course-vocabulary.ts` | **45,077 rows** across 19 courses |

### Vocabulary coverage (courseKey | total | @1 | @2 | @3 | @4 | @5)

```
seven:english:ru      1347   242   498   569   600   749
seven:french:ru       2039   464   734   935  1159  1603
seven:german:ru       2274   287   545   890  1315  1665
seven:swedish:ru      3542   634   911  1471  2390  2838
seven:spanish:ru      1545   380   525   661   937  1187
seven:italian:ru      1891   480   680   894  1218  1469
seven:portuguese:ru   1357   424   569   695   931  1151
seven:czech:ru        2538   428   636  1559  1740  1857
seven:polish:ru       2784   607   940  1334  1698  2017
seven:slovak:ru       2412   564   793  1362  1604  1902
seven:dutch:ru        1993   363   618   937  1156  1486
seven:finnish:ru      1152   308   501   626   853   879
seven:norwegian:ru    2989   606   850  1255  1716  2330
seven:danish:ru       3274   570   780  1390  1915  2580
seven:turkish:ru      2713   578   809  1075  1448  1736
seven:greek:ru        4788   862  1499  2171  2646  3707
seven:chinese:ru      2093   511   712   970  1223  1493
seven:russian:fr      2386   771  1060  1483  1758  1963
seven:japanese:ru     1960   773   994  1290  1444  1647
```

**`coursesWithNoBaseline: []` and `coursesTooThinAtLesson5: []`.** The plan asked
to name every course under 50 words at lesson 5 — there are none. The lowest is
english at 749. The regeneration over-trigger risk described in Track D is
resolved: it was caused by the table being empty, not by thin courses.

### K.2 sanity checks

```
sourceType      BANK_GRAMMAR 24102 · BANK_SEVEN 3477 · AI 40   (total 27,619)
zero_blanks     0        ✅ must be 0
hashes_unique   t        ✅ must be true
drill_topic     547 rows (self-populated during import)
```

## Schema rename — content-service to snake_case

Owner-approved this session, all 20 models. `content-service` had 20/20 models
unmapped while `education-service` had 12/12 mapped to snake_case.

**Prisma's auto-diff for this rename emits 20 `DROP TABLE` + 20 `CREATE TABLE`
and zero `RENAME`.** Applying it would have destroyed 72,700 live rows. The
migration `20260806143845_snake_case_table_names` is therefore hand-written:
20 `ALTER TABLE … RENAME TO`, plus 41 constraint renames and 38 index renames
so future diffs report no drift. Verified to contain no `DROP`.

**Do not regenerate this migration.**

Tested on a scratch DB restored from a schema-only dump before production:
migration applied clean, seed row survived, 21 FKs intact, and
`migrate diff` afterwards reported *"This is an empty migration"* — zero drift.

Production result — every row count preserved:

```
pascal_left 0 · drill_item 27619 · course_vocabulary 45077 · drill_topic 547
seven_exercise 429 · seven_lesson 136 · language 19 · drill_set 7 · fks 21
```

No application code changed: `@@map` alters only the physical table name, and
the Prisma Client API (`prisma.drillItem`) is untouched. `tsc --noEmit` clean.

## K.3 — Deploy

`shared/scripts/deploy.sh speakasap` at `faffc0f`. Note `speakasap/scripts/deploy.sh`
is retired and prints a pointer to the shared runner.

The runner deploys the whole monorepo — all 13 services move to the new tag,
not just the changed one. All rollouts converged; total 272 s.

## K.5 — Post-rollout checks

- `speakasap-content` pod `1/1 Running`, zero restarts, no errors in logs.
- Live endpoints exercised against the **renamed** tables, via `api/v1` prefix
  on port 4201 (not 3000 — the plan does not state either):
  - `GET /api/v1/drill-languages` → 19 languages ✅
  - `GET /api/v1/drill-topics` → real topic rows ✅
  - `GET /api/v1/drill-sets` → real approved set ✅
- No `relation … does not exist` anywhere after the rename.
- Stuck-assignment check: `drill_assignment` holds COMPLETED 5, CANCELLED 1 —
  zero in `GENERATING`, so nothing is stuck.

---

## Not done — K.4 browser reproduction

**The full user journey in a real browser was not run.** Everything above is
service-level and SQL-level evidence. K.4 step 5 — proving the runner response
contains no `answer` or `alternatives` key — is called out in the plan as *"the
single most important verification in this task"* and it remains unperformed.

This does not block what shipped: the drills flow was already live and serving
students before this session, and the changes here were additive data plus a
rename with no API surface change. But K.4 should be run before the feature is
called fully verified.

Remaining from the plan:

- K.4 steps 1–7, in a browser via Playwright MCP.
- Track E's own doc still says "not yet deployed" — its commits are in the
  running image, so that line is stale and should be corrected when K.4 confirms
  the learner UI end to end.
