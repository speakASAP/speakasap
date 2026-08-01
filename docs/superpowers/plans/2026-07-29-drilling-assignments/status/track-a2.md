# Track A2 — Drill Library: Sets, Search, Ratings

**State:** COMPLETE
**Service:** `speakasap/content-service` · **Branch:** `feat/drilling-assignments`
**Commits:** `9a3e1c4..` (A2.1 schema → A2.5 controller, five commits)
**Plan:** [`../06-library.md`](../06-library.md) · **Unblocks:** Tracks D, F

## Contract changes

**None.** C4 is consumed exactly as published. Tracks D and F may code against it as written.

## Verification run

```
$ rtk npm test                    # content-service
Test Suites: 15 passed, 15 total
Tests:       114 passed, 114 total   (91 from Track A + 23 new)

$ rtk npm run typecheck
> ./node_modules/.bin/tsc --noEmit -p tsconfig.json
exit 0 — clean

$ rtk npm run prisma:validate
The schema at prisma/schema.prisma is valid 🚀
```

Every suite was confirmed to **fail first** before implementation. Two
security-critical assertions were additionally **mutation-tested** — the source
was deliberately broken, the test was confirmed red, and the source restored:

| Mutation | Result |
|---|---|
| `validationState === 'FAIL'` → `false` (approval gate opens) | ✕ "refuses approval while any item is FAIL" — **caught** |
| leak `answer: 'LEAK'` into a student-facing set | ✕ "never returns answers" — **caught** |

## Completion checklist

- [x] `rtk npm test` green, `rtk npm run typecheck` clean
- [x] GIN index present in the migration SQL
- [x] Approval refuses on FAIL, permits on WARN and OVERRIDDEN — all three tested
- [x] Search-ignores-lesson test passing
- [x] Status file

## Plan deviations — all deliberate, all verified

1. **No `@@map`.** The plan's A2.1 mandates `@@map("drill_set")` etc., but
   `00-MASTER.md`'s own verified rule says content-service uses **no `@@map` at
   all**, and the live schema confirms it (17 models, zero maps). Followed the
   per-service convention; the master rule wins over the track file. Track A hit
   and corrected this identical defect (its note #1). **Consequence:** the GIN
   index targets `"DrillSet"`, not `drill_set`.

2. **Migration generated offline, never `prisma migrate dev`.** The plan says
   `migrate dev --create-only`; ecosystem rules forbid it against production
   (shadow DB, can prompt to reset on drift). Used
   `prisma migrate diff --from-schema-datamodel <committed schema> --to-schema-datamodel`,
   which never connects. `--from-migrations` was tried first and is unusable —
   it demands a real shadow database.

3. **Search uses `contains` + `mode: 'insensitive'`, not Prisma's `search`.**
   The plan's documented fallback. `fullTextSearch` is a preview feature and is
   **not enabled** on this schema (Prisma 5.22, no `previewFeatures` block).
   Enabling it would change generated-client behavior service-wide — out of this
   track's ownership. Slower than the GIN index allows, but correct.
   **The GIN index is already in place** for whenever the flag is turned on.

4. **No staff guard on the detail route — because content-service has none.**
   The plan says "find content-service's equivalent [staff guard] and use it."
   There is no equivalent: no auth guard, no JWT/passport dependency, no
   `src/auth/` directory, and every existing controller is unguarded. Followed
   Task A.8's precedent instead: the answer-carrying routes live under the
   `internal/` prefix, which the gateway gates behind `x-internal-token`.

## ⚠ Handoff to Track 0 / K — REQUIRED GATEWAY ROUTE

`api-gateway/src/proxy/upstream-resolve.ts` is Track 0's file, **not mine**, so I
did not edit it. It currently routes `/api/v1/drill-sets` publicly and has **no
`/api/v1/internal/drill-sets` entry.**

**Until that entry is added, these routes are unreachable through the gateway:**

```
GET  /api/v1/internal/drill-sets/:uuid          # carries answers
POST /api/v1/internal/drill-sets
POST /api/v1/internal/drill-sets/:uuid/approve
```

Add alongside the existing `/api/v1/internal/drill-items` entry:

```ts
{ prefix: '/api/v1/internal/drill-sets', envKey: 'CONTENT_SERVICE_URL' },
```

**It must be ordered before the public `/api/v1/drill-sets` prefix**, or the
public rule will shadow it and the detail route becomes student-reachable —
which is precisely the A.8 vulnerability again. This is a security-relevant
ordering constraint, not a cosmetic one.

## Deferred to the orchestrator (Track K)

- **Migration `20260801093000_drill_library` is created and NOT applied.**
  Additive only — three `CREATE TABLE`s, four FKs, six indexes, zero drops, zero
  column changes. Safe to apply, but it must go through the deploy lock like
  Track A's three pending migrations.
- No deploys, no data writes. Nothing was run against production.

## Notes for Tracks D and F

1. **`SetsService.list` never returns answers** — it returns `DrillSetDTO`, which
   has no item text at all. Only `getSet` returns `DrillSetDetailDTO` with
   `blanks`. If Track F needs a teacher preview, it must call the internal route.
2. **`createSet` writes `searchText` in a second pass** (`updateSearchText`),
   because the text is the concatenated `plainText` of items that do not exist
   until the nested create resolves. Call `updateSearchText(uuid)` after **any**
   change to a set's items or search silently goes stale.
3. **Vote counts are recounted, not incremented** — `SUM(value)` grouped by
   `raterType`, inside the rating transaction. A rater flipping +1 to −1 cannot
   drift the stored counter.
4. **`approveSet` is idempotent** and preserves the original `approvedAt` on
   re-approval. A double-click will not 409.
5. **The rater is the caller, never the body.** `rateSet` takes a `RaterContext`.
   Whoever wires the HTTP layer must populate it from the token — passing a
   body-supplied `raterId` would let a student cast a 3×-weighted teacher vote.
6. Track A's warning still stands and is **not** addressed here: `GrammarLesson`
   has 0 rows, so `DrillTopicDTO.publicUrl` is `null` for every topic.

## Pre-existing issue, unchanged

Track A's out-of-scope finding still stands: `api-gateway`'s auth guard performs
**no role check anywhere**. This track's `internal/` placement works *because* of
that gap rather than in spite of it. It still deserves its own sweep.
