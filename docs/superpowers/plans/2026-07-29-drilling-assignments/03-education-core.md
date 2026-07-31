# Track B — Assignment Domain and Grading (Wave 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The assignment data model, its state machine, and the grading engine.

**Service:** `speakasap/education-service` · **Depends on:** Track 0 · **Blocks:** Tracks B2, D, E, G

**Read first:** [`00-MASTER.md`](00-MASTER.md) (contracts C6, C7), spec §9.1, §9.2, §9.4.

**You own:** `education-service/prisma/schema.prisma` (drill models only), `education-service/src/drills/**` **except** `src/drills/orchestration/**` (Track D owns that). Do not create files under `orchestration/`.

---

### Task B.1: Prisma models for assignments

**Files:**
- Modify: `education-service/prisma/schema.prisma`

**Interfaces:**
- Consumes: existing `Lesson`, `StudentCourse` models
- Produces: `DrillAssignment`, `DrillAssignmentItem`, `DrillAttempt`, `DrillAssignmentBatch`

- [ ] **Step 1: Append the models**

```prisma
model DrillAssignment {
  uuid               String    @id @db.Uuid
  setUuid            String    @map("set_uuid") @db.Uuid
  studentId          Int       @map("student_id")
  teacherId          Int?      @map("teacher_id")
  origin             String    @db.VarChar(8)
  studentCourseUuid  String?   @map("student_course_uuid") @db.Uuid
  lessonUuid         String?   @map("lesson_uuid") @db.Uuid
  batchUuid          String?   @map("batch_uuid") @db.Uuid
  title              String    @db.VarChar(255)
  languageCode       String    @map("language_code") @db.VarChar(8)
  materialLanguage   String    @map("material_language") @db.VarChar(2)
  status             String    @db.VarChar(16)
  dueAt              DateTime? @map("due_at")
  resourceLinks      Json      @default("[]") @map("resource_links")
  generationMeta     Json      @default("{}") @map("generation_meta")
  generationProgress Json      @default("{}") @map("generation_progress")
  firstTryAccuracy   Float?    @map("first_try_accuracy")
  createdAt          DateTime  @default(now()) @map("created_at")
  assignedAt         DateTime? @map("assigned_at")
  startedAt          DateTime? @map("started_at")
  completedAt        DateTime? @map("completed_at")

  lesson   Lesson?               @relation(fields: [lessonUuid], references: [uuid], onDelete: SetNull)
  items    DrillAssignmentItem[]
  attempts DrillAttempt[]

  @@index([studentId, status])
  @@index([teacherId, status])
  @@index([lessonUuid])
  @@index([setUuid])
  @@map("drill_assignment")
}

model DrillAssignmentItem {
  uuid           String  @id @db.Uuid
  assignmentUuid String  @map("assignment_uuid") @db.Uuid
  order          Int
  sourceItemId   Int?    @map("source_item_id")
  template       String  @db.Text
  blanks         Json
  hint           String? @db.Text
  topicSlug      String? @map("topic_slug") @db.VarChar(255)

  assignment DrillAssignment @relation(fields: [assignmentUuid], references: [uuid], onDelete: Cascade)
  attempts   DrillAttempt[]

  @@unique([assignmentUuid, order])
  @@map("drill_assignment_item")
}

model DrillAttempt {
  uuid           String   @id @db.Uuid
  assignmentUuid String   @map("assignment_uuid") @db.Uuid
  itemUuid       String   @map("item_uuid") @db.Uuid
  blankIndex     Int      @map("blank_index")
  submittedValue String   @map("submitted_value") @db.Text
  isCorrect      Boolean  @map("is_correct")
  attemptNo      Int      @map("attempt_no")
  revealed       Boolean  @default(false)
  createdAt      DateTime @default(now()) @map("created_at")

  assignment DrillAssignment     @relation(fields: [assignmentUuid], references: [uuid], onDelete: Cascade)
  item       DrillAssignmentItem @relation(fields: [itemUuid], references: [uuid], onDelete: Cascade)

  @@index([assignmentUuid, itemUuid])
  @@map("drill_attempt")
}

model DrillAssignmentBatch {
  uuid         String   @id @db.Uuid
  teacherId    Int      @map("teacher_id")
  instructions String   @db.Text
  filter       Json
  createdAt    DateTime @default(now()) @map("created_at")

  @@map("drill_assignment_batch")
}
```

Add to the existing `Lesson` model: `drillAssignments DrillAssignment[]`.

**Note on `firstTryAccuracy`:** the column exists because item-level correctness
statistics are computed from it for bank selection. It is **never** returned in
any teacher-facing DTO. `DrillAssignmentDTO` (contract C6) has no such field —
do not add one.

**Note (added by ruling after B.1 review, 2026-07-31):** `DrillAttempt.assignmentUuid`
and `DrillAttempt.itemUuid` were originally bare `@db.Uuid` scalars with no
`@relation`. Review flagged that every other FK-shaped column in this migration has
one, and an orphaned `drill_attempt` row has no DB-level cleanup path when its parent
`DrillAssignment` or `DrillAssignmentItem` is deleted. Both parents are created in the
same migration, so there is no ordering obstacle. The human partner ruled this finding
governs over the original plan text above: both relations now carry
`onDelete: Cascade`, with `attempts DrillAttempt[]` back-relations added to
`DrillAssignment` and `DrillAssignmentItem`. The model block above reflects the
as-built shape.

**Note (whole-track review, 2026-07-31) — two more FKs, same class.** The ruling
above was applied to the one instance, not the class. Two more FK-shaped columns had
no relation and now do, both `onDelete: SetNull` (both columns are nullable and
neither parent's deletion should destroy assignment history):

- `DrillAssignment.batchUuid` → `DrillAssignmentBatch.uuid`. Created in this very
  same migration; identical case to the ruling above.
- `DrillAssignment.studentCourseUuid` → `StudentCourse` (`education_studentcourse`),
  same schema, same database. Directly analogous to `lessonUuid`, which already had
  an FK to a legacy Django table.

Back-relations added: `assignments DrillAssignment[]` on `DrillAssignmentBatch`,
`drillAssignments DrillAssignment[]` on `StudentCourse`.

`DrillAssignmentItem.sourceItemId` points at content-service's `DrillItem` in a
**different database** and is deliberately left bare. Do not "complete the set".

**Note (whole-track review, 2026-07-31) — index changes.** Postgres does not
auto-index foreign keys, so the FK ruling above left `drill_attempt_item_uuid_fkey`
with no usable index: `@@index([assignmentUuid, itemUuid])` leads with
`assignment_uuid`, so every `DELETE` of a `drill_assignment_item` sequentially scanned
`drill_attempt` — 20 scans to delete one 20-item assignment, on the fastest-growing
table in the feature. As-built index set:

- `DrillAttempt`: `@@index([itemUuid])` added, supporting that cascade.
- `DrillAttempt`: `@@index([assignmentUuid, itemUuid])` **widened** to
  `@@index([assignmentUuid, itemUuid, blankIndex, isCorrect, revealed])`. This is the
  supporting index for `countBlanks`/`countBlanksFor`, the hottest read in the runner
  loop, which filters `assignment_uuid IN (...) AND (is_correct OR revealed)` and
  selects only `(item_uuid, blank_index)`. Every column that query touches is present,
  so it is answered by an index-only scan; the `(assignment_uuid, item_uuid)` prefix is
  preserved, so per-item lookups lose nothing and no second index is needed.
- `DrillAssignment`: `@@index([studentCourseUuid])` and `@@index([batchUuid])` added,
  so the two new SET NULL foreign keys are not the same class of problem.

**Note on regenerating the migration (2026-07-31).** `20260731044037_drill_assignments`
has still never been applied, so the schema changes above were regenerated **into the
same directory** rather than appended as a second migration. `prisma migrate dev` was
**not** used: the only reachable database (`EDUCATION_TARGET_DATABASE_URL`) is
production, and `migrate dev` creates a shadow database there and can prompt for a
reset. The SQL was produced fully offline instead:

```bash
rtk git show aa38676:education-service/prisma/schema.prisma > /tmp/schema-base.prisma
rtk npx prisma migrate diff \
  --from-schema-datamodel /tmp/schema-base.prisma \
  --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/migrations/20260731044037_drill_assignments/migration.sql
```

A datamodel→datamodel diff touches no database and, as a side effect, never emits the
`ALTER TABLE "education_lessonrecord" ALTER COLUMN "updated" DROP DEFAULT;` drift
statement that a DB-backed diff produces — so there was nothing to strip, and the
result is byte-for-byte the four drill tables, their indexes and their foreign keys.
See the `LessonRecord.updatedAt` comment in `schema.prisma` for why that statement is
stripped whenever it does appear.

- [ ] **Step 2: Validate and create the migration**

```bash
cd /home/ssf/Documents/Github/speakasap/education-service
rtk npx prisma validate
rtk npx prisma migrate dev --name drill_assignments --create-only
```

Read the SQL. Confirm no `DROP` and no `ALTER` against `education_lesson` beyond
the added foreign key. Report anything else and stop.

- [ ] **Step 3: Generate, typecheck, commit**

```bash
rtk npx prisma generate && rtk npm run typecheck
rtk git add prisma/
rtk git commit -m "feat(education): drill assignment models

Migration created, not applied. firstTryAccuracy is internal only and is
deliberately absent from every teacher-facing DTO.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task B.2: The grading engine

The most-tested pure function in the feature. Get it right here and no other
track has to think about it.

**Files:**
- Create: `education-service/src/drills/grading.ts`
- Test: `education-service/src/drills/grading.spec.ts`

**Interfaces:**
- Consumes: `DrillBlank` from `./contracts`
- Produces:
  - `normalizeAnswer(value: string, opts: GradingOptions): string`
  - `gradeBlank(value: string, blank: DrillBlank, opts: GradingOptions): GradeResult`
  - `gradingOptionsFor(languageCode: string): GradingOptions`
  ```ts
  export interface GradingOptions { caseSensitive: boolean; }
  export interface GradeResult { correct: boolean; acceptedText: string | null; }
  ```
  Track B2 calls `gradeBlank` from the check endpoint.

- [ ] **Step 1: Write the failing tests — one table, every rule**

> **2026-07-31 review note:** the original assertion here compared two identical precomposed `'é'` literals (a tautology that verified nothing); repaired to compare an explicit precomposed codepoint against an explicit decomposed sequence.

```ts
import { gradeBlank, normalizeAnswer, gradingOptionsFor } from './grading';
import { DrillBlank } from './contracts';

const blank = (answer: string, alternatives: string[] = []): DrillBlank =>
  ({ index: 0, prompt: '', answer, alternatives });

describe('normalizeAnswer', () => {
  const opts = { caseSensitive: false };

  it('trims and collapses internal whitespace', () => {
    expect(normalizeAnswer('  in   die  ', opts)).toBe('in die');
  });

  it('folds typographic apostrophes to ASCII', () => {
    expect(normalizeAnswer('l’eau', opts)).toBe("l'eau");
  });

  it('strips a single trailing sentence punctuation mark', () => {
    expect(normalizeAnswer('bigger.', opts)).toBe('bigger');
    expect(normalizeAnswer('bigger!', opts)).toBe('bigger');
    expect(normalizeAnswer('bigger?', opts)).toBe('bigger');
  });

  it('keeps mid-string punctuation', () => {
    expect(normalizeAnswer("n'est-ce pas", opts)).toBe("n'est-ce pas");
  });

  it('NFC-normalizes composed and decomposed forms to the same string', () => {
    const precomposed = '\u00e9'; // \u00e9 as a single precomposed codepoint
    const decomposed = 'e\u0301'; // e (U+0065) + combining acute accent (U+0301)
    expect(normalizeAnswer(decomposed, opts)).toBe(normalizeAnswer(precomposed, opts));
  });
});

describe('gradeBlank', () => {
  it('accepts an exact match', () => {
    expect(gradeBlank('auf', blank('auf'), { caseSensitive: false }))
      .toEqual({ correct: true, acceptedText: 'auf' });
  });

  it('accepts a listed alternative and echoes the typed form', () => {
    const r = gradeBlank('dieses', blank('dies', ['dieses']), { caseSensitive: false });
    expect(r.correct).toBe(true);
    expect(r.acceptedText).toBe('dieses');
  });

  it('rejects a wrong answer with no accepted text', () => {
    expect(gradeBlank('bei', blank('auf'), { caseSensitive: false }))
      .toEqual({ correct: false, acceptedText: null });
  });

  it('is case-insensitive by default', () => {
    expect(gradeBlank('AUF', blank('auf'), { caseSensitive: false }).correct).toBe(true);
  });

  it('respects case when the language demands it', () => {
    expect(gradeBlank('schule', blank('Schule'), { caseSensitive: true }).correct).toBe(false);
    expect(gradeBlank('Schule', blank('Schule'), { caseSensitive: true }).correct).toBe(true);
  });

  it('never strips diacritics — é is not e', () => {
    expect(gradeBlank('ete', blank('été'), { caseSensitive: false }).correct).toBe(false);
  });

  it('never strips umlauts — o is not ö', () => {
    expect(gradeBlank('schon', blank('schön'), { caseSensitive: true }).correct).toBe(false);
  });

  it('rejects an empty submission', () => {
    expect(gradeBlank('   ', blank('auf'), { caseSensitive: false }).correct).toBe(false);
  });
});

describe('gradingOptionsFor', () => {
  it('is case-sensitive for German', () => {
    expect(gradingOptionsFor('de').caseSensitive).toBe(true);
  });

  it('is case-insensitive for English', () => {
    expect(gradingOptionsFor('en').caseSensitive).toBe(false);
  });

  it('defaults to case-insensitive for an unlisted language', () => {
    expect(gradingOptionsFor('xx').caseSensitive).toBe(false);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
rtk npm --prefix /home/ssf/Documents/Github/speakasap/education-service test -- grading
```

- [ ] **Step 3: Implement**

```ts
import { DrillBlank } from './contracts';

export interface GradingOptions {
  caseSensitive: boolean;
}

export interface GradeResult {
  correct: boolean;
  acceptedText: string | null;
}

/** Languages where capitalization is semantically load-bearing. */
const CASE_SENSITIVE_LANGUAGES = new Set(['de']);

export function gradingOptionsFor(languageCode: string): GradingOptions {
  return { caseSensitive: CASE_SENSITIVE_LANGUAGES.has(languageCode) };
}

export function normalizeAnswer(value: string, opts: GradingOptions): string {
  let out = value
    .normalize('NFC')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]$/, '')
    .trim();
  if (!opts.caseSensitive) out = out.toLowerCase();
  return out;
}

export function gradeBlank(
  value: string,
  blank: DrillBlank,
  opts: GradingOptions,
): GradeResult {
  const submitted = normalizeAnswer(value, opts);
  if (submitted.length === 0) return { correct: false, acceptedText: null };

  const accepted = [blank.answer, ...blank.alternatives];
  const match = accepted.some((a) => normalizeAnswer(a, opts) === submitted);
  return match ? { correct: true, acceptedText: value.trim() } : { correct: false, acceptedText: null };
}
```

**Note (whole-track review, 2026-07-31) — `gradeBlank` is hardened against a
malformed persisted blank.** The line above is NOT the as-built code. `blanks` is an
unvalidated `Json` column written by AI generation in Tracks C/D, so its runtime shape
is not guaranteed to match `DrillBlank`, and the bare spread turned a bad row into a
500 on the *student's* check request:

```
missing alternatives => TypeError: blank.alternatives is not iterable
null answer          => TypeError: Cannot read properties of null (reading 'normalize')
```

As-built behaviour — **signature and well-formed-input behaviour are unchanged**:

- non-string `answer` (null, missing, number) → **ungradeable**:
  `{ correct: false, acceptedText: null }`
- missing / non-array `alternatives` → treated as `[]` (note: a bare spread of a
  *string* `alternatives` would splat it into single accepted characters)
- non-string entries inside `alternatives` → skipped

`{ correct: false, acceptedText: null }` is the deliberate ungradeable return: it never
tells a student they are right and never reveals anything. All 16 original grading
tests still pass untouched.

**Note (whole-track review, 2026-07-31) — apostrophe folding widened.** The character
class is now `/[‘’ʼ´`′]/`. `´` (U+00B4 acute), `` ` `` (U+0060 grave) and `′` (U+2032
prime) were missing and are produced by real keyboards and mobile autocorrect.
`toLocaleLowerCase` was considered and deliberately **not** adopted: Turkish is not an
offered language, and plain `toLowerCase` is correct for the live language set.

- [ ] **Step 4: Run, confirm PASS (17 passed)**

- [ ] **Step 5: Prove the diacritic tests are real**

Temporarily add `.replace(/\p{M}/gu, '')` after `.normalize('NFD')` in
`normalizeAnswer` and rerun. The two diacritic tests must fail. Remove the
change and rerun. If they still passed with stripping enabled, the tests are
wrong — fix them, not the implementation.

- [ ] **Step 6: Commit**

```bash
rtk git add src/drills/grading.ts src/drills/grading.spec.ts
rtk git commit -m "feat(education): grading engine

Case-insensitive by default, case-sensitive for German, and diacritics are
never stripped. The diacritic tests were verified by temporarily enabling
stripping and watching them fail.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task B.3: The assignment state machine

**Files:**
- Create: `education-service/src/drills/state-machine.ts`
- Test: `education-service/src/drills/state-machine.spec.ts`

**Interfaces:**
- Consumes: `DrillAssignmentStatus` from `./contracts`
- Produces:
  - `canTransition(from: DrillAssignmentStatus, to: DrillAssignmentStatus): boolean`
  - `assertTransition(from, to): void` — throws `ConflictException` when illegal
  - `TERMINAL_STATUSES: ReadonlySet<DrillAssignmentStatus>`

- [ ] **Step 1: Write the failing test**

```ts
import { canTransition, assertTransition, TERMINAL_STATUSES } from './state-machine';
import { DrillAssignmentStatus } from './contracts';

describe('canTransition', () => {
  it('allows the teacher-review path', () => {
    expect(canTransition('GENERATING', 'PENDING_REVIEW')).toBe(true);
    expect(canTransition('PENDING_REVIEW', 'ASSIGNED')).toBe(true);
    expect(canTransition('ASSIGNED', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });

  it('allows skipping review when the set is already approved', () => {
    expect(canTransition('GENERATING', 'ASSIGNED')).toBe(true);
  });

  it('allows cancelling from any non-terminal state', () => {
    expect(canTransition('GENERATING', 'CANCELLED')).toBe(true);
    expect(canTransition('PENDING_REVIEW', 'CANCELLED')).toBe(true);
    expect(canTransition('ASSIGNED', 'CANCELLED')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'CANCELLED')).toBe(true);
  });

  it('forbids leaving a terminal state', () => {
    expect(canTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
    expect(canTransition('CANCELLED', 'ASSIGNED')).toBe(false);
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
  });

  it('forbids skipping straight to completed', () => {
    expect(canTransition('ASSIGNED', 'COMPLETED')).toBe(false);
    expect(canTransition('GENERATING', 'COMPLETED')).toBe(false);
  });

  it('forbids going backwards', () => {
    expect(canTransition('IN_PROGRESS', 'ASSIGNED')).toBe(false);
    expect(canTransition('ASSIGNED', 'PENDING_REVIEW')).toBe(false);
  });

  it('forbids a no-op transition', () => {
    expect(canTransition('ASSIGNED', 'ASSIGNED')).toBe(false);
  });

  it('returns false for a status outside the union instead of throwing', () => {
    expect(canTransition('BOGUS' as DrillAssignmentStatus, 'ASSIGNED')).toBe(false);
  });
});

describe('assertTransition', () => {
  it('throws with both states named', () => {
    expect(() => assertTransition('COMPLETED', 'IN_PROGRESS'))
      .toThrow(/COMPLETED.*IN_PROGRESS/);
  });

  it('does not throw on a legal transition', () => {
    expect(() => assertTransition('ASSIGNED', 'IN_PROGRESS')).not.toThrow();
  });
});

describe('TERMINAL_STATUSES', () => {
  it('contains exactly COMPLETED and CANCELLED', () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(['CANCELLED', 'COMPLETED']);
  });
});
```

- [ ] **Step 2: Run, confirm failure. Implement**

```ts
import { ConflictException } from '@nestjs/common';
import { DrillAssignmentStatus } from './contracts';

const ALLOWED: Record<DrillAssignmentStatus, DrillAssignmentStatus[]> = {
  GENERATING:     ['PENDING_REVIEW', 'ASSIGNED', 'CANCELLED'],
  PENDING_REVIEW: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED:       ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS:    ['COMPLETED', 'CANCELLED'],
  COMPLETED:      [],
  CANCELLED:      [],
};

export const TERMINAL_STATUSES: ReadonlySet<DrillAssignmentStatus> =
  new Set<DrillAssignmentStatus>(['COMPLETED', 'CANCELLED']);

export function canTransition(
  from: DrillAssignmentStatus,
  to: DrillAssignmentStatus,
): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: DrillAssignmentStatus,
  to: DrillAssignmentStatus,
): void {
  if (!canTransition(from, to)) {
    throw new ConflictException(`Illegal drill assignment transition: ${from} -> ${to}`);
  }
}
```

**Note (added 2026-07-31 after review):** `canTransition` is guarded because `status` is a free `VarChar(16)` column, not a Prisma enum. An unexpected status is reachable through ordinary data drift (legacy row, hand-run UPDATE, schema migration before app update) — not just through corruption. The guard ensures these edge cases return `false` and let `assertTransition` throw the controlled `ConflictException` rather than crashing.

**Note (whole-track review, 2026-07-31) — the optional-chaining guard did not actually
guard; as-built code differs from the block above.** `?.` only short-circuits on
`undefined`. `ALLOWED` is an object literal, so prototype keys resolve to inherited
**non-array** values that are never `undefined`, and every one of them fits a
`VarChar(16)` column:

```
'BOGUS'       => false          (the original 11th test passed)
'constructor' => TypeError: ALLOWED[from]?.includes is not a function
'__proto__'   => TypeError
'toString'    => TypeError
'valueOf'     => TypeError
```

As-built:

```ts
export function canTransition(from: DrillAssignmentStatus, to: DrillAssignmentStatus): boolean {
  const allowed = ALLOWED[from];
  return Array.isArray(allowed) && allowed.includes(to);
}
```

Tests now cover `constructor`, `__proto__`, `toString`, `valueOf` and `hasOwnProperty`
as both source and target, plus an `assertTransition` case asserting a
`ConflictException` rather than a `TypeError`. Verified by reverting to `?.` and
watching 6 tests fail.

**Note (whole-track review, 2026-07-31) — `assertTransition` and `DrillErrorBody`.**
`assertTransition` throws a bare `ConflictException`, whose body is Nest's default
`{ statusCode, error, message }` — no `code` field, while the contract's
`DrillErrorBody` requires one. `DrillErrorCode` was read: **no existing member fits a
generic illegal transition.** The closest, `GENERATION_IN_PROGRESS`, is narrower (a
mutation attempted while a set is still generating) and would be a lie for, say,
`COMPLETED -> IN_PROGRESS`. No code was invented and the contract was not changed.
Instead a doc comment on `assertTransition` states that **callers must catch and
re-wrap it** at the controller/filter layer; any HTTP boundary that lets it escape
returns a body other tracks cannot parse. Tracks B2/D/E/G: this is your job.

- [ ] **Step 3: Run, confirm PASS (11 passed)**

- [ ] **Step 4: Commit**

```bash
rtk git add src/drills/state-machine.ts src/drills/state-machine.spec.ts
rtk git commit -m "feat(education): assignment state machine

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task B.4: Assignment repository and DTO mapping

**Files:**
- Create: `education-service/src/drills/assignments.repository.ts`
- Create: `education-service/src/drills/assignment.mapper.ts`
- Test: `education-service/src/drills/assignment.mapper.spec.ts`

**Interfaces:**
- Consumes: Prisma models, `DrillAssignmentDTO` from `./contracts`
- Produces:
  - `toAssignmentDTO(row, counts: { blanksCorrect: number; blanksTotal: number }): DrillAssignmentDTO`
  - `AssignmentsRepository.findForStudent(studentId)`, `.findOutstanding(studentId)`, `.countBlanks(assignmentUuid)`

  Tracks B2, D, E and G all consume `toAssignmentDTO`.

- [ ] **Step 1: Write the failing mapper test — leak protection is the point**

```ts
import { toAssignmentDTO } from './assignment.mapper';

const row = {
  uuid: 'a-1', setUuid: 's-1', studentId: 42, teacherId: 7, origin: 'TEACHER',
  lessonUuid: null, title: 'Prepositions', languageCode: 'de', materialLanguage: 'ru',
  status: 'ASSIGNED', dueAt: null, resourceLinks: [{ topic: 'prepositions', url: 'https://x' }],
  generationProgress: {}, firstTryAccuracy: 0.62,
  createdAt: new Date('2026-07-29T10:00:00Z'), assignedAt: null, completedAt: null,
  items: [{ uuid: 'i-1', blanks: [{ index: 0, prompt: 'на', answer: 'auf', alternatives: [] }] }],
} as any;

describe('toAssignmentDTO', () => {
  it('never includes firstTryAccuracy — it is not a teacher-facing field', () => {
    const dto = toAssignmentDTO(row, { blanksCorrect: 3, blanksTotal: 10 });
    expect(JSON.stringify(dto)).not.toContain('firstTryAccuracy');
    expect((dto as Record<string, unknown>).firstTryAccuracy).toBeUndefined();
  });

  it('never includes an answer string', () => {
    const dto = toAssignmentDTO(row, { blanksCorrect: 3, blanksTotal: 10 });
    expect(JSON.stringify(dto)).not.toContain('auf');
  });

  it('carries progress counts and item count', () => {
    const dto = toAssignmentDTO(row, { blanksCorrect: 3, blanksTotal: 10 });
    expect(dto.blanksCorrect).toBe(3);
    expect(dto.blanksTotal).toBe(10);
    expect(dto.itemCount).toBe(1);
  });

  it('serializes dates as ISO strings', () => {
    const dto = toAssignmentDTO(row, { blanksCorrect: 0, blanksTotal: 10 });
    expect(dto.createdAt).toBe('2026-07-29T10:00:00.000Z');
    expect(dto.assignedAt).toBeNull();
  });

  it('returns null generationProgress when the job is not running', () => {
    const dto = toAssignmentDTO(row, { blanksCorrect: 0, blanksTotal: 10 });
    expect(dto.generationProgress).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm failure. Implement the mapper**

Build the DTO by **explicitly listing fields**, never by spreading the row. A
spread is how `firstTryAccuracy` and `blanks` leak. The first two tests exist
precisely to catch a spread being reintroduced later.

```ts
import { DrillAssignmentDTO, GenerationProgress } from './contracts';

export function toAssignmentDTO(
  row: any,
  counts: { blanksCorrect: number; blanksTotal: number },
): DrillAssignmentDTO {
  const progress = row.generationProgress as Partial<GenerationProgress> | null;
  return {
    uuid: row.uuid,
    setUuid: row.setUuid,
    studentId: row.studentId,
    teacherId: row.teacherId,
    origin: row.origin,
    lessonUuid: row.lessonUuid,
    title: row.title,
    languageCode: row.languageCode,
    materialLanguage: row.materialLanguage,
    status: row.status,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    resourceLinks: row.resourceLinks ?? [],
    itemCount: row.items?.length ?? 0,
    blanksCorrect: counts.blanksCorrect,
    blanksTotal: counts.blanksTotal,
    generationProgress: progress && progress.phase ? (progress as GenerationProgress) : null,
    createdAt: row.createdAt.toISOString(),
    assignedAt: row.assignedAt ? row.assignedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}
```

- [ ] **Step 3: Run, confirm PASS (5 passed)**

- [ ] **Step 4: Prove the leak test works**

Temporarily change the mapper to `return { ...row, ...counts } as any;` and
rerun. Tests 1 and 2 must fail. Restore the explicit mapper.

- [ ] **Step 5: Implement the repository**

`AssignmentsRepository` wraps Prisma with three methods:

```ts
findForStudent(studentId: number): Promise<AssignmentRow[]>
// status not in TERMINAL, plus the 10 most recent COMPLETED

findOutstanding(studentId: number): Promise<AssignmentRow | null>
// first row with status in ('ASSIGNED','IN_PROGRESS'), ordered by createdAt
// Track B2's self-drilling gate calls exactly this

countBlanks(assignmentUuid: string): Promise<{ blanksCorrect: number; blanksTotal: number }>
// blanksTotal = sum of blanks.length over items
// blanksCorrect = count of DISTINCT (itemUuid, blankIndex) in DrillAttempt where isCorrect
```

`countBlanks` must count **distinct** blank positions, not attempt rows — a
student who gets the same blank right twice has not solved two blanks. Write a
test for that specific case before implementing.

---

#### As-built interface after the whole-track review (2026-07-31) — READ THIS, NOT THE BLOCK ABOVE

Tracks B2, D, E and G build against **these** signatures. Four things changed.

**1. `AssignmentRow` no longer carries answers.**

```ts
export type AssignmentRow = Prisma.DrillAssignmentGetPayload<{
  include: { items: { select: { uuid: true } } };
}>;
```

It was `include: { items: true }`, which pulled `items[].blanks` — the full
answer/alternatives blob — into memory. The only consumer of `items` is
`toAssignmentDTO`'s `row.items?.length ?? 0`, so a student with 11 assignments ×
~20 items dragged ~220 rows of `template` + `blanks` JSON out of Postgres to produce
two integers. Worse, this is the exported type four tracks hold: a single
`return row` anywhere would have shipped answers **and** `firstTryAccuracy` to a
student. `row.items.length` still works. All three query sites use it.
`firstTryAccuracy` is still on the type (it is a scalar on the assignment row) and
must never reach a DTO — `toAssignmentDTO` lists fields explicitly for that reason.

**2. `findForStudent` returns a structured result, not a flat array.**

```ts
export interface StudentAssignments {
  active: AssignmentRow[];     // non-terminal, createdAt desc
  completed: AssignmentRow[];  // 10 most recent COMPLETED, createdAt desc
}
findForStudent(studentId: number): Promise<StudentAssignments>
```

It previously returned `[...nonTerminal, ...tenMostRecentCompleted]` as one array,
discarding the boundary. **Human ruling: keep both definitions distinct.**

- `active` stays **non-terminal** — GENERATING is included on purpose; a student
  should see generation progress, which is what the DTO's `generationProgress`
  field renders.
- `completed` stays the 10 most recent. CANCELLED is terminal and excluded from
  both buckets; it never reappears as recent history.
- **`active` is NOT `outstanding`.** The contract's `outstanding` — the thing that
  drives `selfDrillingAllowed` — means **ASSIGNED | IN_PROGRESS only**. Derive
  `selfDrillingAllowed` from `findOutstanding`, never from `active`: a consumer
  equating them would block self-drilling on a `PENDING_REVIEW` or `GENERATING`
  assignment the student cannot act on. `findOutstanding` is unchanged.

Tests now pin both queries exactly, `orderBy: { createdAt: 'desc' }` included. The
previous tests used `expect.objectContaining` and never pinned ordering, so a
regression dropping `orderBy` would have gone uncaught.

**3. `countBlanks` counts RESOLVED positions — correct OR revealed.**

`DrillAttempt.revealed` exists and spec §9.6 defines a reveal endpoint (built by a
later track, writing `{ isCorrect: false, revealed: true }`), but `countBlanks`
ignored `revealed` entirely. A revealed blank could therefore never be "solved", so
an assignment containing one would sit in `IN_PROGRESS` forever and permanently
block that student's self-drilling via `findOutstanding`.

**Human ruling: a revealed blank counts as resolved.**

- A distinct `(itemUuid, blankIndex)` position counts when `isCorrect = true`
  **OR** `revealed = true`. Distinctness is preserved — the same position resolved
  twice counts once.
- Completion stays reachable, and a student who reveals everything completes with
  zero correct.
- The DTO field keeps the name **`blanksCorrect`**. Renaming a contract field
  consumed by four tracks is out of scope, so `countBlanks` carries a doc comment
  saying plainly that it counts *resolved* positions. **Do not "fix" it back.**
- First-try accuracy is computed elsewhere from `attemptNo = 1 AND isCorrect`,
  which a reveal never satisfies, so bank-selection statistics stay clean. That
  query is not implemented here; do not break the property.

**4. New: `countBlanksFor` — the batch form. Use it for lists.**

```ts
countBlanksFor(assignmentUuids: string[]): Promise<Map<string, BlankCounts>>
export interface BlankCounts { blanksCorrect: number; blanksTotal: number }
```

`toAssignmentDTO` needs `counts` per assignment, and `countBlanks` costs two queries
per uuid, so rendering a list of 11 assignments cost 2 + 2N queries. `countBlanksFor`
is two queries total regardless of N, with identical resolved-position semantics
(`countBlanks` now delegates to it, so there is one implementation of the rule).
**Every uuid in the input appears in the returned map**, including ones with no items
and no attempts — those map to `{ blanksCorrect: 0, blanksTotal: 0 }` rather than
being absent, so callers need no `?? 0` fallback. Repeated uuids are deduplicated; an
empty input issues no queries. It exists so four tracks do not each write their own
loop — **do not write one.**

Both count methods tolerate a non-array `blanks` blob (contributing 0) for the same
reason `gradeBlank` does: it is an unvalidated `Json` column.

**5. `toAssignmentDTO` keeps `row: any` — but has two unenforced preconditions.**

The signature is unchanged (the plan's specified interface, deliberately
adjudicated), which means TypeScript catches neither of these. A doc comment now
records both; they are on the caller:

- **`row` must be fetched with `items` included.** `itemCount` is
  `row.items?.length ?? 0`, so a row fetched without them silently reports
  `itemCount: 0` instead of failing. `AssignmentsRepository` always includes them.
- **`row` must be a live Prisma row, not JSON.** `createdAt`, `dueAt`, `assignedAt`
  and `completedAt` are called as `Date` objects, so a JSON-deserialized row (cache
  read, HTTP hop, queue payload) throws `row.createdAt.toISOString is not a
  function`. Rehydrate the dates first.

- [ ] **Step 6: Run all tests, typecheck, commit**

```bash
cd /home/ssf/Documents/Github/speakasap/education-service
rtk npm test && rtk npm run typecheck
rtk git add src/drills/
rtk git commit -m "feat(education): assignment repository and DTO mapper

The mapper lists fields explicitly rather than spreading the row; a
spread is how firstTryAccuracy and answers leak, and two tests exist to
catch its reintroduction.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Track B completion checklist

- [x] `rtk npm test` green (73 passed), `rtk npm run typecheck` clean
- [x] Migration created, **not applied**
- [x] The diacritic-stripping and DTO-spread falsification checks both performed
- [x] Whole-track review fixes applied and falsified (2026-07-31)
- [x] Status file at `status/track-b.md` with pasted output

**Hand off to Track B2 (runner API), Track D (orchestration), Track E, Track G.**
They consume `gradeBlank`, `assertTransition`, `toAssignmentDTO`,
`findOutstanding`, `countBlanks` and `countBlanksFor`. **Read the as-built interface
block in Task B.4 above** — `findForStudent`'s return shape, `countBlanks`'s
resolved-position semantics and `countBlanksFor` all differ from the original plan
text. Handoff notes those tracks need are in
[`status/track-b.md`](status/track-b.md).
