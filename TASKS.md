# SpeakASAP Orchestrator Tasks

This file is the root task index for the SpeakASAP master orchestrator. Detailed goals and chunk status live in `docs/orchestrator/GOALS.md`; runtime state lives in `docs/orchestrator/IMPLEMENTATION_STATE.md`, `docs/orchestrator/STATE.json`, and root `STATE.json`.

## In progress — Lesson API single source of truth (2026-08-09)

Plan: `docs/superpowers/plans/2026-08-09-lesson-api-single-source-of-truth.md`

Fixes the root cause behind the drilling breakage: education-service read COPIES of
the portal's lesson tables, filled by a one-shot ETL that last ran **2026-06-26**.
Production evidence gathered this session — the copy holds 182,600 lessons ending
2026-06-26; the portal has 182,958. **181 finished lessons are invisible** to this
service.

| Task | State |
|---|---|
| 1–4 portal internal API | Done, committed in speakasap-portal (`5cf666b696`) |
| 5–6 lesson-client | Done (`4cb8a8a`) |
| 7 drill roster → portal | Done (`985c223`) |
| 8 lesson-records → portal | Done (`7375f19`) |
| 9 remaining lesson readers | Done except internal-salary (`7cdebb3`) |
| 10 drop FKs / legacy models / copied tables | **Not started — destructive, gated** |
| 11 verify against the real broken lesson | **Blocked on the portal deploy** |

406 tests green, `tsc --noEmit` clean. Error propagation and the paid-vs-attendance
split were each confirmed to fail when deliberately broken, not merely to pass.

### Wired and live 2026-08-09 — the seam works end to end

Portal deployed at `5cf666b`; token generated and installed on both sides;
education-service manifest applied, ESO synced, deployment restarted and converged.

| Side | Key | State |
|---|---|---|
| speakasap-portal | `PORTAL_INBOUND_API_TOKEN` | **set** in `.env` (backup `.env.backup-lessonapi-*`), gunicorn restarted |
| education-service | `PORTAL_INBOUND_API_TOKEN` | **set** via Vault → ESO → K8s secret, 64 chars in pod |
| education-service | `PORTAL_API_URL` | **set** in ConfigMap → `https://speakasap.com/api/v1/internal` |

Both Vault paths hold the **same** value (compared, matched). All 11 pre-existing keys
under `secret/prod/speakasap/education` survived the patch — no `put` clobber.

### Task 11 — Steps 1, 2 and 6 PASS

Reference lesson `f249c6e4-e6ef-451d-a1b0-c4fb0a3b4477`, the one the teacher reported:

- **Root cause, both sides.** `education_lesson`: **0 rows**. Portal: exists,
  `teacher_id 182`, start 2026-08-12, group `0c5c3ea8-…`, student **215116**.
- **Step 1 — lesson endpoint:** serves JSON with the correct token.
- **Step 2 — roster endpoint:** `teacher_id 182`, `student_ids [215116]`,
  `paid_student_ids [215116]` — non-empty, as required.
- **From inside the pod:** education-service reached the portal and got that same
  roster. This is the decisive check — the exact call that used to return an empty
  list now returns the student.
- **Step 6 — failures are loud:** an unreachable portal raises rather than yielding a
  roster. The unit-test half of this was proven by breaking the code and watching the
  propagation tests go red, not by a passing run alone.

**Security check (not in the plan, worth keeping).** No token, a wrong token and an
empty token were all tried against the live endpoint: every one returned **zero lesson
data**. Only the correct token returns JSON.

But note **the refusal returns HTTP 200, not 401** — `CustomLoginRequiredMiddleware`
serves the login page ahead of DRF. The plan's "401 means the token does not match" is
wrong on this host. Check the response **body**, not the status. Recorded in
`docs/LESSON_API_OPERATIONS.md`.

### The image was stale — config was necessary but not sufficient

After the token was installed, the wizard still showed **"No students found for this
lesson"**. Cause: `speakasap-education` was pinned to `:latest`, so the earlier
`rollout restart` re-pulled the **pre-fix image**. The pod had no `dist/lesson-client/`
and no `getRoster` — Tasks 7-9 were committed but never built.

Rebuilt and deployed at tag `69187de`; the image now contains both. Verified by
inspecting the pod's `dist/`, not by trusting the deploy banner — note the run reported
"Build and push images: 15.03s", the same too-fast tell Track K recorded for the
frontend.

### Verified in the deployed image (2026-08-09)

Run against the real deployed code inside the pod, for the reported lesson:

```
students: [{"id":215116,"name":"Kovy","groupUuids":["0c5c3ea8-…"]}]
groups:   [{"uuid":"0c5c3ea8-…","name":"260713-EN-Чудовский","studentIds":[215116]}]
total: 1  teacherId: 182
```

- **The reported failure is fixed.** The lesson that rendered "No students found" now
  returns student **215116 ("Kovy")**, with the name resolved through auth-microservice.
- **The bug class is closed.** An unknown lesson raises `LessonNotFoundError` rather
  than returning an empty roster — checked live, not only in tests.
- **lesson-records has what it needs:** `getLesson` returns teacher 182 / start
  2026-08-12, and the roster distinguishes `paidStudentIds` from `studentIds`.

### Two further defects the browser check exposed (2026-08-09)

Fixing the roster surfaced the wizard showing **the wrong student's name**. Both are
fixed and deployed.

**1. Student.id vs User.id — a privacy defect.** The portal has two numerically
overlapping id spaces. Student 215116 is *Tetiana Kovach* (user 314082); User 215116 is
an unrelated person, and their name was displayed against Tetiana's lesson. Every
consumer expects the **user** id — auth's `legacyUserId`, `drill_assignment.student_id`,
and the portal's own `drills_client.py`. Fixed in the roster endpoint (`d10e6e7e74`) and
the wizard link (`56ba7e7389`); always traverse `Student → user_id`.

**2. Names missing for recent registrations.** auth holds only users migrated up to
legacy id 314012, so Tetiana (registered 2026-07-13) had no auth record and the wizard
rendered "Student 314082". ~113 portal users are in that state. The roster now carries
`students: [{id, name}]` and education-service prefers auth, falling back to the portal
(`714a44e94c`, `e7d9b0c`). A rising `named_by_portal` in the roster log means the auth
migration is falling further behind.

Deployed image `e7d9b0c` returns:
`[{"id":314082,"name":"Tetiana Kovach","groupUuids":["0c5c3ea8-…"]}]`

### 3. Wizard hardcoded German for every course (2026-08-09)

The topic picker offered `adjektivgruppen` and `nullartikel` on an **English** course.
`frontend/app/teacher/assignments/new/page.tsx` called `listTopics('de', 'ru')` and
generated with `languageCode: 'de'` — so *every* course was treated as German. The
picker was the visible half; the serious half is that **generation would have produced
German drills for a student learning English**.

The lesson already knows its language: `module_class` is
`course_materials.data.<material>.<target>` — the same segment the portal's own
`panel_language` reads. `courseLanguageOf()` parses it against the 19 codes
content-service actually holds, since they are not all ISO (`cz`, `se`, `dk`, `gr`,
`jp`, `cn`) and a segment like `_demo` must not pass as one. The roster now carries
`languageCode`/`materialLanguage` and the wizard uses them.

**Unknown is surfaced, never guessed.** 11,716 production lessons are `extra_lessons`
courses naming no pair: the picker stays empty and the teacher types the topic, while
generation refuses with an explanation rather than inventing a language.

Verified on the deployed services — `en|ru` returns 21 English topics
(`future-simple`, `gerund`, `conditional-sentence`); `de|ru` returns the 72 German ones
from the report. Fixed in `509e47b` (education-service **and** frontend, which needs its
own `scripts/deploy-frontend.sh`).

### 4. Cross-database FKs 500'd every new lesson — FIXED and applied

Generating drilling returned HTTP 500:
`Foreign key constraint violated: drill_assignment_lesson_uuid_fkey`.

`drill_assignment.lesson_uuid` and `student_course_uuid` had foreign keys into
`education_lesson` / `education_studentcourse` — the frozen copies. A foreign key cannot
span two databases, so a lesson living only in the portal was rejected on insert.

Migration `20260809220000_drop_drill_cross_database_fks`: two `DROP CONSTRAINT`, no
`DROP TABLE`/`DELETE`/`TRUNCATE`. Hand-written, dry-run on a scratch database restored
from a schema-only dump — the insert **fails without it with the exact reported error and
succeeds with it**. Applied 2026-08-09; `batch_uuid` keeps its FK (local parent), columns
and all 6 rows intact.

**Verified end to end on the deployed image:** `generate()` wrote a real assignment for
lesson `f249c6e4` — student **314082**, `language_code=en`, `material_language=ru`. Both
the identity and language fixes visible in one row. Probe rows were removed afterwards;
`drill_assignment` is back to `6|1|1`.

The deploy script had been refusing to ship education-service with
`PENDING MIGRATIONS` — correctly, rather than leaving code and schema out of step.

### 5. extra_lessons courses do name a language — via the course, not the lesson

The owner's steer was right. Those courses are sold from an offer whose product names
the language, and the resulting `StudentCourse.course_class` records it
(`course_materials.data.ru.it._extra.Course`) even though the lesson's own `module_class`
is only `…data.extra_lessons.ModuleExtraLessonsCourse`.

**All 11,787 extra-lessons lessons resolve through `course_class`; none through
`module_class`.** The portal now exposes it (`98af031d8c`) and `courseLanguageOf` prefers
it, falling back to the module class (`81b4fcc`). Unknown is still surfaced, never
guessed — only which field answers changed.

### 6. Raw HTML in item templates — FIXED and backfilled (2026-08-09)

The review screen showed `<span class="mute">(to walk – идти пешком)</span>` as literal
text, with the same glossary repeated underneath.

The legacy bank importers stored each item's rich-text label verbatim in `template`
while ALSO extracting the trailing glossary into `hint`. Nothing renders `template` as
HTML — deliberately, a bank is not a trusted source of markup — so the tag showed as text
and the glossary appeared twice. **14,659 of 27,627 bank rows**; AI items were clean.

Guarded in two places so it cannot return: both importers sanitize on the way in, and
`SetsService.upsertItem` — the single chokepoint every new item passes through —
sanitizes before deriving `plainText` and `hash`.

Backfill updated **14,643** rows. Backup first:
`backups/drill_item-pre-html-strip-20260809-233500.sql` (17.8 MB, all 27,627 rows).

**Deliberately not touched, and why** — these are reported, never silently mangled:
- **2 rows** with `<input … answer="by">`: the answer lives in an attribute, so stripping
  the tag deletes it. They need converting to `[prompt]{answer}`.
- **5 rows** where the mute span wraps the drill content itself, so stripping would
  destroy the blanks.
- **9 rows** whose cleaned text collides with an existing hash. Merging two rows into one
  is a content decision, not a cleanup's.

### 7. Progress page said "0 / 0" for an unapproved set

Assignment items are copied from the set at **approval**, so a set awaiting review has
none — the page rendered stats over an empty list, reading as "the student did nothing"
when they had never been able to start. Now says so explicitly. `ASSIGNED` with no items
is worded differently on purpose: that is a defect, not a normal state. Fixed in
`e41a09d`.

### The AI timeout: batching would not have helped

Measured on the `smart` tier: **5 items 7.1s · 10 items 11.8s · 20 items 21.4s** — linear,
and far inside the 120 s budget. The item count is not the cost driver, so splitting a
20-sentence request into blocks would not have prevented the timeout. It happened **once
in 24 hours**.

The real risk is tier selection: `CLAUDE_CODE_LITELLM_FALLBACK_MODELS=free,cheap` tries
`free` first, and `free` takes **19.8 s** for the same 10 tokens that `cheap` returns in
**813 ms** — 25x. Two changes worth making, both owner decisions since they affect AI cost
ecosystem-wide:

1. Reorder the fallback to `cheap,free`.
2. Retry once automatically on `AI_HTTP_TIMEOUT` — today a transient timeout surfaces as
   a red banner the teacher must click through.

### Still yours: Steps 3, 4, 5 — the browser

These need a signed-in teacher session, which an agent cannot mint for a real person's
account (students here are real people with graded work):

- **Step 3:** open `https://speakasap.com/teacher/students/215116/lessons/f249c6e4-e6ef-451d-a1b0-c4fb0a3b4477/`,
  start the drill wizard, confirm the picker lists **215116** rather than an empty list.
- **Step 4:** repeat for any lesson with `start > now()` — future lessons were the
  original complaint.
- **Step 5:** open the teacher record view for a lesson created after 2026-06-26 and
  confirm it loads instead of `Lesson not found`.

A passing unit test is not a substitute, and neither is the pod-level check above — it
proves the data path, not the UI.

### Open: internal-salary still reads the frozen lesson table

`internal-salary.service.ts:72` aggregates `prisma.lesson` by teacher and date
range to produce `period-aggregates`, which **salary-service consumes to compute
teacher payouts**. Those 181 invisible lessons are therefore missing from salary
aggregation.

Not fixed here, deliberately: the portal exposes no lessons-by-teacher-and-range
endpoint, so this needs a new endpoint plus verification against real payout
figures — materially larger than a drills fix and touching money. Left reading the
frozen table rather than half-migrated.

### Task 10 is destructive — do not run it casually

It drops the copied tables and the cross-database FKs. The plan gates it behind
Tasks 1–9 merged, the portal API deployed, and Task 11 passing. None of the copied
tables have been dropped yet.

---

## Shipped — Drilling Assignments (2026-08-06, tag `faffc0f`)

Feature is live. Evidence per track in
`docs/superpowers/plans/2026-07-29-drilling-assignments/status/`.

This session ran rollout Track K.2, the data migrations, which had never been
executed — before it, every drill item in production was AI-generated and the
vocabulary baseline was empty, which made generation over-trigger regeneration.

- Imported 24,102 grammar + 3,477 seven bank items; both importers proven
  idempotent on a second run (`inserted: 0`).
- Built 45,077 course-vocabulary rows over 19 courses; no course is thin at
  lesson 5.
- Renamed all 20 `content-service` tables to snake_case (hand-written migration —
  Prisma's auto-diff would have dropped 72,700 rows).
- Backup before any write: `backups/speakasap_content_db-pre-k2-20260806-142727.sql`.

**K.4 partial.** The answer-leak check — the plan's most important verification —
**passes**: the runner payload carries no `answer` or `alternatives` for a real
production item, confirmed by breaking the guard and watching tests go red. The
server-side self-drilling gate passes too (409 `ASSIGNMENT_OUTSTANDING`).

**Blocked on you:** K.4 steps 1–4 and 6 need a signed-in teacher and student.
No test identity exists, and minting a session for a real user's account was
refused — students 3 / teacher 182 are real people with real graded work. Either
provision a dedicated test teacher + student, or drive the browser yourself and
hand over the session.

**Bug found, not fixed** (Track E's file, outside this scope):
`frontend/app/learner/practice/page.tsx` shows "Nothing assigned right now" and
"Finish your current assignment before practising on your own" simultaneously
when the fetch fails — the `.catch` sets `error` but leaves `allowed` at its
falsy default. Cosmetic; the server enforces the real gate.

## Active Task

- Goal 9.6: review draft salary calculation run V2; payout/payment/finalize gates remain closed.

Current gate:

- Goal 9.6 duration apply and approved read-only media recovery probe are complete: 2 probe-successful duration rows were updated with rollback SQL captured, and the 7 remaining salary-scoped rows have no reachable current/canonical/legacy-prefix candidate media objects in the target private bucket.

- Draft salary calculation run V2 `b5d47fb3-e366-4c04-8683-37a51b3c45bf` was created after owner approval; 14 lines, totals CZK 29035 and EUR 21858, zero payout runs, rollback SQL captured. Finalize/payout/payment/rollback remain separately gated.

- Broader salary calculation enablement packet is prepared at `docs/orchestrator/SALARY_BROADER_CALCULATION_ENABLEMENT_APPROVAL.md`; no additional calculation run has been created.

- Post-deploy salary preview on 2026-06-15 recorded 14/14 lines using imported legacy lesson salary hours, 6/6 short-record blockers covered by imported expenses, no new calculation run, and zero payout runs. Broader calculation enablement still needs a separate owner decision and approval packet.
- Education ExternalSecret still lacks `LESSON_RECORD_MEDIA_TOKEN_SECRET`; private media token smoke remains blocked separately from salary.

- Draft salary smoke review on 2026-06-14 accepted run `6576ac90-526e-47c6-8755-9631a4fb3149` only as scoped evidence: 14 draft lines, totals EUR 21858 and CZK 29035, no payout run, no payment disbursement, rollback SQL available but not executed.
- Source salary duration tolerance is now fixed to the documented five-minute rule and guarded by `npm run test:lesson-records`; deploy/rollout was not run and needs owner approval before runtime readiness can be trusted.

- Owner explicitly reprioritized salary after Goal 9 had been paused for Seven; existing Seven work remains preserved and must not be reverted.
- Education salary aggregates now expose demo unpaid/payable counters, readiness metadata, and blocker samples for missing `duration_seconds`, short records, and missing teacher mappings.
- Salary calculation run creation is disabled unless `SALARY_CALCULATION_RUNS_ENABLED=true` and education aggregate readiness has no missing-duration, short-record, teacher-mapping, or dependency-warning blockers.
- Salary payout create/commit is disabled unless `SALARY_PAYOUT_FLOWS_ENABLED=true`.
- No-write readiness command exists: `cd salary-service && npm run check:salary-readiness -- --period <YYYY-MM> --json-report /tmp/speakasap-salary-readiness-<period>.json`.
- Report `/tmp/speakasap-salary-readiness-2026-05.json` recorded `writes=false`, `salaryCalculationReady=false`, `missingDurationCount=0`, `shortRecordCount=6`, `teacherMappingMissingCount=0`, `demoLessonCount=1`, `demoUnpaidLessonCount=0`, and `demoPayableLessonCount=1`.
- The six short-record blocker lesson UUIDs are `d3e59e96-d010-4040-baae-0518e3838dce`, `7355b9de-dbdd-4089-ac8e-ac862b512a64`, `a0508fd4-5195-40eb-9eb7-49daa2348dd7`, `9169ce77-4167-48e6-bb11-d1579964b11a`, `9630fdfc-2c57-4c08-822f-ba85ed339527`, and `4668280d-468c-49a4-b135-91bfbc15fb16`.
- Reconciliation report `/tmp/speakasap-salary-short-record-reconciliation-2026-05.json` recorded `writes=false`: all six short-record rows have legacy/imported salary expense `qty=1.00`, while current target duration recalculation would pay less than one hour.
- The remaining blocker is historical parity policy/implementation, not missing data: calculation previews/runs must preserve imported historical `salary_expenses.qty` for imported lesson salary rows, or owner approval is required to recompute historical salary from MP3 duration.
- Historical imported lesson salary quantity preservation is now implemented in `salary-service/src/calculation-runs/calculation-runs.service.ts`: calculation lines use imported lesson salary expense `qty` hour sums for historical profile/month rows when present and keep the env gate disabled until fresh parity evidence passes.
- No-write preview report `/tmp/speakasap-salary-calculation-preview-2026-05.json` recorded `writes=false`, `profiles=14`, `lines=14`, `linesUsingImportedLessonSalary=14`, and `blockerSamplesCoveredByImportedSalaryExpenses=6`.
- Owner-approved draft calculation smoke created calculation run `6576ac90-526e-47c6-8755-9631a4fb3149` with `14` lines for period `2026-05`.
- Draft calculation report: `/tmp/speakasap-salary-calculation-run-2026-05-v1.json`.
- Rollback SQL: `/tmp/speakasap-salary-calculation-run-rollback-2026-05-v1.sql`.
- Payout runs for the draft calculation: `0`; `SALARY_PAYOUT_FLOWS_ENABLED` remains disabled.
- Do not enable salary calculation runs, payout flows, payment execution, salary writes, destructive operations, or legacy retirement before the readiness report isolates and reconciles the remaining blocker rows and owner approval is recorded.

Paused Seven gate:

- Goal 10.1 content-service schema/API and Goal 10.2 dry-run importer are implemented and statically verified.
- Frontend public routes `/<languageCode>/seven` and `/<languageCode>/seven/<order>` are implemented with legacy typography CSS and gateway-only data loading.
- Current authoritative dry-run `/tmp/speakasap-seven-dry-run-v20.json` recorded `writes=false`, payload `languages=19`, `courses=19`, `lessons=136`, `exercises=429`, no blocking issues, HTML safety ok, and media refs `audio=1076`, `pdf=136`, `video=133`.
- Legacy ordering audit confirmed three courses have 8 rows (`en`, `de`, `cn`) but no duplicate `(course, order)` values; the new schema unique key is compatible with source fixture order.
- Importer exercise ordering now uses numeric filename parsing and `--apply` without gates refuses with status `2` before any DB action.
- Importer payload now stamps course/lesson/exercise metadata with migration batch `seven-content-legacy-20260613`; generated rollback SQL includes the same batch note.
- DB-backed target report now returns planned legacy ID/key counts and will include target ID samples after schema migration creates the seven tables.
- No-write Browser preview QA passed against a temporary mock gateway: course and lesson pages rendered, answer disclosure worked, PDF link was present, reading indicator updated on scroll, and console warnings/errors were empty. Screenshots: /tmp/speakasap-seven-course-preview.png and /tmp/speakasap-seven-lesson-preview.png.
- Seven lesson API payloads now include `pdfHref`, so the frontend consumes the content-service media reference and keeps a fallback only for mock/older payloads.
- Seven lesson detail API payloads now include `previousLesson` and `nextLesson`, and frontend navigation prefers API-owned adjacent lesson summaries with computed fallback.
- Seven course and lesson pages now generate Next metadata from migrated SEO fields with SpeakASAP default fallbacks.
- Seven migration payload/API/frontend types now carry structured `mediaRefs`; dry-run v11 recorded 136 lesson rows, 408 exercise rows, and 1104 unique media refs without writes.
- Seven course and lesson pages now include the legacy app-promo copy block when `appPackage` is present; frontend build passed without writes/deploy.
- Seven importer now migrates legacy Android/iOS app URLs into course metadata; dry-run v12 recorded 18 Android and 17 iOS app URL rows without writes.
- No-write Browser QA verified the app promo render and links on `/en/seven` and `/en/seven/1`; screenshots are `/tmp/speakasap-seven-app-promo-course.png` and `/tmp/speakasap-seven-app-promo-lesson.png`.
- Fresh DB-backed target reconciliation v12 confirmed target DB reachability and expected missing seven tables before schema migration; no writes ran.
- The older `docs/orchestrator/SEVEN_SCHEMA_MIGRATION_APPROVAL.md` packet is superseded; use only `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md` for the active base-schema-plus-seven schema approval wording.
- Target reconciliation now uses full `COUNT(*)` planned-match queries instead of sample-sized counts, so post-data evidence can prove all `19/136/429` imported rows.
- Current pre-schema target reconciliation `/tmp/speakasap-seven-post-schema-reconciliation-fresh-v1.json` correctly fails schema acceptance before approval: seven tables and base `Language` are not queryable, while planned counts remain `19/136/429`.
- Base content schema approval packet is documented in `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`; it covers pending content-service Prisma migrations for schema readiness only, then DB-backed no-write seven reconciliation. The approval action is now `scripts/apply-seven-schema-approved.sh --execute` gated by an exact `SEVEN_SCHEMA_APPROVAL_TEXT` match and it records `/tmp/speakasap-seven-schema-apply-execution-v1.json` after successful schema-only execution. Aggregate readiness `/tmp/speakasap-seven-apply-readiness-v14.json` is `ok=true`, `complete=false`, with schema approval ready, hardened direct Prisma execution contract, clean data apply contract, media approval contract, frontend route contract, content API contract, gateway public access contract, and data/cutover not ready. Schema approval packet freshness is verified by `/tmp/speakasap-seven-schema-migration-plan-v10.json`, `/tmp/speakasap-seven-next-gate-v1.json`, and `/tmp/speakasap-seven-no-write-suite-v20.json`.
- Importer course metadata now includes `legacyLanguageCaseGent` for all 19 seven courses so frontend promo copy can preserve Russian grammatical wording after data apply.
- Salary Goal 9 remains paused, not reverted; existing dirty checkout changes must be preserved.
- Do not run content-service schema migration, seven content data apply, frontend/content deployment, destructive operations, or legacy route retirement without dry-run evidence, build evidence, rollback plan, and explicit owner approval. The importer apply path is implemented but must not be used before the schema migration exists and owner approval is recorded.
- Operator refusal gate: `scripts/check-seven-operator-refusal.py` verifies all runtime operators refuse without `--execute` before external actions.
- No-write validation suite: `scripts/check-seven-no-write-suite.py --json-report /tmp/speakasap-seven-no-write-suite-v22.json` regenerates local contract/readiness/completion reports without DB, network, media, kubectl, build, deploy, or route mutation.
- Runtime approval sequence: `docs/orchestrator/SEVEN_RUNTIME_APPROVAL_SEQUENCE.md` and `/tmp/speakasap-seven-approval-sequence-v1.json` enforce the only valid order: schema -> data -> media -> deploy -> visual QA -> runtime evidence.
- Next-gate preflight: `/tmp/speakasap-seven-next-gate-v1.json` records the next requestable gate and blocks later gates until prior runtime evidence exists.

## Required Task Flow

1. Read `AGENTS.md`, `BUSINESS.md`, `SYSTEM.md`, `docs/orchestrator/MASTER_PROMPT.md`, `docs/orchestrator/IMPLEMENTATION_ORCHESTRATOR.md`, `docs/orchestrator/INTENT.md`, `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md`, `docs/orchestrator/GOALS.md`, `docs/orchestrator/PLAN.md`, `docs/orchestrator/IMPLEMENTATION_STATE.md`, `docs/orchestrator/STATE.json`, `docs/orchestrator/STATUS.md`, this file, and root `STATE.json`.
2. Query RAG if reachable; otherwise record repository-evidence fallback in `docs/orchestrator/STATUS.md`.
3. Select the earliest active or pending chunk unless the owner explicitly redirects.
4. Restate the preserved business intent, service owner, data owner, auth boundary, storage boundary, and rollback boundary.
5. Implement only the selected chunk.
6. Run the documented verification commands or record why they could not run.
7. Complete the intent-preservation checklist in `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md`.
8. Append evidence to `docs/orchestrator/STATUS.md`.
9. Commit only after the pre-commit intent gate passes.

## Queue

1. Goal 9.6: prepare a separate owner decision for the 7 unresolved salary-scoped media rows: locate/restore trusted legacy objects, approve an explicit salary fallback policy, or keep them blocked; object restore/copy, fallback DB writes, salary finalization, payouts, payments, deployment, and rollback execution remain separately approval-gated.
2. Goal 9.6: keep `SALARY_PAYOUT_FLOWS_ENABLED` disabled; do not run payouts before separate payment-boundary approval.
3. Resume Goal 10.3 only after owner redirects back to Seven: content-service base schema readiness plus seven schema creation using `docs/orchestrator/CONTENT_BASE_SCHEMA_APPROVAL.md`, then rerun DB-backed no-write report.
4. Goal 10.4: apply seven content data migration only after post-schema no-write reconciliation, explicit owner approval, and rollback SQL generation through `scripts/apply-seven-data-approved.sh`.

## Task Rules

- The master orchestrator chooses the next task from state and goals; worker agents do not choose roadmap order.
- Every task must preserve SpeakASAP intent, service ownership, private data boundaries, and legacy behavior parity.
- Coding tasks require a scoped execution plan, verification evidence, and a status entry before completion.
- Migration commits require the `Intent`, `Scope`, `Evidence`, `Verification`, `Approval`, and `Rollback` commit-message block defined in `docs/orchestrator/INTENT_PRESERVATION_SYSTEM.md`.
- Owner questions are reserved for approval gates, destructive operations, unclear scope, or true blockers.

- 2026-06-13: Goal 10 language seed readiness completed no-write; importer payload now includes 19 legacy Language rows and write-gated `--include-languages`, with schema approval still required before any data apply.

- 2026-06-13: Goal 10 media readiness completed no-write; seven dry-run now reports 1373 media refs and sample public checks show `/media` assets still return 404 pending source-location/copy/routing approval.

- 2026-06-13: Goal 10 media source discovery completed read-only; after the `ml='fr'` audio fix, `https://speakasap.com` covers 1212/1212 internal media refs with 0 missing.

- 2026-06-13: Goal 10 media copy manifest prepared no-write; `/tmp/speakasap-seven-media-copy-manifest-v3.json` lists 1212 available candidates and 0 unresolved refs.

- 2026-06-13: Goal 10 deployment readiness prepared no-write; `/tmp/speakasap-seven-deployment-readiness-v3.json` is `ok=true`, scoped deployment approval readiness is true, and cutover remains false until schema/data/media/deploy gates complete.

- 2026-06-13: Goal 10 media copy operator prepared no-write; `scripts/copy-seven-media-approved.sh` is gated by exact media approval, manifest v3, and explicit `MEDIA_TARGET_ROOT`.

- 2026-06-13: Goal 10 rendered HTML safety gate added no-write; `/tmp/speakasap-seven-dry-run-v19.json` checked 993 rendered fragments with zero tracked HTML safety issues.
- 2026-06-13: Goal 10 runtime approval sequence added no-write; `/tmp/speakasap-seven-approval-sequence-v1.json` will verify the schema -> data -> media -> deploy -> visual QA -> runtime evidence order, and suite v18 includes that checker.
- 2026-06-13: Goal 10 next-gate preflight added no-write; `/tmp/speakasap-seven-next-gate-v1.json` will report the next requestable gate from current artifacts, and suite v19 includes that checker.
- 2026-06-13: Goal 10 schema approval evidence freshness hardened no-write; active schema approval now references next-gate v1 and no-write suite v19, and schema plan v10 verifies these references.
- 2026-06-13: Goal 10 intent/commit readiness gate added no-write; `/tmp/speakasap-seven-intent-commit-readiness-v1.json` verifies intent-preservation evidence and required migration commit block.
- 2026-06-13: Goal 10 worker evidence gate added no-write; `/tmp/speakasap-seven-worker-evidence-v1.json` verifies read-only sub-agent findings and boundaries.
- 2026-06-13: Goal 10 schema and data gates executed under owner approval; `/tmp/speakasap-seven-content-post-apply-v1.json` proves 19/136/429 planned matches and next gate is media.
