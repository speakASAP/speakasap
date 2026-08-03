# Track E — Student Runner UI

**State:** CODE COMPLETE — not yet deployed or exercised against a real assignment
**Service:** `speakasap/frontend` · **Branch:** `feat/drilling-track-e` (from `main`)
**Commits:** `e3fd394` (E.2 api) · `67445d5` (E.3 DrillRunner) · `caf73e1` (E.4 pages) · `55f2bf7` (route removal) · `f6e9c32` (self-drill library)
**Plan:** [`../09-frontend-learner.md`](../09-frontend-learner.md) · **Blocks:** nothing

## Verification on the final tree

```
Test Files  10 passed (10)
     Tests  110 passed (110)

> ./node_modules/.bin/tsc --noEmit -p tsconfig.json      (clean, no output)
```

35 of those tests are new; the other 75 are Track F's and still pass unchanged.

**Guards proven by breaking them,** not by trusting a green run:

| Broken behaviour | Test that went red |
|---|---|
| `NetworkError` downgraded to a plain `Error` | `throws a typed NetworkError on a transport failure` |
| completion inferred from `response.correct` instead of `assignmentCompleted` | `calls onComplete exactly once, and only when the SERVER says completed` |
| a transport failure marked `aria-invalid` | `shows "not saved" rather than marking wrong when the network fails` |

Each was reverted and the suite reconfirmed green afterwards.

## What was built

| File | Purpose |
|---|---|
| `lib/drills/runner/api.ts` | Student-facing client. Separate module from the teacher client by design. |
| `lib/drills/runner/DrillBlank.tsx` | One blank: input until solved, then the student's own words as a `<span>`. |
| `lib/drills/runner/DrillRunner.tsx` | The runner. Debounce 250 ms, plus check on Enter and on blur. |
| `lib/drills/runner/SelfDrillBrowser.tsx` | Approved-set list and the outstanding-assignment lock. |
| `app/learner/practice/page.tsx` | Assigned work first, then the self-drill browser. |
| `app/learner/practice/[uuid]/page.tsx` | One assignment, running. |

## Three decisions worth carrying forward

**The server is the authority on three separate things, and each has its own test.**
Completion comes from `assignmentCompleted`, never from a local count — the assignment
may span items this component was never given. Progress comes from the server's
`blanksCorrect`/`blanksTotal` for the same reason; the test asserts the bar reads 4 of 7
while the component renders a single blank, which a local tally could never produce.

**A transport failure is not a wrong answer.** `NetworkError` is a distinct type from
`DrillRunnerError` precisely so the UI can tell them apart: a dropped request shows
"not saved" and leaves the input clean and editable. Marking it wrong would teach the
student that their correct answer was incorrect. One retry happens first, because a
single dropped request is the common case.

**`selfDrillingAllowed` is advisory, not the gate.** The server enforces it. The flag can
go stale in a tab left open while a teacher assigns new work, so a 409 on start renders
as a normal outcome — the page keeps working and the set stays listed.

## Two plan corrections

**`NEXT_PUBLIC_API_URL` is set in tests.** The plan's E.2 snippet asserts a relative
`/api/v1/...` path, but Track 0 pins `NEXT_PUBLIC_API_URL: 'https://api.test'` in
`vitest.config.ts` with a comment explaining why. The assertions were corrected to the
absolute URL; the production code was not changed to suit the test.

An absent base still yields a **relative** URL rather than throwing (the teacher client
throws). The runner is served from the gateway's own origin, so same-origin is the right
default, and failing here would break a student's page over optional configuration.

**`revealBlank` and `rateAssignment` were removed, not shipped.** The plan's E.2
interface list names them, but education-service exposes **no `/reveal` and no `/rate`
route** — verified across the whole service, and neither appears in the shared contracts.
Clients for them would 404 while reading as finished features.

Reveal is the closer of the two and worth a follow-up: `DrillBlankAttempt.revealed`
exists, and `assignments.repository.ts:93-103` already defines what a revealed blank
means for completion and for keeping bank-selection statistics clean. Only the HTTP
route is missing.

## Not done — deployment and manual verification

The plan's checklist asks for "a manual browser check of one real assignment recorded in
the status file". **That has not happened**, and the reason is a hard blocker rather than
an omission:

> Drill assignments in prod: **0**. Drill sets in prod: **0**.
> — `../../2026-08-03-infrastructure-findings/00-HANDOFF-PROMPT.md`

The test rows from the Finding 7 verification were deleted afterwards, so there is no
assignment to open. A real check needs a teacher to generate, approve and assign a set —
the Track F path — after which `/learner/practice` should list it and
`/learner/practice/<uuid>` should run it.

Also untested end to end, and stated in the same handoff: the teacher review screen
against a real set, approval, and the assign-to-student path that fires `onAssigned`.

**Not deployed.** Nothing in this track has been built into an image or rolled out.
Per the deploy rules, the frontend goes out with `../shared/scripts/deploy.sh speakasap`
— never `./scripts/deploy.sh`, which is retired and builds nothing.

## Handoff

- The branch `feat/drilling-track-e` is unmerged. Track F merged into `main` before it,
  so there is no conflict with `lib/drills/teacher/**`.
- The self-drill library is wired to `GET /drill-sets/available-for-me`, not to the
  teacher client's `/drill-sets`. content-service enforces APPROVED-only and
  lesson-scoping inside that route and returns no answers, which is what makes it safe
  for a student-authenticated caller. It is fetched in parallel with the assignments,
  and a failure there leaves the list empty rather than failing the page — assigned work
  is the more important half and does not depend on it.
