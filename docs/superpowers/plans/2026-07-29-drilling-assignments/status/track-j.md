# Track J — Legacy Portal Entry Points

**State:** CODE COMPLETE — not deployed. See §"Not done".
**Service:** `speakasap-portal` · **Branch:** `feat/drilling-track-j` (from `main`)
**Commits:** `a03fc13d` (J.1 client) · `32ca87e7` (J.2 student dashboard) · `1fe18a1a` (J.3 + J.4)
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

| Broken behaviour | Result |
|---|---|
| student lesson filter removed | `Theirs` and `Boris` render on Anna's page — 2 tests red |
| `x-internal-token` → `x-internal-service-token` | auth header test red |
| `selfDrillingAllowed` defaults to `True` when down | default test red |

The first is the one that matters: it is an authorization failure, not a cosmetic one.

## Three things worth carrying forward

**education-service uses a different internal-auth convention from auth-microservice.**
`InternalTokenGuard` reads **`x-internal-token`** against `INTERNAL_API_TOKEN` — the
api-gateway convention. auth-microservice's `InternalServiceGuard` wants
`x-internal-service-token`/`INTERNAL_SERVICE_TOKEN`. Both exist in this estate, they are
not interchangeable, and sending the wrong one yields a 401 that reads like a bad token.
That is Finding 4 from 2026-08-03, and a test now fails if the wrong header is sent.
Read the guard, don't pattern-match from a sibling service.

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

## Not done

- **Not deployed, not merged.** `feat/drilling-track-j` is committed and unpushed.
- **`DRILLS_INTERNAL_TOKEN` is not set on the portal server.** It must equal
  education-service's `INTERNAL_API_TOKEN` (in `speakasap-education-secret`). Until it is
  set, every block renders its quiet "unavailable" notice — which is the designed
  behaviour, not a crash, so deploying before setting it is safe but pointless.
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
