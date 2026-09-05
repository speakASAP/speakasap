# Design: AI-generated drilling assignments

Date: 2026-07-29
Status: approved design, ready for implementation planning
Scope: `speakasap` (content-service, education-service, notification-service, frontend), `ai-microservice`, `speakasap-portal` (transitional entry points only)

---

## 1. Problem

A teacher needs to set targeted grammar practice for a student — "50 preposition
exercises with *an/bei/für*", "past tense drilling" — and today has no way to do
it. The teacher writes the request, the system assembles the sentences, a
validation agent checks every one of them against the request, the teacher
approves, the student practises in the browser with instant per-blank feedback,
and the teacher is notified when the work is done.

The exercises must be reusable. A drill built for one student could be the same
drill another student needs next month, and the teacher must be able to find it
again without remembering which lesson it came from.

Sentences must be built on what the student already knows. A drill for lesson 5
assumes the vocabulary of lessons 1–5, and stretches the student with a
controlled proportion of new words.

---

## 2. Platform position

Everything here is built on the new platform: NestJS services, Prisma,
PostgreSQL, Next.js, Kubernetes. Nothing is designed for backward compatibility
with the legacy portal, which is being sunset.

The legacy portal appears in this design in exactly two ways, both temporary:

- **As a one-time data source.** The legacy exercise banks are migrated into
  content-service by a TypeScript importer that reads the files as text. After
  the import, those files are not a runtime dependency of anything — the bank in
  content-service is the source of truth and grows from there.
- **As a transitional entry point.** Until the legacy student and teacher
  dashboards are retired, they carry links into the new platform. These are
  template-level links only, marked in the code for deletion at sunset. No
  feature logic lives there and nothing in the new platform depends on them.

---

## 3. Decisions taken

| Question | Decision |
|---|---|
| Student practice UI | New platform, `speakasap.alfares.cz/learner/practice/*` |
| Teacher UI | New platform, `/teacher/assignments/*`, deep-linked from the legacy dashboards while they exist |
| Ownership | Item bank, vocabulary and reusable sets in **content-service**; assignments, attempts, grading in **education-service** |
| Item source | Bank + AI, mixed per set; wholly new topics are generated end to end |
| Vocabulary | Built on words from the student's earlier lessons; **≥ 80 % known words**, up to 20 % new |
| Completion rule | All blanks correct, unlimited retries. First-attempt correctness is recorded **internally only**, to rank bank items — it is never shown to a teacher |
| Review gate | Every set is validated by an agent, then approved by a teacher; approval is **per set, once, forever** |
| Self-drilling | Allowed from the approved library, but **only when no assignment is outstanding** |
| Languages | Prompt in the student's material language, answers in the course language |
| Notifications | Student: email + in-app on assign. Teacher: email + in-app on completion |
| AI model | Best available tier (`smart`), configurable — quality over token cost |
| Identity | No registration — every user already exists in the legacy portal and 214k are already mapped; resolve, or link from signed claims (§12) |
| Legacy SSO | Reuse the marathon mechanism, but fail closed on lookup outage (§12.3) |
| Legacy portal UI | Student dashboard, teacher dashboard, and the lesson page — both views (§13) |

---

## 4. Core model: sets, not assignments

The reusable object is a **DrillSet** — a titled, topic-tagged, ordered
collection of drill items in one language. Everything else hangs off it.

```
DrillItem  ──many──▶  DrillSet  ──instantiated as──▶  DrillAssignment (per student)
   ▲                     │                                   │
   │                     ├── validation verdicts             │
 banks + AI              ├── ratings (teacher +1 / student +1)
                         └── review state (approved once)     └── attempts
```

Consequences of making the set — not the assignment — the unit of reuse:

- A set the teacher approved once is vetted forever. Assigning it to a second
  student skips review entirely.
- Ratings and usage statistics accumulate on a stable object, so popularity
  ranking means something.
- Students self-select from approved sets, so the same vetting serves both paths.
- Editing a set does not mutate live assignments — each assignment holds a
  **snapshot copy** of its items.

### Grouping key for "the same lesson"

`education_lesson.uuid` is per student-course, so it cannot group drills across
students. The stable grouping key is **`courseKey` + `lessonOrder`** (e.g.
`GermanA1` + lesson 5), which is how `SevenLesson` is already keyed in
content-service. Sets carry both as nullable tags; the library groups by them.

---

## 5. Vocabulary baseline

This is the foundation the sentences are built on, so it is built first.

### 5.1 What the student knows

For a student on lesson *N* of course *C*, the known-vocabulary set is every
word introduced in lessons 1…*N* of that course, from three sources already
present in content-service:

- `WordTheme` (`moduleClass`, `order`) joined through `WordThemeRelation` to
  `Word` — the curated per-module vocabulary list
- content words tokenized from imported course-material drill items
  (`sourceType = BANK_SEVEN`) with `lessonOrder ≤ N`
- content words tokenized from `SevenLesson.bodyHtml` for lessons 1…*N*

These are materialized into one table so lookups are a single indexed query:

```prisma
model CourseVocabulary {
  id          Int    @id @default(autoincrement())
  courseKey   String @db.VarChar(255)
  languageId  Int
  lessonOrder Int             // the lesson that first introduces the word
  word        String @db.VarChar(255)   // normalized: lowercased, NFC
  lemma       String? @db.VarChar(255)
  translation String? @db.Text
  source      String @db.VarChar(16)    // THEME | ITEM | LESSON_BODY
  @@unique([courseKey, languageId, word, source])
  @@index([courseKey, languageId, lessonOrder])
}
```

Endpoint: `GET /api/v1/course-vocabulary?courseKey=&languageCode=&maxLessonOrder=`
returns the word list plus translations, capped and paged.

Tokenization is per-language and deliberately simple: split on Unicode word
boundaries, lowercase, NFC-normalize, drop a per-language stopword list
(articles, pronouns, auxiliaries — words that are never the point of a drill).
Lemmatization is best-effort: where no lemmatizer exists for a language, surface
forms are matched directly and the ratio check tolerates it. Getting this
slightly wrong makes the ratio conservative, which is the safe direction.

### 5.2 The 80/20 rule

Every generated set must satisfy, measured over content words (stopwords
excluded):

- **≥ 80 % of content-word tokens across the set are known** — present in the
  student's vocabulary baseline for lessons 1…*N*
- **no single sentence contains more than 2 unknown content words** — a
  set-level ratio alone would let one sentence become impenetrable
- **every unknown word appears in that item's `hint`** with its translation, so
  the student can complete the sentence rather than guess
- unknown words must be within the student's level and relevant to the requested
  topic — not arbitrary vocabulary

This is checked deterministically before the AI validation agent runs (it is
arithmetic, not judgement, and costs nothing). A set failing the ratio is sent
back for regeneration automatically, with the offending words named in the
regeneration request.

Bank items are checked by the same rule. A legacy item that is too far outside
the student's vocabulary is not selected, rather than being rewritten.

---

## 6. Item bank (content-service)

### 6.1 Schema

```prisma
model DrillTopic {
  id               Int      @id @default(autoincrement())
  slug             String   // "prepositions", "past-tense", "comparison-adjectives"
  languageId       Int
  materialLanguage String   @db.VarChar(2)
  title            String   @db.VarChar(255)
  level            String?  @db.VarChar(4)   // A1..C2
  grammarLessonId  Int?     // -> GrammarLesson, yields the public topic URL
  parentTopicId    Int?
  isNew            Boolean  @default(false)  // created on the fly, awaiting teacher confirmation
  @@unique([languageId, materialLanguage, slug])
}

model DrillItem {
  id               Int      @id @default(autoincrement())
  languageId       Int
  materialLanguage String   @db.VarChar(2)
  topicId          Int?
  level            String?  @db.VarChar(4)
  template         String   @db.Text   // "Ich gehe [in]{in} die Schule."
  blanks           Json               // [{index, prompt, answer, alternatives[]}]
  plainText        String   @db.Text   // answers substituted, markup stripped
  hint             String?  @db.Text   // "(wohnen – жить; in Moskau – в Москве)"
  sourceType       String   @db.VarChar(16)  // BANK_GRAMMAR | BANK_SEVEN | AI | TEACHER
  sourceRef        String?  @db.VarChar(255) // "german.Lesson1Ex1.ex3"
  courseKey        String?  @db.VarChar(255)
  lessonOrder      Int?
  unknownWords     Json     @default("[]")  // content words outside the baseline it was built for
  hash             String   @unique @db.VarChar(64)
  status           String   @default("ACTIVE") @db.VarChar(16) // ACTIVE | RETIRED
  timesShown       Int      @default(0)
  timesCorrectFirstTry Int  @default(0)
  createdAt        DateTime @default(now())
  @@index([languageId, materialLanguage, topicId, status])
  @@index([courseKey, lessonOrder])
}

model DrillItemRevision {
  id         Int      @id @default(autoincrement())
  itemId     Int
  template   String   @db.Text
  blanks     Json
  hint       String?  @db.Text
  reason     String   @db.VarChar(32)  // REGENERATED | TEACHER_EDIT | VALIDATION_FIX
  createdAt  DateTime @default(now())
  @@index([itemId, createdAt])
}
```

`template` uses one markup for bank, AI and teacher-edited items —
`[prompt]{answer}`, inherited from the migrated data — so the renderer, the
grader and the validator each have exactly one code path.

### 6.2 One-time migration of the legacy banks

A TypeScript importer in content-service reads the legacy exercise files as
**text** and writes `DrillItem` rows. It is a migration, not an integration: it
runs once per source file, is idempotent on `hash`, and after it the legacy
files play no part in the running system.

**A. Grammar bank** — `speakasap-portal/grammar/exercises/*.py` (~4.5 MB, 16
languages, plus `fr/`, `ru/` subdirectories and `<ml>__<lang>.py` variants).

- Match `class (\w+)\(AnswerForm\)`, then `ex\d+\s*=\s*SmartExerciseField\(\s*label=(['"])(.*?)\1\s*\)` with DOTALL — labels wrap across lines.
- Parse blanks with `\[([^\]]*)\]\{([^\}]*)\}`. **Empty prompts are valid** (`Ich heiß[]{e}` — suffix drill) and must not be skipped.
- Handle backslash-escaped quotes inside labels (`zo\'`).
- Extract the trailing `<span class="mute">…</span>` into `hint`; strip remaining HTML from `plainText`.
- Topic slug from the class name: `ComparisonAdjectivesEx1` → strip trailing `Ex\d+` → kebab-case → `comparison-adjectives`. Match to `GrammarLesson` by `alias` then `url`; unmatched topics get `grammarLessonId = null` and appear in the report.
- Material language: `<lang>.py` → `ru`; `<ml>__<lang>.py` → `<ml>`; `fr/`, `ru/` subdirectories → directory name.

**B. Course-material bank** — `speakasap-portal/seven/exercises/*.py` (~1.5 MB).
Same parser, different tagging: class `Lesson<N>Ex<M>` yields `lessonOrder = N`
and `courseKey` from language + material language, joined to the `SevenLesson` /
`SevenExercise` rows already in content-service. These are the sentences from
the courses students actually take, and they arrive pre-aligned to lesson order —
which is what makes the vocabulary baseline in §5 computable.

Each importer emits a report: items parsed, skipped with reason, topics
unmatched, coverage per language. Zero-byte source files are expected and
reported, not failures.

**Known gap:** classes using plain `ExerciseField` (answers passed as a separate
list rather than inline `{}`) are out of scope for v1. The report counts them so
a second pass is a decision made from data.

### 6.3 Bank query API

```
GET  /api/v1/drill-topics?languageCode=de&materialLanguage=ru
POST /api/v1/drill-items/search
     { languageCode, materialLanguage, topicSlugs[], level?, courseKey?,
       maxLessonOrder?, vocabularyBaseline?, limit, excludeHashes[] }
```

When `vocabularyBaseline` is supplied, items violating the 80/20 rule against it
are excluded server-side.

Selection order: highest `popularityScore` among the sets an item belongs to,
then `timesCorrectFirstTry / timesShown` inside a 55–90 % band (an item everyone
gets right first try is not drilling; one nobody gets is discouraging), then
random under a seed for testability.

---

## 7. Validation agent

Every set is validated before a teacher sees it — sets built entirely from bank
items included. A human-written legacy sentence is not automatically a match for
*this* teacher's request: a preposition drill must actually drill prepositions.

### 7.1 Two layers

**Deterministic pre-checks** run first, cost nothing, and reject the obvious:

- `template` parses and yields ≥ 1 blank; `blanks.length` matches; indices align
- every `answer` is non-empty after trimming
- the answer's script matches the target language (a Cyrillic answer in a German
  drill is a generation failure, not an item)
- substituting answers leaves no residual markup
- the 80/20 vocabulary rule (§5.2), per set and per sentence
- `hash` collides with neither the set nor the bank
- where the topic has a closed word list (prepositions, articles, modal verbs,
  irregular verb forms), **the answer is a member of that list** — the cheapest
  and strongest possible topic-alignment check

**AI validation** handles what cannot be decided mechanically, via
`POST /api/teacher-assistant/validate-drill` on ai-microservice. Per item:

```json
{ "itemRef": "3",
  "verdicts": { "topicAlignment": "PASS|WARN|FAIL",
                "grammar": "PASS|FAIL",
                "level": "PASS|WARN|FAIL",
                "naturalness": "PASS|WARN" },
  "issues": [{ "code": "OFF_TOPIC",
               "message": "Blank tests an article, not a preposition",
               "span": "die" }],
  "suggestedFix": { "template": "Ich warte [на]{auf} den Bus.", "blanks": [...] } }
```

It checks: does the blank exercise the requested grammar point; is the sentence
grammatically correct **in the target language**; is it natural rather than
translated-sounding; is it at the stated level. Where it finds an error it must
return a corrected sentence, not only a complaint — a grammatically wrong
sentence generated by the system is corrected in the target language before any
teacher sees it.

The validator runs with its own prompt and output schema, separate from the
generator, and never sees the generator's reasoning — an independent check, not
a self-review.

### 7.2 Storage and surfacing

Verdicts are stored per set item (`validationState`, `validationIssues`,
`validatedAt`, `validatorVersion`). The review screen sorts `FAIL` first, then
`WARN`, then `PASS`, each with its issue text and the suggested fix. For every
flagged item the teacher can **apply suggestion**, **regenerate**, **edit
manually**, or **keep anyway** (recorded, so a teacher override is never
silently lost).

A set with any unresolved `FAIL` cannot be approved. `WARN` does not block.

### 7.3 Regeneration loop

```
POST /api/v1/drill-sets/:uuid/regenerate   { itemIds[], note? }
```

Creates a generation job for exactly those positions, passing the original
instructions, the validation issues that caused the rejection, the teacher's
optional note, and every other sentence in the set as `avoidTexts`. Replacements
keep their order; the previous versions are written to `DrillItemRevision` so
the teacher can revert. The new items are validated on arrival and the set
returns to `PENDING_REVIEW`.

This is the loop the teacher works in: review → flag → regenerate → review →
approve. It has no iteration limit; each round is a fresh job with the accumulated
constraints.

---

## 8. Drill library — sets, search, ratings (content-service)

### 8.1 Schema

```prisma
model DrillSet {
  uuid             String   @id @db.Uuid
  title            String   @db.VarChar(255)
  languageId       Int
  materialLanguage String   @db.VarChar(2)
  level            String?  @db.VarChar(4)
  topicSlugs       String[]
  courseKey        String?  @db.VarChar(255)
  lessonOrder      Int?
  origin           String   @db.VarChar(16)  // AI | BANK | MIXED | TEACHER
  reviewState      String   @db.VarChar(16)  // GENERATING | VALIDATING | PENDING_REVIEW | APPROVED
  createdByTeacherId Int?
  instructions     String?  @db.Text   // the teacher's original free-text request
  visibility       String   @default("SHARED") @db.VarChar(8)  // SHARED | PRIVATE
  searchText       String   @db.Text   // concatenated item plainText, GIN tsvector indexed
  knownWordRatio   Float?
  timesAssigned    Int      @default(0)
  timesSelfSelected Int     @default(0)
  teacherUpvotes   Int      @default(0)
  studentUpvotes   Int      @default(0)
  avgFirstTryAccuracy Float?
  popularityScore  Float    @default(0)
  createdAt        DateTime @default(now())
  approvedAt       DateTime?
  items            DrillSetItem[]
  @@index([languageId, materialLanguage, reviewState])
  @@index([courseKey, lessonOrder])
  @@index([popularityScore])
}

model DrillSetItem {
  id               Int     @id @default(autoincrement())
  setUuid          String  @db.Uuid
  itemId           Int
  order            Int
  validationState  String  @default("PENDING") @db.VarChar(8)  // PENDING|PASS|WARN|FAIL|OVERRIDDEN
  validationIssues Json    @default("[]")
  validatedAt      DateTime?
  validatorVersion String? @db.VarChar(32)
  @@unique([setUuid, order])
}

model DrillSetRating {
  id        Int      @id @default(autoincrement())
  setUuid   String   @db.Uuid
  raterType String   @db.VarChar(8)  // TEACHER | STUDENT
  raterId   Int
  value     Int      // +1 | -1
  comment   String?  @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([setUuid, raterType, raterId])   // one vote each, changeable
}
```

### 8.2 Popularity

```
popularityScore = 3·teacherUpvotes + 1·studentUpvotes
                + 0.5·min(timesAssigned + timesSelfSelected, 20)
                − 5·(reviewState != APPROVED)
```

Recomputed on every rating and every completion, stored on the row so sorting is
an indexed `ORDER BY`. Downvotes subtract through the same weights. No time
decay in v1 — the corpus is small and a good drill does not go stale.

`avgFirstTryAccuracy` does **not** feed the score — a hard set is not a bad set —
and is **not shown to teachers**. It is retained only as an internal difficulty
signal for item selection (§6.3's 55–90 % band). No teacher-facing screen, list,
panel or email displays it or any other score.

### 8.3 Library API

```
GET   /api/v1/drill-sets?languageCode=&materialLanguage=&topicSlugs=&courseKey=
                        &lessonOrder=&q=&sort=popularity|recent
                        &createdBy=&reviewState=&groupBy=lesson
GET   /api/v1/drill-sets/available-for-me      # student: approved, in-course, lessonOrder ≤ current
GET   /api/v1/drill-sets/:uuid                 # full preview incl. answers (teacher auth)
POST  /api/v1/drill-sets                       # compose from selected items
PATCH /api/v1/drill-sets/:uuid                 # title, topics, visibility
PATCH /api/v1/drill-sets/:uuid/items/:id       # edit template/answers
DELETE /api/v1/drill-sets/:uuid/items/:id
POST  /api/v1/drill-sets/:uuid/regenerate      # { itemIds[], note? }
POST  /api/v1/drill-sets/:uuid/approve
POST  /api/v1/drill-sets/:uuid/ratings         # { value, comment? } — rater from the token, never the body
```

`groupBy=lesson` buckets sets by `courseKey` + `lessonOrder` with an
"unassigned" bucket — the default library view. Search with `q` **deliberately
ignores the lesson filter**, so a teacher can find a good drill that came from a
different lesson by recalling one of its sentences.

---

## 9. Assignments, attempts, grading (education-service)

### 9.1 Schema

```prisma
model DrillAssignment {
  uuid              String   @id @db.Uuid
  setUuid           String   @db.Uuid
  studentId         Int
  teacherId         Int?                      // null for self-selected
  origin            String   @db.VarChar(8)   // TEACHER | SELF
  studentCourseUuid String?  @db.Uuid
  lessonUuid        String?  @db.Uuid         // nullable — standalone or lesson-linked
  batchUuid         String?  @db.Uuid
  title             String   @db.VarChar(255)
  languageCode      String   @db.VarChar(8)
  materialLanguage  String   @db.VarChar(2)
  status            String   @db.VarChar(16)  // GENERATING|PENDING_REVIEW|ASSIGNED|IN_PROGRESS|COMPLETED|CANCELLED
  dueAt             DateTime?
  resourceLinks     Json     @default("[]")   // [{topic, url}] public grammar pages
  generationMeta    Json     @default("{}")
  generationProgress Json    @default("{}")   // { phase, generated, total, etaSeconds, message }
  firstTryAccuracy  Float?
  createdAt         DateTime @default(now())
  assignedAt        DateTime?
  startedAt         DateTime?
  completedAt       DateTime?
  items             DrillAssignmentItem[]
  @@index([studentId, status])
  @@index([teacherId, status])
  @@index([lessonUuid])
}

model DrillAssignmentItem {
  uuid           String @id @db.Uuid
  assignmentUuid String @db.Uuid
  order          Int
  sourceItemId   Int?
  template       String @db.Text
  blanks         Json    // includes answers — server-side only, never serialized to students
  hint           String? @db.Text
  topicSlug      String? @db.VarChar(255)
  @@unique([assignmentUuid, order])
}

model DrillAttempt {
  uuid           String   @id @db.Uuid
  assignmentUuid String   @db.Uuid
  itemUuid       String   @db.Uuid
  blankIndex     Int
  submittedValue String   @db.Text
  isCorrect      Boolean
  attemptNo      Int
  revealed       Boolean  @default(false)
  createdAt      DateTime @default(now())
  @@index([assignmentUuid, itemUuid])
}

model DrillAssignmentBatch {
  uuid         String   @id @db.Uuid
  teacherId    Int
  instructions String   @db.Text
  filter       Json     // { groupUuid?, studentIds[] }
  createdAt    DateTime @default(now())
}
```

### 9.2 Lifecycle

```
              ┌── set already APPROVED ──────────────────────┐
GENERATING ───┤                                              ├─▶ ASSIGNED ─▶ IN_PROGRESS ─▶ COMPLETED
              └── set PENDING_REVIEW ─▶ (teacher approves) ──┘
                                                        └────────────────▶ CANCELLED
```

Bulk assignment creates one `DrillAssignmentBatch` and fans out to N assignments
sharing one set. Reviewing the set once releases all of them.

### 9.3 Self-drilling

A student may start a self-chosen drill **only when nothing is outstanding** —
no assignment in `ASSIGNED` or `IN_PROGRESS`. Teacher work comes first.

The rule is enforced server-side in `POST /api/v1/drill-assignments/self`, which
returns `409` with the blocking assignment's uuid when work is pending. The UI
also hides the entry point, but the UI is not the enforcement.

Self-selected assignments have `teacherId = null`, `origin = SELF`, and generate
no teacher completion email — they do count toward set statistics, ratings and
the student's history, which the teacher can see on the student's page. Students
choose only from `APPROVED` sets matching their course language, material
language and `lessonOrder ≤ current`, so a self-drill can never be
un-vetted content or content ahead of where they are.

### 9.4 Grading

One pure function, `src/drills/grading.ts`, table-tested, no I/O:

- trim; collapse internal whitespace; Unicode NFC normalize
- fold typographic apostrophes and quotes to ASCII (`’` → `'`)
- strip a single trailing `.`/`!`/`?`; mid-string punctuation is significant
- accept any entry in `alternatives[]`
- case-insensitive **by default**, with a per-language `caseSensitive` flag —
  German capitalises nouns, and `sie`/`Sie` is a real distinction
- diacritics are **never** stripped: `é ≠ e`, `ö ≠ o`

Server-side only. Never shipped to the browser.

### 9.5 Answer confidentiality

- `GET /api/v1/drill-assignments/:uuid/runner` returns, per blank, only
  `{ index, prompt, maxLength }` — never `answer` or `alternatives`
- `POST /api/v1/drill-assignments/:uuid/check` grades one blank server-side
- completion is decided by the server after re-checking stored attempts
- an explicit test asserts the runner response body contains none of the
  assignment's answer strings

### 9.6 Assignment API

Teacher:
```
POST   /api/v1/drill-assignments/generate   { studentIds[]|groupUuid, lessonUuid?,
                                              instructions, topicSlugs[], itemCount, dueAt? }
POST   /api/v1/drill-assignments/from-set   { setUuid, studentIds[], lessonUuid?, dueAt? }
GET    /api/v1/drill-assignments?teacherId=me&status=
GET    /api/v1/drill-assignments/:uuid
POST   /api/v1/drill-assignments/:uuid/cancel
```

Student:
```
GET    /api/v1/drill-assignments/mine
POST   /api/v1/drill-assignments/self       { setUuid }        # 409 if work outstanding
GET    /api/v1/drill-assignments/:uuid/runner
POST   /api/v1/drill-assignments/:uuid/check   { itemUuid, blankIndex, value }
POST   /api/v1/drill-assignments/:uuid/reveal  { itemUuid, blankIndex }
POST   /api/v1/drill-assignments/:uuid/rate    { value, comment? }
```

Internal (for the transitional legacy dashboards):
```
GET    /api/v1/internal/drill-assignments/by-student/:studentId
GET    /api/v1/internal/drill-assignments/by-teacher/:teacherId
```

Gateway prefixes for `api-gateway/src/proxy/upstream-resolve.ts`:
`/api/v1/drill-assignments` → `EDUCATION_SERVICE_URL`;
`/api/v1/drill-sets`, `/api/v1/drill-items`, `/api/v1/drill-topics`,
`/api/v1/course-vocabulary` → `CONTENT_SERVICE_URL`. The resolver is
**first-match-wins over a hand-ordered array** — not computed longest-prefix,
despite what its file header claimed before 2026-07-29 — so
`/api/v1/internal/drill-assignments` must precede the existing
`/api/v1/internal` → `USER_SERVICE_URL` entry.

---

## 10. Generation

### 10.1 Pipeline

1. **Resolve** — topics, the student's course, and their current lesson order.
2. **Baseline** — fetch the vocabulary baseline for lessons 1…*N* (§5).
3. **Bank** — request items for the requested topics, filtered by the baseline.
   Course-material items are restricted to `lessonOrder ≤ N`.
4. **Generate** — ask ai-microservice for the shortfall. A wholly new topic with
   no bank coverage means the whole set is generated; this is expected, not an
   error condition, and happens routinely early on.
5. **Validate** — deterministic checks, then the validation agent (§7) over
   **every** item, bank items included.
6. **Persist** — write the set to content-service with `origin = AI|BANK|MIXED`,
   `reviewState = PENDING_REVIEW`; create assignments.

### 10.2 The generator agent — ai-microservice `src/teacher-assistant/`

`POST /api/teacher-assistant/generate-drill`, JWT required, calling
`/ai/complete` with `model_tier` from `DRILL_GENERATION_MODEL_TIER` (default
`smart` — the best available tier).

```json
{ "languageCode": "de", "materialLanguage": "ru", "level": "A2",
  "topics": [{ "slug": "prepositions", "title": "Предлоги", "focus": "an, bei, für" }],
  "instructions": "50 sentences, present tense only, everyday vocabulary",
  "count": 32,
  "knownVocabulary": ["heißen", "wohnen", "lernen", "..."],
  "maxNewWordsPerSentence": 2,
  "exampleItems": ["Ich gehe [in]{in} die Schule."],
  "avoidTexts": ["..."] }
```

Response schema (enforced by `output_schema`):

```json
{ "items": [ { "template": "Ich warte [на]{auf} den Bus.",
               "blanks": [{ "prompt": "на", "answer": "auf", "alternatives": [] }],
               "hint": "(warten auf – ждать; der Bus – автобус)",
               "topicSlug": "prepositions",
               "newWords": ["warten"] } ] }
```

The prompt requires: prompts in `materialLanguage`, blanks in `languageCode`,
one grammar point per sentence, at least 80 % of content words drawn from
`knownVocabulary`, at most `maxNewWordsPerSentence` new ones, every new word
translated in `hint`, everyday register, no proper nouns outside the known list.
Prompt and schema live in one reviewable file so they can be evaluated and
changed without touching call sites.

### 10.3 Progress and latency

Fifty items on the best tier plus validation takes tens of seconds. The teacher
is never shown a bare spinner. `generationProgress` is updated at each phase:

```json
{ "phase": "GENERATING", "generated": 23, "total": 50,
  "etaSeconds": 34, "message": "Generating sentences 23 of 50" }
```

The wizard polls every 2 s and shows a countdown from the estimate, the running
count, and the current phase (`Resolving topics` → `Selecting from library` →
`Generating sentences` → `Validating` → `Ready for review`). Items already
generated are listed as they arrive, so the teacher can start reading before the
set is finished. Errors surface immediately with a retry; a job that stalls past
its estimate says so rather than counting down to zero and lying. The teacher
may leave the page — the job continues and the set appears in the review queue.

A `GENERATING` row older than 10 minutes is swept to `CANCELLED` with an error
note on next access.

---

## 11. Frontend

### 11.1 Student runner

`/learner/practice` — assigned work first, with topics linked to the public
grammar pages, item count, due date and progress. Below it, the self-drilling
section: locked with an explanatory note while an assignment is outstanding,
otherwise a browsable list of approved sets for the student's course and lesson
range, sorted by popularity.

`/learner/practice/[uuid]` — the runner. One component, `DrillRunner`:

- renders `template`; each blank is an auto-sized inline `<input>` with `prompt`
  as placeholder
- on debounced input (250 ms), blur, or Enter → `POST /check`
- **correct** → the input is replaced in place by bold green text, becoming part
  of the sentence; focus advances to the next blank automatically
- **incorrect** → red border, value kept, unlimited retries, no answer revealed
- optional "show answer" per blank, recorded as `revealed` and excluded from
  first-attempt accuracy
- `hint` shown under the sentence, carrying translations of any new words
- progress bar; when the server confirms the last blank, the assignment
  auto-completes and a summary appears with a thumbs-up/down posting to `/rate`
- `aria-live="polite"` announces correctness; every blank has a real label; full
  keyboard operation
- a failed `/check` retries once, then surfaces "not saved — check your
  connection" rather than silently marking a blank wrong

### 11.2 Teacher

`/teacher/assignments/new` — three-step wizard:
1. **Who** — student, several students, or a group; optional lesson link
2. **What** — topic picker (autocomplete from `/drill-topics`, showing the
   public grammar-page URL; free text creates a new topic flagged `isNew`),
   instructions, item count
3. **How** — *Generate new* or *Pick from library*, then the progress view (§10.3)

`/teacher/assignments/library` — grouped by course + lesson order by default;
full-text search across **all** lessons; filters for language, topic, level,
mine/all, approved only. Rows show title, topics, item count, times assigned,
★ score and known-word ratio — **no score of any kind**. Multi-select →
"Assign selected to…".

`/teacher/assignments/[uuid]/review` — items sorted `FAIL` → `WARN` → `PASS`,
each showing what the student will see, the answers, and any validation issue
with its suggested fix. Per item: apply suggestion · regenerate · edit · keep
anyway. Bulk "regenerate all flagged". **Approve & send** is disabled while any
unresolved `FAIL` remains. Approving marks the *set* approved — it never needs
reviewing again.

`/teacher/assignments` — list by status, including completed ones with scores
and the student's self-drilling history.

---

## 12. Identity and sign-in from the legacy portal

### 12.1 There is no registration

Every teacher and student in this feature already exists in the legacy portal.
Drilling never registers anyone, never shows a sign-up form, and never asks a
student to create an account. It only *resolves* a legacy user to their platform
identity.

That resolution has largely already happened. The Goal 4 auth bootstrap
populated `legacy_identity_mappings` with **214,232 `speakasap-portal` users,
every row carrying an `authUserId`** (measured 2026-07-29: 214,034 `created`,
192 `created_duplicate_email`, 6 `mapped`; zero `skipped` rows). For practical
purposes the mapping exists before this feature ships.

This is the key difference from marathon. Marathon has a public funnel and
genuinely registers new participants (`registerMarathonContact` →
`POST /auth/register-contact`). Drilling has no such funnel: the population is
closed and pre-existing.

### 12.2 Mechanism — the marathon pattern, reused

1. The legacy portal issues a short-lived HS256 JWT with the numeric legacy user
   id in `sub`, signed with a shared secret — `marathon/jwt_for_marathon.py`
   generalized into `portal/platform_sso.py` with an `audience` argument and a
   new `SPEAKASAP_PLATFORM_JWT_SECRET` (Vault: `secret/prod/speakasap-portal`).
   The token also carries verified `email`, `first_name`, `last_name` and
   `role` claims taken from the Django user record — signed, so they are
   trustworthy, and sufficient to create a mapping without a callback.
3. `frontend /auth/handoff` consumes `?sso=`, performs the exchange, stores the
   session through the existing `consumeHostedAuthFragment` machinery, and
   redirects to `nextPath`.

### 12.3 Resolution outcomes

Three cases, and they must be distinguished — collapsing them is how identity
bugs happen:

| Outcome | Action |
|---|---|
| **Mapping found** (the 214k case) | Issue the session. |
| **No mapping — `404`** | Provision from the token's signed claims: match an existing auth user by normalized email, else create one, then write the `legacy_identity_mappings` row with `status = mapped` or `created`. Issue the session. This is *linking a known person*, not registering a new one. |
| **Lookup unavailable — timeout or `5xx`** | **Fail closed.** No session, no provisioning, a retryable sign-in error. |

The third row is the deliberate deviation from marathon, which falls soft to the
raw numeric `sub` (`marathon/src/shared/auth-client.ts:110`). For marathon an
unmapped id is a usable participant key. Here it would attach graded work to an
identity the platform has not verified — and provisioning during an outage risks
creating a duplicate user for someone who is already mapped. An outage is
transient; the student retries and loses nothing.

Provisioning needs one new endpoint on auth-microservice, since only a read path
exists today (`findLegacyMapping`, `users.service.ts:56`):

```
POST /internal/users/resolve-or-provision-legacy
     { system, legacyUserId, email, firstName?, lastName? }
  →  { authUserId, provisioned: boolean }
```

It is idempotent on `(system, legacyUserId)`, reuses the existing
`LegacyIdentityMapping` entity and its `status` enum, and is guarded by
`InternalServiceGuard` like its sibling. **Verification task:** before rollout,
confirm no active teacher or student is missing from `legacy_identity_mappings`
— the bootstrap covered 214k rows, but coverage against the *current* active
roster has not been measured, and the provisioning path should be a rarely-taken
fallback rather than a routine one.

---

## 13. Legacy portal UI (transitional, removed at sunset)

The teacher assigns from the legacy portal and the student is reminded there,
because that is where both still work day to day. Three placements, all Django
templates plus server-side reads — no feature logic, no models, no migrations,
no React 15, no Webpack 2. Each is marked in code for deletion at sunset.

**1. Student dashboard** (`cabinet/templates/student/…`) — a "Practice
assignments" block above the fold:

- one card per outstanding assignment: title, topics, item count, due date,
  progress ("18 of 50 done")
- primary button → `{PLATFORM_URL}/learner/practice/{uuid}?sso=…`
- when nothing is outstanding, a single "Practise on your own" link to
  `{PLATFORM_URL}/learner/practice` — matching the self-drilling gate in §9.3,
  so the legacy dashboard and the platform never disagree about what the student
  may do
- source: `GET /api/v1/internal/drill-assignments/by-student/:studentId`

**2. Teacher dashboard** (`cabinet/templates/teacher/…`) — a "Drilling" block:

- counts by state: awaiting my review, assigned, completed this week
- "Create drilling assignment" → `{PLATFORM_URL}/teacher/assignments/new?sso=…`
- "Review pending" → the platform review queue, badged with the count, since a
  set awaiting review is blocking a student
- source: `GET /api/v1/internal/drill-assignments/by-teacher/:teacherId`

**3. Lesson page** — the placement that matters most, because this is where a
teacher decides what a student should practise next:

- *teacher view*: a per-student panel listing that lesson's drilling
  assignments with their status, plus "Create drilling
  assignment" pre-filled with `lessonUuid` and `studentId` →
  `{PLATFORM_URL}/teacher/assignments/new?lessonUuid=…&studentId=…&sso=…`
- *student view*: the same lesson's assignments with their status and a link
  into the runner

All three fail soft: if education-service is unreachable the block renders empty
with a quiet notice. A drilling outage must never 500 a dashboard or a lesson
page.

---

## 14. Notifications (speakasap/notification-service)

- `drill_assignment_assigned` → student on assign: topic list with links to the
  public grammar pages, due date, deep link to the runner. Plus in-app.
- `drill_assignment_completed` → teacher on completion: per-topic breakdown and
  the items the student struggled with — qualitative, **never a score or a
  percentage** — plus links to the lesson and the review page. Plus in-app.
  **Not sent for self-selected drills.**

Both rendered in the recipient's material language. Dispatch is fire-and-forget
with retry; a failed email never blocks a state transition and is logged with
the assignment uuid.

---

## 15. Testing

| Area | Tests |
|---|---|
| Importers | Parser unit tests per language fixture: multi-line labels, escaped quotes, empty prompts (`heiß[]{e}`), multiple blanks, `<span class="mute">` extraction. Idempotence: second run inserts zero rows. |
| Vocabulary | Baseline built for a known course matches a hand-checked word list; tokenizer stopword handling; ratio arithmetic at boundaries (exactly 80 %, 3 unknown words in one sentence). |
| Deterministic validation | Each rule rejects its own violation and nothing else; closed-list topic check (a preposition set whose blank is an article fails). |
| AI validation | Fixtures of real malformed output — wrong blank count, empty answer, wrong-script answer, residual markup, off-topic blank, ungrammatical sentence — each caught, each yielding a usable `suggestedFix`. |
| Regeneration | Regenerating 3 of 50 replaces exactly those positions, preserves order, writes revisions, re-validates, returns the set to `PENDING_REVIEW`. |
| Grading | Table tests per rule and per language: German case sensitivity, French diacritics, typographic apostrophes, trailing punctuation, alternatives. |
| Answer confidentiality | Runner response body contains no answer or alternative string from the assignment. |
| Self-drilling gate | `POST /self` returns 409 while an assignment is `ASSIGNED` or `IN_PROGRESS`; succeeds when none is; rejects sets that are unapproved, wrong course, or ahead of the student's lesson. |
| State machine | Every legal transition, rejection of illegal ones, bulk fan-out, set approval releasing a whole batch. |
| Popularity | Score formula, ordering, downvote effect, unapproved sets rank last. |
| Progress reporting | Phases advance in order; a stalled job reports stalled rather than counting to zero. |
| SSO and identity | Valid token → session. Expired, wrong-signature and wrong-audience tokens → no session, each asserted separately. Mapping `404` → provisions once and issues a session; called twice with the same legacy id → one auth user, one mapping row (idempotence). Lookup timeout/`5xx` → **no session and no provisioning**, asserted explicitly, because a soft failure here is the bug this rule exists to prevent. |
| Frontend | `DrillRunner`: correct → inline text and focus advance; incorrect → error and retry; reveal excluded from accuracy; completion fires once. Self-drill lock renders while work is outstanding. One Playwright e2e on staging. |

Verification before any "done" claim follows
`superpowers:verification-before-completion`: typecheck each changed service
with its own compiler (`./node_modules/.bin/tsc --noEmit -p tsconfig.json` —
never `npx tsc`), run the suites, and reproduce the flow end to end in a browser.

---

## 16. Stages

| # | Stage | Owner service | Depends on |
|---|---|---|---|
| 0 | Contracts, gateway routes, env vars, Vault keys | api-gateway, shared | — |
| 1 | Item bank schema + migration of both legacy banks | content-service | 0 |
| 2 | Vocabulary baseline: `CourseVocabulary`, tokenizer, API | content-service | 1 |
| 3 | Drill library: sets, search, ratings, popularity, review state | content-service | 1 |
| 4 | Assignment schema, state machine, grading engine | education-service | 0 |
| 5 | Generator agent + prompt + output schema | ai-microservice | 0 |
| 6 | Validation agent + deterministic pre-checks + 80/20 enforcement | ai-microservice, content-service | 2,5 |
| 7 | Generation orchestration, progress reporting, regeneration loop | education-service | 1–6 |
| 8 | Runner API (answer-safe), completion, self-drilling gate, ratings | education-service | 4 |
| 9 | Frontend: `DrillRunner`, `/learner/practice`, self-drill browser | frontend | 8 |
| 10 | Frontend: wizard, progress view, library browser, review screen | frontend | 3,7 |
| 11 | Notification templates + dispatch hooks | notification-service | 8 |
| 12 | Identity: `resolve-or-provision-legacy` endpoint + mapping-coverage audit | auth-microservice | 0 |
| 13 | SSO handoff: `platform_sso.py`, `/auth/handoff`, fail-closed resolution | frontend, speakasap-portal | 12 |
| 14 | Legacy UI: student dashboard, teacher dashboard, lesson page (both views) | speakasap-portal | 13 |
| 15 | Rollout, migration verification, production reproduction | all | all |

Deploys are serialized ecosystem-wide via `shared/scripts/with-deploy-lock.sh`.
Implementation subagents stop at the deploy boundary; deploys are performed one
at a time by the orchestrating session.

---

## 17. Risks

- **Migration coverage is unknown until it runs.** Plain-`ExerciseField` classes
  are excluded from v1; the report quantifies what was left behind so a second
  pass is a data-driven decision.
- **Vocabulary baseline quality drives sentence quality.** If `WordTheme`
  coverage for a course is thin, the 80 % rule will reject good sentences and
  force needless regeneration. Stage 2 ends by reporting baseline size per
  course, so thin courses are known before generation depends on them.
- **Lemmatization varies by language.** Where no lemmatizer exists, surface-form
  matching makes the known-word ratio conservative — the safe direction, but it
  will show up as more regeneration on morphologically rich languages.
- **Validation agent cost and latency** — a second model pass over every item,
  bank items included. Deterministic checks run first and reject cheaply; the
  agent only sees what survives.
- **Topic taxonomy drift** — teacher-typed topics that match nothing are created
  with `isNew`, generated entirely by AI, and confirmed by the teacher during
  review, so the taxonomy grows deliberately rather than filling with synonyms.
- **Mapping coverage against the active roster is unmeasured.** 214,232 legacy
  users are mapped, but that is the bootstrap's total, not a check that every
  currently-active teacher and student is among them. Stage 12 measures it. If
  coverage is complete the provisioning path is dead code kept as a safety net;
  if it is not, the gap is known before students hit it rather than after.
