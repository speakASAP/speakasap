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

### Order matters: Vault key first, manifest second

`k8s/services/education-service.yaml` declares `PORTAL_INBOUND_API_TOKEN` as an
ExternalSecret entry pointing at `secret/prod/speakasap/education`. ESO resolves the
entries of one ExternalSecret together, so a missing Vault property risks failing the
whole sync — which would take `DATABASE_URL` and the S3 keys with it.

This has **not** been observed here (every ExternalSecret in `statex-apps` was
`SecretSynced` on 2026-08-09), so treat it as the cautious ordering rather than a proven
failure: write the Vault key **before** applying the manifest, and it cannot matter
either way. If the ExternalSecret does go unhealthy, check it before assuming the deploy
is at fault:

```bash
kubectl get externalsecret speakasap-education-secret -n statex-apps \
  -o jsonpath='{.status.conditions[*].message}{"\n"}'
```

`PORTAL_API_URL` and `PORTAL_CLIENT_TIMEOUT_MS` live in the ConfigMap instead — neither
is a secret, and a URL in plain sight is easier to correct than one buried in Vault.

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

### Config alone changes nothing — the image must be rebuilt

Setting the Vault key and restarting the deployment is **not** enough. On 2026-08-09 the
education deployment sat on `:latest`, so `kubectl rollout restart` re-pulled the *same
pre-fix image*: the pod had no `dist/lesson-client/` and no `getRoster`, and the wizard
still reported "No students found for this lesson" with everything correctly configured.

Confirm the running image actually contains the code, rather than trusting the deploy
banner:

```bash
POD=$(kubectl get pod -n statex-apps -l app=speakasap-education -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n statex-apps "$POD" -c app -- ls dist/lesson-client/
kubectl exec -n statex-apps "$POD" -c app -- grep -c getRoster dist/drills/teacher/roster.service.js
```

`shared/scripts/deploy.sh speakasap` reporting **"Build and push images: 15.03s"** is the
tell that nothing was built — a real monorepo build takes minutes. Track K recorded the
same trap for the frontend. A green banner is not evidence.

## Verifying

```bash
curl -s -H "x-internal-token: $PORTAL_INBOUND_API_TOKEN" \
  https://speakasap.com/api/v1/internal/lessons/<uuid>/
```

**Do not check the status code — check the body.** The plan originally said "401 means
the token does not match". That is wrong on this host: `CustomLoginRequiredMiddleware`
(`portal/settings.py:287`) intercepts unauthenticated requests *before* DRF and serves
the **login page with HTTP 200**. A rejected call and a served one both return 200.

Verified 2026-08-09 — no token, a wrong token, and an empty token all returned 200 with
the login page and **zero lesson data**; only the correct token returned JSON. The guard
is sound, but its refusal does not look like one from the outside.

So: a body starting `{"uuid":` means it worked. An HTML body means the token was
rejected. `curl` is broken on the speakasap host itself (missing `libssl.so.3`) — probe
from alfares, or use Python's `urllib` over there.

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
