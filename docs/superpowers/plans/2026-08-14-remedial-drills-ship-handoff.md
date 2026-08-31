---
status: review
owner: repository-owner
last_updated: 2026-08-31
---

# Работа над ошибками — Ship Handoff

> **For the agent picking this up:** the feature is fully built, reviewed and green. Four
> things remain: one code fix, a push, a migration + seed, and a deploy. The owner has
> approved all four. Work through them in the order given — the race fix changes the
> schema, so it must land before the migration is applied.

**Feature spec:** `docs/superpowers/specs/2026-08-12-remedial-drills-error-analysis-design.md`
**Build plan (completed):** `docs/superpowers/plans/2026-08-12-remedial-drills-error-analysis.md`
**Decision trail from the build:** `/tmp/sdd-ledger-backup.md` (read if something surprises you)

---

## State as of handoff

| | |
|---|---|
| Tasks complete | 18/18, each individually reviewed |
| Final whole-branch review | clean, verdict "ready to merge" |
| education-service | 39 suites / 566 tests pass, `npm run build` exit 0 |
| frontend | 23 files / 281 tests pass, build exit 0 |
| ai-microservice | 7 suites / 108 tests pass, build exit 0 |
| `speakasap` unpushed commits | 16 (HEAD `65dad13`) |
| `ai-microservice` unpushed commits | 1 (HEAD `e298aad`) |
| Migration | `20260813084200_remedial_drills` — additive only, never applied anywhere |
| Grammar taxonomy seed | written for all 19 languages, **never run** |

**The feature does nothing until the seed runs.** The tables ship empty; every analysis
fails identically until `prisma/seed-grammar-topics.ts` has been executed against the
target database.

---

## Owner's instructions, verbatim

> you can push. I approve. check point 2 yourself: Run the migration and seed. I don't
> know where to get database URL. Check Vault and .env files maybe for different repos.
> Check docs-rag - maybe it is there. 3. You are allowed to deploy. After everything will
> be done ask me and I will perform human test for failed drills. Also fix the
> createForGap double-click race

So: push approved, deploy approved, DB URL is yours to find, and the owner wants to be
asked before they run the human test.

---

## Step 1 — Fix the `createForGap` double-click race

**Why:** `RemedialService.createForGap` checks for an existing live remedial drill, then
writes, in two separate round trips with nothing between them. Two rapid clicks from the
same teacher can both pass the check and both write a set — a wasted model call and a
duplicate assignment for the student. `sourceAnalysisUuid` currently has only a plain
index (`prisma/schema.prisma:199`), so nothing at the database level prevents it.

Found during Task 12, deliberately deferred then because it needed a schema change of its
own. This is that change.

**Files:**
- Modify: `education-service/prisma/schema.prisma`
- Create: `education-service/prisma/migrations/<timestamp>_remedial_idempotence/migration.sql`
- Modify: `education-service/src/drills/analysis/remedial.service.ts`
- Test: `education-service/src/drills/analysis/remedial.service.spec.ts`

**The constraint.** A partial unique index on `source_analysis_uuid`, filtered to the live
statuses, so at most one live remedial set can exist per gap. The live set is defined in
`remedial.service.ts`:

```ts
const LIVE_STATUSES = ['GENERATING', 'PENDING_REVIEW', 'ASSIGNED', 'IN_PROGRESS'];
```

`COMPLETED` and `CANCELLED` are deliberately excluded — a revoked or finished drill must
leave the gap open for a fresh attempt. Keep that exactly as it is.

Prisma cannot express a partial unique index, so this is **raw SQL in a migration**, and
the schema gets a comment pointing at it so the next reader is not misled by its absence:

```sql
-- At most one LIVE remedial set per gap. The idempotence check in
-- RemedialService.createForGap is a read-then-write with no lock between the two, so two
-- rapid clicks could both pass it. This makes the second one fail at the database instead
-- of quietly spending a second model call and handing the student a duplicate drill.
--
-- COMPLETED and CANCELLED are excluded on purpose: a revoked or finished drill must leave
-- the gap open to be attempted again.
--
-- Partial index rather than a plain unique: a gap legitimately accumulates many terminal
-- remedial rows over time.
--
-- remedial_part is in the key because a split gap creates one row per part, all sharing
-- one source_analysis_uuid. COALESCE because a single-part gap stores NULL there, and
-- NULLs do not collide in a unique index.
CREATE UNIQUE INDEX "drill_assignment_live_remedial_per_gap"
  ON "drill_assignment" ("source_analysis_uuid", COALESCE("remedial_part", 0))
  WHERE "source_analysis_uuid" IS NOT NULL
    AND "status" IN ('GENERATING', 'PENDING_REVIEW', 'ASSIGNED', 'IN_PROGRESS');
```

**Read `remedial.service.ts` before writing the SQL** and confirm the column names and the
live-status list against the real file rather than trusting this document.

**Generate the migration offline.** Never `prisma migrate dev` — it creates a shadow
database and can prompt to reset on drift. Create the migration directory and
`migration.sql` by hand for this one (it is raw SQL Prisma would not generate anyway), with
a `YYYYMMDDHHMMSS` timestamp **later than `20260813084200`**.

**The service must handle the constraint violation.** A unique-violation is now a legitimate
outcome of a double click, not a crash. In `createForGap`, wrap the transaction and convert
Postgres error code `23505` into the same result the idempotence check would have produced —
re-read the existing live rows and return them with `reused: true`. That is what the second
click should have got in the first place.

```ts
} catch (error: any) {
  // 23505 = unique violation. The partial index caught a double-click that raced past the
  // read-then-write check above. The right answer is the one the check would have given:
  // the drill the first click created.
  if (error?.code === 'P2002' || error?.meta?.code === '23505' || error?.code === '23505') {
    const existing = await this.prisma.drillAssignment.findMany({ /* same query as the check */ });
    if (existing.length > 0) {
      return { assignmentUuids: existing.map((r: any) => r.uuid), setUuid: existing[0].setUuid, reused: true };
    }
  }
  throw error;
}
```

Check what Prisma actually surfaces for a raw-SQL partial-index violation — it may be
`P2002` or a raw `23505` depending on how the write is issued. Verify rather than
assuming, and say in your report which one it turned out to be.

**Tests:** a second `createForGap` for the same gap returns `reused: true` and creates
nothing new (this already exists — confirm it still passes); and a simulated unique
violation from the transaction produces the same `reused: true` result rather than
propagating. Prove the second has teeth by removing the catch and watching it fail.

**Verify:** `npx jest src/drills` (whole suite) and `npm run build`.

---

## Step 2 — Push both repos

Two repositories, both on `main`, both approved by the owner:

```bash
cd /home/ssf/Documents/Github/speakasap        && rtk git push origin main
cd /home/ssf/Documents/Github/ai-microservice  && rtk git push origin main
```

`speakasap` has 16 unpushed commits (plus whatever Step 1 adds), `ai-microservice` has 1.
Never force-push.

---

## Step 3 — Find the database URL

The owner does not know where it is and has asked you to find it. Try in this order and
**stop at the first that works** — do not go hunting further than necessary.

1. **The RAG**, which is the cheapest source:
   ```
   /rag-query education-service production database URL and how migrations are applied
   ```
2. **Vault** — the ecosystem convention is `secret/prod/<service>`:
   ```
   /vault-secret education-service list
   ```
   Then read only the key you need. Never print a whole secret to stdout — pipe it into
   the consuming command.
3. **Local env files**: `/home/ssf/Documents/Github/speakasap/.env` (the seed script and
   `prisma:migrate:deploy` both source `../.env` and read
   `EDUCATION_TARGET_DATABASE_URL` → `EDUCATION_DATABASE_URL` → `DATABASE_URL`, in that
   precedence — read `education-service/package.json:16-17` to confirm).
4. **The running pod**, if all else fails:
   ```bash
   kubectl get secret <education-service-secret> -n statex-apps \
     -o go-template='{{range $k,$v := .data}}{{$k}}{{"\n"}}{{end}}'
   ```
   Key names only. Never `-o yaml`/`-o json` on a Secret — that dumps every credential
   into the transcript.

**Hard rule: no direct connections to `db-server-postgres`.** It hosts every live database.
Use `kubectl port-forward` or `kubectl exec` into the pod. A hostname that fails to resolve
is the signal to port-forward, not to route around it.

---

## Step 4 — Apply the migration, then run the seed

**Dry run first.** The build plan's Task 18 asked for a scratch-database apply and it was
never done, because no scratch URL was available. If you can get one cheaply — a schema-only
dump restored into a scratch database — do that first. If you cannot, say so plainly in
your report rather than skipping it silently; the migration is additive (4 CREATE TABLE,
10 indexes, 2 ADD COLUMN, 4 ADD CONSTRAINT, zero DROP), which is what makes proceeding
without it defensible.

```bash
cd /home/ssf/Documents/Github/speakasap/education-service
npm run prisma:migrate:deploy     # migrate deploy, never migrate dev
npm run prisma:seed:grammar-topics
```

The seed upserts, so it is safe to run more than once.

**Confirm it actually landed** — this is the step that decides whether the feature works
at all:

```sql
SELECT language_code, count(*) FROM grammar_topic GROUP BY language_code ORDER BY 1;
```

Expect **19 languages, 141 rows**, and one `<lang>.other` row per language. Anything less
means the seed did not fully run, and every analysis in the missing languages will fail
with a visible error on the student's page.

---

## Step 5 — Deploy

Deploys are **serialized ecosystem-wide** — one build or rollout at a time, across every
repo. Check the lock before you start:

```bash
/home/ssf/Documents/Github/shared/scripts/with-deploy-lock.sh --status
```

Three services changed and all three need deploying:

| Service | Why |
|---|---|
| `education-service` | the whole analysis + remedial backend |
| `frontend` | the student and teacher UI |
| `ai-microservice` | the `analyze-drill-errors` endpoint |

Order matters: **ai-microservice and education-service before frontend**, so the UI never
calls a route that does not exist yet.

Wait on rollouts only with `shared/scripts/wait-for-rollout.sh [-n ns] [-t secs] <deploy>`.
Never `kubectl rollout status` (returns stale errors instantly after
`progressDeadlineExceeded`) and never hand-rolled jsonpath (`readyReplicas == 1` matches
the *old* pod).

`DRY_RUN=1 ./scripts/deploy.sh` is honoured if you want to see the plan first.

**No new configuration is needed.** `AI_SERVICE_URL` and `AI_SERVICE_JWT_SECRET` are already
provisioned in `k8s/services/education-service.yaml` and already required by the
pre-existing `AiClient`. `DRILL_ANALYSIS_CLIENT_TIMEOUT_MS` is optional and defaults to
120000.

---

## Step 6 — Smoke-check, then hand back to the owner

Confirm the deployed system responds before involving them:

- `education-service` health endpoint is up
- `GET /drill-assignments/<some-completed-assignment-uuid>/analysis` returns a JSON body
  with a `status` field (`NOT_ANALYZED` is a perfectly good answer here — it proves the
  route exists and is wired, which is all this check is for)
- `grammar_topic` has its 19 languages (from Step 4)

Then **stop and ask the owner to run their human test.** They asked for this explicitly.
Give them:

- the teacher progress URL for a completed drill with mistakes on it, e.g.
  `https://speakasap.alfares.cz/teacher/assignments/<uuid>/progress`
- what to look for: gap cards with a Russian explanation below the sentence list, a
  "Создать работу над ошибками (N предложений)" button, and — the case they care most
  about — that a **failed** analysis shows a visible red error rather than an empty block
- that the student sees the same explanation on their own finished drill, without any
  create button

The full post-deploy verification script is at the end of
`docs/superpowers/plans/2026-08-12-remedial-drills-error-analysis.md` — including the
mastery-streak SQL that proves a word retires after three clean runs.

---

## Things that will bite you if you do not know them

- **`rg` here is a GNU grep shim.** Use `grep -E` for alternation; `rg -E` is parsed as an
  encoding flag and your pattern silently fails.
- **Never `npx tsc`** — it runs an unrelated package and reads as a pass. Use
  `npm run build`.
- `education-service`'s `npm run typecheck` fails on a **pre-existing** `rootDir`
  misconfiguration unrelated to this feature (verified by `git stash` during the build).
  `npm run build` uses `tsconfig.build.json`, excludes `prisma/`, and passes clean. Do not
  "fix" the typecheck script as part of this work.
- **This machine IS alfares.** Run prod commands directly. `ssh speakasap` is a different
  server and is read-only.
- Prefix shell commands with `rtk`.

## Known-deferred, deliberately not in scope

- `shared/contracts` SSOT drift across content-service / notification-service /
  ai-microservice. **Predates this feature** — verified present at commit `03686f6`, before
  Task 1. Inert for this work: no consumer constructs the affected DTO or branches on the
  changed field. Needs its own task: reconcile the SSOT with education-service's earlier
  unrelated additions first, *then* run `shared/scripts/sync-drill-contracts.sh`. Running
  the sync now would overwrite education-service's own shipped fields with a stale source.
- A stray `api-gateway` `SERVICE_NAME` commit (`8cf972e`) swept up from the working tree
  during Task 1. Unrelated to this feature; left in place and flagged rather than rewritten.
