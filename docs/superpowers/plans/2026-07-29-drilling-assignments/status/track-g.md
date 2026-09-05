# Track G — Notifications

**State:** COMPLETE — with one **deployment-blocking** handoff, see §"Template seed rows are required before any email sends"

**Commits:** `898bc34..89e8e0f`

- `898bc34` feat(notifications): drill assign and completion emails (Task G.1)
- `89e8e0f` feat(education): drill notification dispatch hook (Task G.2)

**Contract changes:** none. No file under `shared/contracts/` was touched, so no
other track's work is invalidated.

**Deferred to orchestrator:**

- **Migration `20260803120000_drill_notification_timestamps` is not applied to
  production.** It adds two nullable columns to `drill_assignment`. Generated
  offline per the production-safety rule (never `prisma migrate dev` against
  prod) and verified by applying all 6 migrations to a scratch Postgres 16 from
  empty — see the verification section. Apply with `prisma migrate deploy`.
- Deploy of `education-service` and `notification-service`. Not run: subagents
  and track sessions do not deploy.
- Seed the two template rows named in §"Template seed rows", and wire them to
  G.1's render functions.
- `NOTIFICATION_SERVICE_URL` and the Auth-issued `education-service -> notification-service`
  credential must be present in education-service's environment. `NOTIFICATION_SERVICE_URL` exists in
  `.env.example:109`; confirm both are in the K8s ExternalSecret before the first
  assignment is created, or every dispatch degrades to a logged warning.
  `dispatch/email` requires a validated service identity, so the credential must be the one [`SERVICE_IDENTITY_CONSUMER_STANDARD.md`](../../../../../auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md) prescribes for that pair
  — verify this at deploy time; it was not exercised here.

## Verification run

- typecheck (education-service): `./node_modules/.bin/tsc --noEmit -p tsconfig.json` → exit 0, no output
- typecheck (notification-service): `./node_modules/.bin/tsc --noEmit -p tsconfig.json` → **pre-existing failure, not introduced here**:
  `error TS6059: File 'scripts/migrate-notification-data.ts' is not under rootDir 'src'`.
  `scripts/` and `tsconfig.json` are untouched since `d776bb4`, long before this track.
- tests (education-service): `./node_modules/.bin/jest` → **19 suites passed, 213 passed, 0 failed**
  (209 before the completion call site; 4 added with it)
- tests (notification-service): `./node_modules/.bin/jest` → **1 suite passed, 25 passed, 0 failed**
- migration: all 6 migrations applied to a throwaway `postgres:16-alpine` from
  empty → "All migrations have been successfully applied"; `\d drill_assignment`
  confirms `notified_assigned_at` and `notified_completed_at` as
  `timestamp(3) without time zone`, both nullable. Container removed.
- `prisma migrate diff --from-migrations --to-schema-datamodel` reports **no drill
  drift**. It does report one pre-existing unrelated difference:
  `education_lessonrecord.updated` default `Now` → `None`. That predates this track.

### Falsification (a green check that never ran is worse than a red one)

Each guard was broken and the suite re-run to confirm the tests actually catch it:

- Removed the URL scheme check in `safeUrl` → **4 tests failed**. Restored → 25 pass.
- Removed the `onCompleted` call from `RunnerService` → **2 tests failed**.
  Restored → 16 pass. (Guarding it with `&& false` instead failed at typecheck
  as unreachable code, which proves nothing, so the block was deleted outright.)
- Removed `origin === 'SELF'` from the completion guard → **1 test failed**.
  This one mattered: the plan's original test set `origin: 'SELF'` *and*
  `teacherId: null`, so it passed on the null alone and did not pin the origin
  rule at all. A test for a SELF assignment that still carries a teacherId was
  added, and that is the test which now fails when the check is dropped.

## Deviations from the plan

**Five of Task G.1's specified assertions were wrong and were corrected.** The
implementation they were failing against is correct; the assertions were not.

1. `refuses to emit a link for <scheme>` (×4) asserted `r.html` contains no
   `<a href` anywhere. The runner CTA is a separate, already-validated field and
   is always a link, so the assertion could never hold. Now scoped to the topic
   list, plus an assertion that the rejected URL appears nowhere in the document.
2. `encodes quotes in a topic url` asserted `&quot;` appears in the output.
   WHATWG `new URL()` percent-encodes a literal quote to `%22` before
   `escapeHtml` ever sees it, so `&quot;` never appears — the property holds by a
   stronger mechanism than the assertion anticipated. Now asserts the property
   that matters: no `onmouseover` attribute can form.

**Task G.2 count.** The plan said "7 passed"; the suite has 12. The five
additions cover claim-before-dispatch ordering, assign-side idempotence, a
missing assignment, the SELF-with-teacher case above, and the absence of numeric
performance data in the dispatched payload.

**Idempotence column.** The plan named a single `notifiedAt`. Two columns
shipped, `notifiedAssignedAt` and `notifiedCompletedAt`: one column cannot
distinguish "the assign email went out" from "the completion email went out",
so the second send would be suppressed by the first.

## Template seed rows are required before any email sends (deployment-blocking)

`NotificationsClientAdapter` calls notification-service's existing generic route,
`POST dispatch/email`, which resolves the recipient, applies preferences and
handles idempotency itself. No new route was added: this is an ordinary caller.

It sends `templateMachineName: 'drill_assignment_assigned'` and
`'drill_assignment_completed'`. **Those two template rows are not seeded.** Until
they exist, `dispatch/email` will not find a template and the call fails — caught
and logged by the hook, so nothing breaks, but no email goes out.

Seeding was left to the orchestrator rather than done here because the template
rows live in `notification-service/prisma`, and the two render functions from
G.1 have to be reachable from whatever the seeded row points at. Their input
shapes match the `context` the hook sends, with one gap: the routes must supply
`studentName`/`teacherName` and the absolute `runnerUrl`, `lessonUrl` and
`reviewUrl`, none of which education-service knows.

Note the interaction with idempotence: a dispatch attempted before the templates
are seeded still claims the `notified_*` timestamp, so it is **not** retried
afterwards. If any assignment transitions during that gap, clear its `notified_*`
column to let the email resend.

`createInApp` is a deliberate no-op. notification-service creates the in-app
record as part of dispatching, and its `in-app` controller exposes list,
mark-read and mark-all-read only — there is no create route, and a second call
would duplicate the record.

## Notes for the next track

- **`onCompleted` is wired; `onAssigned` has no call site yet.**
  `RunnerService.check` calls `onCompleted` after the COMPLETED write lands, and
  `DrillsModule` constructs the runner through a factory so the hook is actually
  injected. The runner depends on a narrow `DrillCompletionNotifier` interface
  rather than on `NotificationsHook` itself, and takes it as an optional third
  constructor argument, so every existing construction still compiles.

  `onAssigned` is **not** called anywhere, because there is nowhere correct to
  call it from yet. The only write of `status: 'ASSIGNED'` in the service is
  `SelfDrillService`, where `origin` is SELF — a student choosing their own
  practice. Sending "your teacher assigned you work" there would be wrong.
  The teacher-assign path that should fire it does not exist: the controller
  exposes only `POST :uuid/check` and `POST self`. **Whoever builds the teacher
  assign endpoint (Track F) must call `onAssigned` from it**, or students are
  never told they have work.
- `struggledWith` reports first-try misses only (`attemptNo: 1, isCorrect: false`),
  capped at 5, oldest first. It carries the sentence with blanks rendered as
  `___` and the blank's *prompt* — never the answer.
- `plainSentence` re-implements blank-stripping with the same regex as
  `DRILL_BLANK_PATTERN`. It is deliberately local rather than imported from
  `template.ts`, which exports `toSegments` for the runner rather than a
  plain-text renderer. If a third copy appears, promote it to the contract.

## Track G completion checklist

- [x] Both suites green, both typechecks clean (notification-service tsc has one
      pre-existing unrelated error, documented above)
- [x] The no-score assertion passes
- [x] Self-drill completion sends nothing to a teacher — tested, and the test
      verified to fail when the guard is removed
- [x] A failing dispatch neither throws nor blocks — tested
- [x] Status file at `status/track-g.md`
