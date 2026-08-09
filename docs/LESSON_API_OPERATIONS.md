# Lesson API — operations

**LESSON-API: transitional.** The portal is scheduled for sunset. Everything here is the
seam between legacy Django and education-service, and is deleted when lessons move onto
the platform.

## What this is

`speakasap-portal` (legacy Django, on the **speakasap** host) is the single source of
truth for lessons. `education-service` (NestJS, on **alfares**/K8s) reads them over HTTP
instead of from its own database.

It used to read local copies — `education_lesson`, `education_group`,
`education_studentcourse`, `education_homework` — populated by a one-shot ETL that last
ran **2026-06-26**. Nothing refreshed them. Measured 2026-08-09: the copy held 182,600
lessons ending 2026-06-26 while the portal held 182,958, so **181 finished lessons were
invisible**. A teacher opening a newer lesson got an empty student list and no error.

## Endpoints

Mounted by `portal/urls.py` under `/api/v1/internal/`:

| Method | Path | Serves |
|---|---|---|
| GET | `/api/v1/internal/lessons/<uuid>/` | one lesson |
| PATCH | `/api/v1/internal/lessons/<uuid>/` | `recommendation`, `to_manager` |
| GET | `/api/v1/internal/lessons/<uuid>/roster/` | `student_ids` + `paid_student_ids` |

Guarded by `x-internal-token`, matched against `PORTAL_INBOUND_API_TOKEN`.

### `student_ids` vs `paid_student_ids`

Kept separate deliberately. `student_ids` is who attends; `paid_student_ids` is the
subset with `education_studentaccess.is_paid` for **that** lesson. They authorize
different things — lesson-record playback is for payers only. Collapsing them hands
recordings to students who never paid, so a test asserts the split and was confirmed to
fail when the two lists are swapped.

## Configuration — both sides, same value

The portal validates exactly what education-service sends, so one secret goes to two
places. **They are different stores on different hosts.**

| Side | Key | Where |
|---|---|---|
| education-service | `PORTAL_INBOUND_API_TOKEN` | Vault `secret/prod/speakasap/education` |
| education-service | `PORTAL_API_URL` | same — `https://speakasap.com/api/v1/internal` |
| education-service | `PORTAL_CLIENT_TIMEOUT_MS` | optional, defaults to 5000 |
| speakasap-portal | `PORTAL_INBOUND_API_TOKEN` | `.env` on the **speakasap** host (no Vault there) |

```bash
export VAULT_ADDR=http://127.0.0.1:8200
TOK=$(openssl rand -hex 32)
vault kv patch secret/prod/speakasap/education \
  PORTAL_INBOUND_API_TOKEN="$TOK" \
  PORTAL_API_URL="https://speakasap.com/api/v1/internal"
vault kv patch secret/prod/speakasap-portal PORTAL_INBOUND_API_TOKEN="$TOK"
unset TOK

kubectl annotate externalsecret speakasap-education -n statex-apps \
  force-sync="$(date +%s)" --overwrite
kubectl rollout restart deployment/speakasap-education -n statex-apps
shared/scripts/wait-for-rollout.sh -n statex-apps speakasap-education
```

`secret/prod/speakasap-portal` is a convenience copy — the portal host does not read
Vault. Put the value in its `.env` and restart supervisord there.

Never `vault kv put` on these paths: it replaces the whole secret and would drop
`DATABASE_URL` and the S3 keys. Always `patch`.

## Both sides fail closed

Neither side degrades quietly when misconfigured, and this is the point of the whole
change:

- **Portal**: an empty `PORTAL_INBOUND_API_TOKEN` denies every request. It does not
  become an open endpoint through misconfiguration.
- **education-service**: `LessonClientService` raises `LessonServiceUnavailableError`
  when `PORTAL_API_URL` or the token is unset — it never returns an empty roster.

`LessonNotFoundError` (a real 404 about a real lesson) and
`LessonServiceUnavailableError` (could not ask) are separate types on purpose. Collapsing
them into one 404 is what let a frozen table look like ordinary missing data for six
weeks.

## Deploying

The two halves deploy **separately and by different people**:

- **Portal** — owner-run, on the speakasap host: `ssh speakasap && cd speakasap-portal &&
  ./scripts/deploy.sh`. Agents cannot do this; `ssh speakasap` is read-only for them.
  Never use `shared/scripts/deploy.sh` for the portal.
- **education-service** — `shared/scripts/deploy.sh speakasap` on alfares, which moves
  the whole monorepo. Note it does **not** deploy `speakasap-frontend`; that needs
  `shared/scripts/with-deploy-lock.sh ./scripts/deploy-frontend.sh` as well.

Deploy the portal **first**. education-service raises loudly against a portal that has
not got the endpoints yet, so the reverse order is a visible outage rather than a silent
one — but still an outage.

## Verifying

```bash
# 200 = serving. 401 = token mismatch. 404 = wrong mount path.
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "x-internal-token: $PORTAL_INBOUND_API_TOKEN" \
  https://speakasap.com/api/v1/internal/lessons/<uuid>/
```

The reference lesson for this bug is `f249c6e4-e6ef-451d-a1b0-c4fb0a3b4477` (student
215116, teacher 182, start 2026-08-12). Confirmed 2026-08-09: **absent** from
`education_lesson`, **present** in the portal with a non-empty roster. If the roster
endpoint returns `teacher_id: 182` and `student_ids: [215116]`, the seam works.

A unit test is not a substitute for the browser check — open the lesson's drill wizard
and confirm the student picker lists people.

## What still reads the frozen tables

`internal-salary.service.ts:72` aggregates `prisma.lesson` by teacher and date range for
`period-aggregates`, which **salary-service consumes to compute teacher payouts**. Those
181 invisible lessons are missing from salary aggregation.

Not migrated, because the portal exposes no lessons-by-teacher-and-range endpoint. Fixing
it means adding one under `education/internal_api/` and verifying against real payout
figures — it touches money and deserves its own pass.

Every other reader was moved in `7cdebb3`: reads the portal can answer go to it, reads it
cannot refuse with `503 FROZEN_COPY_UNAVAILABLE` and an error-level log naming what was
asked for, rather than serving stale rows. See `src/shared/frozen-copy.ts`.

`/api/v1/lessons/<uuid>` is served from the portal. `/api/v1/lessons?studentCourseUuid=`,
`/api/v1/groups`, `/api/v1/student-courses` and `/api/v1/homeworks` refuse. They had no
caller in any repo and no gateway traffic in the 7 days before 2026-08-09, but they are
publicly routed — quiet logs are not proof of no client, so they raise instead of being
deleted. A real consumer announces itself in the error log.

## The copied tables still exist

Task 10 of the plan drops them along with the cross-database FKs. It has not run, and is
gated behind Task 11 passing. Until then the tables sit there, unread except by
`internal-salary`. Do not drop them while that is still true.
