# Track B — Assignment Domain and Grading · STATUS: COMPLETE

**Service:** `speakasap/education-service` · **Branch:** `feat/drilling-assignments`
**Track base:** `aa38676` · **Last updated:** 2026-07-31 (after whole-track review fix wave)
**Plan:** [`../03-education-core.md`](../03-education-core.md)

Tasks B.1–B.4 are implemented, reviewed, fixed and committed. The consolidated fix wave
from the final whole-track review is applied. **Blocks nothing — B2, D, E and G are clear
to start.**

---

## 1. What Track B delivers

| File | What it is |
|---|---|
| `education-service/prisma/schema.prisma` | The four drill models (`DrillAssignment`, `DrillAssignmentItem`, `DrillAttempt`, `DrillAssignmentBatch`) plus back-relations on `Lesson`, `StudentCourse` |
| `education-service/prisma/migrations/20260731044037_drill_assignments/` | Their migration — **created, never applied** |
| `education-service/src/drills/grading.ts` | The grading engine — pure functions, no I/O |
| `education-service/src/drills/state-machine.ts` | The assignment lifecycle |
| `education-service/src/drills/assignments.repository.ts` | Prisma access + progress counts |
| `education-service/src/drills/assignment.mapper.ts` | Row → `DrillAssignmentDTO` |

Not delivered here, by scope: `src/drills/orchestration/**` (Track D), the runner/check/
reveal endpoints (Track B2), and any NestJS module wiring (see handoff note 4).

### Invariants this track holds

- **Answers are server-side only.** No value reachable from a student-authenticated path
  returns `answer` or `alternatives`. `AssignmentRow` selects `items` down to `{ uuid }`
  precisely so `return row` cannot leak them.
- **`firstTryAccuracy` is never teacher-facing.** It is on `AssignmentRow` (a scalar on
  the row) but on no DTO. `toAssignmentDTO` lists fields explicitly — never spreads —
  and two tests exist to catch a spread being reintroduced.
- **Contract types are never redeclared locally.** Everything imports from
  `src/drills/contracts.ts`. **No contract type was changed in this wave.**

---

## 2. Interfaces B2 / D / E / G consume — exact signatures

```ts
// src/drills/grading.ts
export interface GradingOptions { caseSensitive: boolean }
export interface GradeResult { correct: boolean; acceptedText: string | null }

export function gradingOptionsFor(languageCode: string): GradingOptions;
export function normalizeAnswer(value: string, opts: GradingOptions): string;
export function gradeBlank(value: string, blank: DrillBlank, opts: GradingOptions): GradeResult;

// src/drills/state-machine.ts
export const TERMINAL_STATUSES: ReadonlySet<DrillAssignmentStatus>;  // COMPLETED, CANCELLED
export function canTransition(from: DrillAssignmentStatus, to: DrillAssignmentStatus): boolean;
export function assertTransition(from: DrillAssignmentStatus, to: DrillAssignmentStatus): void;

// src/drills/assignments.repository.ts
export type AssignmentRow = Prisma.DrillAssignmentGetPayload<{
  include: { items: { select: { uuid: true } } };
}>;
export interface BlankCounts { blanksCorrect: number; blanksTotal: number }
export interface StudentAssignments { active: AssignmentRow[]; completed: AssignmentRow[] }

class AssignmentsRepository {
  findForStudent(studentId: number): Promise<StudentAssignments>;
  findOutstanding(studentId: number): Promise<AssignmentRow | null>;
  countBlanks(assignmentUuid: string): Promise<BlankCounts>;
  countBlanksFor(assignmentUuids: string[]): Promise<Map<string, BlankCounts>>;
}

// src/drills/assignment.mapper.ts
export function toAssignmentDTO(
  row: any,
  counts: { blanksCorrect: number; blanksTotal: number },
): DrillAssignmentDTO;
```

### Semantics you must not get wrong

- **`findForStudent().active` is NOT `outstanding`.** `active` is every non-terminal
  assignment (GENERATING included, so the student sees generation progress). The
  contract's `outstanding` — which drives `selfDrillingAllowed` — means **ASSIGNED |
  IN_PROGRESS only**. Derive `selfDrillingAllowed` from `findOutstanding`. Equating the
  two blocks a student on a `PENDING_REVIEW` assignment they cannot act on.
- **`countBlanks` counts RESOLVED positions: `isCorrect = true` OR `revealed = true`.**
  The DTO field is still named `blanksCorrect` (renaming a contract field consumed by
  four tracks is out of scope). Distinct `(itemUuid, blankIndex)` — the same position
  resolved twice counts once. Do not "fix" this back to `isCorrect` alone.
- **Use `countBlanksFor` for lists.** `countBlanks` is two queries per uuid; a list of 11
  assignments through it costs 2 + 2N. `countBlanksFor` is two queries total, same
  semantics, and every input uuid is present in the map (zeros, never absent).
- **`gradeBlank` never throws on a malformed persisted blank.** A non-string `answer`
  returns `{ correct: false, acceptedText: null }` (ungradeable); a missing/non-array
  `alternatives` is treated as `[]`. Behaviour on well-formed input is unchanged.
- **`acceptedText` is the student's raw trimmed text**, not the normalized form — see
  handoff note 3.
- **`assertTransition` throws a bare `ConflictException`** whose body does not satisfy
  `DrillErrorBody` — see handoff note 5.

---

## 3. Verification — pasted output

### Full test suite

```
$ rtk npm test
> jest --passWithNoTests
PASS src/drills/assignments.repository.spec.ts
PASS src/drills/state-machine.spec.ts
PASS src/drills/grading.spec.ts
PASS src/drills/assignment.mapper.spec.ts
PASS src/shared/validate-env.spec.ts
PASS src/shared/validate-env.k8s.spec.ts
Test Suites: 6 passed, 6 total
Tests:       73 passed, 73 total
Snapshots:   0 total
Time:        0.77 s, estimated 1 s
Ran all test suites.
```

Drill suites alone: 68 of those 73 (`grading` 22, `assignments.repository` 23,
`state-machine` 18, `assignment.mapper` 5).

### Typecheck

```
$ rtk npm run typecheck
> ./node_modules/.bin/tsc --noEmit -p tsconfig.json
$ echo $?
0
```

Run via the workspace compiler by path, never `npx tsc`. **The pass was falsified** —
changing `gradingOptionsFor(languageCode: string)` to `: number` produced:

```
src/drills/grading.spec.ts(131,30): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
src/drills/grading.spec.ts(135,30): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
src/drills/grading.spec.ts(139,30): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
src/drills/grading.ts(16,56): error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
```

so the green above is a real green, not a compiler that never ran.

### Migration status — APPLIED to production 2026-07-31

> **Superseded.** The section below recorded the state at the end of implementation,
> when the migration was created but not applied. It was applied to production on
> 2026-07-31 with the owner's explicit authorization (no paid users on this database —
> test users only). Procedure and verification are in "Migration applied" immediately
> after this block. Handoff note 10 is therefore closed.

### (historical) Migration status — created, NOT applied

Authoritative check against the live `speakasap_education_db` (read-only, via the
postgres MCP):

```sql
SELECT migration_name, finished_at IS NOT NULL AS applied FROM _prisma_migrations ORDER BY migration_name;

migration_name,applied
20260412120000_init_education_core,t
20260612120000_lesson_record_metadata,t
20260612143000_student_access,t
20260613130000_lesson_record_duration_seconds,t
```

`20260731044037_drill_assignments` is **absent from the migration history**.

```sql
SELECT count(*) AS drill_tables_present FROM information_schema.tables
 WHERE table_schema='public' AND table_name LIKE 'drill_%';

drill_tables_present
0
```

No drill table exists in the database. The migration is created and unapplied, as
required.

### Migration applied — 2026-07-31 (supersedes the block above)

Applied to production `speakasap_education_db` with the owner's explicit
authorization. Procedure, in order:

1. **`kubectl port-forward -n statex-apps svc/db-server-postgres 5432:5432`** — the
   sanctioned route. Not a direct ClusterIP connection; see the ecosystem CLAUDE.md
   rule added the same day.
2. **Scratch-database dry run**, closing the gap that handoff note 10 raised — this SQL
   had never been executed anywhere:
   - `pg_dump --schema-only --no-owner --no-privileges` of the production database
   - restored into a throwaway `drill_dryrun` database
   - the migration applied to it with `ON_ERROR_STOP=1` → **executed cleanly**
   - verified 4 tables, 6 FKs, 13 indexes (9 declared + 4 primary keys)
   - `drill_dryrun` dropped afterwards
3. **`npm run prisma:migrate:deploy`** — `migrate deploy`, never `migrate dev`. Output:
   `Applying migration 20260731044037_drill_assignments` … `All migrations have been
   successfully applied.`

Post-apply verification against production:

```
drill tables      : drill_assignment, drill_assignment_batch, drill_assignment_item, drill_attempt
_prisma_migrations: 20260731044037_drill_assignments | applied | rolled_back=f
constraints       : 6 FKs, 13 indexes
legacy row counts : education_lesson=182600, education_studentcourse=20125, education_lessonrecord=101184
drift column      : education_lessonrecord.updated default = CURRENT_TIMESTAMP  (untouched, as intended)
```

Legacy row counts are unchanged from before the migration, and the deliberately
stripped `DROP DEFAULT` never ran — `education_lessonrecord.updated` still carries its
`CURRENT_TIMESTAMP` default. No scratch or shadow databases remain; the port-forward was
closed.

**Handoff note 10 is closed.** The drift documented at `schema.prisma:116-123` remains
open and is unrelated to this feature.

### How the migration was regenerated (offline — no database touched)

Findings 4 and 5 changed the schema. The migration had never been applied, so it was
regenerated **into the same directory** rather than appended as a second migration.
`prisma migrate dev` was **not** used, for two independent reasons: the only configured
datasource (`EDUCATION_TARGET_DATABASE_URL`) is production, where `migrate dev` creates a
shadow database and can prompt for a reset; and it is not reachable from the build host
anyway (`Error: P1001: Can't reach database server at 127.0.0.1:5432` — Postgres lives in
the cluster). The SQL was produced by a datamodel→datamodel diff, which touches no
database:

```bash
rtk git show aa38676:education-service/prisma/schema.prisma > /tmp/schema-base.prisma
rtk npx prisma migrate diff \
  --from-schema-datamodel /tmp/schema-base.prisma \
  --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/migrations/20260731044037_drill_assignments/migration.sql
```

Because both sides are datamodels, the diff never emits the
`ALTER TABLE "education_lessonrecord" ALTER COLUMN "updated" DROP DEFAULT;` drift
statement a DB-backed diff produces — so there was nothing to strip and no hand-editing
occurred. The result is exactly the four drill tables, their indexes and their foreign
keys, verified to contain no `DROP`, no `ALTER COLUMN` and no reference to
`education_lessonrecord`.

### Foreign keys in the regenerated migration

```sql
ALTER TABLE "drill_assignment" ADD CONSTRAINT "drill_assignment_lesson_uuid_fkey" FOREIGN KEY ("lesson_uuid") REFERENCES "education_lesson"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drill_assignment" ADD CONSTRAINT "drill_assignment_student_course_uuid_fkey" FOREIGN KEY ("student_course_uuid") REFERENCES "education_studentcourse"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drill_assignment" ADD CONSTRAINT "drill_assignment_batch_uuid_fkey" FOREIGN KEY ("batch_uuid") REFERENCES "drill_assignment_batch"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drill_assignment_item" ADD CONSTRAINT "drill_assignment_item_assignment_uuid_fkey" FOREIGN KEY ("assignment_uuid") REFERENCES "drill_assignment"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drill_attempt" ADD CONSTRAINT "drill_attempt_assignment_uuid_fkey" FOREIGN KEY ("assignment_uuid") REFERENCES "drill_assignment"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drill_attempt" ADD CONSTRAINT "drill_attempt_item_uuid_fkey" FOREIGN KEY ("item_uuid") REFERENCES "drill_assignment_item"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
```

`DrillAssignmentItem.sourceItemId` is deliberately **bare** — it points at
content-service's `DrillItem` in a different database. Do not "complete the set".

### Indexes in the regenerated migration

```sql
CREATE INDEX "drill_assignment_student_id_status_idx" ON "drill_assignment"("student_id", "status");
CREATE INDEX "drill_assignment_teacher_id_status_idx" ON "drill_assignment"("teacher_id", "status");
CREATE INDEX "drill_assignment_lesson_uuid_idx" ON "drill_assignment"("lesson_uuid");
CREATE INDEX "drill_assignment_set_uuid_idx" ON "drill_assignment"("set_uuid");
CREATE INDEX "drill_assignment_student_course_uuid_idx" ON "drill_assignment"("student_course_uuid");
CREATE INDEX "drill_assignment_batch_uuid_idx" ON "drill_assignment"("batch_uuid");
CREATE UNIQUE INDEX "drill_assignment_item_assignment_uuid_order_key" ON "drill_assignment_item"("assignment_uuid", "order");
CREATE INDEX "drill_attempt_assignment_uuid_item_uuid_blank_index_is_corr_idx" ON "drill_attempt"("assignment_uuid", "item_uuid", "blank_index", "is_correct", "revealed");
CREATE INDEX "drill_attempt_item_uuid_idx" ON "drill_attempt"("item_uuid");
```

Two things to know about `drill_attempt`:

- `drill_attempt_item_uuid_idx` supports `drill_attempt_item_uuid_fkey`'s
  `ON DELETE CASCADE`. Postgres does not auto-index foreign keys, and the composite index
  leads with `assignment_uuid`, so without it every delete of a `drill_assignment_item`
  sequentially scanned `drill_attempt` — 20 scans to delete one 20-item assignment, on
  the fastest-growing table in the feature.
- The composite index was **widened** from `(assignment_uuid, item_uuid)` to cover
  `countBlanks`/`countBlanksFor`, which filter
  `assignment_uuid IN (...) AND (is_correct OR revealed)` and select only
  `(item_uuid, blank_index)`. Every column that query touches is in the index, so it is
  answered by an index-only scan; the `(assignment_uuid, item_uuid)` prefix is preserved,
  so per-item lookups lose nothing and no second index is needed.

---

## 4. Handoff notes — B2 / D / E / G must read these

**1. A single-blank assignment needs two transitions in one request.**
`canTransition('ASSIGNED','COMPLETED')` is deliberately `false`. When the first check is
also the last, the handler must run `ASSIGNED → IN_PROGRESS` and then
`IN_PROGRESS → COMPLETED` **in the same request**. Doing it in one step throws a 409 at a
student who answered correctly.

**2. Generation failure has exactly one exit.** There is no `FAILED` assignment status —
`GenerationPhase: 'FAILED'` lives only in the progress JSON — and `ALLOWED.GENERATING`
permits only `PENDING_REVIEW | ASSIGNED | CANCELLED`. **Track D must move a failed job to
`CANCELLED`** or it strands in `GENERATING`, where `findForStudent`'s `active` bucket
keeps surfacing it to the student forever.

**3. `acceptedText` is the student's raw trimmed text, not the normalized form.** Input
`"  auf.  "` against answer `"auf"` returns `'auf.'` — punctuation preserved, original
casing preserved. This is deliberate (normalization lowercases for case-insensitive
languages, so echoing it would render a correctly typed `"Schule"` as `"schule"`), and
the contract doc comment says so. The frontend renders it verbatim; **do not "fix" it in
the UI layer.**

**4. `AssignmentsRepository` is not registered in any NestJS module.** No
`drills.module.ts` exists yet, so as shipped the class is **unreachable at runtime**.
Track D presumably creates the module; **B2 must not assume DI is already wired.**

**5. `assertTransition`'s error body does not satisfy `DrillErrorBody`.** It throws a bare
`ConflictException`, whose body is Nest's default `{ statusCode, error, message }` — no
`code` field. `DrillErrorCode` was reviewed and **no existing member fits a generic
illegal transition** (`GENERATION_IN_PROGRESS` is narrower and would be a lie for, say,
`COMPLETED -> IN_PROGRESS`). No code was invented and the contract was not changed.
**Callers must catch and re-wrap it** at the controller/filter layer; any HTTP boundary
that lets it escape returns a body other tracks cannot parse.

**6. `toAssignmentDTO(row: any, …)` has two preconditions TypeScript cannot enforce.**
`row` must be fetched **with `items` included** (otherwise `itemCount` silently reports
`0`), and must be a **live Prisma row, not JSON** (the four date fields are called as
`Date` objects, so a cache read / HTTP hop / queue payload throws
`row.createdAt.toISOString is not a function`). Both are documented on the function.

**7. The reveal endpoint (spec §9.6) must write `{ isCorrect: false, revealed: true }`.**
That is the shape `countBlanks` treats as resolved. First-try accuracy is computed
elsewhere from `attemptNo = 1 AND isCorrect`, which a reveal never satisfies — so bank
selection stays clean. Whoever implements that query: do not break the property.

**8. `InternalStudentAssignmentsResponse.outstanding[]` is NOT `findForStudent().active`.**
The contract (`contracts.ts:371-375`) has an `outstanding: DrillAssignmentDTO[]` array
alongside `completedRecent`. `active` is the natural mapping *by position* and the wrong
one *by name*: `active` is everything non-terminal, so it includes `GENERATING` and
`PENDING_REVIEW` assignments a student cannot act on, while "outstanding" everywhere else
in this feature means `ASSIGNED | IN_PROGRESS`. **B2 must decide deliberately** which it
serializes, and `selfDrillingAllowed` must derive from `findOutstanding()` either way —
never from `active.length`.

**9. `countBlanksFor(uuids)` does not chunk its `IN (…)` clauses.** Fine at the intended
call sites (page-sized lists, ~11 assignments). A caller passing thousands of uuids would
hit the Postgres bind-parameter ceiling. Chunk at the call site, or add chunking here
before any bulk/reporting consumer uses it.

**10. Track K — dry-run this migration before production.** The migration SQL was
generated **offline** via `prisma migrate diff --from-schema-datamodel … --to-schema-datamodel`
because the target datasource is production and pointing `migrate dev` at it would have
created a shadow database (and risked a reset prompt). Two reviews verified the SQL is
column-for-column, index-for-index and FK-for-FK faithful to `schema.prisma`, and that
both legacy FK targets (`education_lesson`, `education_studentcourse`) have primary keys
on `uuid`. But **the script has never been executed against any database** — the
shadow-DB executability check that `migrate dev` gives for free was skipped. Apply it once
to a throwaway database restored from a production schema dump before applying to
production. That closes the only residual gap.

Related: a datamodel→datamodel diff cannot see drift between `prisma/migrations/*` and
`schema.prisma`. Here that is harmless and deliberate — see the `LessonRecord.updatedAt`
comment at `schema.prisma:116-123` — but do not read this migration's cleanliness as
evidence that this service has no schema drift. It has some, and it is documented there.

---

## 5. Commit history

| SHA | Subject |
|---|---|
| `1a38ed5` | fix(education): add missing DrillAttempt foreign keys |
| `b282f2c` | feat(education): grading engine |
| `6c46aa5` | test(education): fix tautological NFC-normalization test in grading spec |
| `b5f6981` | docs(contracts): correct acceptedText to the student's raw typed text |
| `f052d43` | feat(education): assignment state machine |
| `fc0aae1` | fix(education): harden canTransition to handle unexpected statuses |
| `745faff` | docs: update Task B.3 plan with defensive status handling |
| `3cef932` | feat(education): assignment repository and DTO mapper |
| — | *whole-track review fix wave, 2026-07-31 — see the repo log from `3cef932`* |

Full detail of the fix wave, including every falsification run, is in
`speakasap/.superpowers/sdd/03-education-core/final-fix-report.md`.
