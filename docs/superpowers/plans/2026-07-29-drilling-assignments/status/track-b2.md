# Track B2 — Runner API and the Self-Drilling Gate

**State:** COMPLETE — with one **deployment-blocking** handoff, see §"Will not boot yet"
**Service:** `speakasap/education-service` · **Branch:** `feat/drilling-assignments`
**Commits:** `cf186f8..0cb492c` (B2.1 → B2.4, four commits)
**Plan:** [`../08-runner-api.md`](../08-runner-api.md) · **Unblocks:** Tracks E, G

## Contract changes

**None.** C6 and C7 are consumed exactly as published.

## Verification run

```
$ rtk npm test                    # education-service
Test Suites: 11 passed, 11 total
Tests:       114 passed, 114 total   (73 from Track B + 41 new)

$ rtk npm run typecheck
> ./node_modules/.bin/tsc --noEmit -p tsconfig.json
exit 0 — clean
```

Every suite was confirmed to fail first. **Four falsifications were run** — the
source was deliberately broken, the test confirmed red, the source restored:

| # | Mutation | Result |
|---|---|---|
| 1 | add `answer`/`alternatives` back to the runner blank (cast past the type) | **4 leak tests fail** |
| 2 | replace the server count check with `grade.correct` | **2 tests fail** — see below |
| 3 | remove the self-drilling gate | **3 gate tests fail** |
| 4 | remove `@UseGuards(InternalTokenGuard)` | **guard test fails** |

Falsification 1 also showed a second, independent defence: the same edit **without**
the cast is rejected by TypeScript, because `RunnerBlankDTO` has no `answer` field.

## A real defect the falsification found

**The plan's completion test did not test what it claimed.** As written, it asserts
`assignmentCompleted === false` at 9/10 blanks — but its input is also a *wrong*
answer, so replacing the entire server-side count check with the client-facing
`grade.correct` **still passed it**. Only the idempotency test caught the mutant.

Added `does not complete on a correct answer while the server count is still short`,
which isolates the property: a **correct** answer against a short server count must
not complete the assignment. With it, the mutant fails 2 tests instead of 1. This is
the single most important property in the track — completion is server-decided — and
it was one test away from being unguarded.

## ⚠ Will not boot yet — REQUIRED handoff to Track D

`DrillsModule` deliberately does **not** bind three cross-service providers, all
owned by other tracks:

| Token | Needed by | Owner |
|---|---|---|
| `DrillSetsClient` (`getSet`, `incrementSelfSelected`) | `SelfDrillService` | Track D |
| `StudentProgressClient` (`getStudentProgress`) | `SelfDrillService` | Track D |
| `DrillIdentityResolver` (`resolveStudentId`) | `DrillsController` | Track D, using Track H's endpoint |

**Verified behaviour:** compiling the module throws immediately. That is the
intended failure mode — an unbound cross-service call must not be stubbed into a
silently-wrong runtime — but it means **education-service will not start until
Track D binds all three.** Do not deploy this service before then.

`DrillIdentityResolver` exists because `DrillAssignment.studentId` is the legacy
Django **integer** while `AuthContextUser.id` is a **UUID**. Bridging them is
Track H/I's `POST /internal/users/resolve-or-provision-legacy` (shipped, not yet
deployed), not this controller's business, so it is an injected boundary.

## Plan deviations — deliberate

1. **`template.ts` lives at `src/drills/`, not `src/drills/runner/`.** The plan said
   to copy it into `runner/`, but the file imports `./contracts` relatively; one
   directory deeper, that import does not resolve. Byte-identity and a working
   import are in direct conflict, and byte-identity is the one the drift test
   protects. Placed at matching depth so the copy stays **byte-identical**
   (sha256-enforced by `template.drift.spec.ts`).

2. **The projection fixture's hint was changed.** The plan's hint,
   `'(warten auf – ждать)'`, contains the answer `auf`, so the leak assertion
   `expect(json).not.toContain('auf')` fired on the **hint** — which is
   student-visible by design and asserted visible by another test in the same
   file. Per the plan's own instruction ("change the fixture, never the
   assertion"), the hint is now `'(warten + винительный падеж)'`. The plan
   anticipated this collision but predicted it would not occur.

3. **Falsification 3 fails 3 tests, not the plan's predicted 6.** The other three
   refusal tests cover the set-approval and lesson-order rules, which are separate
   checks further down the method — removing the outstanding-work gate correctly
   leaves them passing. The plan's estimate assumed all six shared one gate.

## Notes for Tracks E and G

1. **`selfDrillingAllowed` provably matches the gate.** Both derive from the same
   `ASSIGNED | IN_PROGRESS` filter (`findOutstanding` semantics, Track B note 8),
   so the portal cannot render a button that 409s. Do not recompute it from
   `findForStudent().active` — that includes GENERATING and PENDING_REVIEW.
2. **`acceptedText` is the student's raw trimmed text**, not the normalized form
   (Track B note 3). Render it verbatim; do not "fix" the casing in the UI.
3. **A revealed blank is `solved: true` with `solvedText: null`.** There is nothing
   of the student's to echo, and the answer is never substituted in. Render it as
   resolved-but-unattributed.
4. **`maxLength` is the longest accepted form + 6.** It is a rendering hint derived
   from a *length*, never from answer text. Do not treat it as an answer oracle.
5. `POST /drill-assignments/self` returns **201**; `check` returns **200**.
6. The single-blank case makes two status transitions in one request
   (Track B note 1) — `assignmentCompleted: true` can come back on the very first
   check.

## Deferred to the orchestrator (Track K)

- **No deploys.** No migration was created or applied by this track: Track B's
  `20260731044037_drill_assignments` already covers every table used here, and it
  was applied to production on 2026-07-31.
- Nothing was run against production; the postgres MCP was not used.
