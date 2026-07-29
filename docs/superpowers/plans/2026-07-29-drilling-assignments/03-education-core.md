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

  lesson Lesson?               @relation(fields: [lessonUuid], references: [uuid], onDelete: SetNull)
  items  DrillAssignmentItem[]

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
    expect(normalizeAnswer('é', opts)).toBe(normalizeAnswer('é', opts));
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
  return ALLOWED[from].includes(to);
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

- [ ] **Step 3: Run, confirm PASS (10 passed)**

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

- [ ] `rtk npm test` green, `rtk npm run typecheck` clean
- [ ] Migration created, **not applied**
- [ ] The diacritic-stripping and DTO-spread falsification checks both performed
- [ ] Status file at `status/track-b.md` with pasted output

**Hand off to Track B2 (runner API), Track D (orchestration), Track E, Track G.**
They consume `gradeBlank`, `assertTransition`, `toAssignmentDTO`,
`findOutstanding` and `countBlanks`.
