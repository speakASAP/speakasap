# Track K — Rollout

**State:** K.1, K.2, K.3, K.5 COMPLETE. **K.4 COMPLETE** — every step now has
evidence. Steps 1–4 and 6 were driven through the owner's own signed-in session
on 2026-08-07; steps 5 and 7 were already proven. See §K.4.
**Date:** 2026-08-07 · **Deploy tag:** `bec78df`
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

## K.3b — Deploy at `fcd349d` (2026-08-07)

Owner-approved. `shared/scripts/deploy.sh speakasap` moved 12 services to
`fcd349d` in 264 s, all rollouts converged.

**The shared runner does not deploy the frontend, and reports success anyway.**
`speakasap-frontend` stayed on `098d74f` while everything else advanced — and
`fcd349d` changes *exactly one file*, `frontend/app/learner/practice/page.tsx`.
So the run shipped 12 unchanged services and skipped the only changed one. The
tell was "Build and push images: 10.69 s", far too fast for a Next.js build.

This is deliberate, not a bug: `deploy.config.sh:62-70` excludes
`speakasap-frontend` because `scripts/deploy-frontend.sh` owns it and computes
its own tag; declaring it twice would give one deployment two build paths.

**Anyone deploying a frontend change must therefore run both:**

```
shared/scripts/deploy.sh speakasap                              # services
shared/scripts/with-deploy-lock.sh ./scripts/deploy-frontend.sh # frontend
```

The second was run under the deploy lock. `speakasap-frontend` is now on
`fcd349d`, converged via `wait-for-rollout.sh`, one pod desired/ready — the
second pod seen briefly was the prior ReplicaSet draining
(`deletionTimestamp` set, RS scaled to 0).

Verified in the *served* bundle rather than trusting the green banner: the
minified client chunk contains `d||h?null:(…)`, i.e. loading-or-error
short-circuits both sections to `null`, with `Loading…` as its own branch.

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

## K.4 — PARTIAL. Step 5 proven; the signed-in journey is not.

### Step 5, the answer-leak check: **PASS**

The plan calls this the single most important verification in the track. It is
proven three ways, against production data rather than fixtures.

**The real projection over a real production row.** Item taken verbatim from
`speakasap_content_db.drill_item` (answers `habe` / `gemacht`), pushed through the
deployed `toRunnerItem`:

```
WIRE: {"segments":[{"type":"text","value":"Ich ___ das ___."}],
       "blanks":[{"index":0,"prompt":"have done","maxLength":10,"solved":false,"solvedText":null},
                 {"index":1,"prompt":"done","maxLength":13,"solved":false,"solvedText":null}],
       "hint":null}

has "answer" key      : false
has "alternatives" key: false
answer values leaked  : NONE
```

**The guard was proven by breaking it,** not by trusting a green run. Adding
`answer` to the blank DTO turned 4 of 9 tests red, including *"contains no answer
string across the whole response"*. Reverted; 9/9 green again; working tree clean.

**`maxLength` is derived, not the answer.** 10 and 13 for 4- and 7-character
answers — headroom is added so the box is not a length oracle.

### Step 7, server-side half: **PASS**

`self-drill.service.spec.ts` 9/9, including *"enforces the gate with no UI
involvement whatsoever"*. The refusal is `ConflictException` / 409 /
`ASSIGNMENT_OUTSTANDING`, thrown in the service, not the controller or the UI.

### Steps 1, 2, 3, 4, 6: **PASS** (2026-08-07)

Driven through the owner's own signed-in Chrome. The owner is both the real
teacher and the real student here and authorised using their account, so no
dedicated test identity was needed.

**Connecting the browser.** The Playwright plugin ships as bare
`npx @playwright/mcp@latest`, which launches its own empty browser and ignores
the user's. It must be given the DevTools endpoint —
`--cdp-endpoint http://127.0.0.1:9222` in
`~/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/playwright/.mcp.json`
— against a Chrome started with `--remote-debugging-port=9222`. Without this the
session looks logged out and every probe returns 401.

| Step | Evidence |
|---|---|
| 1. SSO handoff | «Создать тренировку» → `/auth/handoff?sso=…` → wizard landed **prefilled and authenticated**: student pre-checked, lesson pre-selected, Next enabled |
| 2. Topics | 74 topics loaded; Next correctly disabled until one is picked |
| 3. Generation phases | Live: "Generating 6 more item(s)", progress bar, "0 of 6", then redirect to review |
| 4. Review + approve | 6 items, all PENDING, Approve enabled, approval delivered the set to the student |
| 6. Runner | Wrong answer `habe geverstehen` → hint "Не получается? Можно показать ответ"; correct `habe verstanden` → "Correct", progress 1/6 |

Generation quality was sound: all six verbs were genuinely untrennbar without
`ge-` (verstehen, erklären, besuchen, versprechen, vergessen, bezahlen), exactly
the lesson's topic.

**Answer-leak re-checked against this live assignment.** The runner payload
carries no `answer` and no `alternatives`; `solvedText` is null. The string
`vergessen` does appear, but as the infinitive inside the glossary hint
(`(vergessen – забывать)`) while the answer is `hast vergessen` — a deliberate
partial overlap, not a leak.

**The self-drill gate reads correctly in the UI too**, naming the blocking
assignment: "Finish your assignment "…" before practising on your own."

### Flag sorting and the Approve gate: proven by test, not by browser

Step 4's remaining assertions — FAIL items sorting first, Approve disabled while
a FAIL is open — could not be driven in the browser because generation never
produced a FAIL. Rather than write a FAIL into production by hand, they were
verified where they are already covered:
`frontend/lib/drills/teacher/ReviewList.test.tsx`, 13/13 green.

Both tests were confirmed to *fail* when the logic is broken — `byState` forced
to 0 and `hasUnresolvedFailure` forced to false turned exactly
*"orders FAIL, then WARN, then PASS"* and *"disables approve while any FAIL is
unresolved"* red, and nothing else. File restored, tree clean.

**Correction:** commit `3efbb83` records "no test runner" for the frontend. That
is wrong — `frontend` runs **vitest** (`npm test` → `vitest run`). The runner
exists and these tests were run with it.

### Correction: there is no token-attachment bug

An earlier note in this session suspected the frontend was not sending its
bearer token, after `/api/v1/auth/me` returned 401 `Missing bearer token` while
a valid token sat in `localStorage`. **That was wrong.** The 401s came from raw
`fetch` calls typed into the console, which send no `Authorization` header.
`frontend/lib/drills/runner/api.ts:80-83` reads `getAuthSession()?.accessToken`
and sets `Authorization: Bearer …`; `lib/auth-session.ts` reads the same
`speakasap.auth.tokens` blob. The client is correct. Do not chase this.

Any future browser probing must go through the app's own client, not bare
`fetch`, or it will manufacture the same false 401.

Unverified as a result: the SSO handoff landing prefilled, generation phases
appearing live, flagged items sorting first with Approve disabled while a FAIL is
open, the wrong-then-right answer interaction, and both notification emails.

### What the browser did confirm, unauthenticated

`/learner/practice` and `/teacher/assignments/new` both render, both fail closed
on 401, and the teacher wizard correctly disables **Next**. No score appears on
either page.

## Bug found: contradictory empty state on the learner practice page

`app/learner/practice/page.tsx` — when the assignments fetch rejects, the `.catch`
sets `error` but never sets `allowed`, which keeps its falsy initial value. The
page then renders all three at once:

```
"Could not load your practice. Please refresh."
"Nothing assigned right now."
"Finish your current assignment before practising on your own."
```

Nothing is assigned, yet self-practice claims to be locked by an outstanding
assignment. Cosmetic and confined to the error path — the server enforces the real
gate — but it tells the student something false. Suggested fix: suppress the
self-drill section entirely while `error` is set, rather than showing a lock
derived from a default.

**FIXED and deployed** in `fcd349d` (2026-08-07). Both sections are now
suppressed while `error` is set, so the error message stands alone; `loading`
keeps its own branch so the three states stay distinct. `tsc --noEmit` clean,
and confirmed present in the deployed bundle (see K.3b).

Note on the reproduction: the contradictory triple was captured on the live
page, but in an *unauthenticated* browser context, where the 401 drove the
`.catch`. It was not observed hitting a signed-in student. The fix stands on the
code path regardless — any fetch rejection (gateway 502, dropped connection,
expired token) reaches the same `.catch`, which sets `error` while leaving
`allowed` false and `outstanding` empty.

## Bug found and fixed: the assignment email was never sent

Driving step 6 surfaced a real production defect. `notified_assigned_at` was
**null on every row the table had ever held**, while `notified_completed_at` was
populated on completed ones.

Cause: `assignApprovedSet` flipped rows to `ASSIGNED` without ever calling
`notifications.onAssigned`. The hook was only wired into `assignSet` — the
reuse-an-existing-set flow. Generate-then-approve, the path a teacher actually
takes, delivered every assignment silently. The hook itself was fine.

Fixed in `bec78df` (`teacher-assignments.service.ts`), with a regression test
that was confirmed to fail without the fix. Verified live: a fresh assignment
recorded `notified_assigned_at = 2026-08-07 10:38:31.373` — the first non-null
value in the table's history.

### Notification policy, owner's decision (2026-08-07)

**Exactly one email leaves the system: the student's, on assign.** The teacher is
no longer emailed on completion.

While verifying this, a stale comment turned out to be wrong in a way worth
recording: `NotificationsClientAdapter.createInApp()` is a **no-op stub**.
notification-service exposes `POST dispatch/email` and nothing else — its
`in-app` controller reads and marks read but cannot create, and
`in_app_notifications` is empty. So "in-app only" was never a real channel;
`onCompleted` now delivers nothing at all, which is what the owner chose once
this was clear. A genuine in-app route would be new work in two services.

## Test data cleanup

The two assignments created during this verification were deleted on 2026-08-07:
`79e63ea4` (IN_PROGRESS, 1/6) and `a67f85fc` (ASSIGNED). Removed 2 assignments,
8 items, 4 attempts in one transaction. Backup taken first:
`backups/drill-test-assignments-pre-delete-20260807-210505.sql` (353 inserts).
The owner's real work is untouched — 5 COMPLETED and 1 CANCELLED remain.

## Still outstanding

**Nothing in Track K.** Every step of K.1–K.5 has evidence, the learner practice
empty-state bug is fixed and live, and the assignment-email bug found during
verification is fixed and confirmed in production.

Two notes for whoever picks this up next, neither blocking:

- No FAIL item has ever been observed from live generation, so the flagged-item
  path is proven by test rather than in production. If one appears naturally,
  it is worth walking the review screen once.
- A real in-app notification channel does not exist. If the teacher should ever
  learn about completions in the portal, that is new work in notification-service
  plus a caller change here.
