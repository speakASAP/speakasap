# Track J — Legacy Portal Entry Points

**State:** **DEPLOYED AND LIVE.** The deployed portal client reaches education-service
through the gateway in production (`unavailable: False`). Verified 2026-08-04.
**Service:** `speakasap-portal` · **Branch:** `feat/drilling-track-j` (from `main`)
**Commits:** `a03fc13d` (J.1) · `32ca87e7` (J.2) · `1fe18a1a` (J.3 + J.4) · `47bf534e` `845acc59` (deploy fixes) · `speakasap@0fc065c` (gateway two-hop)
**Plan:** [`../13-legacy-ui.md`](../13-legacy-ui.md) · **Depends on:** Tracks I, B2 (both live)

## Exact files touched

The plan asks for these by name rather than by guess. Located by reading the code, not
assumed:

| File | Role |
|---|---|
| `cabinet/drills_client.py` | **new** — fail-soft client + context builders |
| `cabinet/student/views/account.py` | `HomeView` — student dashboard (had no `get_context_data`) |
| `cabinet/student/views/courses.py` | `LessonView` — student lesson page |
| `cabinet/teacher/views/__init__.py` | `HomeView` — teacher dashboard |
| `cabinet/teacher/views/lessons.py` | `LessonView` — teacher lesson page |
| `cabinet/templates/student/home.html` | include (React 15 mount point, untouched) |
| `cabinet/templates/student/lesson.html` | include (React 15 mount point, untouched) |
| `cabinet/templates/teacher/home.html` | include |
| `cabinet/templates/teacher/lesson.html` | include |
| `cabinet/templates/student/_drilling_block.html` | **new** |
| `cabinet/templates/student/_lesson_drilling_panel.html` | **new** |
| `cabinet/templates/teacher/_drilling_block.html` | **new** |
| `cabinet/templates/teacher/_lesson_drilling_panel.html` | **new** |
| `portal/local_settings_default.py` | `EDUCATION_SERVICE_URL`, `DRILLS_INTERNAL_TOKEN`, `DRILLS_CLIENT_TIMEOUT` |

All thirteen code/template files carry `DRILLING: transitional — delete at legacy sunset`,
so removal at sunset is `grep -rl` and delete.

**Both student pages are React 15 mount points.** The blocks are server-rendered Django
*above* the mount, so no React, Webpack or bundle change was needed — the constraint the
plan sets.

## Verification

Run on the speakasap server's own Python 3.4.3 / Django 1.11.2:

```
client + platform_link            19 passed, 0 failed
dashboard block rendering          9 passed, 0 failed
lesson panels + teacher dashboard 13 passed, 0 failed
```

All modules parse under Python 3.4 and every imported name resolves.

**Guards proven by breaking them, then reverting:**

The first is the one that matters: it is an authorization failure, not a cosmetic one.

## Three things worth carrying forward

**The authorization filter lives in Python, not the template.** `by-lesson` returns every
assignment on a lesson. `lesson_panel_for_student` filters to `user.id` before the
context is built, because an authorization rule written as a `{% if %}` is one careless
template edit away from being silently lost.

**`studentId` and `teacherId` are both the legacy Django user id**, not profile pks —
confirmed by reading `resolveStudentId`, which maps an auth UUID back to the legacy
integer. `user.id` is correct on both sides.

## Deviations from the plan, and why

**`responses` was not used.** The plan's J.1 test uses it; it is not installed on the
portal and adding a test dependency to a Python 3.4 / Django 1.11 stack is a worse trade
than stubbing `requests` directly. Same coverage, no new dependency.

**The port in the plan is wrong.** J.1 shows `http://education:4205`; education-service
listens on **4206**, and the portal is not in the K8s cluster, so it goes through the
public gateway (`https://speakasap.alfares.cz`) whose
`/api/v1/internal/drill-assignments` prefix routes there — verified returning 403 without
a token, so the guard is live on that path.

**The no-score assertion excludes href attributes.** A rendered `href` legitimately
carries percent-encoding (`next=%2Flearner…`). The rule is "no score, percentage or grade
shown to the user", so the check strips hrefs and then asserts no `%`. Progress renders
as raw counts (`18 / 50`), never a percentage — the platform owns what progress means.

## Four defects deployment uncovered

None of these were visible from code review; each needed a real deploy.

**1. `/api/v1/internal/*` was unreachable from outside the cluster — for every service.**
`GATEWAY_INTERNAL_API_TOKEN` had never been set in any manifest, and the gateway guard
fails closed on `!expected`. Track J was simply the first caller to need that path.

Fixed in `speakasap@0fc065c`: `api-gateway/src/proxy/internal-hop.ts` re-stamps the
header after the guard passes, so the caller proves itself to the gateway and the gateway
proves itself to the upstream. Missing upstream token strips the header rather than
leaking the caller's. Six tests; three go red if the swap is removed.

**Credential separation verified in production:**

```
portal --[gateway token]--> gateway --[education token]--> education
  by-student/310740 -> 200      by-teacher/10 -> 200
  no token -> 403               wrong token -> 403

education-service direct, using the portal's token -> 401
```

That last line is the point: the portal's credential does **not** open education.

**3. `scripts/deploy.sh` aborted on the speakasap server.** It sourced the dry-run guard
by the hardcoded path `/home/ssf/Documents/Github/shared/...`, which exists only on a dev
machine. Pre-existing (`b778a49b`), latent until this merge put the line on the host, and
self-locking: the script died before reaching its own `git pull`. Fixed in `47bf534e` —
resolve relative to the repo, source when present, inline refusal otherwise.

**4. Production never loads `local_settings_default.py`.** `portal/settings.py` prefers
`local_settings.py`, which exists on that host, so every setting I had declared in the
default file was invisible there — `EDUCATION_SERVICE_URL` raised `AttributeError` in
production while working locally. Fixed in `845acc59` following the `RECORDS_S3_*` pattern
directly above it: prefer `local_settings`, else read `.env`.

This one also silently affected **Track I**: `SPEAKASAP_PLATFORM_JWT_SECRET` and
`SPEAKASAP_PLATFORM_URL` were declared the same way. The handoff worked in testing because
those probes read `.env` directly; the Django app would not have seen them.

**Also worth knowing:** `deploy.sh` only pulls when `NODE_ENV=production`, which is **not
set** in that server's `.env`. So the deploy script never syncs code there — every
"successful" portal deploy in this session actually shipped whatever `git pull` had
already fetched. Deploying that host currently requires an explicit `git pull` first.

## Live verification

```
EDUCATION_SERVICE_URL: https://speakasap.alfares.cz
drills token configured: True     platform secret configured: True
student 310740 -> unavailable: False | outstanding: 0 | selfDrilling: True
teacher 10     -> unavailable: False | awaitingReview: 0 | assigned: 0
```

`unavailable: False` is the whole point — these are real 200s through the gateway, not
the fail-soft path. Counts are zero because production holds no drill assignments yet.

## Not done

- **No drill assignments exist in production**, so the blocks currently render their
  empty state. Proving they render *content* needs a teacher to generate, approve and
  assign a set through the Track F wizard.
- **No test has run through the Django test runner.** `manage.py test` fails on that host
  with `permission denied to create database`; the portal's DB user cannot create
  `test_portal_db`. The committed `cabinet/tests/*.py` are the durable suites for when a
  test database exists. Everything above was verified by stdin probes on the same
  interpreter instead.
- **No browser has seen these blocks.** Rendering is proven, but nobody has loaded a real
  dashboard with a real student session.
- **The teacher dashboard block renders even when all counts are zero.** The student block
  deliberately renders nothing in that case; for a teacher, a visible "Create drilling
  assignment" entry point is the point of the block, so it stays.
