# Handoff: infrastructure and integration findings, 2026-08-03

> **This file is a prompt.** Give it to an implementing agent as-is. Everything
> needed to act is here: the evidence, the exact files, and what "done" means.
> Findings are ordered by severity; each is independent and can be taken alone.

## Context you need before touching anything

**The environment.** One production node (`alfares`), K3s, namespace
`statex-apps`, ~80 deployments. Images live in a local registry at
`localhost:5000`, tagged by git SHA. Secrets are in Vault at
`secret/prod/<service>` and reach pods through ExternalSecrets.

**Read first:** `/home/ssf/Documents/Github/CLAUDE.md`. The rules that matter
most here:

- **Never copy files into production** (`scp`/`rsync`/`kubectl cp`). To run a
  script inside a pod, pipe it to `node`/`sh` over `kubectl exec -i` — nothing
  is written to the pod's filesystem.
- **Deploys are serialized ecosystem-wide.** Anything that creates a container
  goes through `shared/scripts/with-deploy-lock.sh <cmd>`;
  `shared/scripts/deploy.sh <service>` takes the lock itself.
- **Never let `kubectl` print a Secret's `.data`.** Key names only:
  `kubectl get secret <n> -n <ns> -o go-template='{{range $k,$v := .data}}{{$k}}{{"\n"}}{{end}}'`
- **Never `npx tsc`** — it silently runs an unrelated package. Use
  `./node_modules/.bin/tsc --noEmit -p tsconfig.json`.
- `rg` here is a GNU grep shim. `-E` means *encoding*, not extended-regex.

**Verification standard.** Do not report a fix as working without pasting the
command output that proves it. Where a guard is cheap to break, break it and
confirm the test goes red before trusting the green.

---

## Finding 1 — `scripts/deploy.sh` builds nothing (FIXED 2026-08-03)

**Evidence.** `speakasap/scripts/deploy.sh` applies manifests and runs
`kubectl rollout restart`. There is no `docker build` anywhere in it. Pods
re-pull whatever tag the manifest already names, so **running it after a code
change ships nothing** while reporting success.

Confirmed 2026-08-03: production was on `speakasap-education:4ed5579`, two days
and 27 commits behind `main`, having been "deployed" repeatedly.

The working path is `shared/scripts/deploy.sh speakasap`, which reads
`speakasap/deploy.config.sh`, builds and pushes all twelve images, then
`kubectl set image` to the real SHA.

**Task.** Make the wrong path impossible to invoke by accident. Either delete
`speakasap/scripts/deploy.sh` and leave a stub that `exec`s the shared runner,
or make it refuse to run with a message naming the shared runner. Do not leave
two scripts where the more obvious name is the broken one.

`speakasap/deploy.config.sh` still carries a header calling
`scripts/deploy.sh` "the live, authoritative deploy path". That is now false —
fix it in the same change.

**RESOLVED.** `speakasap/scripts/deploy.sh` now refuses and exits 1, naming the
shared runner. A stub that silently `exec`d the runner was considered and
rejected: the two take different arguments, and silently redirecting a deploy is
how the wrong mental model survives. `speakasap/CLAUDE.md` was updated to point
at `../shared/scripts/deploy.sh speakasap`.

---

## Finding 2 — `DRY_RUN=1` is not honoured everywhere (FIXED 2026-08-03)

**Evidence.** `CLAUDE.md` states `DRY_RUN=1 ./scripts/deploy.sh` is honoured. It
is not universal: `ai-microservice/scripts/deploy.sh` contains no reference to
`DRY_RUN` at all, and `--dry-run` is consumed as the *image tag*, producing
`invalid tag "localhost:5000/ai-microservice:--dry-run"`.

Running it expecting a dry run performed a **real build and deploy** to
production (2026-08-03; harmless in that instance only because the code was
already merged and no other deploy was in flight).

**RESOLVED.** The scope was much narrower than first written, and the audit
command originally given here was wrong — do not use it.

```bash
# WRONG — 36 false positives.
grep -q 'DRY_RUN' "$f" || echo "NO DRY_RUN SUPPORT: $f"
```

34 of the 43 `scripts/deploy.sh` files are one-line shims that `exec` the shared
runner:

```bash
exec "$(dirname "$0")/../../shared/scripts/deploy.sh" "<service>" "$@"
```

They **inherit** dry-run support rather than containing the string, so grepping
for `DRY_RUN` reports them as broken when they are not. Verified by running one:
`DRY_RUN=1 bash catalog-microservice/scripts/deploy.sh` emits 19 `[dry-run]`
lines and executes no docker or kubectl command. The `--dry-run` flag form
behaves identically.

Only the hand-written scripts were ever at risk, and all of them are now guarded:

| Script | State |
|---|---|
| ai-microservice | `deploy_dry_run_guard` — refuses rather than deploying |
| database-server, minio-microservice, speakasap-portal, statex-ecosystem, vault-microservice, shared | already supported it |
| speakasap | retired; refuses and exits 1 |
| growth | shim into the shared runner |

`shared/scripts/deploy-lib/dry-run-guard.sh` is the reusable guard. It refuses
before anything runs, and strips `--dry-run` from the argument list so a script
taking a positional tag can never mistake the flag for an image tag — the exact
failure that produced `invalid tag "localhost:5000/ai-microservice:--dry-run"`
*after* the build and push had already happened.

**If you add a new hand-written deploy script**, source that guard immediately
after `set -e`. The correct audit is "does this script contain real logic rather
than `exec`ing the shared runner, and if so does it source the guard":

```bash
for f in /home/ssf/Documents/Github/*/scripts/deploy.sh; do
  grep -qE '^exec .*shared/scripts/deploy\.sh' "$f" && continue
  grep -q 'dry_run_guard\|DRY_RUN' "$f" || echo "UNGUARDED: $f"
done
```

`CLAUDE.md`'s claim that `DRY_RUN=1 ./scripts/deploy.sh` is honoured is now
true for every deploy script in the ecosystem.

---

## Finding 3 — production DBs drift behind their schemas (FIXED 2026-08-03)

**Evidence.** `speakasap_content_db` was missing **three** migrations —
`20260730014739_drill_bank`, `20260730152915_course_vocabulary`,
`20260801093000_drill_library` — seven tables in total. `speakasap_education_db`
was missing `20260803120000_drill_notification_timestamps`.

Nothing in the deploy path runs `prisma migrate deploy`, and nothing warns. The
new image would have started against a database with no drill tables. Both were
applied by hand on 2026-08-03; every other speakasap DB was up to date.

**RESOLVED.** `shared/scripts/deploy-lib/migration-preflight.sh` checks every
service named in a repo's `PRISMA_SERVICES` and **refuses** rather than applying
— auto-migrating on deploy is how a bad migration reaches production unattended.
It runs before the build, so a refusal costs nothing.

It asks two questions, because they fail differently: whether the live DB is
behind the running image (answered by reading `_prisma_migrations` from inside
the pod, so no DSN is printed and no port-forward is needed), and whether the
working tree carries migrations the running image has never seen — the dangerous
case, invisible to `migrate status` inside the old pod.

**Proven to fire.** A throwaway migration was added to education-service and a
real deploy run:

```
Preflight: checking migration state of 10 database(s)...
  speakasap-education: PENDING MIGRATIONS
      29990101000000_preflight_probe
Deploy refused: the database is behind the migrations being shipped.
```

Exit code 1, **zero build phases executed**. The probe was then removed and the
preflight passes over all ten databases.

One bug was found and fixed while proving it (`shared@964b68a`): the refusal
used plain `echo` with colour variables, printing
`\033[0;31mPENDING MIGRATIONS\033[0m` literally and burying the deployment name.

**If you add a service with a Prisma schema**, declare it in that repo's
`deploy.config.sh` as `PRISMA_SERVICES=("deployment|source-dir")`. A service not
named there is skipped rather than guessed at.

---

## Finding 4 — `education-service` cannot name its students (FIXED 2026-08-03)

**Evidence.** `TeacherRosterService.listForTeacher` returns
`{ id, name, groupUuids }` with **`name` always empty** — education-service
stores `studentId` integers and nothing about the person. Verified against
production: teacher 10 has **656 students and 931 groups**, all unnamed.

`frontend/app/teacher/assignments/new/page.tsx` falls back to
`Student <id>`, so a teacher picking students sees `Student 58`,
`Student 111`… That is not usable at 656 entries.

`DrillAssignmentsService.listForLesson` has the same hole (`studentName: ''`).

**RESOLVED**, but it took four fixes — the feature was written and committed
without ever being run against production, and each defect hid the next.

| Probe | Cause | Fix |
|---|---|---|
| **404** | auth-microservice was 7 commits behind; `names-by-legacy-ids` existed in source but not in the running image | deployed auth |
| **401** | education sent `x-internal-token`/`INTERNAL_API_TOKEN` — the api-gateway's convention. auth's `InternalServiceGuard` wants `x-internal-service-token`/`INTERNAL_SERVICE_TOKEN` | `speakasap@885b1da` + Vault key + allowlist |
| **500** | `findNamesByLegacyIds` passed quoted identifiers, so TypeORM emitted `"mapping"."mapping"."legacyUserId"` → `syntax error at or near "."` | `auth@16311eb` |
| **401** | `x-service-name` read `process.env.SERVICE_NAME`, the K8s deployment name `speakasap-education`; the allowlist is keyed on `education-service` | `speakasap@3e4da71` |

**Verified against production:**

```
total: 656 returned: 5 hasMore: true
[{"id":114116,"name":"7soli23"},{"id":146622,"name":"Ada"},
 {"id":146214,"name":"advena"},{"id":177152,"name":"Ainura"},
 {"id":133384,"name":"AkaFose"}]
PASS: 5/5 named

page 2 (offset 3): ["Ainura","AkaFose","Akzharken Dakenovna Naribayeva"]
search "ain" -> 3 matches: ["Ainura","goaindia","Kain"]  (substring, not prefix)
groups: 931
```

**Two lessons worth carrying forward.**

*The 500 fix was wrong the first time and shipped anyway.* Moving from the array
form of `select()` to `addSelect` while keeping identifiers quoted reproduces the
same double-prefix. It was only caught by reproducing on a scratch Postgres 16
instead of reasoning about TypeORM's behaviour. Columns go in as
**`alias.column`, unquoted** — TypeORM quotes each part itself.

*The SQL shipped because nothing built the query.* `internal-users.controller.spec.ts`
mocks the service, so a statement that could never execute passed CI.
`users.service.legacy-names.spec.ts` now builds it and asserts the projection
shape; both it and `auth-client.service.spec.ts` fail against the broken versions.

**Latent, not a live bug:** auth caps a batch at 1000 legacy ids and
`resolveLegacyNames` does not chunk. The largest roster measured is 656 and no
teacher currently exceeds the cap — checked directly — but a teacher who does
would get a 400 and lose every name at once. Chunk before that happens.

Names come from auth and are not cached. Every roster open is one batch call;
if that shows up in latency, cache it there rather than in education-service.

---

## Finding 5 — `catalog-contract-monitor` fails every run (FIXED 2026-08-03)

**Evidence.** Its CronJob has been failing continuously; four Error pods were on
the node at once. The pod logs give the reason directly:

```
Set CATALOG_SMOKE_ENABLE_BAZOS_AUTHORIZED=true with approved Bazos identity/
category inputs to run this side-effect-risk check.
```

Unrelated to the drilling work — found while investigating node capacity.

**RESOLVED**, in two steps — the second undoing an overcorrection in the first.

The failing contract, `authorized-bazos-draft`, posts **real Bazos drafts**. It
is genuinely not something to enable by default, and it is now gated off by
`CATALOG_MONITOR_INCLUDE_BAZOS_AUTHORIZED=false`.

The job was then suspended entirely. That fixed the noise but **stopped the
other eleven contract checks with it** — and a monitor that does not run reports
nothing, which is indistinguishable from a monitor reporting no problems. It has
been un-suspended (`catalog-microservice@2530a1b`); the schedule
`14,44 * * * *` is live again.

**Measured, not assumed.** A manual run with the current configuration:

```
"passed": 11, "skipped": 4, "failed": 0, "failedContracts": []
```

The four skips, with their own stated reasons:

| Contract | Why skipped | Side effects |
|---|---|---|
| `authorized-bazos-draft` | needs approved Bazos identity/category inputs | **writes** — posts real drafts |
| `authorized-channel-status` | `CATALOG_SMOKE_ENABLE_CHANNEL_STATUS` unset | read-only, live third-party call |
| `authorized-heureka-readiness` | `CATALOG_SMOKE_ENABLE_HEUREKA_READINESS` unset | read-only, live third-party call |
| `authorized-stock-consistency` | `CATALOG_SMOKE_ASSERT_STOCK` unset | read-only, compares Warehouse vs channel stock |

**Open decision for the owner, not a defect.** The three read-only checks are
off by default. Enabling them means live calls to Heureka and the channel APIs
on every run, twice an hour — cheap if those APIs tolerate it, rude if they
rate-limit. `authorized-stock-consistency` is the most valuable of the three: a
Warehouse/channel stock divergence is the kind of thing that silently oversells.

To enable any of them, set the variable in
`catalog-microservice/k8s/contract-monitor-cronjob.yaml`; the bazos one
additionally needs approved inputs through `secret/prod/catalog-microservice`.

Watch the next scheduled runs (`:14` and `:44`) to confirm it stays green
unattended — the manual run proves the configuration, not the schedule.

---

## Finding 6 — node runs near its pod ceiling (FIXED 2026-08-03)

**Evidence.** Ceiling is 110 pods; usage sat at **110/110** mid-deploy on
2026-08-03, with eleven surge pods unable to schedule
(`0/1 nodes are available: 1 Too many pods`). The deploy recovered only as old
pods terminated. `speakasap/deploy.config.sh` documents the same failure from
2026-08-01, when a deploy took ~40 minutes and reported success while old images
were still serving.

Mitigated since: a `pod-janitor` CronJob now reclaims finished pods
(`k8s-manifests/services/pod-janitor.yaml`), and four services were scaled from
2 replicas to 1. Usage is ~100/110.

**RESOLVED** by raising the kubelet ceiling, which was option 1 and the right
one: 110 was a kubelet default, never a measured limit. The node measured 24 CPU
at 17% requested and 62Gi at 17% while wedged at 110/110 — there was no resource
reason for the ceiling to be where it was.

`/etc/rancher/k3s/config.yaml`:

```yaml
kubelet-arg:
  - "max-pods=250"
```

250 is the per-node figure Kubernetes tests against. Node capacity and
allocatable both now report 250.

**Proven with a real deploy, not by reasoning.** A full twelve-service rollout
was run after the change:

| | old ceiling (110) | after (250) |
|---|---|---|
| Wait-for-rollout | **308.7s** | **226.8s** |
| Pods unable to schedule | 11 | **0** |
| Peak pods on node | 110 (wedged) | 119 |

Peak hit 119 — nine above the old ceiling — with 12 old pods terminating while
12 new ones started. That rollout could not have completed under 110. No
`FailedScheduling` event was produced; the only ones in the cluster are 65
minutes old, from before the change. Site served 200 throughout.

**`maxSurge: 0` was tried and reverted, correctly.** Commit `443c4a8` set
`maxSurge: 0, maxUnavailable: 1` across the thirteen deployments; `32ec869`
reverted it. With 154 slots of headroom and a rollout needing 13 surge pods, the
tradeoff no longer applies — `maxSurge: 1, maxUnavailable: 0` gives zero-downtime
rollouts, which is strictly better when capacity allows. Do not reapply
`maxSurge: 0` unless the ceiling is lowered again.

**The one remaining risk is that this file is not in any repository.** A node
rebuild or fresh k3s install silently returns to the 110 default and the failure
resurfaces. `shared/docs/DEPLOY_STANDARD.md` documents the file, why 250, how to
re-apply it, and the ~60s during which the node keeps reporting the old value
after `systemctl restart k3s`. Verify with:

```bash
kubectl get node alfares -o jsonpath='{.status.capacity.pods}'   # want 250
```

Worth considering separately: image pulls now dominate the rollout (~42s per
image, serialized through one containerd), not scheduling. That is the next
constraint if deploy time matters.

---

## Finding 7 — AI-generated drill items are never persisted (FIXED 2026-08-03)

**Evidence.** The pipeline was driven end to end against production on
2026-08-03 (after the ai-microservice auth fix, `speakasap@4516fb7`). It ran to
completion:

```
generationProgress: {"phase":"READY","total":3,"generated":2,
                     "message":"Ready with 2 of 3 requested item(s)"}
```

Bank search, the generator agent, the validator agent and set creation all
worked. The set was created in content-service with `origin: AI`,
`reviewState: PENDING_REVIEW` — both correct.

**But the set contains zero items**, despite the pipeline reporting two
generated and validated.

**Root cause.** `education-service/src/drills/orchestration/generation.service.ts:220`:

```ts
itemIds: survivors.map((c) => c.bankItemId).filter((id): id is number => typeof id === 'number'),
```

`bankItemId` is documented on the `Candidate` type as *"Present for bank items
only — content-service already has a row for them."* AI-generated candidates
have no `bankItemId`, so `.filter()` drops every one. An all-AI set therefore
sends `itemIds: []`.

Nothing anywhere creates a `DrillItem` row for AI output — grep for
`replaceSetItems`, `createItems` or `source === 'AI'` in that file returns
nothing. **The generated sentences are discarded after validation**, having been
paid for.

This is why the feature produces empty sets even when everything reports
success. It is a Track D gap, unrelated to the auth fix.

**The mechanism already exists.** content-service exposes
`POST internal/drill-sets/:uuid/replace-items`, which accepts full
`ReplacementItem` objects (`template`, `blanks`, `hint`, `topicSlug`) and
creates the rows — Track A2 built it for regeneration. `ContentClient` already
wraps it as `replaceSetItems`. It is simply never called after generation.

**Task.** Persist AI survivors. Either extend `CreateSetInput` to accept new
items alongside `itemIds`, or call `replaceSetItems` immediately after
`createSet` with the AI candidates. Prefer whichever keeps set creation atomic —
a set that exists with no items is exactly the state observed here, and it looks
identical to a finished one in a teacher's review queue.

Watch the ordering: `reviewState` is `APPROVED` only for a pure-bank set. If AI
items are added after creation, make sure that decision still sees them.

**Done when.** A generation run produces a set whose item count equals
`generated`, and the items carry the sentences the model returned. Verify by
reading them back out of content-service, not by trusting the progress message —
that message already says READY today while the set is empty.

**RESOLVED** in `speakasap@1dad456`. `CreateSetInput` gained `newItems`;
AI candidates now travel whole and content-service creates the rows through its
existing `upsertItem` (hash-deduped on plain text plus language) inside the same
transaction as the set. `topicSlug` was also being dropped when building AI
candidates and is now carried through — an item filed under no topic is
invisible to every later bank search.

`replace-items` turned out not to be usable for this after all: it swaps rows at
existing `order` positions and rejects an empty set with "no item at position N".

The existing generation suite passed with the defect present, asserting nothing
about persistence. Six new tests fail if the fix is reverted.

**Verified end to end in production 2026-08-03**, reading the set back out of
content-service rather than trusting the progress message:

```
progress: {"phase":"READY","generated":3,"total":3,"message":"Ready"}
SET origin=AI reviewState=PENDING_REVIEW itemCount=3
  Ich gehe [в]{durch} den Park.
  Das Geschenk ist [для]{für} dich.
  Wir fahren [вокруг]{um} die Stadt.
PASS: 3 generated, 3 persisted
```

Bank search, generator, validator, set creation and item persistence all work.
Test rows were deleted afterwards; production holds zero assignments, sets and
AI items.

**What remains untested:** the student runner (Track E is not built), the
teacher review screen against a real set, approval, and the assign-to-student
path that fires `onAssigned`.

## Finding 8 — one node, no HA (LOW, informational)

Four services ran 2 replicas (`catalog-microservice`, `cliplot`,
`domain-research`, `warehouse-microservice`). On a single node both replicas sit
on the same machine, so this was never fault tolerance — it cost a pod slot and
bought nothing. Scaled to 1 on 2026-08-03; manifests updated so the next deploy
does not revert it.

Worth stating plainly: **this cluster has no high availability.** Losing
`alfares` loses everything. If that matters commercially, it is a second node,
not a replica count.

---

## Appendix — verified facts, so you need not re-derive them

| Fact | Value |
|---|---|
| Node | `alfares`, ceiling **250** pods (raised 2026-08-03), ~102 in use |
| Namespace | `statex-apps`, ~80 deployments |
| Registry | `localhost:5000`, images tagged by git SHA |
| speakasap services live on | `79659b6` → `4516fb7` after the auth fix |
| ai-microservice live on | `b766b12` |
| Teacher with students | id `10` → 656 students, 931 groups |
| content-service port | 4201, global prefix `/api/v1` |
| education-service port | 4206, global prefix `/api/v1` |
| ai-microservice port | 3380, **no** global prefix |
| ai-microservice JWT secret | Vault `secret/prod/ai-microservice`, key `JWT_SECRET` |
| Drill assignments in prod | 0 (test rows cleaned up) |
| Drill sets in prod | 0 (test sets cleaned up) |
| ai-microservice auth | FIXED — `speakasap@4516fb7`, AiClient mints a service JWT |
| Pipeline status | **working end to end** — 3 generated, 3 persisted, verified 2026-08-03 |
| Track F status | `speakasap/docs/superpowers/plans/2026-07-29-drilling-assignments/status/track-f.md` |
| Pod janitor | `k8s-manifests/services/pod-janitor.yaml`, every 15 min |
| Manual pod prune | `shared/scripts/k8s-prune-terminal-pods.sh` (dry run by default) |
