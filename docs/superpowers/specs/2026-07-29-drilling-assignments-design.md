# Design: AI-generated drilling assignments

Date: 2026-07-29
Status: approved design, ready for implementation planning
Scope: `speakasap` (content-service, education-service, notification-service, frontend), `ai-microservice`, `speakasap-portal` (entry points only)

---

## 1. Problem

A teacher needs to set targeted grammar practice for a student — "50 preposition
exercises with *an/bei/für*", "past tense drilling" — and today has no way to do
it. The teacher writes the request, the system assembles the sentences, the
teacher approves them, the student practises them in the browser with instant
per-blank feedback, and the teacher is notified when the work is done.

The exercises must be reusable. A drill built for one student is the same drill
another student needs next month, and the teacher must be able to find it again
without remembering which lesson it came from.

---

## 2. Decisions taken

| Question | Decision |
|---|---|
| Student practice UI | New platform, `speakasap.alfares.cz/learner/practice/*` |
| Teacher UI | New platform, `/teacher/assignments/*`, deep-linked from legacy portal |
| Ownership | Item bank + reusable sets in **content-service**; assignments, attempts, grading in **education-service** |
| Item source | Hybrid — import the legacy banks, AI generates only the shortfall |
| Completion rule | All blanks correct, unlimited retries; **first-attempt accuracy** is the recorded score |
| Review gate | Required only while a set contains unreviewed AI items; approval is **per set, once, forever** |
| Languages | Prompt in the student's material language, answers in the course language |
| Notifications | Student: email + in-app on assign. Teacher: email + in-app on completion |
| AI model | Best available tier (`smart`), configurable — quality over token cost |

---

## 3. Core model: sets, not assignments

The reusable object is a **DrillSet** — a titled, topic-tagged, ordered
collection of drill items in one language. Everything else hangs off it.

```
DrillItem  ──many──▶  DrillSet  ──instantiated as──▶  DrillAssignment (per student)
   ▲                     │                                   │
   │                     ├── ratings (teacher +1 / student +1)│
 banks + AI              └── review state (approved once)     └── attempts
```

Consequences of making the set — not the assignment — the unit of reuse:

- A set the teacher approved once is vetted forever. Assigning it to a second
  student skips review entirely. This is what makes "required only for
  AI-generated items" precise: review is required while the set holds
  *unreviewed* AI items, not every time it is handed out.
- Ratings and usage statistics accumulate on a stable object, so popularity
  ranking means something.
- Editing a set does not mutate live assignments — each assignment holds a
  **snapshot copy** of its items.

### Grouping key for "the same lesson"

`education_lesson.uuid` is per student-course, so it cannot group drills across
students. The stable grouping key is **`courseClass` + lesson `order`** (e.g.
`GermanA1` + lesson 5), which is exactly how `SevenLesson` is already keyed in
content-service. Sets carry `courseKey` and `lessonOrder` as nullable tags; the
library groups by them.

---

## 4. Item bank (content-service)

### 4.1 Schema — new models

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
  plainText        String   @db.Text   // template with answers substituted, markup stripped
  hint             String?  @db.Text   // the <span class="mute"> vocabulary note
  sourceType       String   @db.VarChar(16)  // BANK_GRAMMAR | BANK_SEVEN | AI | TEACHER
  sourceRef        String?  @db.VarChar(255) // "german.Lesson1Ex1.ex3"
  courseKey        String?  @db.VarChar(255) // course-material items only
  lessonOrder      Int?
  hash             String   @unique @db.VarChar(64)  // sha256(normalized plainText + language)
  status           String   @default("ACTIVE") @db.VarChar(16) // ACTIVE | RETIRED
  timesShown       Int      @default(0)
  timesCorrectFirstTry Int  @default(0)
  createdAt        DateTime @default(now())
  @@index([languageId, materialLanguage, topicId, status])
  @@index([courseKey, lessonOrder])
}
```

`template` keeps the legacy markup verbatim so bank items, AI items and
teacher-edited items are all one format, and the renderer has one code path.

### 4.2 Importers

Two one-off, idempotent, re-runnable importers. Both parse Python source with a
regex — they do **not** execute it (Python 3.4 is not available on alfares, and
executing legacy source is not something an importer should do).

**A. Grammar bank** — `speakasap-portal/grammar/exercises/*.py` (~4.5 MB, 16
languages, plus `fr/`, `ru/` and `<ml>__<lang>.py` material-language variants).

- Match `class (\w+)\(AnswerForm\)`, then `ex\d+\s*=\s*SmartExerciseField\(\s*label=(['"])(.*?)\1\s*\)` with DOTALL — labels wrap across lines (`grammar/exercises/german.py`).
- Parse blanks with `\[([^\]]*)\]\{([^\}]*)\}`. **Empty prompts are valid** (`Ich heiß[]{e}` — suffix drill) and must not be skipped.
- Handle escaped quotes in labels (`zo\'`).
- Extract the trailing `<span class="mute">…</span>` into `hint`; strip remaining HTML from `plainText` but keep it in `template`.
- Topic slug from the class name: `ComparisonAdjectivesEx1` → strip trailing `Ex\d+` → kebab-case → `comparison-adjectives`. Match to `GrammarLesson` by `alias` then `url`; unmatched topics are created with `grammarLessonId = null` and listed in the import report for manual tagging.
- Material language: filename `<lang>.py` → `ru`; `<ml>__<lang>.py` → `<ml>`; `fr/`, `ru/` subdirectories → directory name.

**B. Course-material bank** — `speakasap-portal/seven/exercises/*.py` (~1.5 MB).
Same parser, different tagging: class `Lesson<N>Ex<M>` yields `lessonOrder = N`
and `courseKey` from the language + material language, joined to the existing
`SevenLesson` / `SevenExercise` rows already in content-service. These items are
the "sentences from our own course materials" — they arrive pre-aligned to the
course a student is actually taking.

Both are idempotent on `hash`. Each emits a report: items parsed, items skipped
with reason, topics unmatched, coverage per language. Files that are 0 bytes
(`english.py`, `russian.py`, `chinese.py` in places) are expected and reported,
not treated as failures.

**Known gap:** classes using plain `ExerciseField` (answers passed as a separate
list rather than inline `{}`) are out of scope for v1. The report counts them so
the value of a second pass can be judged from data.

### 4.3 Bank query API

```
GET  /api/v1/drill-topics?languageCode=de&materialLanguage=ru
POST /api/v1/drill-items/search
     { languageCode, materialLanguage, topicSlugs[], level?, courseKey?,
       maxLessonOrder?, limit, excludeHashes[] }
```

`maxLessonOrder` restricts course-material items to lessons the student has
already covered — never drill vocabulary the student has not met.

Selection order: highest `popularityScore` of the sets the item belongs to,
then highest `timesCorrectFirstTry / timesShown` inside a 55–90 % band (an item
everyone gets right first try is not drilling; one nobody gets is discouraging),
then random. Deterministic under a seed for testability.

---

## 5. Drill library — sets, search, ratings (content-service)

### 5.1 Schema

```prisma
model DrillSet {
  uuid             String   @id @db.Uuid
  title            String   @db.VarChar(255)
  languageId       Int
  materialLanguage String   @db.VarChar(2)
  level            String?  @db.VarChar(4)
  topicSlugs       String[] // denormalized for filtering
  courseKey        String?  @db.VarChar(255)
  lessonOrder      Int?
  origin           String   @db.VarChar(16)  // AI | BANK | MIXED | TEACHER
  reviewState      String   @db.VarChar(16)  // PENDING_REVIEW | APPROVED
  createdByTeacherId Int?
  instructions     String?  @db.Text  // the teacher's original free-text request
  visibility       String   @default("SHARED") @db.VarChar(8) // SHARED | PRIVATE
  searchText       String   @db.Text  // concatenated item plainText, for full-text search
  timesAssigned    Int      @default(0)
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
  id       Int    @id @default(autoincrement())
  setUuid  String @db.Uuid
  itemId   Int
  order    Int
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

`searchText` gets a Postgres `tsvector` GIN index so a teacher who remembers one
sentence — "the one about the whale and the elephant" — can find the set.

### 5.2 Popularity

```
popularityScore = 3·teacherUpvotes + 1·studentUpvotes
                + 0.5·min(timesAssigned, 20)
                − 5·(reviewState != APPROVED)
```

Recomputed on every rating and every assignment completion, stored on the row so
sorting is a plain indexed `ORDER BY`. Downvotes subtract through the same
weights. No time decay in v1 — the corpus is small and a good drill does not go
stale.

`avgFirstTryAccuracy` is reported to the teacher as a difficulty signal but does
**not** feed the score: a hard set is not a bad set.

### 5.3 Library API

```
GET  /api/v1/drill-sets?languageCode=&materialLanguage=&topicSlugs=&courseKey=
                       &lessonOrder=&q=&sort=popularity|recent|accuracy
                       &createdBy=&reviewState=&groupBy=lesson
GET  /api/v1/drill-sets/:uuid            # full preview incl. answers (teacher auth)
POST /api/v1/drill-sets                  # create from selected items
PATCH /api/v1/drill-sets/:uuid           # title, topics, visibility
PATCH /api/v1/drill-sets/:uuid/items/:id # edit one item's template/answers
DELETE /api/v1/drill-sets/:uuid/items/:id
POST /api/v1/drill-sets/:uuid/approve
POST /api/v1/drill-sets/:uuid/ratings    # { value, comment? } — rater identity
                                         # comes from the token, never the body

```

`groupBy=lesson` returns sets bucketed by `courseKey` + `lessonOrder` with an
"unassigned" bucket, which is the default view of the library browser. Search
with `q` deliberately ignores the lesson filter so a teacher can find a good
drill that came from a different lesson — the exact case raised in review.

---

## 6. Assignments, attempts, grading (education-service)

### 6.1 Schema

```prisma
model DrillAssignment {
  uuid              String   @id @db.Uuid
  setUuid           String   @db.Uuid       // source set in content-service
  studentId         Int
  teacherId         Int
  studentCourseUuid String?  @db.Uuid
  lessonUuid        String?  @db.Uuid       // nullable — standalone or lesson-linked
  batchUuid         String?  @db.Uuid
  title             String   @db.VarChar(255)
  languageCode      String   @db.VarChar(8)
  materialLanguage  String   @db.VarChar(2)
  status            String   @db.VarChar(16) // GENERATING|PENDING_REVIEW|ASSIGNED|IN_PROGRESS|COMPLETED|CANCELLED
  dueAt             DateTime?
  resourceLinks     Json     @default("[]") // [{topic, url}] grammar topic links
  generationMeta    Json     @default("{}") // model, tier, tokens, correlationId, bankCount, aiCount
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
  uuid       String   @id @db.Uuid
  teacherId  Int
  instructions String @db.Text
  filter     Json     // { groupUuid? , studentIds[] }
  createdAt  DateTime @default(now())
}
```

### 6.2 Lifecycle

```
              ┌── set already APPROVED ──────────────────────┐
GENERATING ───┤                                              ├─▶ ASSIGNED ─▶ IN_PROGRESS ─▶ COMPLETED
              └── set PENDING_REVIEW ─▶ (teacher approves) ──┘
                                                        └────────────────▶ CANCELLED
```

Bulk assignment creates one `DrillAssignmentBatch` and fans out to N
assignments sharing one set. Reviewing the set once releases all of them.

### 6.3 Grading

One pure function, `src/drills/grading.ts`, table-tested — no framework, no I/O:

- trim; collapse internal whitespace; Unicode NFC normalize
- fold typographic apostrophes and quotes to ASCII (`’` → `'`)
- strip a single trailing `.`/`!`/`?` (mid-string punctuation is significant)
- accept any entry in `alternatives[]`
- case-insensitive **by default**, with a per-language `caseSensitive` flag —
  German capitalises nouns and `sie`/`Sie` is a real distinction
- diacritics are **never** stripped: `é ≠ e` in French, `ö ≠ o` in German

Called only server-side. Never shipped to the browser.

### 6.4 Answer confidentiality

The legacy implementation puts the answer in the DOM
(`portal/templates/tags/exercise_field.html` → `data-answer="{{ help }}"`), so a
student can read every answer from devtools. The new runner does not:

- `GET /api/v1/drill-assignments/:uuid/runner` returns, per blank, only
  `{ index, prompt, maxLength }` — never `answer` or `alternatives`
- `POST /api/v1/drill-assignments/:uuid/check` grades one blank server-side
- completion is decided by the server after re-checking stored attempts
- an explicit test asserts the runner response body contains none of the
  assignment's answer strings

### 6.5 Assignment API

Teacher:
```
POST   /api/v1/drill-assignments/generate      { studentIds[]|groupUuid, lessonUuid?,
                                                 instructions, topicSlugs[], itemCount,
                                                 dueAt?, useCourseMaterials? }
POST   /api/v1/drill-assignments/from-set      { setUuid, studentIds[], lessonUuid?, dueAt? }
GET    /api/v1/drill-assignments?teacherId=me&status=
GET    /api/v1/drill-assignments/:uuid
POST   /api/v1/drill-assignments/:uuid/cancel
```

Student:
```
GET    /api/v1/drill-assignments/mine
GET    /api/v1/drill-assignments/:uuid/runner
POST   /api/v1/drill-assignments/:uuid/check   { itemUuid, blankIndex, value }
POST   /api/v1/drill-assignments/:uuid/reveal  { itemUuid, blankIndex }
POST   /api/v1/drill-assignments/:uuid/rate    { value, comment? }   → forwards to content-service
```

Internal (for the legacy portal):
```
GET    /api/v1/internal/drill-assignments/by-student/:studentId
GET    /api/v1/internal/drill-assignments/by-teacher/:teacherId
```

Gateway prefixes to add to `api-gateway/src/proxy/upstream-resolve.ts`:
`/api/v1/drill-assignments` → `EDUCATION_SERVICE_URL`;
`/api/v1/drill-sets`, `/api/v1/drill-items`, `/api/v1/drill-topics` → `CONTENT_SERVICE_URL`.
Longest-prefix wins, so `/api/v1/internal/drill-assignments` must be listed
above the existing `/api/v1/internal` → `USER_SERVICE_URL` entry.

---

## 7. Generation (education-service → ai-microservice)

### 7.1 Pipeline

1. Resolve topics (`content-service /drill-topics`) and the student's course +
   current lesson order (`education-service`, local).
2. Ask content-service for up to `itemCount` bank items:
   grammar-bank items for the requested topics, plus — when
   `useCourseMaterials` is set — course-material items restricted to
   `maxLessonOrder = student's current lesson order`.
3. If the bank covers the request, build the set with `origin = BANK`,
   `reviewState = APPROVED`, and assign immediately.
4. Otherwise call ai-microservice for the shortfall, passing:
   - the teacher's verbatim instructions
   - 8–12 bank items as few-shot examples (same topic, same language pair)
   - vocabulary and sentences from the student's course lessons up to their
     current order, from `SevenLesson.bodyHtml` and imported course-material items
   - `avoidTexts` — `plainText` of every item already selected, plus items this
     student has seen before
5. Validate every returned item (§7.3). Discard failures, re-request up to two
   further rounds, then stop and mark the set partial with a note for the teacher.
6. Persist the set to content-service with `origin = AI|MIXED`,
   `reviewState = PENDING_REVIEW`; create assignments in `PENDING_REVIEW`.

### 7.2 The agent — ai-microservice `src/teacher-assistant/`

`POST /api/teacher-assistant/generate-drill`, JWT required, calling
`/ai/complete` with `model_tier` from `DRILL_GENERATION_MODEL_TIER` (default
`smart` — best available; quality matters more than token cost here).

Request:
```json
{ "languageCode": "de", "materialLanguage": "ru", "level": "A2",
  "topics": [{ "slug": "prepositions", "title": "Предлоги", "focus": "an, bei, für" }],
  "instructions": "50 sentences, present tense only, everyday vocabulary",
  "count": 32,
  "exampleItems": ["Ich gehe [in]{in} die Schule."],
  "courseVocabulary": ["heißen", "wohnen", "lernen"],
  "avoidTexts": ["..."] }
```

Response schema (enforced via `output_schema`):
```json
{ "items": [ { "template": "Ich warte [на]{auf} den Bus.",
               "blanks": [{ "prompt": "на", "answer": "auf", "alternatives": [] }],
               "hint": "(warten auf – ждать; der Bus – автобус)",
               "topicSlug": "prepositions" } ] }
```

The prompt instructs: prompt text in `materialLanguage`, blanks in
`languageCode`, one grammar point per sentence, everyday register, no proper
nouns outside `courseVocabulary`, `hint` in the legacy `(word – translation)`
style. Prompt and schema live in one reviewable file so they can be evaluated
and changed without touching call sites.

### 7.3 Validation before storage

Every AI item must pass, or it is discarded:
- `template` parses under `\[([^\]]*)\]\{([^\}]*)\}` and yields ≥ 1 blank
- `blanks.length` equals the parsed count and indices align
- every `answer` is non-empty after trimming
- the answer's script matches the target language's expected script (a Cyrillic
  answer in a German drill is a generation failure, not a valid item)
- substituting the answers produces a sentence with no leftover markup
- `hash` collides with neither the current set nor the bank

Validation is a pure function with its own tests, fed by fixtures of real
malformed output. It never trusts the model's own claim of conformance.

### 7.4 Asynchrony

No queue library is installed in these services. Generation runs as an
in-process background task; the assignment sits in `GENERATING` and the frontend
polls `GET /drill-assignments/:uuid`. Correct at this volume, and replaceable
with BullMQ later without an API change. A `GENERATING` row older than 10
minutes is swept to `CANCELLED` with an error note on next access.

---

## 8. Student runner (frontend)

`/learner/practice` — assignment list: title, topics with links to the public
grammar pages, item count, due date, progress.

`/learner/practice/[uuid]` — the runner. One component, `DrillRunner`:

- renders `template`, each blank an auto-sized inline `<input>` showing `prompt`
  as placeholder
- on debounced input (250 ms), blur, or Enter → `POST /check`
- **correct** → the input is replaced in place by bold green text, becoming part
  of the sentence; focus advances to the next blank automatically
- **incorrect** → red border, value kept, unlimited retries, no answer revealed
- optional "show answer" per blank, recorded as `revealed` and excluded from
  first-attempt accuracy
- progress bar; when the server reports the last blank correct, the assignment
  auto-completes and a summary appears with first-try accuracy and a
  thumbs-up/down that posts to `/rate`
- `aria-live="polite"` announces correctness; every blank has a real label; full
  keyboard operation (Tab/Enter advance)

Offline/flaky network: a failed `/check` retries once, then surfaces
"not saved — check your connection" rather than silently marking a blank wrong.

---

## 9. Teacher UI (frontend)

`/teacher/assignments/new` — three-step wizard:
1. **Who** — student, several students, or a group; optional lesson link
2. **What** — topic picker (autocomplete from `/drill-topics`, shows the public
   grammar-page URL), free-text instructions, item count, "use sentences from
   this student's course materials" toggle
3. **How** — *Generate new* or *Pick from library*

`/teacher/assignments/library` — the drill library. Default view groups sets by
course + lesson order; a search box queries `searchText` **across all lessons**
so a set from a different lesson can be found by a remembered sentence. Filters:
language, topic, level, mine/all, approved only. Each row shows
title, topics, item count, times assigned, ★ score, average first-try accuracy.
Multi-select checkboxes → "Assign selected to…".

`/teacher/assignments/[uuid]/review` — item-by-item preview showing exactly what
the student will see plus the answers, with inline edit, delete, "regenerate
this item", set title/topic editing, ★ rating, and **Approve & send**. Approving
marks the *set* approved, so it never needs reviewing again.

`/teacher/assignments` — list by status, including completed ones with scores.

---

## 10. Notifications (speakasap/notification-service)

Two templates, both bilingual by the recipient's material language:

- `drill_assignment_assigned` → student, on approval/assign. Subject, topic
  list with links to the public grammar pages, due date, deep link to the
  runner. Plus an in-app record.
- `drill_assignment_completed` → teacher, on completion. First-try accuracy,
  per-topic breakdown, items the student struggled with, link to the lesson and
  to the review page. Plus an in-app record.

Dispatch is fire-and-forget with retry; a failed email never blocks the state
transition, and a failure is logged with the assignment uuid.

---

## 11. Legacy portal integration (speakasap-portal)

Django templates and one new module. No model changes, no migrations, no React
15, no Webpack 2, no touching supervisord.

1. **`portal/platform_sso.py`** — generalizes `marathon/jwt_for_marathon.py`
   into `get_platform_bearer_token(user, audience, expiry)`, signed with a new
   `SPEAKASAP_PLATFORM_JWT_SECRET` setting (Vault: `secret/prod/speakasap-portal`).
   PyJWT 1.5.3 / Python 3.4 compatible, byte-vs-str return handled as the
   existing helper does.
2. **`user-service`** — new `POST /api/v1/internal/sso/exchange`: verifies the
   portal JWT, maps the legacy numeric user id to the platform auth user (the
   bridge already exists in reverse via `/api/v1/students/me` →
   `education-service/src/lesson-records/user-profiles.client.ts`), and returns a
   normal platform access token. **This is the only genuinely new auth surface
   and gets its own stage with tests** — the known portal-JWT identity gap lives
   here.
3. **`frontend /auth/handoff`** — consumes `?sso=`, calls the exchange, stores
   the session using the existing `consumeHostedAuthFragment` machinery, and
   redirects to `nextPath`.
4. **`cabinet/student` dashboard** — server-side call to
   `/api/v1/internal/drill-assignments/by-student/:id`, renders "Practice
   assignments — N due" cards linking to
   `{PLATFORM_URL}/learner/practice/{uuid}?sso=…`.
5. **`cabinet/teacher` dashboard and the lesson page** — "Create drilling
   assignment" button linking to
   `{PLATFORM_URL}/teacher/assignments/new?lessonUuid=…&studentId=…&sso=…`,
   plus a "Practice assignments" panel on the lesson showing status per student.

Both portal-side calls fail soft: if education-service is unreachable the panel
renders empty with a quiet notice, never a 500 on the dashboard.

---

## 12. Testing

| Area | Tests |
|---|---|
| Importers | Parser unit tests on fixtures from each language file: multi-line labels, escaped quotes, empty prompts (`heiß[]{e}`), multiple blanks per sentence, `<span class="mute">` extraction, HTML-heavy labels. Idempotence: second run inserts zero rows. |
| Grading | Table tests per rule and per language, including German case sensitivity, French diacritics, typographic apostrophes, trailing punctuation, alternatives. |
| Answer confidentiality | Explicit test: runner response body contains no answer or alternative string from the assignment. |
| Assignment state machine | Every legal transition plus rejection of illegal ones; bulk fan-out; set approval releasing all assignments in a batch. |
| AI validation | Fixtures of real malformed model output — wrong blank count, empty answer, wrong-script answer, leftover markup, duplicate — each rejected. |
| Generation orchestration | Bank fully covers → zero AI calls, set auto-approved. Bank partially covers → AI called for exactly the shortfall. AI fails twice → set marked partial, no crash. |
| Popularity | Score formula unit tests; ordering test; downvote lowers rank; unapproved sets rank last. |
| Frontend | `DrillRunner`: correct → inline text and focus advance; incorrect → error, retry allowed; reveal excluded from accuracy; completion fires once. One Playwright e2e end-to-end on staging. |
| Legacy | Django tests for token issue and for dashboard cards rendering, including the service-unreachable path. |

Verification before any "done" claim follows `superpowers:verification-before-completion`:
typecheck each changed service with its own compiler
(`./node_modules/.bin/tsc --noEmit -p tsconfig.json` — never `npx tsc`), run the
suites, and reproduce the end-to-end flow in the browser.

---

## 13. Stages

Each stage is independently shippable and independently verifiable.

| # | Stage | Owner service | Depends on |
|---|---|---|---|
| 0 | Contracts, gateway routes, env vars, Vault keys | api-gateway, shared | — |
| 1 | Item bank schema + grammar importer + course-material importer | content-service | 0 |
| 2 | Drill library: sets, search, ratings, popularity, review state | content-service | 1 |
| 3 | Assignment schema, state machine, grading engine | education-service | 0 |
| 4 | Teacher-assistant agent + prompt + output schema | ai-microservice | 0 |
| 5 | Generation orchestration + AI validation | education-service | 1,2,3,4 |
| 6 | Runner API (answer-safe) + completion + rating forward | education-service | 3 |
| 7 | Frontend: `DrillRunner` + `/learner/practice` | frontend | 6 |
| 8 | Frontend: teacher wizard, library browser, review screen | frontend | 2,5 |
| 9 | Notification templates + dispatch hooks | notification-service | 6 |
| 10 | SSO exchange endpoint + `/auth/handoff` | user-service, frontend | 0 |
| 11 | Legacy portal entry points (student + teacher + lesson panel) | speakasap-portal | 10 |
| 12 | Rollout, seed verification, production reproduction | all | all |

Deploys are serialized ecosystem-wide (`shared/scripts/with-deploy-lock.sh`).
Implementation subagents stop at the deploy boundary; deploys are performed one
at a time by the orchestrating session.

---

## 14. Risks

- **Importer coverage is unknown until it runs.** Plain-`ExerciseField` classes
  are excluded from v1; the report quantifies what was left behind so a second
  pass is a data-driven decision rather than a guess.
- **Legacy portal has no local dev environment.** Portal changes are templates
  plus one module, verified read-only on the speakasap server before deploy.
  `ssh speakasap` remains read-only; deployment goes through the normal pipeline.
- **`DrillAttempt` growth** — 50 items × several blanks × retries × students.
  Indexed by assignment; a retention policy is needed before the table matters,
  not after.
- **SSO identity mapping** is the highest-risk piece and is isolated in stage 10
  with its own tests; a mismatch there must fail closed, never fall back to an
  unauthenticated session.
- **Generation latency** — 50 items on the `smart` tier may take tens of
  seconds. The `GENERATING` state plus polling exists for this; the teacher is
  never blocked on a spinner and can leave the page.
- **Topic taxonomy drift** — teacher-typed topics that match no `DrillTopic`
  must not silently produce an empty bank query; they fall through to AI
  generation and are flagged in the review screen as a new topic to confirm.
