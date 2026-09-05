# Работа над ошибками — error analysis and remedial drills

**Date**: 2026-08-12
**Service**: education-service (primary), ai-microservice (one new endpoint), frontend
**Status**: Design approved, ready for implementation planning

---

## 1. Problem

A teacher assigns a drilling session on a topic. The student works through it and makes
mistakes. Today those mistakes are recorded (`DrillAttempt`) and shown to the teacher on
the progress page — and that is where they stop. Nothing explains to the student *why* an
answer was wrong, and nothing turns the mistakes into further practice.

The company goal is that the student ends up knowing the language better, not merely that
the drill was completed. That requires two things the system does not do:

1. **Explain the gap.** The student who wrote `across` where `through` belongs does not
   know which rule they broke. A list of red words is not a lesson.
2. **Drill the gap again.** A word missed once is a word not yet learned. It has to come
   back, in new sentences, until it is answered right on the first try repeatedly.

## 2. Solution overview

Four pieces:

1. **Analysis pipeline** — when a drill completes, cluster the student's mistakes into
   grammar gaps drawn from a fixed per-language taxonomy. Each cluster carries an
   explanation, the rules to remember, and worked examples.
2. **Mastery tracking** — per student, per word, a clean-streak counter. Three
   consecutive first-try-correct appearances retire the word from remedial work.
3. **Remedial drill generation** — teacher-initiated, one assignment per gap cluster,
   composed from that gap's failed words.
4. **UI** — the grammar block below the finished drill for both student and teacher, a
   generate button per gap on the teacher's progress page, and the same grammar block at
   the top of the remedial assignment.

The explanation is written **once**, stored **once**, and rendered in **both** places.

---

## 3. Existing architecture (what this builds on)

| Concern | Where it lives today |
|---|---|
| Assignment / item / attempt rows | `education-service` Prisma: `DrillAssignment`, `DrillAssignmentItem`, `DrillAttempt` |
| Generation pipeline | `education-service/src/drills/orchestration/generation.service.ts` — RESOLVING → BANK → GENERATING → VALIDATING → READY |
| Item bank | content-service, via `ContentClient.searchItems` |
| Model calls | ai-microservice `POST /api/teacher-assistant/{generate,validate}-drill`, education-service's Auth-issued service credential, **not** the caller's token |
| Grading / normalization | `education-service/src/drills/grading.ts`, `gradingOptionsFor(languageCode)` |
| Completion transition | `RunnerService.check()` — `IN_PROGRESS → COMPLETED`, then `notifications.onCompleted` |
| Teacher mistake view | `TeacherAssignmentsService.progressForTeacher` — already aggregates `wrongAttempts` per blank |
| Review gate | `PENDING_REVIEW` → `assignApprovedSet` → `ASSIGNED` |
| Sentence editing | `updateAssignmentItem` / `addAssignmentItem` / `deleteAssignmentItem` |
| Student runner page | `frontend/app/learner/practice/[uuid]/page.tsx` |
| Teacher progress page | `frontend/app/teacher/assignments/[uuid]/progress/page.tsx` |

Nothing in the list is replaced. The analysis pipeline is a sibling of the generation
pipeline, and remedial generation reuses the generation pipeline with a new job flavour.

---

## 4. Decisions taken (and the alternatives rejected)

| # | Decision | Rejected alternative | Why |
|---|---|---|---|
| D1 | Remedial drill is **teacher-initiated** (a button on the progress page) | Fully automatic on completion; auto-generate into the review queue | No model spend on a completion nobody will act on; the teacher decides whether the gap is worth a second assignment |
| D2 | Analysis runs **automatically on completion**, fire-and-forget | Lazy on first read | The student should see the explanation the moment they finish, not after a 60s wait |
| D3 | Remedial drills are **100% error words**, no filler from correct answers | 70/30 split with correctly-answered words | Keeps assignments short; the padding rule (D5) already supplies discrimination practice |
| D4 | `repeats = mistakeCount`, strict — no floor, no cap | `max(2, n)`; `clamp(n, 2, 4)` | A word missed once needs one repetition, not two. Keeps sentence counts small |
| D5 | Below 10 required slots, **pad with new sentences on the same grammar topic**, different vocabulary | Pad by repeating the same error words; drop the 10-minimum | Re-typing three words four times tests memory. Testing the *rule* with new words is what proves the gap closed |
| D6 | Gap clusters constrained to a **fixed per-language taxonomy** | Group by the source assignment's `topicSlug`; free-text LLM clusters | `topicSlug` is uniform across a generated set, so it yields one cluster and no grouping. Free text can never be compared across assignments or over time — stable slugs are what make "which gaps does this student keep failing" answerable |
| D7 | Mastery tracked **per word** (`student × languageCode × normalizedAnswer`) | Per gap-topic; both | Matches the requirement literally, and makes selection trivial. A derived topic view avoids a second store that can drift |
| D8 | A clean appearance = **first attempt correct, blank never revealed** | Any eventual correct answer | A word solved on the fourth try is not known. Anything else advances the streak on a word the student guessed |
| D9 | Gap analysis stored as **one row per cluster** (`DrillGapAnalysis`) | JSON blob on the assignment; a copy on each remedial drill | Rows are queryable and reusable across students; a snapshot copy makes a bad explanation unfixable everywhere |
| D10 | Explanation language = `materialLanguage` | Browser locale; always the target language | The course already decides what language the pair works in; `panel_language` in the portal follows the same rule |
| D11 | Max **20 sentences per assignment**, overflow splits into "часть N" | Uncapped | Keeps one session to roughly 10–15 minutes |

---

## 5. Data model

All new tables live in education-service's database, alongside the existing drill tables.

### 5.1 `GrammarTopic` — the taxonomy

```
slug            String  @id          // "en.prepositions-of-place"
languageCode    String  @db.VarChar(8)
titles          Json                 // { "ru": "Предлоги места", "en": "Prepositions of place" }
sortOrder       Int
createdAt       DateTime @default(now())

@@index([languageCode])
```

Seeded per language from a checked-in seed file. Not editable at runtime. Every language
has a permanent `<lang>.other` row so the analyzer always has a legal target.

### 5.2 `DrillAnalysisRun` — one per completed assignment

```
uuid                  String   @id @db.Uuid
sourceAssignmentUuid  String   @unique @db.Uuid
studentId             Int
status                String   @db.VarChar(16)   // PENDING | RUNNING | READY | NO_ERRORS | FAILED
errorMessage          String?  @db.Text
attemptCount          Int      @default(0)
startedAt             DateTime?
finishedAt            DateTime?
createdAt             DateTime @default(now())

sourceAssignment      DrillAssignment @relation(fields: [sourceAssignmentUuid], references: [uuid], onDelete: Cascade)
clusters              DrillGapAnalysis[]

@@index([studentId, status])
```

Exists so a failure is a visible state rather than an absence of clusters. This is what
the student's page polls.

`NO_ERRORS` and `FAILED` are distinct and must stay distinct through every layer to the
UI. An empty grammar block must never stand in for a failed analysis.

### 5.3 `DrillGapAnalysis` — one per gap cluster

```
uuid                  String   @id @db.Uuid
runUuid               String   @db.Uuid
sourceAssignmentUuid  String   @db.Uuid
studentId             Int
topicSlug             String                      // FK-by-value to GrammarTopic.slug
languageCode          String   @db.VarChar(8)
materialLanguage      String   @db.VarChar(2)
title                 String   @db.VarChar(255)
explanation           String   @db.Text
rules                 Json     @default("[]")     // string[]
examples              Json     @default("[]")     // [{ text, gloss }]
failedAnswers         Json     @default("[]")     // [{ answer, normalized, mistakeCount, wrongAttempts[] }]
editedByTeacherId     Int?
editedAt              DateTime?
createdAt             DateTime @default(now())

run                   DrillAnalysisRun @relation(fields: [runUuid], references: [uuid], onDelete: Cascade)
topic                 GrammarTopic     @relation(fields: [topicSlug], references: [slug])
remedialAssignments   DrillAssignment[]

@@unique([sourceAssignmentUuid, topicSlug])
@@index([studentId, topicSlug])
```

The `@@unique` makes re-running an analysis idempotent per cluster.

### 5.4 `StudentWordMastery`

```
uuid             String   @id @db.Uuid
studentId        Int
languageCode     String   @db.VarChar(8)
normalizedAnswer String   @db.Text
displayAnswer    String   @db.Text        // last seen surface form, for the teacher's weak-word list
cleanStreak      Int      @default(0)
totalMistakes    Int      @default(0)
lastSeenAt       DateTime
masteredAt       DateTime?

@@unique([studentId, languageCode, normalizedAnswer])
@@index([studentId, languageCode, masteredAt])
```

`normalizedAnswer` is produced by the **same normalization `grading.ts` uses**, via
`gradingOptionsFor(languageCode)`. A second normalizer would silently split one student's
mastery record in two — do not write one.

Multi-word answers (`out of`) are a single unit keyed on the whole blank answer, never
split into tokens.

### 5.5 Changes to `DrillAssignment`

```
origin              String  @db.VarChar(8)   // TEACHER | SELF | REMEDIAL  (REMEDIAL is 8 chars — fits)
sourceAnalysisUuid  String? @map("source_analysis_uuid") @db.Uuid
remedialPart        Int?    @map("remedial_part")        // 1-based, null for non-split

sourceAnalysis      DrillGapAnalysis? @relation(fields: [sourceAnalysisUuid], references: [uuid], onDelete: SetNull)

@@index([sourceAnalysisUuid])
```

`DrillAssignmentOrigin` in `contracts.ts` gains `'REMEDIAL'`. Widening the union makes the
TypeScript compiler surface every `switch` and filter that assumes two origins — each one
must be audited rather than defaulted.

The FK to `DrillGapAnalysis` is legitimate: both tables are in this database. It is not a
cross-database reference like `lessonUuid`.

### 5.6 Migration

Generated **offline** with `prisma migrate diff --from-schema-datamodel … --to-schema-datamodel`.
Never `prisma migrate dev` against production. Applied first to a scratch database restored
from a schema-only dump, then to production via `migrate deploy`.

---

## 6. Analysis pipeline

### 6.1 Trigger

In `RunnerService.check()`, at the point the assignment flips to `COMPLETED`:

1. **Update mastery synchronously** (§7). Pure DB arithmetic; must not depend on a model
   call succeeding, because the streak is a fact about what the student did.
2. **Create the `DrillAnalysisRun` row** with status `PENDING`, in the same write path as
   the status flip, so a lost job is detectable.
3. **Enqueue the analysis job**, fire-and-forget, wrapped exactly like the existing
   `notifications.onCompleted` call — a dead analyzer must never 500 a student's last
   answer, and the failure must be logged at error level with the assignment uuid.

### 6.2 The job — `AnalysisService`

Sibling of `GenerationService`, in `education-service/src/drills/analysis/`.

1. **Load** assignment, items, and attempts. Compute failed blanks:
   `{ answer, mistakeCount, wrongAttempts[], template, itemUuid, blankIndex }`.
   - `mistakeCount` = count of wrong, non-revealed attempts on that blank.
   - A blank that was **revealed with zero typed attempts** still counts as a failure with
     `mistakeCount = 1` — the student did not know it.
   - Worked example from production (`159a0749…`): `out of` was tried as "out, out, out"
     and then revealed → `mistakeCount = 3`.
2. **Zero failed blanks** → run status `NO_ERRORS`, finished. No model call.
3. **Call ai-microservice** `POST /api/teacher-assistant/analyze-drill-errors` (§6.3).
4. **Validate the response** against `analyze.schema.ts`, mirroring `generate.schema.ts`.
   A `topicSlug` outside the language's taxonomy is coerced to `<lang>.other` and logged
   at **warn** with the offending value, so the taxonomy grows from real data rather than
   silently absorbing everything.
5. **Persist** one `DrillGapAnalysis` per cluster. **Every failed answer must land in
   exactly one cluster.** An answer the model dropped goes to `<lang>.other` rather than
   vanishing.
6. Run status → `READY`.

### 6.3 New ai-microservice endpoint

`POST /api/teacher-assistant/analyze-drill-errors`, on the existing
`TeacherAssistantController` behind its service-identity guard, called with education-service's
Auth-issued credential exactly as `AiClient.generate` does. Files follow the existing
generate/validate shape:
`analyze.prompt.ts`, `analyze.schema.ts`, `analyze.service.ts`, plus specs.

**Request**

```ts
{
  languageCode: string;          // target language, e.g. "en"
  materialLanguage: string;      // explanation language, "ru" | "en"
  level: CefrLevel | null;
  allowedTopicSlugs: string[];   // the language's taxonomy — the model may use nothing else
  failures: Array<{
    answer: string;              // the correct answer
    sentence: string;            // the item template, blank included
    prompt: string | null;       // the blank's prompt, e.g. "[за]"
    wrongAttempts: string[];     // what the student typed, in order
    revealed: boolean;
    mistakeCount: number;
  }>;
  correlationId: string;
}
```

**Response**

```ts
{
  clusters: Array<{
    topicSlug: string;           // must be one of allowedTopicSlugs
    title: string;               // in materialLanguage
    explanation: string;         // in materialLanguage, the rule and why the attempts were wrong
    rules: string[];             // short, memorable, in materialLanguage
    examples: Array<{ text: string; gloss: string }>;  // text in target language, gloss in materialLanguage
    answers: string[];           // which of the submitted failures this cluster covers
  }>;
}
```

The prompt states explicitly that the explanation must address **what the student actually
typed** — `across` for `through` is a different lesson from a blank left empty.

### 6.4 Failure handling

Any throw → run `FAILED` with `errorMessage`, logged at **error** with assignment uuid and
correlation id. The student sees "Разбор ошибок не удался" with a retry button; the
teacher sees the same on the progress page. No silent degradation, no empty block standing
in for an error.

### 6.5 Retry

`POST /drill-assignments/:uuid/analysis/retry` — teacher only. Allowed from `FAILED`, or
from a `PENDING`/`RUNNING` run whose `startedAt` is older than the stall threshold.
Increments `attemptCount`. This is also the recovery path when the process dies mid-job.

---

## 7. Mastery tracking

Runs synchronously on completion, before the analysis job is enqueued.

For each blank in the completed assignment:

```
firstTryClean = the blank's first attempt was correct
                AND the blank was never revealed
```

Then, per distinct `normalizedAnswer`:

- `firstTryClean` → `cleanStreak += 1`; when it reaches **3**, set `masteredAt = now()`
- otherwise → `cleanStreak = 0`, `masteredAt = null`, `totalMistakes += mistakeCount`

`lastSeenAt` and `displayAnswer` always updated. Rows are upserted on
`(studentId, languageCode, normalizedAnswer)`.

A word with `masteredAt != null` is excluded from remedial composition (§8). If it is
later missed again in an ordinary drill, the streak resets and `masteredAt` clears — the
word becomes eligible again.

---

## 8. Remedial drill generation

Teacher-initiated. `POST /drill-gap-analysis/:uuid/remedial`.

### 8.1 Composition — `RemedialCompositionService`

A pure function over `(cluster, masteryRows)`, unit-testable with no upstream at all.

1. **Filter**: drop answers whose `masteredAt != null`. If this leaves **zero** answers,
   no remedial assignment is created — the endpoint returns a 409 with a message saying
   every word in this gap is already mastered, rather than generating ten sentences of
   pure padding.
2. **Required slots** = `Σ mistakeCount` over the remaining answers. Strict — no floor, no
   cap per word (D4).
3. **Sentence count** = `max(10, requiredSlots)`, capped at **20** per assignment (D11).
4. **Split**: `requiredSlots > 20` → parts of ≤ 20, titled
   `Работа над ошибками: <тема> (часть N)`, `remedialPart` set. A single answer's
   repetitions are spread across parts rather than concentrated in one. Each part is a
   separate `DrillAssignment` row sharing one `sourceAnalysisUuid`; the idempotence rule
   in §8.4 therefore reads "one *set* of parts per analysis", and a second click returns
   the existing parts.
5. **Padding** = `sentenceCount − requiredSlots` slots, filled with new sentences on the
   **same taxonomy topic** using **different vocabulary** (D5). Bank-first via
   `ContentClient.searchItems` scoped to the gap's `topicSlug`; AI for the shortfall.
6. **Distinctness**: every occurrence of an answer is in a different sentence. Never the
   same template twice. If bank + AI cannot supply enough distinct sentences, the run
   reports `partial` (the existing `RunSummary.partial` concept) rather than duplicating.

Worked example — the production assignment in the screenshot, hypothetically clustered:

```
cluster en.prepositions-of-movement: through (6 mistakes), across-family
  requiredSlots = 6  →  sentenceCount = max(10, 6) = 10
  6 sentences contain "through"; 4 pad sentences test movement prepositions
  with vocabulary the student did not get wrong.
```

### 8.2 Generation

Reuses `GenerationService` with a new job flavour carrying:

- `requiredAnswers: Array<{ answer, occurrences }>` — the AI prompt must place these
- the cluster's `explanation` and `rules` as instruction context
- the gap's `topicSlug` for the bank search

Bank items whose blank answer matches a required word are free wins and are used first.
Vocabulary baseline, lesson ceiling, pre-checks, and validation are **unchanged** — a
remedial item is held to the same standard as any other item.

### 8.3 Delivery

Assignment created with `origin: 'REMEDIAL'`, `sourceAnalysisUuid` set, `lessonUuid`
inherited from the source assignment, `teacherId` from the caller, status
`PENDING_REVIEW`. The existing approval gate then applies unchanged: teacher reviews,
edits sentences (existing sentence-editing) and the explanation (§9), approves, student
receives it with the existing notification.

### 8.4 Idempotence

At most one set of `REMEDIAL` assignments per `sourceAnalysisUuid` in a non-terminal
status — one row when the gap fits in 20 sentences, one row per part when it does not
(§8.1 step 4). A second click returns the existing rows rather than creating duplicates.
Regenerating requires revoking them first (existing `revokeAssignment`).

---

## 9. API surface

All on the existing drills controller, with the existing guards and the existing
teacher-ownership rule (404, never 403, for another teacher's assignment).

All paths sit under the existing `drill-assignments` controller so they inherit its
`JwtAuthGuard` and identity resolution; staff-only routes take the `teacher/` prefix the
controller already uses for that purpose.

| Method | Path | Caller | Purpose |
|---|---|---|---|
| `GET` | `/drill-assignments/:uuid/analysis` | student (own) or owning teacher | Run status + clusters. Polled while `PENDING`/`RUNNING` |
| `GET` | `/drill-assignments/gaps/:gapUuid` | student (own) or staff | One cluster — the theory shown above a remedial drill |
| `POST` | `/drill-assignments/:uuid/analysis/retry` | owning teacher | Re-run a `FAILED` or stalled analysis |
| `PATCH` | `/drill-assignments/teacher/gaps/:gapUuid` | owning teacher | Edit `title` / `explanation` / `rules` / `examples`; stamps `editedByTeacherId` |
| `POST` | `/drill-assignments/teacher/gaps/:gapUuid/remedial` | owning teacher | Create the remedial assignment(s) for one gap |

Internal routes for the portal (`internal-drills.controller.ts`) are **not** extended in
this work — the portal shows counts and links, and the analysis lives on the platform
pages the portal already links to.

---

## 10. UI

### 10.1 Student — completed drill

`frontend/app/learner/practice/[uuid]/page.tsx`, below the finished runner: a
`GapAnalysisBlock` component.

- `PENDING` / `RUNNING` → "Разбираем твои ошибки…", polling
- `READY` → one card per cluster: title, explanation, rules list, examples with glosses
- `NO_ERRORS` → "Всё верно, ошибок нет"
- `FAILED` → visible error message and a retry affordance

The student has no generate button — remedial creation is the teacher's decision (D1).

### 10.2 Teacher — progress page

`frontend/app/teacher/assignments/[uuid]/progress/page.tsx`, below the existing sentence
list: the same `GapAnalysisBlock`, plus per cluster:

- which words the cluster covers and **how many sentences the remedial drill would be**,
  shown *before* the click
- **"Создать работу над ошибками"** button
- **"Изменить"** on the explanation (PATCH)
- a "создать для всех пробелов" action that loops the clusters

### 10.3 Remedial assignment — student view

The runner page renders its own cluster's explanation **above** the items when
`origin === 'REMEDIAL'`, read through `sourceAnalysisUuid`. Same component, same row —
that is what makes "the same theory in two places" true rather than duplicated.

This requires the runner payload to carry `origin` and `sourceAnalysisUuid`, which it does
not today: `runner.projection.ts` gains both fields. They are safe to expose — neither is
an answer, and the student already knows which drill they are on.

### 10.4 Teacher review page

Remedial sets carry a badge and show the explanation at the top, so the teacher reviews
theory and sentences together before approving.

---

## 11. Testing

TDD throughout; education-service and the frontend both have working Jest/Vitest setups.

**Pure units, no upstream:**

- composition math: strict `repeats = mistakeCount`; padding to the 10 minimum; the 20-cap
  split into parts; mastered-word filtering; distinctness
- mastery arithmetic: first-try clean advances; a reveal resets; a 4th-attempt correct
  resets; 3 consecutive → `masteredAt`; a later miss clears it
- failed-blank extraction, including the revealed-with-no-attempts case
- taxonomy coercion: an out-of-taxonomy slug becomes `<lang>.other` and is logged
- every failed answer lands in exactly one cluster

**Service level**, with mocked `AiClient` / `ContentClient`, following
`generation.service.spec.ts`:

- `NO_ERRORS` vs `FAILED` stay distinct end to end
- a throwing analyzer never breaks the student's completion request
- retry from `FAILED` and from a stalled run
- remedial idempotence: two clicks, one assignment

**Page level**, following `progress/page.test.tsx`:

- each of the four run states renders its own distinguishable UI
- the remedial runner shows its cluster explanation above the items

**Never** run `manage.py test` against the portal host — that constraint is the portal's,
and none of this work lives there.

---

## 12. Out of scope

- Portal-side (Django) changes. The portal links to platform pages; those pages carry this
  feature.
- Cross-student reuse of an explanation for the same `topicSlug`. The row structure makes
  it possible later; this work does not implement it.
- A teacher-facing "weak words for this student" report. `StudentWordMastery` makes it a
  query away, but it is a separate feature.
- Automatic assignment of remedial drills without a teacher (D1 rejected it deliberately).
- Spaced repetition scheduling. The 3-clean-streak rule is the only retirement mechanism
  here.
