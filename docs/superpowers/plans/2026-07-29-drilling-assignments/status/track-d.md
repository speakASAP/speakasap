# Track D — Generation Orchestration

**State:** COMPLETE — with three **upstream-blocked** boundaries, see §"Blocked upstream"
**Service:** `speakasap/education-service` · **Branch:** `feat/drilling-assignments`
**Commits:** `d12e8e3..1631b20` (D.1 → D.5 + wiring, five commits)
**Plan:** [`../07-orchestration.md`](../07-orchestration.md) · **Unblocks:** Track F, and the
deployability of education-service itself

## Contract changes

**None.** C2–C6 are consumed exactly as published.

## Verification run

```
$ ./node_modules/.bin/jest                          # education-service
Test Suites: 17 passed, 17 total
Tests:       183 passed, 183 total   (114 from B2 + 69 new)

$ ./node_modules/.bin/tsc --noEmit -p tsconfig.json
exit 0 — clean
```

Every suite was confirmed to fail first. **Twenty-five mutations were run** — the source
was deliberately broken, the test confirmed red, the source restored and diffed back to
identical. Two of them exposed tests that proved nothing; both are recorded below.

| Task | Mutations | All caught |
|---|---|---|
| D.1 clients | 3 | yes |
| D.2 pre-checks | 4 | after one test fix |
| D.3 pipeline | 6 | yes |
| D.4 regeneration | 6 | yes |
| D.5 job runner | 6 | yes |
| module wiring | 2 | after one test fix |

## ⚠ The B2 boot blocker is cleared

Track B2 shipped `DrillsModule` with three cross-service providers deliberately unbound,
so that compiling the module threw and the service would not start. All three are now
bound, and `src/drills/drills.module.spec.ts` is the test for it — it compiles the module
and resolves every provider. `AppModule` was separately confirmed to compile end to end.

Reverting the binding fails all five module tests, so the fix is real rather than assumed.

`SelfDrillService` takes its two boundaries as plain TypeScript interfaces, which erase at
runtime and carry no DI token. It is constructed through `useFactory` rather than by
editing B2's file. `DrillsController` could not be handled that way — Nest instantiates
controllers itself — so it received a single `@Inject(DRILL_IDENTITY_RESOLVER)`
annotation. **That one line is the only Track D edit to a file Track D does not own.**

## Two tests that proved nothing, found by mutation

1. **`pre-checks.spec.ts`, mixed-script case.** It used `Café` as a "mixed script" answer.
   `é` is Latin, so the answer was entirely Latin and contained no wrong-script letter at
   all. A mutant flagging *any* wrong-script letter still passed it. Replaced with
   `Мoskau` (Cyrillic М, Latin remainder), which fails the mutant.
2. **`drills.module.spec.ts`, progress-sink case.** It asserted only that an update
   function existed on the sink, which passes against a sink wired to nowhere — a
   generation job that runs but never updates the assignment row. It now drives a write
   through the sink and asserts it arrives at the runner's repository.

## A real defect found by reading logs, not by a test

`GenerationService` scored set origin as `aiKept === 0 ? 'BANK' : …`. A run that kept
**zero** items therefore scored `BANK`, and `BANK` is the one origin that auto-approves.
`APPROVED` is what makes a set visible to a student, so a failed run would have shipped an
empty drill straight past the teacher's review queue. Fixed, pinned by
`never auto-approves a set that kept no items`, and mutation-verified.

It surfaced from a log line (`origin=BANK kept=0/10`) while all thirteen tests were green.

## Blocked upstream — REQUIRED before this feature works end to end

All three fail closed and log explicitly. None of them fake a success, because every
plausible fake here puts unreviewed content or another student's data in front of a user.

| # | Boundary | Needs | Consequence today |
|---|---|---|---|
| 1 | `ContentClient.replaceSetItems` | a content-service route replacing a set's items at given `order` positions, writing the outgoing rows to `DrillItemRevision` | `NotImplementedException`. **Task D.4 regeneration cannot run.** |
| 2 | `ContentClient.updateSet` | a content-service route patching `reviewState` on an existing set | `NotImplementedException`. A regenerated set cannot be returned to `PENDING_REVIEW`. |
| 3 | `DrillIdentityResolverAdapter` | an auth-microservice route mapping **authUserId → legacyUserId** | 503 `IDENTITY_UNRESOLVED`. **Every student-facing drill endpoint returns 503.** |

Notes on each:

1 and 2 are content-service (Track A2's files). Track A2 shipped `POST internal/drill-sets`,
`POST …/approve` and `POST drill-sets/:uuid/ratings` and nothing that mutates an existing
set. The `DrillItemRevision` model **already exists** in content-service's schema from
Track A, so this is HTTP-route work, not a migration. All the orchestration logic around
both calls is implemented and tested against the port.

3 is the significant one. Track H shipped `GET /internal/users/by-legacy-id` and
`POST /internal/users/resolve-or-provision-legacy`; **both map legacy id → auth UUID**,
which is contract C9's direction. The runner needs the reverse, because the JWT carries
`AuthContextUser.id` (a UUID) while `DrillAssignment.studentId` is the legacy Django
integer. No shipped route returns it. Until one exists, `DrillsController` resolves no
student and every student-facing endpoint 503s. The service **boots** — this is a runtime
gap, not a startup one.

A fourth, smaller gap: `DrillSetsClientAdapter.incrementSelfSelected` has no
content-service route either. It logs and returns rather than throwing — failing a
student's drill start because a popularity counter could not be bumped would be the wrong
trade, and the counter feeds library ranking only.

## Plan deviations — deliberate

1. **`template.ts` was not re-vendored into `orchestration/`.** The plan's D.2 step 1 says
   to copy it there. Track B2 had already vendored it at `src/drills/template.ts` with its
   own sha256 drift test; a second copy would be a third parser free to drift from both.
   Imported B2's instead. `ratio.ts`, `tokenize.ts` and `stopwords.ts` **were** vendored,
   with drift tests, because education-service had no copy of those.

2. **`src/drills/drills/contracts.ts` is a path shim.** The vendored `ratio.ts` imports
   `../drills/contracts`, which resolves in content-service (`src/vocabulary` →
   `src/drills`) but not from `src/drills/orchestration`. Rewriting the import would break
   the byte-identity the drift test exists to protect. The shim re-exports the single
   vendored contracts file and redeclares nothing. Same trade-off B2 resolved for
   `template.ts` by placing it at matching depth.

3. **Internal routes send `x-internal-token`, which the plan's D.1 test did not.** The
   gateway rejects `/api/v1/internal/*` without it
   (`api-gateway/src/proxy/gateway-auth.guard.ts:40`). A bearer-only client gets 403, the
   orchestrator reads "the bank is empty", and it generates a full set of AI items nobody
   asked for — the same failure class the plan warns about for swallowed 500s.

4. **`createSet({ partial: true })` became `RunSummary.partial`.** The plan's D.3 test
   asserts a `partial` flag on the create call, but `CreateSetInput` has no such field, so
   content-service would drop it silently and the test would pass while asserting nothing.
   **Open:** the teacher-facing "this set is short" signal still has no home. It wants a
   `generationMeta` write on the assignment row.

5. **Generation stops early when the model returns zero items.** The plan says retry up to
   three times. Retrying an identical request that returned nothing returns nothing again,
   at full token cost. It still retries up to three times when items come back and are
   discarded, which is the case the rule is actually about.

6. **The vocabulary gate is skipped when `hasBaseline` is false.** That field was added to
   the contract after the plan was written. content-service's `ratio.ts` explicitly refuses
   to decide this and hands it to the caller — while warning that a caller silently
   skipping the gate also swallows a broken vocabulary build. Skipping is right for
   pre-checks (the alternative flags every item), but **the loud-surfacing half of that
   warning is not yet implemented.** It belongs where course context exists.

7. **`GenerationJobRepository` is a Track-D-owned port.** `AssignmentsRepository` is Track
   B's file and carries none of `updateProgress` / `cancel` / `findStaleGenerating`. Track D
   does not edit it, so the three writes live in
   `orchestration/adapters.ts` against the same Prisma client.

8. **`StudentProgressClientAdapter` reads local tables, not HTTP.** `StudentCourse` carries
   no `studentId`; a student reaches a course through `GroupStudent → Group →
   StudentCourse`, `courseKey` is `StudentCourse.courseClass`, and the lesson ceiling is the
   highest finished `Lesson.order` rather than a stored counter. Verified against the
   schema — the first implementation assumed columns that do not exist.

## Deferred to the orchestrator

- **No deploy.** Subagents and track sessions do not deploy; the orchestrating session
  does, one at a time, via `shared/scripts/with-deploy-lock.sh`.
- **No migration.** Track D added no schema changes. `generationProgress` and
  `DrillItemRevision` already exist from Tracks B and A.
- **New env vars** consumed by the clients, all with defaults except the URLs:
  `CONTENT_SERVICE_URL` (required), `INTERNAL_API_TOKEN` (required, already in
  `REQUIRED_ENV`), `AI_SERVICE_URL` (required, already in `REQUIRED_ENV`),
  `DRILL_CLIENT_TIMEOUT_MS` (default 30000), `DRILL_AI_CLIENT_TIMEOUT_MS` (default
  180000), `DRILL_GENERATION_TIMEOUT_SECONDS` (default 900).
  **`CONTENT_SERVICE_URL` is not in `validate-env.ts`'s `REQUIRED_ENV`** — adding it means
  editing a file Track D does not own, so it is flagged here instead. Without it the
  clients throw a clear `ServiceUnavailableException` naming the missing key rather than
  failing obscurely.
- **Track C's eval harness** is still deferred behind the credential rotation
  (`ROTATION-STATE.md`), so the AI path has never been exercised end to end against the
  real agents. Everything here is tested against the contract, not against the live model.

## Notes for the next track

**Track F (teacher UI)** is the direct consumer. What it needs to know:

- `GenerationProgress.stalled` means *no progress*, not *slow*. Do not render a countdown
  that hits zero and keeps going — that is the exact behaviour spec §10.3 forbids, and the
  runner deliberately never produces it.
- A set is `APPROVED` only when every item came from the bank. Anything with a surviving
  AI item arrives `PENDING_REVIEW` and must pass through the review queue.
- A set can arrive **short** of the requested count. `RunSummary.partial` records it today,
  but nothing teacher-facing surfaces it yet (deviation 4).
- The regeneration endpoint will 501 until content-service ships the two routes above.
- Every student-facing drill endpoint 503s until the identity route exists. Test with
  teacher-facing paths first.
