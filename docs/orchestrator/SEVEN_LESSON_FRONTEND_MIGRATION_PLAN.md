# Seven-Lesson Course Frontend Migration Plan

Date: 2026-06-13
Status: active planning; no database write, deployment, object mutation, or legacy retirement has run in this chunk.

## Owner Request

Migrate only the legacy SpeakASAP seven-lesson course frontend from `speakasap-portal` into the new `speakasap` platform, move the data for the seven lessons to the new server/database, and preserve the existing on-screen text style because it is intentionally readable for the target audience.

## Preserved Intent

The seven-lesson course is public learning content for online language education. The migration must preserve lesson order, titles, body text, exercises, answers, media references, download links where still available, language-specific content, and the typography that learners currently see. Private student data, progress, exercise answers, payments, and teacher workflows are out of scope for the first frontend/content slice unless a later goal explicitly adds them with service-owned data and auth evidence.

## Legacy Evidence

Legacy app and routes:

- `speakasap-portal/seven/models.py` defines `SevenCourse`, `SevenLesson`, `Exercise`, and `ExerciseAnswer`.
- `speakasap-portal/speakasap_site/urls.py` exposes `/<lang>/seven/`, `/<lang>/seven/<lesson>/`, app, email, exercise, and answer render routes.
- `speakasap-portal/seven/urls.py` exposes `/seven/<code>/lessons/<order>/` and `/seven/<code>/app/lessons/<order>/`.
- `speakasap-portal/seven/api_views.py` exposes lesson list, exercise answer, and app materials behavior.
- `speakasap-portal/speakasap_site/templates/site/seven/base.html` renders the public lesson page, reading indicator, lesson HTML, exercises, answers, PDF link, promo block, and app badges.
- `speakasap-portal/speakasap_site/templates/site/seven/index.html` renders the course lesson cards and final test gate.
- `speakasap-portal/seven/templates/seven/<language>/lessons/*.html` stores lesson bodies by language.
- `speakasap-portal/seven/templates/seven/<language>/exercises/*.html` and `answers/*.html` store exercise and answer templates.
- `speakasap-portal/portal/fixtures/seven.xml` contains fixture evidence for `19` `SevenCourse` rows and `136` `SevenLesson` rows.

Typography/style evidence to preserve:

- `speakasap-portal/speakasap_site/static/css/speakasap.css` has `.lesson__content h1/h2/h3`, table, audio, and content styles.
- `speakasap-portal/speakasap_site/static/css/site.css` has `.hyphenate { text-align: justify; }` and base lesson content styles.
- `speakasap-portal/speakasap_site/static/scss/_lesson_content.scss`, `_seven.scss`, and `_content.scss` are source style evidence.
- Key visual constraints: `.lesson__content { color: #424242; padding: 12px; }`, `.lesson__content--seven { padding: 4.2%; }`, desktop lesson text `16px` and `30px` line-height, table cells `13px` and `1.5` line-height, `PT Mono` headings, blue `h1`, yellow `h2`, justified/hyphenated lesson text, and `Open Sans` promo text.
- Legacy fonts/assets include `portal/static/fonts/PT Mono.ttf`, `portal/static/fonts/Open Sans.ttf`, `speakasap_site/static/css/self-hosted-fonts.css`, and `speakasap_site/static/js/sp-reading-indicator.js`.

## Target Ownership

- `content-service`: public seven-course content, lesson body HTML, exercise HTML, answer HTML, language linkage, metadata, media references, and public read API.
- `api-gateway`: frontend-facing forwarding, e.g. `/api/v1/seven/*` to `content-service`.
- `frontend`: Next.js public course and lesson pages; it must call only the gateway.
- `course-service`: paid products/offers remain here; not the first target for public seven lesson content.
- `education-service`: private student progress/access remains here; later protected slice.
- `assessment/certification`: final `seven_test` behavior remains later scope unless explicitly included.

## Proposed Target Contract

Public read API through gateway:

- `GET /api/v1/seven/courses?languageCode=en&materialLanguage=ru`
- `GET /api/v1/seven/courses/:languageCode`
- `GET /api/v1/seven/courses/:languageCode/lessons`
- `GET /api/v1/seven/courses/:languageCode/lessons/:order`

Lesson detail payload should include course id, title, language code, material language, app package, materials version, lesson id, order, title, prefix, SEO metadata, sanitized legacy lesson HTML body, ordered exercises with exercise/answer HTML, previous/next summary, and media/PDF references as policy allows.

## Data Migration Plan

1. Inventory legacy `seven_sevencourse`, `seven_sevenlesson`, fixture rows, template files, exercise files, answer files, PDF paths, audio/video references, app zip metadata, and app screenshots.
2. Add content-service schema for `SevenCourse`, `SevenLesson`, and `SevenExercise` with preserved legacy IDs and duplicate guards.
3. Add dry-run-first migration script `content-service/scripts/migrate-seven-from-legacy.py`.
4. Dry-run report must include source counts, template counts, media references, missing language rows, missing lesson files, missing exercise/answer templates, duplicate target keys, target counts, and sample source/target IDs.
5. Do not assume exactly seven DB lesson rows for every course; German fixture evidence has 8 rows because lesson 1 is split into two parts.
6. Only after dry-run evidence and explicit owner approval, run apply mode with `--apply --confirm-write --approval-note ... --rollback-plan ...` and generate rollback SQL.
7. Re-run no-write reconciliation after apply and record evidence in `docs/orchestrator/STATUS.md`.

## Frontend Plan

1. Add public route `/<languageCode>/seven` for the course index.
2. Add public route `/<languageCode>/seven/<lessonOrder>` for lesson detail, preserving old URL intent where possible.
3. Render sanitized legacy HTML while preserving typography classes and CSS custom properties from the legacy visual evidence.
4. Keep lesson navigation, exercise blocks, answer toggles, PDF/material link area, reading indicator behavior if feasible, and mobile layout stable.
5. Do not add marketing-style redesign; this is a learning surface, not a landing page.
6. Browser-test desktop and mobile against old/new screenshots or DOM/style snapshots, focusing on font family, font size, line-height, text color, headings, tables, and exercise controls.

## Goal-Driven Sub-Agent Slices

- Explorer A: legacy `seven` templates, data, routes, and style evidence. Status: completed read-only.
- Explorer B: new platform frontend/API/schema/deploy map. Status: completed read-only.
- Worker 10.1: content-service schema and API contract for seven content. Write ownership: `content-service/prisma/schema.prisma`, `content-service/src/seven/*`, `content-service/src/app.module.ts`, `api-gateway/src/proxy/upstream-resolve.ts` if API route is added.
- Worker 10.2: dry-run migration importer. Write ownership: `content-service/scripts/migrate-seven-from-legacy.py` and docs/report examples only.
- Worker 10.3: frontend public seven-course UI. Write ownership: `frontend/app/[languageCode]/seven/*`, `frontend/app/globals.css` or route-local CSS, and `frontend/lib` gateway helpers if needed.
- Validator 10.4: visual parity and smoke verification. Read-only until implementation is ready.

## Verification Gates

Before any apply/deploy:

- `cd content-service && npm run build`
- content-service Prisma validation/generation using the service's existing workflow
- dry-run migration JSON report with `writes=false`
- `cd frontend && npm run build`
- api-gateway build if route table changes
- rendered browser QA for desktop and mobile, including computed style checks for typography

Apply/deploy gates:

- No target DB write without fresh dry-run report and owner approval.
- No deployment without build evidence and rollback command.
- No legacy route retirement; legacy stays fallback/reference until a later owner-approved cutover goal.

## Rollback

- Pre-apply rollback is no-op because only code/docs are changed.
- Data apply rollback must use generated SQL deleting only rows with recorded migration batch/idempotency markers.
- Deployment rollback uses previous Kubernetes image digest for `speakasap-frontend`, `speakasap-content`, and `speakasap-api-gateway` if changed.
- Legacy `speakasap-portal` remains the reference/fallback throughout this goal.

## Immediate Next Chunk

Goal 10.3: after owner approval, apply only the content-service seven schema migration, then rerun DB-backed no-write seven report before any content data apply.

## Implementation Progress 2026-06-13

Completed without DB writes or deployment:

- Added content-service `SevenCourse`, `SevenLesson`, and `SevenExercise` schema plus Prisma migration SQL.
- Added content-service public read API under `/api/v1/seven`.
- Added api-gateway upstream route and a narrow anonymous gateway exception for `GET /api/v1/seven...`; non-GET requests remain bearer-protected.
- Added dry-run importer/report `content-service/scripts/migrate-seven-from-legacy.py`.
- Added Next.js public routes `/<languageCode>/seven` and `/<languageCode>/seven/<order>` with legacy typography and self-hosted `PT Mono` / `Open Sans` fonts.

Verification evidence:

- `cd content-service && npm run prisma:validate && npm run build` passed.
- `cd api-gateway && npm run build` passed.
- `cd frontend && npm run build` passed and listed dynamic routes for `/(languageCode)/seven`.
- `/tmp/speakasap-seven-dry-run-target-v4.json` recorded `writes=false`, `sevenCourses=19`, `sevenLessons=136`, no blocking issues, 4 warnings, and target seven tables missing before schema migration.

Next approval gate:

- Apply only `content-service/prisma/migrations/20260613110000_seven_content/migration.sql` after owner approval, then rerun DB-backed no-write report before any content data apply.

## Write-Gated Apply Path 2026-06-13

Implemented without running writes:

- `content-service/scripts/migrate-seven-from-legacy.py` now supports `--apply --confirm-write --approval-note --rollback-plan`.
- Apply mode refuses to run without all write gates.
- Apply mode generates rollback SQL before writing target rows.
- Apply mode refuses to run if dry-run blocking issues exist.
- The importer statically renders common legacy Django tags (`title`, `audio`, `video`, `url`, `load`, `hg/endhg`) so stored HTML is closer to the learner-visible legacy page instead of showing Django template syntax.

Verification evidence:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `content-service/scripts/migrate-seven-from-legacy.py --apply` refused with `ERROR: --apply requires --confirm-write` and exit status `2`.
- `/tmp/speakasap-seven-dry-run-v2.json` recorded `writes=false`, `applySupported=true`, and migration payload counts `courses=19`, `lessons=136`, `exercises=429`.
- `/tmp/speakasap-seven-dry-run-target-v5.json` recorded `writes=false`, target checked through the runtime `speakasap-content-secret` database URL and temporary port-forward, and target seven tables still missing before schema migration.

Next approval gate remains unchanged: apply only the content-service seven schema migration after explicit owner approval, rerun no-write report, then request separate owner approval for data apply.

## Reconciliation Hardening 2026-06-13

Implemented without writes:

- Migration payload rows now include metadata batch marker `seven-content-legacy-20260613` for courses, lessons, and exercises.
- Generated rollback SQL includes the same migration batch note and remains scoped to legacy course IDs, lesson IDs, and exercise legacy keys.
- DB-backed target reconciliation now receives the planned payload and reports planned course legacy IDs, lesson legacy IDs, and exercise legacy keys; once schema exists, it also returns target ID samples for matching planned rows.

Verification evidence:

- `/tmp/speakasap-seven-dry-run-v7.json` recorded `writes=false`, payload `courses=19`, `lessons=136`, `exercises=429`, no blocking issues, and batch marker presence was verified in sample course/lesson/exercise metadata.
- `/tmp/speakasap-seven-dry-run-target-v8.json` recorded `writes=false`, `target.checked=true`, planned counts `19/136/429`, and expected missing-table errors for `SevenCourse`, `SevenLesson`, and `SevenExercise` before schema migration.
- `content-service/scripts/migrate-seven-from-legacy.py --apply` still refuses without `--confirm-write` before DB action.
- `python3 -m py_compile`, `cd content-service && npm run prisma:validate`, `cd content-service && npm run build`, and `cd frontend && npm run build` passed.

## Frontend Preview Parity 2026-06-13

Implemented without writes or deployment:

- Added a client-side reading indicator for seven lesson pages, matching the legacy page behavior that displayed sp-reading-indicator over lesson-wrapper.
- Added lesson PDF download link generation using the legacy path shape /media/pdf/<languageCode>/lesson<order>.pdf.
- Added a shared course promo description helper so course and lesson pages reuse the same learner-visible copy and avoid grammar regressions from raw language names.
- Added a bottom course promo block on lesson pages, matching the legacy lesson template structure.

Preview QA evidence:

- Temporary mock gateway on 127.0.0.1:4310 and temporary Next preview on 127.0.0.1:4311 were used only for no-write Browser QA; both were stopped after validation.
- Course preview /en/seven rendered two lesson cards, promo text "Этот курс английского языка...", header font Open Sans Legacy 44px/52.8px, promo text 18px/27.9px/700, no framework overlay, and no console warnings/errors.
- Lesson preview /en/seven/1 rendered PDF link /media/pdf/en/lesson1.pdf, lesson paragraph style 16px/30px/rgb(66, 66, 66), heading style PT Mono 32px/40px/rgb(44, 150, 255), answer disclosure opened correctly, and reading indicator style changed to width: 100% after scroll.
- Screenshots saved outside the repo: /tmp/speakasap-seven-course-preview.png and /tmp/speakasap-seven-lesson-preview.png.

Remaining visual gate:

- Full Goal 10.6 remains open until real migrated content is applied, services are deployed, and desktop/mobile QA runs against the production route with actual seven-course data.


## Language Seed Readiness 2026-06-13

Implemented without writes:

- Extended `content-service/scripts/migrate-seven-from-legacy.py` so the migration payload includes the `19` legacy `Language` rows required by the seven courses.
- Replaced regex parsing of `portal/fixtures/languages.yaml` with PyYAML parsing so Russian `name` and `speaker` values are preserved exactly instead of carrying YAML line-folding spaces into the new database.
- Added `--include-languages` as an explicit write-gated apply option; without it, missing target language codes remain a blocking issue.
- Added `docs/orchestrator/SEVEN_DATA_MIGRATION_APPROVAL.md` as the later data-apply approval packet. This is separate from the schema-only approval gate.

Verification evidence:

- `python3 -m py_compile content-service/scripts/migrate-seven-from-legacy.py` passed.
- `/tmp/speakasap-seven-dry-run-v16.json` recorded `writes=false`, payload `languages=19`, `courses=19`, `lessons=136`, `exercises=429`, corrected language samples such as `китайский`, `чешский`, and `немецкий`, and no blocking issues.
- `/tmp/speakasap-seven-dry-run-target-v16.json` recorded `writes=false`, `target.checked=true`, planned payload `19/19/136/429`, and the expected blocker `TARGET_LANGUAGE_TABLE_UNAVAILABLE` because the target content DB still has no base schema.

Boundary: no schema migration, data apply, deployment, object mutation, destructive command, media copy, final test migration, private progress migration, paid-product change, or legacy route retirement ran.

## Media Readiness 2026-06-13

Implemented without writes:

- Extended the seven migration dry-run report to include all unique media refs, counts by kind/prefix, planned PDF refs, and YouTube refs extracted from rendered legacy video tags.
- Added `content-service/scripts/check-seven-media-availability.py`, a no-write checker for validating reported `/media` refs against a public base URL.
- Added `docs/orchestrator/SEVEN_MEDIA_MIGRATION_APPROVAL.md` for the later media copy/routing approval gate.

Verification evidence:

- `/tmp/speakasap-seven-dry-run-v18.json` recorded `writes=false`, payload `languages=19`, `courses=19`, `lessons=136`, `exercises=429`, media refs `audio=1104`, `pdf=136`, `video=133`, and total unique refs `1373`.
- `/tmp/speakasap-seven-media-check-sample-v18.json` checked a sample against `https://speakasap.alfares.cz` and returned `6/6` missing with HTTP `404`.
- `/tmp/speakasap-seven-media-check-assets-sample-v18.json` checked the same sample against `https://assets.alfares.cz` and returned `6/6` missing with HTTP `404`.
- `speakasap-portal/media` is not present in the legacy checkout, so source media files must be located from production storage/backup before any copy approval.

Boundary: no media copy, object mutation, route change, deployment, schema migration, data apply, destructive command, private media migration, paid-product change, final test migration, or legacy route retirement ran.


## Media Source Discovery 2026-06-13

Completed read-only:

- Checked legacy production domain `https://speakasap.com` as a source candidate for the internal `/media` refs from the seven report.
- `/tmp/speakasap-seven-media-check-legacy-source-v1.json` checked `1240` internal refs: `1212` returned HTTP `200`, `28` returned HTTP `404`.
- All `136` PDF refs are available on the legacy production domain; `1076/1104` audio refs are available.
- The only missing source prefix is `media/audio/ru` with 28 refs.
- Local/server filesystem checks did not find sample source files under `/home/ssf/Documents/Github`, `/srv`, `/mnt`, `/opt`, or `/var/www`; the legacy checkout still has no `media` directory.

Boundary: no media copy, download/archive creation, object mutation, route change, deployment, schema migration, data apply, destructive operation, or legacy route retirement ran.


## Media Copy Manifest 2026-06-13

Implemented without writes:

- Added `content-service/scripts/prepare-seven-media-manifest.py` to convert the no-write availability report into JSON/CSV copy-review artifacts.
- Generated `/tmp/speakasap-seven-media-copy-manifest-v1.json`, `/tmp/speakasap-seven-media-copy-manifest-v1.csv`, and `/tmp/speakasap-seven-media-missing-v1.csv`.
- Manifest summary: `1240` internal refs, `1212` available copy candidates, `28` excluded missing refs, available bytes by kind `audio=3229902938`, `pdf=11240877`.
- Missing refs remain only under `media/audio/ru`.

Boundary: no media download, media copy, object mutation, route change, deployment, schema migration, data apply, destructive operation, or legacy route retirement ran.
