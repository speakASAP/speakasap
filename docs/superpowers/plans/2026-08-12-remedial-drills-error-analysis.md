# Работа над ошибками — Error Analysis and Remedial Drills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a student finishes a drill, cluster their mistakes into grammar gaps with explanations, track per-word mastery, and let the teacher generate a remedial "работа над ошибками" drill built from the failed words.

**Architecture:** A new `analysis/` module in education-service sits beside the existing `orchestration/` generation pipeline. Drill completion synchronously updates per-word mastery counters, then fire-and-forget enqueues an analysis job that calls a new ai-microservice endpoint to cluster mistakes into taxonomy-constrained grammar gaps. Each gap is one `DrillGapAnalysis` row, rendered both below the source drill and at the top of the remedial drill it produces. Remedial generation reuses `GenerationService` with required-answer targets.

**Tech Stack:** NestJS 10, Prisma, PostgreSQL, Jest (education-service and ai-microservice); Next.js 15 App Router, React, Vitest + Testing Library (frontend).

**Spec:** `docs/superpowers/specs/2026-08-12-remedial-drills-error-analysis-design.md`

## Global Constraints

- **No silent failures.** Every catch either re-throws or logs at error level with full context (service, assignment uuid, correlation id). An empty result must never stand in for a failure. `NO_ERRORS` and `FAILED` are distinct states through every layer to the UI.
- **`NO_ERRORS` ≠ `FAILED` ≠ missing.** Never render an empty grammar block in place of an error.
- **One normalizer.** Word mastery keys use `normalizeAnswer(value, gradingOptionsFor(languageCode))` from `education-service/src/drills/grading.ts`. Never write a second normalizer — a divergence silently splits one student's mastery record in two.
- **Multi-word answers are one unit.** `out of` is a single mastery key, never split into tokens.
- **Migrations are generated offline.** `prisma migrate diff --from-schema-datamodel … --to-schema-datamodel`. NEVER `prisma migrate dev` against production, not even `--create-only`. Apply to a scratch DB from a schema-only dump before production `migrate deploy`.
- **A clean appearance** = the blank's first attempt was correct AND the blank was never revealed. Anything else resets `cleanStreak` to 0.
- **`repeats = mistakeCount`** — strict, no floor, no per-word cap.
- **Remedial drills are 100% error words**; padding to the 10-sentence minimum uses new sentences on the same grammar topic with different vocabulary.
- **Max 20 sentences per assignment**; overflow splits into parts titled `Работа над ошибками: <тема> (часть N)`.
- **3 consecutive clean appearances** retire a word (`masteredAt` set); a later miss clears it.
- **Explanations are written in `materialLanguage`** (`ru` or `en`); example sentences are in the target language with a `gloss` in `materialLanguage`.
- **ai-microservice calls use a minted service token**, never the caller's bearer token. `mintServiceToken('education-service', requiredEnv('AI_SERVICE_JWT_SECRET', 'ai-microservice'))` — forwarding a user token produces `401 Malformed token`.
- **Teacher ownership returns 404, never 403**, for another teacher's assignment, and accepts both id spaces (`[userId, lessonTeacherId]`) exactly as `teacherProgress` does.
- **Deploys are serialized.** Subagents must not deploy. Stop at build/test/typecheck and report ready.
- **Typecheck with the service's own compiler**, never `npx tsc`.

---

## File Structure

**education-service — new files**

| File | Responsibility |
|---|---|
| `src/drills/analysis/failed-blanks.ts` | Pure: attempts + items → failed blanks with `mistakeCount` |
| `src/drills/analysis/mastery.ts` | Pure: attempts → per-word clean/miss deltas |
| `src/drills/analysis/mastery.repository.ts` | Upserts `StudentWordMastery`, reads mastered words |
| `src/drills/analysis/taxonomy.ts` | Loads `GrammarTopic` slugs per language; coerces unknown slugs to `<lang>.other` |
| `src/drills/analysis/analysis.client.ts` | Calls ai-microservice `analyze-drill-errors` with a service token |
| `src/drills/analysis/analysis.service.ts` | The job: load → cluster → persist → run status |
| `src/drills/analysis/analysis.repository.ts` | `DrillAnalysisRun` + `DrillGapAnalysis` reads/writes |
| `src/drills/analysis/analysis.job-runner.ts` | `AnalysisJobRunner` (fire-and-forget enqueue, never rejects) and `CompletionAnalysisAdapter` (the port `RunnerService` calls on completion) |
| `src/drills/analysis/remedial-composition.ts` | Pure: cluster + mastery → sentence plan (parts, slots, padding) |
| `src/drills/analysis/remedial.service.ts` | Turns a sentence plan into generation jobs + assignment rows |
| `src/drills/analysis/contracts.ts` | DTOs for everything above |

**education-service — modified**

| File | Change |
|---|---|
| `prisma/schema.prisma` | 4 new models, 3 columns on `DrillAssignment` |
| `prisma/seed-grammar-topics.ts` (new) | Taxonomy seed per language |
| `src/drills/contracts.ts` | `DrillAssignmentOrigin` gains `'REMEDIAL'` |
| `src/drills/runner/runner.service.ts` | Completion hook: mastery then enqueue |
| `src/drills/drills.controller.ts` | 5 new routes (Task 13 adds four, Task 16 adds `GET gaps/:gapUuid`) |
| `src/drills/runner/runner.projection.ts` | Runner payload carries `origin` and `sourceAnalysisUuid` (Task 16) |
| `src/drills/drills.module.ts` | Wire the analysis module |

**ai-microservice — new**

`src/teacher-assistant/analyze.prompt.ts`, `analyze.schema.ts`, `analyze.service.ts` (+ specs); one route on the existing controller.

**frontend — new**

`lib/drills/analysis/contracts.ts`, `lib/drills/analysis/api.ts`, `lib/drills/analysis/GapAnalysisBlock.tsx`, `lib/drills/analysis/GapCard.tsx`; modifications to the two pages.

---

## Task Order and Dependencies

```
1 (schema) ─┬─ 2 (failed-blanks) ─┬─ 6 (analysis.service) ─ 7 (job runner) ─ 8 (completion hook)
            ├─ 3 (mastery pure)  ─┴─ 4 (mastery repo) ────────────────────────┘
            ├─ 5 (taxonomy)
            └─ 9 (composition pure) ─ 10 (remedial.service)
11 (ai endpoint) ─ 6
12 (analysis client) ─ 6
13 (controller routes) ─ 6, 10
14 (frontend contracts+api) ─ 15 (GapAnalysisBlock) ─ 16 (student page) ─ 17 (teacher page) ─ 18 (remedial runner header)
```

Tasks 2, 3, 5, 9 are pure functions with no upstream and can be built in any order after Task 1.

---

### Task 1: Schema, migration, and taxonomy seed

**Files:**
- Modify: `education-service/prisma/schema.prisma`
- Create: `education-service/prisma/seed-grammar-topics.ts`
- Create: `education-service/prisma/migrations/<timestamp>_remedial_drills/migration.sql` (generated)
- Test: `education-service/src/drills/analysis/schema.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: Prisma models `GrammarTopic`, `DrillAnalysisRun`, `DrillGapAnalysis`, `StudentWordMastery`; `DrillAssignment.origin` accepts `'REMEDIAL'`, plus `sourceAnalysisUuid: string | null` and `remedialPart: number | null`

- [ ] **Step 1: Add the four models to `schema.prisma`**

Append to `education-service/prisma/schema.prisma`:

```prisma
model GrammarTopic {
  slug         String   @id @db.VarChar(128)
  languageCode String   @map("language_code") @db.VarChar(8)
  titles       Json     @default("{}")
  sortOrder    Int      @default(0) @map("sort_order")
  createdAt    DateTime @default(now()) @map("created_at")

  gaps DrillGapAnalysis[]

  @@index([languageCode])
  @@map("grammar_topic")
}

model DrillAnalysisRun {
  uuid                 String    @id @db.Uuid
  sourceAssignmentUuid String    @unique @map("source_assignment_uuid") @db.Uuid
  studentId            Int       @map("student_id")
  status               String    @db.VarChar(16)
  errorMessage         String?   @map("error_message") @db.Text
  attemptCount         Int       @default(0) @map("attempt_count")
  startedAt            DateTime? @map("started_at")
  finishedAt           DateTime? @map("finished_at")
  createdAt            DateTime  @default(now()) @map("created_at")

  sourceAssignment DrillAssignment    @relation("AnalysisSource", fields: [sourceAssignmentUuid], references: [uuid], onDelete: Cascade)
  clusters         DrillGapAnalysis[]

  @@index([studentId, status])
  @@map("drill_analysis_run")
}

model DrillGapAnalysis {
  uuid                 String    @id @db.Uuid
  runUuid              String    @map("run_uuid") @db.Uuid
  sourceAssignmentUuid String    @map("source_assignment_uuid") @db.Uuid
  studentId            Int       @map("student_id")
  topicSlug            String    @map("topic_slug") @db.VarChar(128)
  languageCode         String    @map("language_code") @db.VarChar(8)
  materialLanguage     String    @map("material_language") @db.VarChar(2)
  title                String    @db.VarChar(255)
  explanation          String    @db.Text
  rules                Json      @default("[]")
  examples             Json      @default("[]")
  failedAnswers        Json      @default("[]") @map("failed_answers")
  editedByTeacherId    Int?      @map("edited_by_teacher_id")
  editedAt             DateTime? @map("edited_at")
  createdAt            DateTime  @default(now()) @map("created_at")

  run                 DrillAnalysisRun  @relation(fields: [runUuid], references: [uuid], onDelete: Cascade)
  topic               GrammarTopic      @relation(fields: [topicSlug], references: [slug])
  remedialAssignments DrillAssignment[] @relation("RemedialSource")

  @@unique([sourceAssignmentUuid, topicSlug])
  @@index([studentId, topicSlug])
  @@index([runUuid])
  @@index([topicSlug])
  @@map("drill_gap_analysis")
}

model StudentWordMastery {
  uuid             String    @id @db.Uuid
  studentId        Int       @map("student_id")
  languageCode     String    @map("language_code") @db.VarChar(8)
  normalizedAnswer String    @map("normalized_answer") @db.Text
  displayAnswer    String    @map("display_answer") @db.Text
  cleanStreak      Int       @default(0) @map("clean_streak")
  totalMistakes    Int       @default(0) @map("total_mistakes")
  lastSeenAt       DateTime  @map("last_seen_at")
  masteredAt       DateTime? @map("mastered_at")

  @@unique([studentId, languageCode, normalizedAnswer])
  @@index([studentId, languageCode, masteredAt])
  @@map("student_word_mastery")
}
```

- [ ] **Step 2: Add the three columns and two relations to `DrillAssignment`**

In the existing `model DrillAssignment`, add beside `origin`:

```prisma
  sourceAnalysisUuid String? @map("source_analysis_uuid") @db.Uuid
  remedialPart       Int?    @map("remedial_part")
```

and beside the existing `items`/`attempts` relations:

```prisma
  sourceAnalysis DrillGapAnalysis? @relation("RemedialSource", fields: [sourceAnalysisUuid], references: [uuid], onDelete: SetNull)
  analysisRun    DrillAnalysisRun? @relation("AnalysisSource")
```

and beside the existing `@@index` lines:

```prisma
  @@index([sourceAnalysisUuid])
```

`origin` stays `String @db.VarChar(8)` — `REMEDIAL` is exactly 8 characters.

- [ ] **Step 3: Write the failing schema test**

Create `education-service/src/drills/analysis/schema.spec.ts`:

```ts
import { readFileSync } from 'fs';
import { join } from 'path';

const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8');

describe('remedial drills schema', () => {
  it('declares the four new models', () => {
    expect(schema).toContain('model GrammarTopic');
    expect(schema).toContain('model DrillAnalysisRun');
    expect(schema).toContain('model DrillGapAnalysis');
    expect(schema).toContain('model StudentWordMastery');
  });

  it('keeps one analysis run per source assignment', () => {
    expect(schema).toMatch(/sourceAssignmentUuid\s+String\s+@unique/);
  });

  it('keeps one gap cluster per assignment and topic', () => {
    expect(schema).toContain('@@unique([sourceAssignmentUuid, topicSlug])');
  });

  it('keeps one mastery row per student, language and normalized answer', () => {
    expect(schema).toContain('@@unique([studentId, languageCode, normalizedAnswer])');
  });

  it('links a remedial assignment back to its gap without cascading deletes onto it', () => {
    expect(schema).toContain('sourceAnalysisUuid String? @map("source_analysis_uuid") @db.Uuid');
    expect(schema).toMatch(/RemedialSource".*onDelete: SetNull/s);
  });

  it('leaves origin wide enough for REMEDIAL', () => {
    expect('REMEDIAL'.length).toBeLessThanOrEqual(8);
    expect(schema).toMatch(/origin\s+String\s+@db\.VarChar\(8\)/);
  });
});
```

- [ ] **Step 4: Run the test**

Run: `cd education-service && npx jest src/drills/analysis/schema.spec.ts`
Expected: PASS if steps 1–2 were done correctly; a failure names the missing declaration.

- [ ] **Step 5: Write the taxonomy seed**

Create `education-service/prisma/seed-grammar-topics.ts`:

```ts
import { PrismaClient } from '@prisma/client';

/**
 * The grammar taxonomy the error analyzer is allowed to cluster into.
 *
 * Fixed, not runtime-editable: stable slugs are what make "which gaps does this student
 * keep failing" answerable across assignments and over time. Free-text clusters cannot be
 * compared to each other.
 *
 * Every language carries an `<lang>.other` row. The analyzer must always have a legal
 * target, so an unrecognised cluster lands there and is logged rather than dropped.
 */
export const GRAMMAR_TOPICS: Array<{
  slug: string;
  languageCode: string;
  titles: Record<string, string>;
  sortOrder: number;
}> = [
  { slug: 'en.prepositions-of-place', languageCode: 'en', sortOrder: 10,
    titles: { ru: 'Предлоги места', en: 'Prepositions of place' } },
  { slug: 'en.prepositions-of-movement', languageCode: 'en', sortOrder: 20,
    titles: { ru: 'Предлоги движения', en: 'Prepositions of movement' } },
  { slug: 'en.prepositions-of-time', languageCode: 'en', sortOrder: 30,
    titles: { ru: 'Предлоги времени', en: 'Prepositions of time' } },
  { slug: 'en.phrasal-prepositions', languageCode: 'en', sortOrder: 40,
    titles: { ru: 'Составные предлоги', en: 'Phrasal prepositions' } },
  { slug: 'en.articles', languageCode: 'en', sortOrder: 50,
    titles: { ru: 'Артикли', en: 'Articles' } },
  { slug: 'en.verb-tenses', languageCode: 'en', sortOrder: 60,
    titles: { ru: 'Времена глагола', en: 'Verb tenses' } },
  { slug: 'en.irregular-verbs', languageCode: 'en', sortOrder: 70,
    titles: { ru: 'Неправильные глаголы', en: 'Irregular verbs' } },
  { slug: 'en.word-order', languageCode: 'en', sortOrder: 80,
    titles: { ru: 'Порядок слов', en: 'Word order' } },
  { slug: 'en.pronouns', languageCode: 'en', sortOrder: 90,
    titles: { ru: 'Местоимения', en: 'Pronouns' } },
  { slug: 'en.modal-verbs', languageCode: 'en', sortOrder: 100,
    titles: { ru: 'Модальные глаголы', en: 'Modal verbs' } },
  { slug: 'en.plurals-and-countability', languageCode: 'en', sortOrder: 110,
    titles: { ru: 'Множественное число и исчисляемость', en: 'Plurals and countability' } },
  { slug: 'en.spelling', languageCode: 'en', sortOrder: 120,
    titles: { ru: 'Орфография', en: 'Spelling' } },
  { slug: 'en.vocabulary-choice', languageCode: 'en', sortOrder: 130,
    titles: { ru: 'Выбор слова', en: 'Vocabulary choice' } },
  { slug: 'en.other', languageCode: 'en', sortOrder: 999,
    titles: { ru: 'Прочее', en: 'Other' } },

  { slug: 'de.prepositions-with-cases', languageCode: 'de', sortOrder: 10,
    titles: { ru: 'Предлоги и падежи', en: 'Prepositions and cases' } },
  { slug: 'de.articles-and-gender', languageCode: 'de', sortOrder: 20,
    titles: { ru: 'Артикли и род', en: 'Articles and gender' } },
  { slug: 'de.word-order', languageCode: 'de', sortOrder: 30,
    titles: { ru: 'Порядок слов', en: 'Word order' } },
  { slug: 'de.verb-tenses', languageCode: 'de', sortOrder: 40,
    titles: { ru: 'Времена глагола', en: 'Verb tenses' } },
  { slug: 'de.separable-verbs', languageCode: 'de', sortOrder: 50,
    titles: { ru: 'Отделяемые приставки', en: 'Separable verbs' } },
  { slug: 'de.spelling', languageCode: 'de', sortOrder: 60,
    titles: { ru: 'Орфография', en: 'Spelling' } },
  { slug: 'de.vocabulary-choice', languageCode: 'de', sortOrder: 70,
    titles: { ru: 'Выбор слова', en: 'Vocabulary choice' } },
  { slug: 'de.other', languageCode: 'de', sortOrder: 999,
    titles: { ru: 'Прочее', en: 'Other' } },

  { slug: 'es.prepositions', languageCode: 'es', sortOrder: 10,
    titles: { ru: 'Предлоги', en: 'Prepositions' } },
  { slug: 'es.ser-vs-estar', languageCode: 'es', sortOrder: 20,
    titles: { ru: 'Ser и estar', en: 'Ser vs estar' } },
  { slug: 'es.verb-tenses', languageCode: 'es', sortOrder: 30,
    titles: { ru: 'Времена глагола', en: 'Verb tenses' } },
  { slug: 'es.subjunctive', languageCode: 'es', sortOrder: 40,
    titles: { ru: 'Сослагательное наклонение', en: 'Subjunctive' } },
  { slug: 'es.articles-and-gender', languageCode: 'es', sortOrder: 50,
    titles: { ru: 'Артикли и род', en: 'Articles and gender' } },
  { slug: 'es.spelling', languageCode: 'es', sortOrder: 60,
    titles: { ru: 'Орфография', en: 'Spelling' } },
  { slug: 'es.vocabulary-choice', languageCode: 'es', sortOrder: 70,
    titles: { ru: 'Выбор слова', en: 'Vocabulary choice' } },
  { slug: 'es.other', languageCode: 'es', sortOrder: 999,
    titles: { ru: 'Прочее', en: 'Other' } },
];

export async function seedGrammarTopics(prisma: PrismaClient): Promise<number> {
  for (const topic of GRAMMAR_TOPICS) {
    await prisma.grammarTopic.upsert({
      where: { slug: topic.slug },
      update: { languageCode: topic.languageCode, titles: topic.titles, sortOrder: topic.sortOrder },
      create: topic,
    });
  }
  return GRAMMAR_TOPICS.length;
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedGrammarTopics(prisma)
    .then((count) => {
      // eslint-disable-next-line no-console
      console.log(`Seeded ${count} grammar topics`);
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Grammar topic seed failed:', error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
```

- [ ] **Step 6: Write the seed test**

Create `education-service/prisma/seed-grammar-topics.spec.ts`:

```ts
import { GRAMMAR_TOPICS } from './seed-grammar-topics';

describe('grammar topic taxonomy', () => {
  it('has unique slugs', () => {
    const slugs = GRAMMAR_TOPICS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('prefixes every slug with its language code', () => {
    for (const topic of GRAMMAR_TOPICS) {
      expect(topic.slug.startsWith(`${topic.languageCode}.`)).toBe(true);
    }
  });

  it('gives every language an `other` fallback the analyzer can always use', () => {
    const languages = new Set(GRAMMAR_TOPICS.map((t) => t.languageCode));
    for (const language of languages) {
      expect(GRAMMAR_TOPICS.some((t) => t.slug === `${language}.other`)).toBe(true);
    }
  });

  it('titles every topic in both material languages', () => {
    for (const topic of GRAMMAR_TOPICS) {
      expect(typeof topic.titles.ru).toBe('string');
      expect(topic.titles.ru.length).toBeGreaterThan(0);
      expect(typeof topic.titles.en).toBe('string');
      expect(topic.titles.en.length).toBeGreaterThan(0);
    }
  });

  it('fits every slug in the column width', () => {
    for (const topic of GRAMMAR_TOPICS) {
      expect(topic.slug.length).toBeLessThanOrEqual(128);
    }
  });
});
```

- [ ] **Step 7: Run both tests**

Run: `cd education-service && npx jest src/drills/analysis/schema.spec.ts prisma/seed-grammar-topics.spec.ts`
Expected: PASS.

- [ ] **Step 8: Generate the migration OFFLINE**

```bash
cd education-service
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma.baseline \
  --to-schema-datamodel prisma/schema.prisma \
  --script > /tmp/remedial-drills.sql
```

If no `schema.prisma.baseline` exists, produce it from `git show HEAD:prisma/schema.prisma > prisma/schema.prisma.baseline`, run the diff, then delete the baseline file. **NEVER run `prisma migrate dev`** — it creates a shadow database and can prompt to reset on drift.

Review `/tmp/remedial-drills.sql`: it must contain only `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE … ADD COLUMN`, and `ADD CONSTRAINT`. Any `DROP` is a bug in the diff — stop and report it.

Move it into place as `prisma/migrations/<timestamp>_remedial_drills/migration.sql`.

- [ ] **Step 9: Regenerate the Prisma client and typecheck**

Run: `cd education-service && npx prisma generate && npm run build`
Expected: build succeeds; the new model names are available on `PrismaService`.

- [ ] **Step 10: Commit**

```bash
git add education-service/prisma/schema.prisma \
        education-service/prisma/seed-grammar-topics.ts \
        education-service/prisma/seed-grammar-topics.spec.ts \
        education-service/prisma/migrations \
        education-service/src/drills/analysis/schema.spec.ts
git commit -m "feat(drills): schema for error analysis, gap clusters and word mastery"
```

---

### Task 2: Failed-blank extraction (pure)

**Files:**
- Create: `education-service/src/drills/analysis/contracts.ts`
- Create: `education-service/src/drills/analysis/failed-blanks.ts`
- Test: `education-service/src/drills/analysis/failed-blanks.spec.ts`

**Interfaces:**
- Consumes: `DrillBlank` from `../contracts`
- Produces:
  - `interface FailedBlank { itemUuid: string; blankIndex: number; answer: string; prompt: string | null; sentence: string; wrongAttempts: string[]; revealed: boolean; mistakeCount: number }`
  - `function extractFailedBlanks(items: AnalysisItemInput[], attempts: AnalysisAttemptInput[]): FailedBlank[]`
  - `interface AnalysisItemInput { uuid: string; order: number; template: string; blanks: unknown }`
  - `interface AnalysisAttemptInput { itemUuid: string; blankIndex: number; submittedValue: string; isCorrect: boolean; revealed: boolean; attemptNo: number }`

- [ ] **Step 1: Write the failing test**

Create `education-service/src/drills/analysis/failed-blanks.spec.ts`:

```ts
import { extractFailedBlanks } from './failed-blanks';

const item = (uuid: string, template: string, blanks: unknown[]) => ({
  uuid,
  order: 0,
  template,
  blanks,
});

const attempt = (
  itemUuid: string,
  blankIndex: number,
  submittedValue: string,
  isCorrect: boolean,
  attemptNo: number,
  revealed = false,
) => ({ itemUuid, blankIndex, submittedValue, isCorrect, attemptNo, revealed });

describe('extractFailedBlanks', () => {
  it('returns nothing when every blank was right on the first try', () => {
    const items = [item('i1', 'Never leave children alone {{0}} a car.', [
      { index: 0, answer: 'inside', prompt: 'в, внутри' },
    ])];
    const attempts = [attempt('i1', 0, 'inside', true, 1)];

    expect(extractFailedBlanks(items, attempts)).toEqual([]);
  });

  it('counts wrong non-revealed attempts as the mistake count', () => {
    const items = [item('i1', 'We will have to walk {{0}} this market.', [
      { index: 0, answer: 'through', prompt: 'через' },
    ])];
    const attempts = [
      attempt('i1', 0, 'acros', false, 1),
      attempt('i1', 0, 'across', false, 2),
      attempt('i1', 0, 'to across', false, 3),
    ];

    const failed = extractFailedBlanks(items, attempts);

    expect(failed).toHaveLength(1);
    expect(failed[0].answer).toBe('through');
    expect(failed[0].mistakeCount).toBe(3);
    expect(failed[0].wrongAttempts).toEqual(['acros', 'across', 'to across']);
    expect(failed[0].sentence).toBe('We will have to walk {{0}} this market.');
    expect(failed[0].prompt).toBe('через');
  });

  it('counts a blank revealed with no typed attempt as one mistake', () => {
    const items = [item('i1', 'Get {{0}} your car immediately!', [
      { index: 0, answer: 'out of', prompt: 'из' },
    ])];
    const attempts = [attempt('i1', 0, '', false, 1, true)];

    const failed = extractFailedBlanks(items, attempts);

    expect(failed).toHaveLength(1);
    expect(failed[0].revealed).toBe(true);
    expect(failed[0].mistakeCount).toBe(1);
    expect(failed[0].wrongAttempts).toEqual([]);
  });

  it('counts typed attempts before a reveal, not the reveal itself', () => {
    const items = [item('i1', 'Get {{0}} your car immediately!', [
      { index: 0, answer: 'out of', prompt: 'из' },
    ])];
    const attempts = [
      attempt('i1', 0, 'out', false, 1),
      attempt('i1', 0, 'out', false, 2),
      attempt('i1', 0, 'out', false, 3),
      attempt('i1', 0, '', false, 4, true),
    ];

    const failed = extractFailedBlanks(items, attempts);

    expect(failed[0].mistakeCount).toBe(3);
    expect(failed[0].revealed).toBe(true);
    expect(failed[0].wrongAttempts).toEqual(['out', 'out', 'out']);
  });

  it('reports a blank eventually solved after wrong tries', () => {
    const items = [item('i1', 'I heard some strange sound {{0}} my back.', [
      { index: 0, answer: 'behind', prompt: 'за' },
    ])];
    const attempts = [
      attempt('i1', 0, 'on', false, 1),
      attempt('i1', 0, 'behind', true, 2),
    ];

    const failed = extractFailedBlanks(items, attempts);

    expect(failed).toHaveLength(1);
    expect(failed[0].mistakeCount).toBe(1);
  });

  it('ignores a blank with no attempts at all — unanswered is not a mistake', () => {
    const items = [item('i1', 'Never leave children alone {{0}} a car.', [
      { index: 0, answer: 'inside', prompt: 'в, внутри' },
    ])];

    expect(extractFailedBlanks(items, [])).toEqual([]);
  });

  it('handles several blanks in one sentence independently', () => {
    const items = [item('i1', 'Walk {{0}} the park and sit {{1}} the bench.', [
      { index: 0, answer: 'through', prompt: 'через' },
      { index: 1, answer: 'on', prompt: 'на' },
    ])];
    const attempts = [
      attempt('i1', 0, 'across', false, 1),
      attempt('i1', 1, 'on', true, 1),
    ];

    const failed = extractFailedBlanks(items, attempts);

    expect(failed).toHaveLength(1);
    expect(failed[0].blankIndex).toBe(0);
  });

  it('falls back to positional index when a blank carries no index field', () => {
    const items = [item('i1', 'Walk {{0}} the park.', [{ answer: 'through', prompt: 'через' }])];
    const attempts = [attempt('i1', 0, 'across', false, 1)];

    const failed = extractFailedBlanks(items, attempts);

    expect(failed).toHaveLength(1);
    expect(failed[0].answer).toBe('through');
  });

  it('skips attempts pointing at a blank the item does not have', () => {
    const items = [item('i1', 'Walk {{0}} the park.', [{ index: 0, answer: 'through' }])];
    const attempts = [attempt('i1', 7, 'nonsense', false, 1)];

    expect(extractFailedBlanks(items, attempts)).toEqual([]);
  });

  it('orders results by item order then blank index', () => {
    const items = [
      { uuid: 'i2', order: 1, template: 'B {{0}}', blanks: [{ index: 0, answer: 'b' }] },
      { uuid: 'i1', order: 0, template: 'A {{0}}', blanks: [{ index: 0, answer: 'a' }] },
    ];
    const attempts = [
      attempt('i2', 0, 'x', false, 1),
      attempt('i1', 0, 'y', false, 1),
    ];

    const failed = extractFailedBlanks(items, attempts);

    expect(failed.map((f) => f.answer)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd education-service && npx jest src/drills/analysis/failed-blanks.spec.ts`
Expected: FAIL — `Cannot find module './failed-blanks'`.

- [ ] **Step 3: Write the contracts file**

Create `education-service/src/drills/analysis/contracts.ts`:

```ts
/** One blank the student got wrong, with everything the analyzer needs to explain it. */
export interface FailedBlank {
  itemUuid: string;
  blankIndex: number;
  /** The correct answer, in its surface form. */
  answer: string;
  /** The blank's prompt, e.g. "через". Null when the item carries none. */
  prompt: string | null;
  /** The item template, blank placeholder included. */
  sentence: string;
  /** What the student typed, wrong and non-revealed, in the order they tried. */
  wrongAttempts: string[];
  /** Whether the student gave up and revealed this blank. */
  revealed: boolean;
  /**
   * How many times the student got this blank wrong — the number of remedial sentences
   * this answer earns. A blank revealed with nothing typed still counts as one: the
   * student did not know it.
   */
  mistakeCount: number;
}

/** The item shape the analysis reads. Matches `DrillAssignmentItem` rows. */
export interface AnalysisItemInput {
  uuid: string;
  order: number;
  template: string;
  /** Prisma `Json`; validated at the boundary rather than trusted. */
  blanks: unknown;
}

/** The attempt shape the analysis reads. Matches `DrillAttempt` rows. */
export interface AnalysisAttemptInput {
  itemUuid: string;
  blankIndex: number;
  submittedValue: string;
  isCorrect: boolean;
  revealed: boolean;
  attemptNo: number;
}
```

- [ ] **Step 4: Write the implementation**

Create `education-service/src/drills/analysis/failed-blanks.ts`:

```ts
import { AnalysisAttemptInput, AnalysisItemInput, FailedBlank } from './contracts';

interface ParsedBlank {
  index: number;
  answer: string;
  prompt: string | null;
}

/**
 * The blanks the student got wrong on a completed assignment.
 *
 * `mistakeCount` is the number of remedial sentences the answer earns, so it counts
 * **typed wrong attempts only** — a reveal is not a fourth mistake on top of three tries.
 * A blank revealed with nothing typed is still a failure, counted as one: not knowing an
 * answer and getting it wrong are the same gap.
 *
 * A blank with no attempts at all is not returned. The student never reached it; that is
 * an incomplete drill, not a mistake, and drilling it would teach nothing.
 */
export function extractFailedBlanks(
  items: AnalysisItemInput[],
  attempts: AnalysisAttemptInput[],
): FailedBlank[] {
  const byItem = new Map<string, AnalysisItemInput>();
  for (const item of items) {
    byItem.set(item.uuid, item);
  }

  const grouped = new Map<string, AnalysisAttemptInput[]>();
  for (const attempt of attempts) {
    const key = `${attempt.itemUuid}:${attempt.blankIndex}`;
    const list = grouped.get(key);
    if (list) {
      list.push(attempt);
    } else {
      grouped.set(key, [attempt]);
    }
  }

  const failed: Array<FailedBlank & { order: number }> = [];

  for (const [key, tries] of grouped) {
    const [itemUuid] = key.split(':');
    const item = byItem.get(itemUuid);
    if (!item) {
      // An attempt whose item is gone. Deleted mid-drill by a teacher edit; there is no
      // sentence left to explain, so it cannot be analyzed.
      continue;
    }

    const blankIndex = Number(key.slice(itemUuid.length + 1));
    const blank = parseBlank(item.blanks, blankIndex);
    if (!blank) {
      continue;
    }

    const ordered = [...tries].sort((a, b) => a.attemptNo - b.attemptNo);
    const wrongAttempts = ordered
      .filter((t) => !t.isCorrect && !t.revealed)
      .map((t) => t.submittedValue);
    const revealed = ordered.some((t) => t.revealed);

    // Revealed with nothing typed still counts as one mistake — see the doc comment.
    const mistakeCount = wrongAttempts.length > 0 ? wrongAttempts.length : revealed ? 1 : 0;
    if (mistakeCount === 0) {
      continue;
    }

    failed.push({
      order: item.order,
      itemUuid,
      blankIndex: blank.index,
      answer: blank.answer,
      prompt: blank.prompt,
      sentence: item.template,
      wrongAttempts,
      revealed,
      mistakeCount,
    });
  }

  failed.sort((a, b) => (a.order - b.order) || (a.blankIndex - b.blankIndex));
  return failed.map(({ order: _order, ...rest }) => rest);
}

/** Reads one blank out of the item's Json column, tolerating a missing `index`. */
function parseBlank(blanks: unknown, wantedIndex: number): ParsedBlank | null {
  if (!Array.isArray(blanks)) {
    return null;
  }

  for (let position = 0; position < blanks.length; position++) {
    const raw = blanks[position] as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') {
      continue;
    }
    const index = typeof raw.index === 'number' ? raw.index : position;
    if (index !== wantedIndex) {
      continue;
    }
    const answer = typeof raw.answer === 'string' ? raw.answer : '';
    if (!answer) {
      return null;
    }
    return {
      index,
      answer,
      prompt: typeof raw.prompt === 'string' && raw.prompt.length > 0 ? raw.prompt : null,
    };
  }

  return null;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd education-service && npx jest src/drills/analysis/failed-blanks.spec.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Verify the test can fail**

Temporarily change `mistakeCount` to `wrongAttempts.length` (dropping the reveal fallback), re-run, and confirm the "revealed with no typed attempt" test fails. Restore it.

- [ ] **Step 7: Commit**

```bash
git add education-service/src/drills/analysis/contracts.ts \
        education-service/src/drills/analysis/failed-blanks.ts \
        education-service/src/drills/analysis/failed-blanks.spec.ts
git commit -m "feat(drills): extract failed blanks with mistake counts from attempts"
```

---

### Task 3: Word mastery arithmetic (pure)

**Files:**
- Create: `education-service/src/drills/analysis/mastery.ts`
- Test: `education-service/src/drills/analysis/mastery.spec.ts`

**Interfaces:**
- Consumes: `AnalysisAttemptInput`, `AnalysisItemInput` from `./contracts`; `gradingOptionsFor`, `normalizeAnswer` from `../grading`
- Produces:
  - `const MASTERY_STREAK_TARGET = 3`
  - `interface MasteryDelta { normalizedAnswer: string; displayAnswer: string; clean: boolean; mistakes: number }`
  - `function computeMasteryDeltas(items: AnalysisItemInput[], attempts: AnalysisAttemptInput[], languageCode: string): MasteryDelta[]`
  - `function nextStreak(current: number, clean: boolean): number`
  - `function masteredAtFor(streak: number, now: Date): Date | null`

- [ ] **Step 1: Write the failing test**

Create `education-service/src/drills/analysis/mastery.spec.ts`:

```ts
import {
  MASTERY_STREAK_TARGET,
  computeMasteryDeltas,
  masteredAtFor,
  nextStreak,
} from './mastery';

const item = (uuid: string, blanks: unknown[]) => ({
  uuid,
  order: 0,
  template: 'x {{0}} y',
  blanks,
});

const attempt = (
  itemUuid: string,
  blankIndex: number,
  submittedValue: string,
  isCorrect: boolean,
  attemptNo: number,
  revealed = false,
) => ({ itemUuid, blankIndex, submittedValue, isCorrect, attemptNo, revealed });

describe('nextStreak', () => {
  it('advances on a clean appearance', () => {
    expect(nextStreak(1, true)).toBe(2);
  });

  it('resets to zero on anything else', () => {
    expect(nextStreak(2, false)).toBe(0);
  });
});

describe('masteredAtFor', () => {
  const now = new Date('2026-08-12T10:00:00Z');

  it('marks a word mastered at three clean appearances', () => {
    expect(masteredAtFor(MASTERY_STREAK_TARGET, now)).toEqual(now);
  });

  it('leaves a word unmastered below the target', () => {
    expect(masteredAtFor(MASTERY_STREAK_TARGET - 1, now)).toBeNull();
  });

  it('keeps a word mastered above the target', () => {
    expect(masteredAtFor(MASTERY_STREAK_TARGET + 2, now)).toEqual(now);
  });
});

describe('computeMasteryDeltas', () => {
  it('marks a first-try correct answer clean', () => {
    const items = [item('i1', [{ index: 0, answer: 'behind' }])];
    const attempts = [attempt('i1', 0, 'behind', true, 1)];

    expect(computeMasteryDeltas(items, attempts, 'en')).toEqual([
      { normalizedAnswer: 'behind', displayAnswer: 'behind', clean: true, mistakes: 0 },
    ]);
  });

  it('does not mark a fourth-attempt correct answer clean', () => {
    const items = [item('i1', [{ index: 0, answer: 'through' }])];
    const attempts = [
      attempt('i1', 0, 'across', false, 1),
      attempt('i1', 0, 'acros', false, 2),
      attempt('i1', 0, 'to across', false, 3),
      attempt('i1', 0, 'through', true, 4),
    ];

    expect(computeMasteryDeltas(items, attempts, 'en')).toEqual([
      { normalizedAnswer: 'through', displayAnswer: 'through', clean: false, mistakes: 3 },
    ]);
  });

  it('does not mark a revealed blank clean even when nothing was typed wrong', () => {
    const items = [item('i1', [{ index: 0, answer: 'out of' }])];
    const attempts = [attempt('i1', 0, '', false, 1, true)];

    expect(computeMasteryDeltas(items, attempts, 'en')).toEqual([
      { normalizedAnswer: 'out of', displayAnswer: 'out of', clean: false, mistakes: 1 },
    ]);
  });

  // The test above passes even if `!revealed &&` is deleted, because `isCorrect: false`
  // already forces `clean: false`. This one is the discriminating case: a first attempt
  // recorded CORRECT on a blank that was also revealed. A student who reveals an answer
  // and types it back has demonstrated nothing, so the reveal must still spoil the
  // appearance — and only this shape proves the rule is enforced.
  it('does not mark a revealed blank clean even when the attempt is recorded correct', () => {
    const items = [item('i1', [{ index: 0, answer: 'out of' }])];
    const attempts = [attempt('i1', 0, 'out of', true, 1, true)];

    expect(computeMasteryDeltas(items, attempts, 'en')).toEqual([
      { normalizedAnswer: 'out of', displayAnswer: 'out of', clean: false, mistakes: 1 },
    ]);
  });

  it('keeps a multi-word answer as one key', () => {
    const items = [item('i1', [{ index: 0, answer: 'out of' }])];
    const attempts = [attempt('i1', 0, 'out of', true, 1)];

    const deltas = computeMasteryDeltas(items, attempts, 'en');

    expect(deltas).toHaveLength(1);
    expect(deltas[0].normalizedAnswer).toBe('out of');
  });

  it('normalizes case so one word is one record', () => {
    const items = [
      item('i1', [{ index: 0, answer: 'Behind' }]),
      { uuid: 'i2', order: 1, template: 'x {{0}}', blanks: [{ index: 0, answer: 'behind' }] },
    ];
    const attempts = [
      attempt('i1', 0, 'Behind', true, 1),
      attempt('i2', 0, 'behind', true, 1),
    ];

    const deltas = computeMasteryDeltas(items, attempts, 'en');

    expect(deltas).toHaveLength(1);
    expect(deltas[0].clean).toBe(true);
  });

  it('lets one dirty appearance spoil a word that was clean elsewhere', () => {
    const items = [
      item('i1', [{ index: 0, answer: 'behind' }]),
      { uuid: 'i2', order: 1, template: 'x {{0}}', blanks: [{ index: 0, answer: 'behind' }] },
    ];
    const attempts = [
      attempt('i1', 0, 'behind', true, 1),
      attempt('i2', 0, 'on', false, 1),
      attempt('i2', 0, 'behind', true, 2),
    ];

    const deltas = computeMasteryDeltas(items, attempts, 'en');

    expect(deltas).toEqual([
      { normalizedAnswer: 'behind', displayAnswer: 'behind', clean: false, mistakes: 1 },
    ]);
  });

  it('ignores blanks the student never attempted', () => {
    const items = [item('i1', [{ index: 0, answer: 'behind' }])];

    expect(computeMasteryDeltas(items, [], 'en')).toEqual([]);
  });

  it('reports one delta per distinct answer', () => {
    const items = [
      item('i1', [{ index: 0, answer: 'behind' }]),
      { uuid: 'i2', order: 1, template: 'x {{0}}', blanks: [{ index: 0, answer: 'through' }] },
    ];
    const attempts = [
      attempt('i1', 0, 'behind', true, 1),
      attempt('i2', 0, 'across', false, 1),
    ];

    const deltas = computeMasteryDeltas(items, attempts, 'en');

    expect(deltas.map((d) => d.normalizedAnswer).sort()).toEqual(['behind', 'through']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd education-service && npx jest src/drills/analysis/mastery.spec.ts`
Expected: FAIL — `Cannot find module './mastery'`.

- [ ] **Step 3: Write the implementation**

Create `education-service/src/drills/analysis/mastery.ts`:

```ts
import { gradingOptionsFor, normalizeAnswer } from '../grading';
import { AnalysisAttemptInput, AnalysisItemInput } from './contracts';

/**
 * Consecutive clean appearances that retire a word from remedial work.
 *
 * Three, deliberately: one is luck and two is a coincidence. A word that survives three
 * separate first-try-correct appearances is known, and continuing to drill it spends the
 * student's attention on something already learned.
 */
export const MASTERY_STREAK_TARGET = 3;

export interface MasteryDelta {
  normalizedAnswer: string;
  /** The surface form last seen, for the teacher's weak-word list. */
  displayAnswer: string;
  /** True only when EVERY appearance of the word in this assignment was clean. */
  clean: boolean;
  /** Wrong typed attempts across every appearance; a bare reveal counts as one. */
  mistakes: number;
}

/**
 * Per-word outcomes for one completed assignment.
 *
 * A **clean appearance** is the blank's first attempt being correct with the blank never
 * revealed. A word solved on the fourth try was not known — counting it clean would
 * advance a streak on a word the student guessed their way through.
 *
 * When a word appears in several sentences, one dirty appearance spoils the whole word:
 * the streak describes the word, not the sentence.
 *
 * Keys come from `normalizeAnswer` with this language's grading options — the SAME
 * normalization the grader uses. A second normalizer here would silently split one
 * student's record in two.
 */
export function computeMasteryDeltas(
  items: AnalysisItemInput[],
  attempts: AnalysisAttemptInput[],
  languageCode: string,
): MasteryDelta[] {
  const options = gradingOptionsFor(languageCode);

  const byItem = new Map<string, AnalysisItemInput>();
  for (const item of items) {
    byItem.set(item.uuid, item);
  }

  const grouped = new Map<string, AnalysisAttemptInput[]>();
  for (const attempt of attempts) {
    const key = `${attempt.itemUuid}:${attempt.blankIndex}`;
    const list = grouped.get(key);
    if (list) {
      list.push(attempt);
    } else {
      grouped.set(key, [attempt]);
    }
  }

  const deltas = new Map<string, MasteryDelta>();

  for (const [key, tries] of grouped) {
    const [itemUuid] = key.split(':');
    const item = byItem.get(itemUuid);
    if (!item) {
      continue;
    }

    const blankIndex = Number(key.slice(itemUuid.length + 1));
    const answer = answerFor(item.blanks, blankIndex);
    if (!answer) {
      continue;
    }

    const ordered = [...tries].sort((a, b) => a.attemptNo - b.attemptNo);
    const revealed = ordered.some((t) => t.revealed);
    const wrongCount = ordered.filter((t) => !t.isCorrect && !t.revealed).length;
    const first = ordered[0];
    const clean = !revealed && Boolean(first?.isCorrect);
    const mistakes = wrongCount > 0 ? wrongCount : revealed ? 1 : 0;

    const normalized = normalizeAnswer(answer, options);
    if (!normalized) {
      continue;
    }

    const existing = deltas.get(normalized);
    if (existing) {
      existing.clean = existing.clean && clean;
      existing.mistakes += mistakes;
    } else {
      deltas.set(normalized, {
        normalizedAnswer: normalized,
        displayAnswer: answer,
        clean,
        mistakes,
      });
    }
  }

  return [...deltas.values()];
}

/** The streak after one appearance. Clean advances it; anything else resets it. */
export function nextStreak(current: number, clean: boolean): number {
  return clean ? current + 1 : 0;
}

/** When a streak reaches the target the word is mastered; below it, it is not. */
export function masteredAtFor(streak: number, now: Date): Date | null {
  return streak >= MASTERY_STREAK_TARGET ? now : null;
}

function answerFor(blanks: unknown, wantedIndex: number): string | null {
  if (!Array.isArray(blanks)) {
    return null;
  }
  for (let position = 0; position < blanks.length; position++) {
    const raw = blanks[position] as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') {
      continue;
    }
    const index = typeof raw.index === 'number' ? raw.index : position;
    if (index !== wantedIndex) {
      continue;
    }
    return typeof raw.answer === 'string' && raw.answer.length > 0 ? raw.answer : null;
  }
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd education-service && npx jest src/drills/analysis/mastery.spec.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Verify the reveal rule can fail**

Temporarily change `clean` to `Boolean(first?.isCorrect)` (dropping `!revealed &&`), re-run, and confirm the revealed-blank test fails. Restore it.

- [ ] **Step 6: Commit**

```bash
git add education-service/src/drills/analysis/mastery.ts \
        education-service/src/drills/analysis/mastery.spec.ts
git commit -m "feat(drills): per-word mastery arithmetic with first-try-clean streaks"
```

---

### Task 4: Mastery repository

**Files:**
- Create: `education-service/src/drills/analysis/mastery.repository.ts`
- Test: `education-service/src/drills/analysis/mastery.repository.spec.ts`

**Interfaces:**
- Consumes: `MasteryDelta`, `nextStreak`, `masteredAtFor` from `./mastery`; `PrismaService`
- Produces:
  - `class MasteryRepository`
  - `applyDeltas(studentId: number, languageCode: string, deltas: MasteryDelta[], now: Date): Promise<void>`
  - `masteredAnswers(studentId: number, languageCode: string, normalizedAnswers: string[]): Promise<Set<string>>`

- [ ] **Step 1: Write the failing test**

Create `education-service/src/drills/analysis/mastery.repository.spec.ts`:

```ts
import { MasteryRepository } from './mastery.repository';

function prismaStub(existing: Array<Record<string, unknown>> = []) {
  const rows = [...existing];
  return {
    rows,
    upserts: [] as Array<Record<string, unknown>>,
    studentWordMastery: {
      findMany: jest.fn(async ({ where }: any) => {
        const wanted: string[] = where.normalizedAnswer?.in ?? [];
        return rows.filter(
          (r) =>
            r.studentId === where.studentId &&
            r.languageCode === where.languageCode &&
            (wanted.length === 0 || wanted.includes(r.normalizedAnswer as string)),
        );
      }),
      upsert: jest.fn(async (args: any) => {
        (prismaStubUpserts as any[]).push(args);
        return args;
      }),
    },
  };
}

let prismaStubUpserts: any[] = [];
beforeEach(() => {
  prismaStubUpserts = [];
});

describe('MasteryRepository.applyDeltas', () => {
  const now = new Date('2026-08-12T10:00:00Z');

  it('advances the streak of a clean word', async () => {
    const prisma = prismaStub([
      { studentId: 7, languageCode: 'en', normalizedAnswer: 'behind', cleanStreak: 1, totalMistakes: 4 },
    ]);
    const repo = new MasteryRepository(prisma as any);

    await repo.applyDeltas(
      7,
      'en',
      [{ normalizedAnswer: 'behind', displayAnswer: 'behind', clean: true, mistakes: 0 }],
      now,
    );

    expect(prismaStubUpserts).toHaveLength(1);
    expect(prismaStubUpserts[0].update.cleanStreak).toBe(2);
    expect(prismaStubUpserts[0].update.masteredAt).toBeNull();
  });

  it('marks a word mastered on the third clean appearance', async () => {
    const prisma = prismaStub([
      { studentId: 7, languageCode: 'en', normalizedAnswer: 'behind', cleanStreak: 2, totalMistakes: 4 },
    ]);
    const repo = new MasteryRepository(prisma as any);

    await repo.applyDeltas(
      7,
      'en',
      [{ normalizedAnswer: 'behind', displayAnswer: 'behind', clean: true, mistakes: 0 }],
      now,
    );

    expect(prismaStubUpserts[0].update.cleanStreak).toBe(3);
    expect(prismaStubUpserts[0].update.masteredAt).toEqual(now);
  });

  it('resets the streak and clears mastery when the word is missed again', async () => {
    const prisma = prismaStub([
      {
        studentId: 7,
        languageCode: 'en',
        normalizedAnswer: 'behind',
        cleanStreak: 3,
        totalMistakes: 4,
        masteredAt: new Date('2026-08-01T00:00:00Z'),
      },
    ]);
    const repo = new MasteryRepository(prisma as any);

    await repo.applyDeltas(
      7,
      'en',
      [{ normalizedAnswer: 'behind', displayAnswer: 'behind', clean: false, mistakes: 2 }],
      now,
    );

    expect(prismaStubUpserts[0].update.cleanStreak).toBe(0);
    expect(prismaStubUpserts[0].update.masteredAt).toBeNull();
    expect(prismaStubUpserts[0].update.totalMistakes).toBe(6);
  });

  it('creates a row for a word never seen before', async () => {
    const prisma = prismaStub();
    const repo = new MasteryRepository(prisma as any);

    await repo.applyDeltas(
      7,
      'en',
      [{ normalizedAnswer: 'through', displayAnswer: 'through', clean: false, mistakes: 3 }],
      now,
    );

    expect(prismaStubUpserts[0].create.cleanStreak).toBe(0);
    expect(prismaStubUpserts[0].create.totalMistakes).toBe(3);
    expect(prismaStubUpserts[0].create.masteredAt).toBeNull();
    expect(prismaStubUpserts[0].create.displayAnswer).toBe('through');
  });

  it('does nothing when there are no deltas', async () => {
    const prisma = prismaStub();
    const repo = new MasteryRepository(prisma as any);

    await repo.applyDeltas(7, 'en', [], now);

    expect(prisma.studentWordMastery.findMany).not.toHaveBeenCalled();
    expect(prismaStubUpserts).toHaveLength(0);
  });
});

describe('MasteryRepository.masteredAnswers', () => {
  it('returns only the answers already mastered', async () => {
    const prisma = prismaStub([
      { studentId: 7, languageCode: 'en', normalizedAnswer: 'behind', masteredAt: new Date() },
      { studentId: 7, languageCode: 'en', normalizedAnswer: 'through', masteredAt: null },
    ]);
    const repo = new MasteryRepository(prisma as any);

    const mastered = await repo.masteredAnswers(7, 'en', ['behind', 'through']);

    expect(mastered.has('behind')).toBe(true);
    expect(mastered.has('through')).toBe(false);
  });

  it('returns an empty set without querying when asked about nothing', async () => {
    const prisma = prismaStub();
    const repo = new MasteryRepository(prisma as any);

    const mastered = await repo.masteredAnswers(7, 'en', []);

    expect(mastered.size).toBe(0);
    expect(prisma.studentWordMastery.findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd education-service && npx jest src/drills/analysis/mastery.repository.spec.ts`
Expected: FAIL — `Cannot find module './mastery.repository'`.

- [ ] **Step 3: Write the implementation**

Create `education-service/src/drills/analysis/mastery.repository.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MasteryDelta, masteredAtFor, nextStreak } from './mastery';

/**
 * Persistence for `StudentWordMastery`.
 *
 * Deliberately separate from the arithmetic in `mastery.ts`: the streak rules are worth
 * testing without a database, and the database work is worth testing without restating
 * the rules.
 */
@Injectable()
export class MasteryRepository {
  private readonly logger = new Logger(MasteryRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Applies one assignment's outcomes to the student's word records.
   *
   * Read-then-upsert rather than a raw increment: `masteredAt` depends on the streak
   * value AFTER the change, and a reset has to clear it. Assignments complete one at a
   * time per student, so the read-modify-write window is not contended in practice.
   */
  async applyDeltas(
    studentId: number,
    languageCode: string,
    deltas: MasteryDelta[],
    now: Date,
  ): Promise<void> {
    if (deltas.length === 0) {
      return;
    }

    const existing: any[] = await (this.prisma as any).studentWordMastery.findMany({
      where: {
        studentId,
        languageCode,
        normalizedAnswer: { in: deltas.map((d) => d.normalizedAnswer) },
      },
    });

    const byAnswer = new Map<string, any>();
    for (const row of existing) {
      byAnswer.set(row.normalizedAnswer, row);
    }

    for (const delta of deltas) {
      const row = byAnswer.get(delta.normalizedAnswer);
      const currentStreak = typeof row?.cleanStreak === 'number' ? row.cleanStreak : 0;
      const currentMistakes = typeof row?.totalMistakes === 'number' ? row.totalMistakes : 0;

      const streak = nextStreak(currentStreak, delta.clean);
      const masteredAt = masteredAtFor(streak, now);

      await (this.prisma as any).studentWordMastery.upsert({
        where: {
          studentId_languageCode_normalizedAnswer: {
            studentId,
            languageCode,
            normalizedAnswer: delta.normalizedAnswer,
          },
        },
        update: {
          displayAnswer: delta.displayAnswer,
          cleanStreak: streak,
          totalMistakes: currentMistakes + delta.mistakes,
          lastSeenAt: now,
          masteredAt,
        },
        create: {
          uuid: randomUUID(),
          studentId,
          languageCode,
          normalizedAnswer: delta.normalizedAnswer,
          displayAnswer: delta.displayAnswer,
          cleanStreak: streak,
          totalMistakes: delta.mistakes,
          lastSeenAt: now,
          masteredAt,
        },
      });
    }

    const mastered = deltas.filter((d) => d.clean).length;
    this.logger.log(
      `Mastery updated: student=${studentId} lang=${languageCode} words=${deltas.length} clean=${mastered}`,
    );
  }

  /** Which of these answers the student has already retired. */
  async masteredAnswers(
    studentId: number,
    languageCode: string,
    normalizedAnswers: string[],
  ): Promise<Set<string>> {
    if (normalizedAnswers.length === 0) {
      return new Set();
    }

    const rows: any[] = await (this.prisma as any).studentWordMastery.findMany({
      where: { studentId, languageCode, normalizedAnswer: { in: normalizedAnswers } },
    });

    return new Set(
      rows.filter((row) => row.masteredAt !== null && row.masteredAt !== undefined)
        .map((row) => row.normalizedAnswer as string),
    );
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd education-service && npx jest src/drills/analysis/mastery.repository.spec.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add education-service/src/drills/analysis/mastery.repository.ts \
        education-service/src/drills/analysis/mastery.repository.spec.ts
git commit -m "feat(drills): persist per-word mastery streaks"
```

---

### Task 5: Taxonomy loader and slug coercion

**Files:**
- Create: `education-service/src/drills/analysis/taxonomy.ts`
- Test: `education-service/src/drills/analysis/taxonomy.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`
- Produces:
  - `class TaxonomyService`
  - `slugsFor(languageCode: string): Promise<string[]>`
  - `fallbackSlug(languageCode: string): string`
  - `coerceSlug(candidate: string, allowed: string[], languageCode: string): { slug: string; coerced: boolean }`
  - `titleFor(slug: string, materialLanguage: string): Promise<string | null>`

- [ ] **Step 1: Write the failing test**

Create `education-service/src/drills/analysis/taxonomy.spec.ts`:

```ts
import { TaxonomyService } from './taxonomy';

function prismaStub(topics: Array<Record<string, unknown>>) {
  return {
    grammarTopic: {
      findMany: jest.fn(async ({ where }: any) =>
        topics.filter((t) => !where?.languageCode || t.languageCode === where.languageCode),
      ),
      findUnique: jest.fn(async ({ where }: any) =>
        topics.find((t) => t.slug === where.slug) ?? null,
      ),
    },
  };
}

const topics = [
  { slug: 'en.prepositions-of-place', languageCode: 'en', titles: { ru: 'Предлоги места', en: 'Prepositions of place' }, sortOrder: 10 },
  { slug: 'en.other', languageCode: 'en', titles: { ru: 'Прочее', en: 'Other' }, sortOrder: 999 },
];

describe('TaxonomyService.slugsFor', () => {
  it('returns the language taxonomy', async () => {
    const service = new TaxonomyService(prismaStub(topics) as any);

    expect(await service.slugsFor('en')).toEqual(['en.prepositions-of-place', 'en.other']);
  });

  it('raises when a language has no taxonomy at all', async () => {
    const service = new TaxonomyService(prismaStub([]) as any);

    await expect(service.slugsFor('fr')).rejects.toThrow(/no grammar taxonomy/i);
  });
});

describe('TaxonomyService.coerceSlug', () => {
  const service = new TaxonomyService(prismaStub(topics) as any);
  const allowed = ['en.prepositions-of-place', 'en.other'];

  it('passes a slug that is in the taxonomy', () => {
    expect(service.coerceSlug('en.prepositions-of-place', allowed, 'en')).toEqual({
      slug: 'en.prepositions-of-place',
      coerced: false,
    });
  });

  it('coerces an invented slug to the language fallback', () => {
    expect(service.coerceSlug('en.made-up-by-the-model', allowed, 'en')).toEqual({
      slug: 'en.other',
      coerced: true,
    });
  });

  it('coerces an empty slug to the fallback', () => {
    expect(service.coerceSlug('', allowed, 'en')).toEqual({ slug: 'en.other', coerced: true });
  });

  it('coerces another language\'s slug to this language\'s fallback', () => {
    expect(service.coerceSlug('de.word-order', allowed, 'en')).toEqual({
      slug: 'en.other',
      coerced: true,
    });
  });
});

describe('TaxonomyService.titleFor', () => {
  it('returns the title in the material language', async () => {
    const service = new TaxonomyService(prismaStub(topics) as any);

    expect(await service.titleFor('en.prepositions-of-place', 'ru')).toBe('Предлоги места');
  });

  it('falls back to the English title when the material language has none', async () => {
    const service = new TaxonomyService(
      prismaStub([{ slug: 'en.x', languageCode: 'en', titles: { en: 'X' }, sortOrder: 1 }]) as any,
    );

    expect(await service.titleFor('en.x', 'ru')).toBe('X');
  });

  it('returns null for a slug that does not exist', async () => {
    const service = new TaxonomyService(prismaStub(topics) as any);

    expect(await service.titleFor('en.nope', 'ru')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd education-service && npx jest src/drills/analysis/taxonomy.spec.ts`
Expected: FAIL — `Cannot find module './taxonomy'`.

- [ ] **Step 3: Write the implementation**

Create `education-service/src/drills/analysis/taxonomy.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * The grammar taxonomy the analyzer is allowed to cluster into.
 *
 * Stable slugs are the point. A model asked to name a gap freely will name the same gap
 * three different ways across three assignments, which makes "which gaps does this student
 * keep failing" unanswerable. Constraining the model to this list is what makes the gap a
 * durable fact about the student rather than a sentence in one report.
 */
@Injectable()
export class TaxonomyService {
  private readonly logger = new Logger(TaxonomyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every slug for a language, in display order.
   *
   * Raises rather than returning `[]` when a language has no taxonomy: an empty allow-list
   * would make every cluster invalid and silently push the whole analysis into the
   * fallback bucket, which reads as "the model is useless" instead of "this language was
   * never seeded".
   */
  async slugsFor(languageCode: string): Promise<string[]> {
    const rows: any[] = await (this.prisma as any).grammarTopic.findMany({
      where: { languageCode },
      orderBy: { sortOrder: 'asc' },
    });

    if (rows.length === 0) {
      throw new Error(
        `No grammar taxonomy seeded for language "${languageCode}" — run prisma/seed-grammar-topics.ts`,
      );
    }

    return rows.map((row) => row.slug as string);
  }

  /** The bucket an unrecognised cluster lands in. Seeded for every language. */
  fallbackSlug(languageCode: string): string {
    return `${languageCode}.other`;
  }

  /**
   * Forces a model-proposed slug into the taxonomy.
   *
   * A coerced slug is logged at **warn** with the original value by the caller, so the
   * taxonomy grows from what the model actually keeps reaching for rather than from
   * guesswork. Silently absorbing everything into `other` would hide that signal.
   */
  coerceSlug(
    candidate: string,
    allowed: string[],
    languageCode: string,
  ): { slug: string; coerced: boolean } {
    const trimmed = (candidate ?? '').trim();
    if (trimmed && allowed.includes(trimmed)) {
      return { slug: trimmed, coerced: false };
    }
    return { slug: this.fallbackSlug(languageCode), coerced: true };
  }

  /** A topic's display title, in the student's material language. */
  async titleFor(slug: string, materialLanguage: string): Promise<string | null> {
    const row: any = await (this.prisma as any).grammarTopic.findUnique({ where: { slug } });
    if (!row) {
      return null;
    }
    const titles = (row.titles ?? {}) as Record<string, string>;
    return titles[materialLanguage] ?? titles.en ?? null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd education-service && npx jest src/drills/analysis/taxonomy.spec.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add education-service/src/drills/analysis/taxonomy.ts \
        education-service/src/drills/analysis/taxonomy.spec.ts
git commit -m "feat(drills): grammar taxonomy loader with fallback slug coercion"
```

---

### Task 6: ai-microservice `analyze-drill-errors` endpoint

**Repo:** `/home/ssf/Documents/Github/ai-microservice` — a separate repository from `speakasap`. Commit there separately.

**Files:**
- Create: `src/teacher-assistant/analyze.schema.ts`
- Create: `src/teacher-assistant/analyze.prompt.ts`
- Create: `src/teacher-assistant/analyze.service.ts`
- Test: `src/teacher-assistant/analyze.service.spec.ts`
- Test: `src/teacher-assistant/analyze.prompt.spec.ts`
- Modify: `src/teacher-assistant/contracts.ts` (append request/response types)
- Modify: `src/teacher-assistant/teacher-assistant.controller.ts` (one route)
- Modify: `src/teacher-assistant/teacher-assistant.module.ts` (register `AnalyzeService`)
- Create: `src/teacher-assistant/dto/analyze-errors-request.dto.ts`

**Interfaces:**
- Consumes: `LlmClient.completeJson` (existing), `ServiceAuthGuard` (existing)
- Produces: `POST /api/teacher-assistant/analyze-drill-errors`
  - Request `AnalyzeErrorsRequest { languageCode, materialLanguage, level, allowedTopicSlugs: string[], failures: AnalyzeFailure[], correlationId }`
  - `AnalyzeFailure { answer: string; sentence: string; prompt: string | null; wrongAttempts: string[]; revealed: boolean; mistakeCount: number }`
  - Response `AnalyzeErrorsResponse { clusters: AnalyzedGapCluster[]; meta }`
  - `AnalyzedGapCluster { topicSlug: string; title: string; explanation: string; rules: string[]; examples: Array<{ text: string; gloss: string }>; answers: string[] }`

- [ ] **Step 1: Append the contracts**

Append to `src/teacher-assistant/contracts.ts`:

```ts
/** One blank the student got wrong, as education-service reports it. */
export interface AnalyzeFailure {
  /** The correct answer. */
  answer: string;
  /** The sentence, blank placeholder included. */
  sentence: string;
  /** The blank's prompt, e.g. "через". Null when the item carries none. */
  prompt: string | null;
  /** What the student typed, in the order they tried it. */
  wrongAttempts: string[];
  /** Whether the student revealed the answer instead of solving it. */
  revealed: boolean;
  mistakeCount: number;
}

export interface AnalyzeErrorsRequest {
  /** The language being learned, e.g. "en". */
  languageCode: string;
  /** The language the explanation must be written in: "ru" or "en". */
  materialLanguage: string;
  level: string | null;
  /** The only topic slugs the response may use. */
  allowedTopicSlugs: string[];
  failures: AnalyzeFailure[];
  correlationId: string;
}

/** One grammar gap, with the theory that closes it. */
export interface AnalyzedGapCluster {
  /** Must be one of the request's `allowedTopicSlugs`. */
  topicSlug: string;
  /** In `materialLanguage`. */
  title: string;
  /** In `materialLanguage`. Addresses what the student actually typed. */
  explanation: string;
  /** Short, memorable, in `materialLanguage`. */
  rules: string[];
  /** `text` in the target language, `gloss` in `materialLanguage`. */
  examples: Array<{ text: string; gloss: string }>;
  /** Which of the request's failure answers this cluster covers. */
  answers: string[];
}

export interface AnalyzeErrorsResponse {
  clusters: AnalyzedGapCluster[];
  meta: LlmMeta;
}
```

If `LlmMeta` is named differently in that file, use whatever `GenerateDrillResponse.meta` is typed as — do not introduce a second meta type.

- [ ] **Step 2: Write the output schema**

Create `src/teacher-assistant/analyze.schema.ts`:

```ts
export const ANALYZE_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['clusters'],
  properties: {
    clusters: {
      type: 'array',
      items: {
        type: 'object',
        required: ['topicSlug', 'title', 'explanation', 'rules', 'examples', 'answers'],
        properties: {
          topicSlug: { type: 'string' },
          title: { type: 'string' },
          explanation: { type: 'string' },
          rules: { type: 'array', items: { type: 'string' } },
          examples: {
            type: 'array',
            items: {
              type: 'object',
              required: ['text', 'gloss'],
              properties: {
                text: { type: 'string' },
                gloss: { type: 'string' },
              },
            },
          },
          answers: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;
```

- [ ] **Step 3: Write the failing prompt test**

Create `src/teacher-assistant/analyze.prompt.spec.ts`:

```ts
import { ANALYZE_SYSTEM_PROMPT, buildAnalyzeUserPrompt } from './analyze.prompt';
import type { AnalyzeErrorsRequest } from './contracts';

const request: AnalyzeErrorsRequest = {
  languageCode: 'en',
  materialLanguage: 'ru',
  level: 'A2',
  allowedTopicSlugs: ['en.prepositions-of-place', 'en.prepositions-of-movement', 'en.other'],
  failures: [
    {
      answer: 'through',
      sentence: 'We will have to walk {{0}} this market.',
      prompt: 'через',
      wrongAttempts: ['acros', 'across', 'to across'],
      revealed: true,
      mistakeCount: 3,
    },
  ],
  correlationId: 'cid-1',
};

describe('buildAnalyzeUserPrompt', () => {
  it('lists every allowed slug and forbids inventing others', () => {
    const prompt = buildAnalyzeUserPrompt(request);

    expect(prompt).toContain('en.prepositions-of-movement');
    expect(prompt).toContain('en.other');
    expect(ANALYZE_SYSTEM_PROMPT + prompt).toMatch(/only|exclusively/i);
  });

  it('includes what the student actually typed', () => {
    const prompt = buildAnalyzeUserPrompt(request);

    expect(prompt).toContain('across');
    expect(prompt).toContain('acros');
  });

  it('includes the sentence and the correct answer', () => {
    const prompt = buildAnalyzeUserPrompt(request);

    expect(prompt).toContain('We will have to walk');
    expect(prompt).toContain('through');
  });

  it('names the explanation language explicitly', () => {
    expect(buildAnalyzeUserPrompt(request)).toMatch(/Russian|русск/i);
    expect(buildAnalyzeUserPrompt({ ...request, materialLanguage: 'en' })).toMatch(/English/i);
  });

  it('says a revealed blank means the student did not know the answer', () => {
    expect(buildAnalyzeUserPrompt(request)).toMatch(/reveal/i);
  });

  it('requires every submitted answer to appear in exactly one cluster', () => {
    expect(ANALYZE_SYSTEM_PROMPT).toMatch(/every|each/i);
    expect(ANALYZE_SYSTEM_PROMPT).toMatch(/exactly one cluster/i);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `cd /home/ssf/Documents/Github/ai-microservice && npx jest src/teacher-assistant/analyze.prompt.spec.ts`
Expected: FAIL — `Cannot find module './analyze.prompt'`.

- [ ] **Step 5: Write the prompt**

Create `src/teacher-assistant/analyze.prompt.ts`:

```ts
import type { AnalyzeErrorsRequest, AnalyzeFailure } from './contracts';

const LANGUAGE_NAMES: Record<string, string> = {
  ru: 'Russian',
  en: 'English',
  de: 'German',
  es: 'Spanish',
};

export const ANALYZE_SYSTEM_PROMPT = `You are an experienced language teacher reviewing one student's completed exercise.

Your job is to explain the grammar behind the mistakes so the student understands the rule, not just the correction. You are writing for the student, not for the teacher.

Rules you must follow:
- Group the mistakes into grammar gaps. Each gap is one cluster.
- Use ONLY the topic slugs given in the request. Never invent a slug. If a mistake fits none of them, use the slug ending in ".other".
- Every submitted answer must appear in exactly one cluster. Never drop one, never place one in two clusters.
- Address what the student ACTUALLY TYPED. "across" written where "through" belongs is a different lesson from an empty answer.
- Explain the rule, why the student's attempt broke it, and how to choose correctly next time.
- Give two or three short example sentences per cluster, using vocabulary at or below the student's level.
- Keep the explanation to a few short paragraphs. A student reads this after finishing an exercise, not before a exam.

Return JSON only, matching the requested schema.`;

export function buildAnalyzeUserPrompt(req: AnalyzeErrorsRequest): string {
  const target = LANGUAGE_NAMES[req.languageCode] ?? req.languageCode;
  const material = LANGUAGE_NAMES[req.materialLanguage] ?? req.materialLanguage;

  const lines: string[] = [
    `The student is learning ${target}.`,
    `Level: ${req.level ?? 'unknown'}.`,
    ``,
    `Write "title", "explanation", "rules" and every example "gloss" in ${material}.`,
    `Write every example "text" in ${target}.`,
    ``,
    `Allowed topic slugs — use these and nothing else:`,
    ...req.allowedTopicSlugs.map((slug) => `- ${slug}`),
    ``,
    `The student got these blanks wrong:`,
    ``,
  ];

  req.failures.forEach((failure, index) => {
    lines.push(...describeFailure(failure, index + 1));
    lines.push('');
  });

  lines.push(
    `Group these into grammar gaps and explain each one. Every one of the ${req.failures.length} answers above must appear in exactly one cluster's "answers" array.`,
  );

  return lines.join('\n');
}

function describeFailure(failure: AnalyzeFailure, position: number): string[] {
  const lines = [
    `${position}. Sentence: ${failure.sentence}`,
    `   Correct answer: ${failure.answer}`,
  ];

  if (failure.prompt) {
    lines.push(`   Prompt shown to the student: ${failure.prompt}`);
  }

  if (failure.wrongAttempts.length > 0) {
    lines.push(`   The student typed: ${failure.wrongAttempts.join(', ')}`);
  } else {
    lines.push(`   The student typed nothing.`);
  }

  if (failure.revealed) {
    lines.push(`   The student revealed the answer — they did not know it.`);
  }

  lines.push(`   Wrong ${failure.mistakeCount} time(s).`);

  return lines;
}
```

- [ ] **Step 6: Run the prompt test**

Run: `cd /home/ssf/Documents/Github/ai-microservice && npx jest src/teacher-assistant/analyze.prompt.spec.ts`
Expected: PASS, 6 tests.

- [ ] **Step 7: Write the failing service test**

Create `src/teacher-assistant/analyze.service.spec.ts`:

```ts
import { AnalyzeService } from './analyze.service';
import type { AnalyzeErrorsRequest } from './contracts';

const request: AnalyzeErrorsRequest = {
  languageCode: 'en',
  materialLanguage: 'ru',
  level: 'A2',
  allowedTopicSlugs: ['en.prepositions-of-movement', 'en.other'],
  failures: [
    {
      answer: 'through',
      sentence: 'We will have to walk {{0}} this market.',
      prompt: 'через',
      wrongAttempts: ['across'],
      revealed: false,
      mistakeCount: 1,
    },
  ],
  correlationId: 'cid-1',
};

function llmStub(data: unknown) {
  return {
    completeJson: jest.fn(async () => ({ data, meta: { model: 'test', tokensIn: 1, tokensOut: 1 } })),
  };
}

describe('AnalyzeService.analyze', () => {
  it('returns the clusters the model produced', async () => {
    const llm = llmStub({
      clusters: [
        {
          topicSlug: 'en.prepositions-of-movement',
          title: 'Предлоги движения',
          explanation: 'through — сквозь что-то...',
          rules: ['through — внутри и наружу'],
          examples: [{ text: 'Walk through the park.', gloss: 'Пройди через парк.' }],
          answers: ['through'],
        },
      ],
    });
    const service = new AnalyzeService(llm as any);

    const result = await service.analyze(request);

    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].topicSlug).toBe('en.prepositions-of-movement');
    expect(result.clusters[0].answers).toEqual(['through']);
  });

  it('returns an empty cluster list when the model returns an object instead of an array', async () => {
    const service = new AnalyzeService(llmStub({ clusters: { nope: true } }) as any);

    const result = await service.analyze(request);

    expect(result.clusters).toEqual([]);
  });

  it('drops a cluster with no topicSlug rather than emitting an unfileable one', async () => {
    const service = new AnalyzeService(
      llmStub({ clusters: [{ title: 'x', explanation: 'y', rules: [], examples: [], answers: [] }] }) as any,
    );

    expect((await service.analyze(request)).clusters).toEqual([]);
  });

  it('coerces missing rules, examples and answers to empty arrays', async () => {
    const service = new AnalyzeService(
      llmStub({
        clusters: [
          { topicSlug: 'en.other', title: 'x', explanation: 'y' },
        ],
      }) as any,
    );

    const cluster = (await service.analyze(request)).clusters[0];

    expect(cluster.rules).toEqual([]);
    expect(cluster.examples).toEqual([]);
    expect(cluster.answers).toEqual([]);
  });

  it('drops an example missing its text or gloss', async () => {
    const service = new AnalyzeService(
      llmStub({
        clusters: [
          {
            topicSlug: 'en.other',
            title: 'x',
            explanation: 'y',
            rules: [],
            examples: [{ text: 'ok', gloss: 'ок' }, { text: 'no gloss' }],
            answers: [],
          },
        ],
      }) as any,
    );

    expect((await service.analyze(request)).clusters[0].examples).toEqual([
      { text: 'ok', gloss: 'ок' },
    ]);
  });

  it('passes the correlation id through to the model client', async () => {
    const llm = llmStub({ clusters: [] });
    await new AnalyzeService(llm as any).analyze(request);

    expect(llm.completeJson).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: 'cid-1' }),
    );
  });
});
```

- [ ] **Step 8: Run it to verify it fails**

Run: `cd /home/ssf/Documents/Github/ai-microservice && npx jest src/teacher-assistant/analyze.service.spec.ts`
Expected: FAIL — `Cannot find module './analyze.service'`.

- [ ] **Step 9: Write the service**

Create `src/teacher-assistant/analyze.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { LlmClient } from './llm.client';
import { ANALYZE_SYSTEM_PROMPT, buildAnalyzeUserPrompt } from './analyze.prompt';
import { ANALYZE_OUTPUT_SCHEMA } from './analyze.schema';
import { AnalyzeErrorsRequest, AnalyzeErrorsResponse, AnalyzedGapCluster } from './contracts';

/**
 * Clusters a student's drill mistakes into grammar gaps with the theory that closes them.
 *
 * Mirrors `GenerateService`: nothing validates the model's parsed JSON for us, so every
 * field is checked here. A cluster without a `topicSlug` cannot be filed under a topic and
 * is dropped — education-service's coercion needs something to coerce.
 */
@Injectable()
export class AnalyzeService {
  constructor(private readonly llm: LlmClient) {}

  async analyze(req: AnalyzeErrorsRequest): Promise<AnalyzeErrorsResponse> {
    const { data, meta } = await this.llm.completeJson<{ clusters: unknown[] }>({
      systemPrompt: ANALYZE_SYSTEM_PROMPT,
      userPrompt: buildAnalyzeUserPrompt(req),
      outputSchema: ANALYZE_OUTPUT_SCHEMA,
      correlationId: req.correlationId,
    });

    const raw = Array.isArray(data?.clusters) ? data.clusters : [];
    const clusters: AnalyzedGapCluster[] = [];

    for (const candidate of raw) {
      const c = candidate as Record<string, any>;
      const topicSlug = typeof c?.topicSlug === 'string' ? c.topicSlug.trim() : '';
      if (!topicSlug) {
        continue;
      }

      clusters.push({
        topicSlug,
        title: String(c.title ?? ''),
        explanation: String(c.explanation ?? ''),
        rules: Array.isArray(c.rules) ? c.rules.map(String) : [],
        examples: Array.isArray(c.examples)
          ? c.examples
              .filter(
                (e: any) => typeof e?.text === 'string' && typeof e?.gloss === 'string',
              )
              .map((e: any) => ({ text: String(e.text), gloss: String(e.gloss) }))
          : [],
        answers: Array.isArray(c.answers) ? c.answers.map(String) : [],
      });
    }

    return { clusters, meta };
  }
}
```

- [ ] **Step 10: Run the service test**

Run: `cd /home/ssf/Documents/Github/ai-microservice && npx jest src/teacher-assistant/analyze.service.spec.ts`
Expected: PASS, 6 tests.

- [ ] **Step 11: Add the request DTO**

Create `src/teacher-assistant/dto/analyze-errors-request.dto.ts`, following the shape of `generate-drill-request.dto.ts` in the same directory (read it first and match its validation decorators and imports exactly):

```ts
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class AnalyzeFailureDto {
  @IsString()
  answer!: string;

  @IsString()
  sentence!: string;

  @IsOptional()
  @IsString()
  prompt!: string | null;

  @IsArray()
  @IsString({ each: true })
  wrongAttempts!: string[];

  @IsBoolean()
  revealed!: boolean;

  @IsInt()
  @Min(1)
  mistakeCount!: number;
}

export class AnalyzeErrorsRequestDto {
  @IsString()
  languageCode!: string;

  @IsString()
  materialLanguage!: string;

  @IsOptional()
  @IsString()
  level!: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  allowedTopicSlugs!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnalyzeFailureDto)
  failures!: AnalyzeFailureDto[];

  @IsString()
  correlationId!: string;
}
```

`allowedTopicSlugs` and `failures` both require at least one entry: an empty allow-list makes every cluster invalid, and an empty failure list means education-service should have short-circuited to `NO_ERRORS` without spending a model call.

- [ ] **Step 12: Add the route**

In `src/teacher-assistant/teacher-assistant.controller.ts`, add the import, the constructor parameter, and the route:

```ts
  @Post('analyze-drill-errors')
  @HttpCode(200)
  analyzeDrillErrors(@Body() dto: AnalyzeErrorsRequestDto): Promise<AnalyzeErrorsResponse> {
    return this.analyzeService.analyze(dto);
  }
```

Register `AnalyzeService` in `teacher-assistant.module.ts` providers, beside `GenerateService` and `ValidateService`.

- [ ] **Step 13: Add the controller guard test**

Append to `src/teacher-assistant/teacher-assistant.controller.spec.ts`, matching the existing guard assertion style in that file:

```ts
  it('routes analyze-drill-errors to the analyze service', async () => {
    const analyze = { analyze: jest.fn(async () => ({ clusters: [], meta: {} })) };
    const controller = new TeacherAssistantController(
      { generate: jest.fn() } as any,
      { validate: jest.fn() } as any,
      analyze as any,
    );

    await controller.analyzeDrillErrors({ correlationId: 'cid' } as any);

    expect(analyze.analyze).toHaveBeenCalled();
  });
```

Adjust the constructor argument order to match whatever the controller actually declares.

- [ ] **Step 14: Run the full teacher-assistant suite and build**

Run: `cd /home/ssf/Documents/Github/ai-microservice && npx jest src/teacher-assistant && npm run build`
Expected: all tests PASS, build succeeds.

- [ ] **Step 15: Commit (in the ai-microservice repo)**

```bash
cd /home/ssf/Documents/Github/ai-microservice
git add src/teacher-assistant
git commit -m "feat(teacher-assistant): analyze drill errors into grammar gap clusters"
```

---

### Task 7: Analysis client (education-service → ai-microservice)

**Files:**
- Create: `education-service/src/drills/analysis/analysis.client.ts`
- Test: `education-service/src/drills/analysis/analysis.client.spec.ts`
- Modify: `education-service/src/drills/analysis/contracts.ts` (append the wire types)

**Interfaces:**
- Consumes: `requestUpstream`, `numericEnv`, `requiredEnv` from `../orchestration/http`; `mintServiceToken` from `../orchestration/service-token`
- Produces:
  - `class AnalysisClient` with `analyze(req: AnalyzeErrorsRequest): Promise<AnalyzeErrorsResponse>`
  - Types `AnalyzeErrorsRequest`, `AnalyzeFailure`, `AnalyzedGapCluster`, `AnalyzeErrorsResponse` (mirroring Task 6's, this side of the wire)

- [ ] **Step 1: Append the wire types to `contracts.ts`**

Append to `education-service/src/drills/analysis/contracts.ts`:

```ts
/** One failure as ai-microservice's analyzer receives it. */
export interface AnalyzeFailure {
  answer: string;
  sentence: string;
  prompt: string | null;
  wrongAttempts: string[];
  revealed: boolean;
  mistakeCount: number;
}

export interface AnalyzeErrorsRequest {
  languageCode: string;
  materialLanguage: string;
  level: string | null;
  allowedTopicSlugs: string[];
  failures: AnalyzeFailure[];
  correlationId: string;
}

/** One grammar gap as the analyzer returns it, before slug coercion. */
export interface AnalyzedGapCluster {
  topicSlug: string;
  title: string;
  explanation: string;
  rules: string[];
  examples: Array<{ text: string; gloss: string }>;
  answers: string[];
}

export interface AnalyzeErrorsResponse {
  clusters: AnalyzedGapCluster[];
  meta?: unknown;
}

/** Run states. `NO_ERRORS` and `FAILED` are deliberately distinct all the way to the UI. */
export type AnalysisRunStatus = 'PENDING' | 'RUNNING' | 'READY' | 'NO_ERRORS' | 'FAILED';
```

- [ ] **Step 2: Write the failing test**

Create `education-service/src/drills/analysis/analysis.client.spec.ts`:

```ts
import { AnalysisClient } from './analysis.client';
import * as http from '../orchestration/http';
import * as serviceToken from '../orchestration/service-token';

const request = {
  languageCode: 'en',
  materialLanguage: 'ru',
  level: 'A2',
  allowedTopicSlugs: ['en.other'],
  failures: [
    {
      answer: 'through',
      sentence: 'Walk {{0}} the park.',
      prompt: 'через',
      wrongAttempts: ['across'],
      revealed: false,
      mistakeCount: 1,
    },
  ],
  correlationId: 'cid-1',
};

describe('AnalysisClient', () => {
  const originalUrl = process.env.AI_SERVICE_URL;
  const originalSecret = process.env.AI_SERVICE_JWT_SECRET;

  beforeEach(() => {
    process.env.AI_SERVICE_URL = 'http://ai-microservice:3400';
    process.env.AI_SERVICE_JWT_SECRET = 'test-secret';
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env.AI_SERVICE_URL = originalUrl;
    process.env.AI_SERVICE_JWT_SECRET = originalSecret;
  });

  it('posts to the analyze route', async () => {
    const spy = jest
      .spyOn(http, 'requestUpstream')
      .mockResolvedValue({ clusters: [] } as any);

    await new AnalysisClient().analyze(request);

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://ai-microservice:3400/api/teacher-assistant/analyze-drill-errors',
        method: 'POST',
        body: request,
      }),
    );
  });

  it('sends a minted service token, never a caller token', async () => {
    const mint = jest.spyOn(serviceToken, 'mintServiceToken').mockReturnValue('minted');
    const spy = jest
      .spyOn(http, 'requestUpstream')
      .mockResolvedValue({ clusters: [] } as any);

    await new AnalysisClient().analyze(request);

    expect(mint).toHaveBeenCalledWith('education-service', 'test-secret');
    expect(spy.mock.calls[0][0].token).toBe('minted');
  });

  it('propagates an upstream failure rather than returning empty clusters', async () => {
    jest.spyOn(http, 'requestUpstream').mockRejectedValue(new Error('502 Bad Gateway'));

    await expect(new AnalysisClient().analyze(request)).rejects.toThrow('502 Bad Gateway');
  });

  it('raises when AI_SERVICE_URL is unset', async () => {
    delete process.env.AI_SERVICE_URL;

    await expect(new AnalysisClient().analyze(request)).rejects.toThrow(/AI_SERVICE_URL/);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd education-service && npx jest src/drills/analysis/analysis.client.spec.ts`
Expected: FAIL — `Cannot find module './analysis.client'`.

- [ ] **Step 4: Write the client**

Create `education-service/src/drills/analysis/analysis.client.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { numericEnv, requestUpstream, requiredEnv } from '../orchestration/http';
import { mintServiceToken } from '../orchestration/service-token';
import { AnalyzeErrorsRequest, AnalyzeErrorsResponse } from './contracts';

const UPSTREAM = 'ai-microservice';
const SERVICE_ID = 'education-service';

/**
 * Calls ai-microservice's error analyzer.
 *
 * AUTHENTICATION — a minted service token, never a caller's bearer token, for the same
 * reason as `AiClient`: `TeacherAssistantController` sits behind `ServiceAuthGuard`, which
 * verifies a service JWT signed with `AI_SERVICE_JWT_SECRET` and has no per-user concept.
 * Forwarding a user token returns `401 Malformed token`.
 *
 * **Not fail-soft.** A failure here must reach `AnalysisService`, which records it as a
 * `FAILED` run the student and teacher can see and retry. Returning empty clusters would
 * render as "no mistakes to explain" on a drill full of mistakes.
 */
@Injectable()
export class AnalysisClient {
  timeoutMs(): number {
    return numericEnv('DRILL_ANALYSIS_CLIENT_TIMEOUT_MS', 120000);
  }

  async analyze(req: AnalyzeErrorsRequest): Promise<AnalyzeErrorsResponse> {
    return requestUpstream<AnalyzeErrorsResponse>({
      url: `${this.baseUrl()}/api/teacher-assistant/analyze-drill-errors`,
      method: 'POST',
      token: this.serviceToken(),
      body: req,
      timeoutMs: this.timeoutMs(),
      upstream: UPSTREAM,
    });
  }

  private serviceToken(): string {
    return mintServiceToken(SERVICE_ID, requiredEnv('AI_SERVICE_JWT_SECRET', UPSTREAM));
  }

  private baseUrl(): string {
    return requiredEnv('AI_SERVICE_URL', UPSTREAM);
  }
}
```

If `requestUpstream`'s options object uses different property names, read `src/drills/orchestration/http.ts` and match it exactly rather than adapting the call site.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd education-service && npx jest src/drills/analysis/analysis.client.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add education-service/src/drills/analysis/analysis.client.ts \
        education-service/src/drills/analysis/analysis.client.spec.ts \
        education-service/src/drills/analysis/contracts.ts
git commit -m "feat(drills): client for the ai-microservice error analyzer"
```

---

### Task 8: Analysis repository

**Files:**
- Create: `education-service/src/drills/analysis/analysis.repository.ts`
- Test: `education-service/src/drills/analysis/analysis.repository.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`; `AnalysisRunStatus`, `AnalyzedGapCluster`, `FailedBlank` from `./contracts`
- Produces:
  - `class AnalysisRepository`
  - `createRun(sourceAssignmentUuid: string, studentId: number): Promise<string>` — returns the run uuid, idempotent
  - `markRunning(runUuid: string): Promise<void>`
  - `markReady(runUuid: string): Promise<void>`
  - `markNoErrors(runUuid: string): Promise<void>`
  - `markFailed(runUuid: string, message: string): Promise<void>`
  - `replaceClusters(runUuid: string, sourceAssignmentUuid: string, studentId: number, languageCode: string, materialLanguage: string, clusters: PersistableCluster[]): Promise<void>`
  - `getRunWithClusters(sourceAssignmentUuid: string): Promise<AnalysisRunRecord | null>`
  - `getCluster(uuid: string): Promise<GapClusterRecord | null>`
  - `updateCluster(uuid: string, patch: ClusterPatch, teacherId: number): Promise<GapClusterRecord>`
  - `interface PersistableCluster { topicSlug: string; title: string; explanation: string; rules: string[]; examples: Array<{ text: string; gloss: string }>; failedAnswers: PersistedFailedAnswer[] }`
  - `interface PersistedFailedAnswer { answer: string; normalized: string; mistakeCount: number; wrongAttempts: string[] }`

- [ ] **Step 1: Append the record types to `contracts.ts`**

Append to `education-service/src/drills/analysis/contracts.ts`:

```ts
/** One failed answer as it is stored on a gap cluster. */
export interface PersistedFailedAnswer {
  /** Surface form, for display. */
  answer: string;
  /** Mastery key — `normalizeAnswer` with this language's grading options. */
  normalized: string;
  /** How many remedial sentences this answer earns. */
  mistakeCount: number;
  wrongAttempts: string[];
}

/** A cluster ready to be written, after slug coercion and answer attribution. */
export interface PersistableCluster {
  topicSlug: string;
  title: string;
  explanation: string;
  rules: string[];
  examples: Array<{ text: string; gloss: string }>;
  failedAnswers: PersistedFailedAnswer[];
}

/** A stored gap cluster, as the API returns it. */
export interface GapClusterRecord extends PersistableCluster {
  uuid: string;
  runUuid: string;
  sourceAssignmentUuid: string;
  studentId: number;
  languageCode: string;
  materialLanguage: string;
  editedByTeacherId: number | null;
  editedAt: Date | null;
  createdAt: Date;
}

/** A stored run with its clusters. */
export interface AnalysisRunRecord {
  uuid: string;
  sourceAssignmentUuid: string;
  studentId: number;
  status: AnalysisRunStatus;
  errorMessage: string | null;
  attemptCount: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  clusters: GapClusterRecord[];
}

/** The fields a teacher may edit on a cluster. */
export interface ClusterPatch {
  title?: string;
  explanation?: string;
  rules?: string[];
  examples?: Array<{ text: string; gloss: string }>;
}
```

- [ ] **Step 2: Write the failing test**

Create `education-service/src/drills/analysis/analysis.repository.spec.ts`:

```ts
import { AnalysisRepository } from './analysis.repository';

function prismaStub(overrides: Record<string, any> = {}) {
  const state = {
    runs: [] as any[],
    clusters: [] as any[],
  };

  const prisma: any = {
    state,
    drillAnalysisRun: {
      findUnique: jest.fn(async ({ where, include }: any) => {
        const run = state.runs.find((r) => r.sourceAssignmentUuid === where.sourceAssignmentUuid);
        if (!run) return null;
        return include?.clusters
          ? { ...run, clusters: state.clusters.filter((c) => c.runUuid === run.uuid) }
          : run;
      }),
      create: jest.fn(async ({ data }: any) => {
        state.runs.push({ ...data });
        return data;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const run = state.runs.find((r) => r.uuid === where.uuid);
        Object.assign(run, data);
        return run;
      }),
      ...overrides.drillAnalysisRun,
    },
    drillGapAnalysis: {
      deleteMany: jest.fn(async ({ where }: any) => {
        state.clusters = state.clusters.filter((c) => c.runUuid !== where.runUuid);
        return { count: 0 };
      }),
      create: jest.fn(async ({ data }: any) => {
        state.clusters.push({ ...data });
        return data;
      }),
      findUnique: jest.fn(async ({ where }: any) =>
        state.clusters.find((c) => c.uuid === where.uuid) ?? null,
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const cluster = state.clusters.find((c) => c.uuid === where.uuid);
        Object.assign(cluster, data);
        return cluster;
      }),
      ...overrides.drillGapAnalysis,
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };

  return prisma;
}

describe('AnalysisRepository.createRun', () => {
  it('creates a PENDING run', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);

    const uuid = await repo.createRun('a1', 7);

    expect(typeof uuid).toBe('string');
    expect(prisma.state.runs[0].status).toBe('PENDING');
    expect(prisma.state.runs[0].studentId).toBe(7);
  });

  it('returns the existing run rather than creating a second for one assignment', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);

    const first = await repo.createRun('a1', 7);
    const second = await repo.createRun('a1', 7);

    expect(second).toBe(first);
    expect(prisma.state.runs).toHaveLength(1);
  });
});

describe('AnalysisRepository run states', () => {
  it('records a failure with its message', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);

    await repo.markFailed(uuid, 'upstream 502');

    const run = prisma.state.runs[0];
    expect(run.status).toBe('FAILED');
    expect(run.errorMessage).toBe('upstream 502');
    expect(run.finishedAt).toBeInstanceOf(Date);
  });

  it('keeps NO_ERRORS distinct from READY and from FAILED', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);

    await repo.markNoErrors(uuid);

    expect(prisma.state.runs[0].status).toBe('NO_ERRORS');
    expect(prisma.state.runs[0].errorMessage).toBeNull();
  });

  it('clears a previous error message when a retry succeeds', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);
    await repo.markFailed(uuid, 'upstream 502');

    await repo.markReady(uuid);

    expect(prisma.state.runs[0].status).toBe('READY');
    expect(prisma.state.runs[0].errorMessage).toBeNull();
  });

  it('counts attempts when a run starts', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);

    await repo.markRunning(uuid);
    await repo.markRunning(uuid);

    expect(prisma.state.runs[0].attemptCount).toBe(2);
    expect(prisma.state.runs[0].status).toBe('RUNNING');
  });
});

describe('AnalysisRepository.replaceClusters', () => {
  const cluster = {
    topicSlug: 'en.prepositions-of-movement',
    title: 'Предлоги движения',
    explanation: 'through — сквозь',
    rules: ['through — внутри и наружу'],
    examples: [{ text: 'Walk through the park.', gloss: 'Пройди через парк.' }],
    failedAnswers: [
      { answer: 'through', normalized: 'through', mistakeCount: 3, wrongAttempts: ['across'] },
    ],
  };

  it('writes one row per cluster', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);

    await repo.replaceClusters(uuid, 'a1', 7, 'en', 'ru', [cluster]);

    expect(prisma.state.clusters).toHaveLength(1);
    expect(prisma.state.clusters[0].topicSlug).toBe('en.prepositions-of-movement');
    expect(prisma.state.clusters[0].failedAnswers[0].mistakeCount).toBe(3);
  });

  it('replaces previous clusters so a retry does not duplicate them', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);

    await repo.replaceClusters(uuid, 'a1', 7, 'en', 'ru', [cluster]);
    await repo.replaceClusters(uuid, 'a1', 7, 'en', 'ru', [cluster]);

    expect(prisma.state.clusters).toHaveLength(1);
  });
});

describe('AnalysisRepository.updateCluster', () => {
  it('stamps the editing teacher', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);
    await repo.replaceClusters(uuid, 'a1', 7, 'en', 'ru', [
      {
        topicSlug: 'en.other',
        title: 't',
        explanation: 'e',
        rules: [],
        examples: [],
        failedAnswers: [],
      },
    ]);
    const clusterUuid = prisma.state.clusters[0].uuid;

    await repo.updateCluster(clusterUuid, { explanation: 'better' }, 182);

    expect(prisma.state.clusters[0].explanation).toBe('better');
    expect(prisma.state.clusters[0].editedByTeacherId).toBe(182);
    expect(prisma.state.clusters[0].editedAt).toBeInstanceOf(Date);
  });

  it('leaves fields the patch does not mention untouched', async () => {
    const prisma = prismaStub();
    const repo = new AnalysisRepository(prisma);
    const uuid = await repo.createRun('a1', 7);
    await repo.replaceClusters(uuid, 'a1', 7, 'en', 'ru', [
      {
        topicSlug: 'en.other',
        title: 'original',
        explanation: 'e',
        rules: ['r'],
        examples: [],
        failedAnswers: [],
      },
    ]);
    const clusterUuid = prisma.state.clusters[0].uuid;

    await repo.updateCluster(clusterUuid, { explanation: 'better' }, 182);

    expect(prisma.state.clusters[0].title).toBe('original');
    expect(prisma.state.clusters[0].rules).toEqual(['r']);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd education-service && npx jest src/drills/analysis/analysis.repository.spec.ts`
Expected: FAIL — `Cannot find module './analysis.repository'`.

- [ ] **Step 4: Write the repository**

Create `education-service/src/drills/analysis/analysis.repository.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AnalysisRunRecord,
  AnalysisRunStatus,
  ClusterPatch,
  GapClusterRecord,
  PersistableCluster,
} from './contracts';

/**
 * Persistence for `DrillAnalysisRun` and `DrillGapAnalysis`.
 *
 * The run row exists so a failed analysis is a state rather than an absence. Without it,
 * "no clusters" would mean both "the student made no mistakes" and "the analyzer died" —
 * and the second would render as the first, which is exactly the silent failure this
 * feature must not have.
 */
@Injectable()
export class AnalysisRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The run for one assignment, created if it does not exist.
   *
   * Idempotent because completion can be reached more than once in practice — a retried
   * request, a re-delivered job — and a second run row would orphan the first's clusters.
   */
  async createRun(sourceAssignmentUuid: string, studentId: number): Promise<string> {
    const existing: any = await (this.prisma as any).drillAnalysisRun.findUnique({
      where: { sourceAssignmentUuid },
    });
    if (existing) {
      return existing.uuid as string;
    }

    const uuid = randomUUID();
    await (this.prisma as any).drillAnalysisRun.create({
      data: {
        uuid,
        sourceAssignmentUuid,
        studentId,
        status: 'PENDING' as AnalysisRunStatus,
        attemptCount: 0,
      },
    });
    return uuid;
  }

  /** RUNNING, and one more attempt on the clock. */
  async markRunning(runUuid: string): Promise<void> {
    await (this.prisma as any).drillAnalysisRun.update({
      where: { uuid: runUuid },
      data: {
        status: 'RUNNING' as AnalysisRunStatus,
        startedAt: new Date(),
        finishedAt: null,
        attemptCount: { increment: 1 },
      },
    });
  }

  async markReady(runUuid: string): Promise<void> {
    await this.finish(runUuid, 'READY', null);
  }

  async markNoErrors(runUuid: string): Promise<void> {
    await this.finish(runUuid, 'NO_ERRORS', null);
  }

  async markFailed(runUuid: string, message: string): Promise<void> {
    await this.finish(runUuid, 'FAILED', message);
  }

  /**
   * Writes this run's clusters, replacing any from a previous attempt.
   *
   * Delete-then-create rather than upsert: a retry may produce a different clustering
   * entirely, and leaving the old rows behind would show the student two contradictory
   * explanations of the same mistakes.
   */
  async replaceClusters(
    runUuid: string,
    sourceAssignmentUuid: string,
    studentId: number,
    languageCode: string,
    materialLanguage: string,
    clusters: PersistableCluster[],
  ): Promise<void> {
    await (this.prisma as any).$transaction(async (tx: any) => {
      await tx.drillGapAnalysis.deleteMany({ where: { runUuid } });

      for (const cluster of clusters) {
        await tx.drillGapAnalysis.create({
          data: {
            uuid: randomUUID(),
            runUuid,
            sourceAssignmentUuid,
            studentId,
            topicSlug: cluster.topicSlug,
            languageCode,
            materialLanguage,
            title: cluster.title,
            explanation: cluster.explanation,
            rules: cluster.rules,
            examples: cluster.examples,
            failedAnswers: cluster.failedAnswers,
          },
        });
      }
    });
  }

  /** The run and its clusters, or null when the assignment has never been analyzed. */
  async getRunWithClusters(sourceAssignmentUuid: string): Promise<AnalysisRunRecord | null> {
    const row: any = await (this.prisma as any).drillAnalysisRun.findUnique({
      where: { sourceAssignmentUuid },
      include: { clusters: { orderBy: { topicSlug: 'asc' } } },
    });
    if (!row) {
      return null;
    }

    return {
      uuid: row.uuid,
      sourceAssignmentUuid: row.sourceAssignmentUuid,
      studentId: row.studentId,
      status: row.status as AnalysisRunStatus,
      errorMessage: row.errorMessage ?? null,
      attemptCount: row.attemptCount ?? 0,
      startedAt: row.startedAt ?? null,
      finishedAt: row.finishedAt ?? null,
      clusters: (row.clusters ?? []).map(toClusterRecord),
    };
  }

  async getCluster(uuid: string): Promise<GapClusterRecord | null> {
    const row: any = await (this.prisma as any).drillGapAnalysis.findUnique({ where: { uuid } });
    return row ? toClusterRecord(row) : null;
  }

  /** A teacher's edit. Only the named fields change; the rest keep the model's version. */
  async updateCluster(
    uuid: string,
    patch: ClusterPatch,
    teacherId: number,
  ): Promise<GapClusterRecord> {
    const data: Record<string, unknown> = {
      editedByTeacherId: teacherId,
      editedAt: new Date(),
    };
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.explanation !== undefined) data.explanation = patch.explanation;
    if (patch.rules !== undefined) data.rules = patch.rules;
    if (patch.examples !== undefined) data.examples = patch.examples;

    let row: any;
    try {
      row = await (this.prisma as any).drillGapAnalysis.update({ where: { uuid }, data });
    } catch (error: any) {
      // Prisma signals "no row matched the where clause" as P2025 rather than resolving
      // null, so a `if (!row)` guard here would be dead code and a missing cluster would
      // escape as a raw 500. The teacher-facing PATCH route above this one documents a
      // 404. Any other Prisma error is rethrown untouched.
      if (error?.code === 'P2025') {
        throw new NotFoundException('Gap analysis not found');
      }
      throw error;
    }
    return toClusterRecord(row);
  }

  private async finish(
    runUuid: string,
    status: AnalysisRunStatus,
    errorMessage: string | null,
  ): Promise<void> {
    await (this.prisma as any).drillAnalysisRun.update({
      where: { uuid: runUuid },
      data: { status, errorMessage, finishedAt: new Date() },
    });
  }
}

function toClusterRecord(row: any): GapClusterRecord {
  return {
    uuid: row.uuid,
    runUuid: row.runUuid,
    sourceAssignmentUuid: row.sourceAssignmentUuid,
    studentId: row.studentId,
    topicSlug: row.topicSlug,
    languageCode: row.languageCode,
    materialLanguage: row.materialLanguage,
    title: row.title,
    explanation: row.explanation,
    rules: Array.isArray(row.rules) ? row.rules : [],
    examples: Array.isArray(row.examples) ? row.examples : [],
    failedAnswers: Array.isArray(row.failedAnswers) ? row.failedAnswers : [],
    editedByTeacherId: row.editedByTeacherId ?? null,
    editedAt: row.editedAt ?? null,
    createdAt: row.createdAt,
  };
}
```

Note the test's `attemptCount: { increment: 1 }` — the stub's `Object.assign` will not evaluate it. Make the stub's `update` handle it:

```ts
      update: jest.fn(async ({ where, data }: any) => {
        const run = state.runs.find((r) => r.uuid === where.uuid);
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in (value as any)) {
            run[key] = (run[key] ?? 0) + (value as any).increment;
          } else {
            run[key] = value;
          }
        }
        return run;
      }),
```

Apply that to the stub in Step 2 before running.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd education-service && npx jest src/drills/analysis/analysis.repository.spec.ts`
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add education-service/src/drills/analysis/analysis.repository.ts \
        education-service/src/drills/analysis/analysis.repository.spec.ts \
        education-service/src/drills/analysis/contracts.ts
git commit -m "feat(drills): persistence for analysis runs and gap clusters"
```

---

### Task 9: AnalysisService — the job

**Files:**
- Create: `education-service/src/drills/analysis/analysis.service.ts`
- Test: `education-service/src/drills/analysis/analysis.service.spec.ts`

**Interfaces:**
- Consumes: `AnalysisRepository`, `AnalysisClient`, `TaxonomyService`, `PrismaService`, `extractFailedBlanks`, `normalizeAnswer`/`gradingOptionsFor`
- Produces:
  - `class AnalysisService`
  - `run(sourceAssignmentUuid: string, correlationId: string): Promise<void>` — never throws; every failure lands on the run row

- [ ] **Step 1: Write the failing test**

Create `education-service/src/drills/analysis/analysis.service.spec.ts`:

```ts
import { AnalysisService } from './analysis.service';

const assignment = {
  uuid: 'a1',
  studentId: 7,
  languageCode: 'en',
  materialLanguage: 'ru',
  items: [
    {
      uuid: 'i1',
      order: 0,
      template: 'We will have to walk {{0}} this market.',
      blanks: [{ index: 0, answer: 'through', prompt: 'через' }],
    },
    {
      uuid: 'i2',
      order: 1,
      template: 'Get {{0}} your car immediately!',
      blanks: [{ index: 0, answer: 'out of', prompt: 'из' }],
    },
  ],
};

const attempts = [
  { itemUuid: 'i1', blankIndex: 0, submittedValue: 'across', isCorrect: false, revealed: false, attemptNo: 1 },
  { itemUuid: 'i2', blankIndex: 0, submittedValue: 'out', isCorrect: false, revealed: false, attemptNo: 1 },
];

function deps(overrides: Record<string, any> = {}) {
  const repo = {
    createRun: jest.fn(async () => 'run-1'),
    markRunning: jest.fn(async () => undefined),
    markReady: jest.fn(async () => undefined),
    markNoErrors: jest.fn(async () => undefined),
    markFailed: jest.fn(async () => undefined),
    replaceClusters: jest.fn(async () => undefined),
    ...overrides.repo,
  };

  const client = {
    analyze: jest.fn(async () => ({
      clusters: [
        {
          topicSlug: 'en.prepositions-of-movement',
          title: 'Предлоги движения',
          explanation: 'through — сквозь',
          rules: [],
          examples: [],
          answers: ['through', 'out of'],
        },
      ],
    })),
    ...overrides.client,
  };

  const taxonomy = {
    slugsFor: jest.fn(async () => ['en.prepositions-of-movement', 'en.other']),
    fallbackSlug: (lang: string) => `${lang}.other`,
    coerceSlug: (candidate: string, allowed: string[], lang: string) =>
      allowed.includes(candidate)
        ? { slug: candidate, coerced: false }
        : { slug: `${lang}.other`, coerced: true },
    ...overrides.taxonomy,
  };

  const prisma: any = {
    drillAssignment: {
      findUnique: jest.fn(async () => overrides.assignment ?? assignment),
    },
    drillAttempt: {
      findMany: jest.fn(async () => overrides.attempts ?? attempts),
    },
  };

  return { repo, client, taxonomy, prisma };
}

describe('AnalysisService.run', () => {
  it('marks the run NO_ERRORS and never calls the model when nothing was wrong', async () => {
    const d = deps({ attempts: [
      { itemUuid: 'i1', blankIndex: 0, submittedValue: 'through', isCorrect: true, revealed: false, attemptNo: 1 },
    ] });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    expect(d.repo.markNoErrors).toHaveBeenCalledWith('run-1');
    expect(d.client.analyze).not.toHaveBeenCalled();
    expect(d.repo.markFailed).not.toHaveBeenCalled();
  });

  it('sends every failed blank to the analyzer with the allowed slugs', async () => {
    const d = deps();
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    const sent = d.client.analyze.mock.calls[0][0];
    expect(sent.failures).toHaveLength(2);
    expect(sent.allowedTopicSlugs).toEqual(['en.prepositions-of-movement', 'en.other']);
    expect(sent.materialLanguage).toBe('ru');
    expect(sent.correlationId).toBe('cid-1');
  });

  it('persists the clusters and marks the run READY', async () => {
    const d = deps();
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    expect(d.repo.replaceClusters).toHaveBeenCalled();
    const clusters = d.repo.replaceClusters.mock.calls[0][5];
    expect(clusters).toHaveLength(1);
    expect(clusters[0].failedAnswers.map((a: any) => a.answer).sort()).toEqual(['out of', 'through']);
    expect(d.repo.markReady).toHaveBeenCalledWith('run-1');
  });

  it('coerces an out-of-taxonomy slug to the language fallback', async () => {
    const d = deps({
      client: {
        analyze: jest.fn(async () => ({
          clusters: [
            { topicSlug: 'en.invented', title: 't', explanation: 'e', rules: [], examples: [], answers: ['through', 'out of'] },
          ],
        })),
      },
    });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    expect(d.repo.replaceClusters.mock.calls[0][5][0].topicSlug).toBe('en.other');
  });

  it('files an answer no cluster claimed under the fallback rather than dropping it', async () => {
    const d = deps({
      client: {
        analyze: jest.fn(async () => ({
          clusters: [
            { topicSlug: 'en.prepositions-of-movement', title: 't', explanation: 'e', rules: [], examples: [], answers: ['through'] },
          ],
        })),
      },
    });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    const clusters = d.repo.replaceClusters.mock.calls[0][5];
    const answers = clusters.flatMap((c: any) => c.failedAnswers.map((a: any) => a.answer));
    expect(answers.sort()).toEqual(['out of', 'through']);
    expect(clusters.some((c: any) => c.topicSlug === 'en.other')).toBe(true);
  });

  it('never puts one answer in two clusters', async () => {
    const d = deps({
      client: {
        analyze: jest.fn(async () => ({
          clusters: [
            { topicSlug: 'en.prepositions-of-movement', title: 't', explanation: 'e', rules: [], examples: [], answers: ['through', 'out of'] },
            { topicSlug: 'en.other', title: 't2', explanation: 'e2', rules: [], examples: [], answers: ['through'] },
          ],
        })),
      },
    });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    const clusters = d.repo.replaceClusters.mock.calls[0][5];
    const answers = clusters.flatMap((c: any) => c.failedAnswers.map((a: any) => a.answer));
    expect(answers).toHaveLength(new Set(answers).size);
  });

  it('drops a cluster left with no answers after attribution', async () => {
    const d = deps({
      client: {
        analyze: jest.fn(async () => ({
          clusters: [
            { topicSlug: 'en.prepositions-of-movement', title: 't', explanation: 'e', rules: [], examples: [], answers: ['through', 'out of'] },
            { topicSlug: 'en.other', title: 'empty', explanation: 'e', rules: [], examples: [], answers: ['not-a-real-answer'] },
          ],
        })),
      },
    });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    const clusters = d.repo.replaceClusters.mock.calls[0][5];
    expect(clusters.every((c: any) => c.failedAnswers.length > 0)).toBe(true);
  });

  it('marks the run FAILED when the analyzer throws, and does not throw itself', async () => {
    const d = deps({ client: { analyze: jest.fn(async () => { throw new Error('502 Bad Gateway'); }) } });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await expect(service.run('a1', 'cid-1')).resolves.toBeUndefined();

    expect(d.repo.markFailed).toHaveBeenCalledWith('run-1', expect.stringContaining('502'));
    expect(d.repo.markReady).not.toHaveBeenCalled();
  });

  it('marks the run FAILED when the taxonomy is missing for the language', async () => {
    const d = deps({
      taxonomy: { slugsFor: jest.fn(async () => { throw new Error('No grammar taxonomy seeded for language "fr"'); }) },
    });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    expect(d.repo.markFailed).toHaveBeenCalledWith('run-1', expect.stringContaining('taxonomy'));
  });

  // No run row can exist for an assignment that is gone: createRun needs its studentId,
  // and DrillAnalysisRun.studentId is a required column. The failure is visible in the
  // error log rather than on a row — this is the one path with nothing to mark. The
  // `resolves` assertion is load-bearing: run() must not throw even here, or the
  // fire-and-forget job runner takes the process down.
  it('logs and gives up when the assignment has vanished, without creating a run row', async () => {
    const d = deps();
    d.prisma.drillAssignment.findUnique = jest.fn(async () => null);
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await expect(service.run('a1', 'cid-1')).resolves.toBeUndefined();

    expect(d.repo.createRun).not.toHaveBeenCalled();
    expect(d.repo.markFailed).not.toHaveBeenCalled();
    expect(d.client.analyze).not.toHaveBeenCalled();
  });

  it('marks RUNNING before calling the analyzer', async () => {
    const d = deps();
    const order: string[] = [];
    d.repo.markRunning = jest.fn(async () => { order.push('running'); });
    d.client.analyze = jest.fn(async () => { order.push('analyze'); return { clusters: [] }; });
    const service = new AnalysisService(d.prisma, d.repo as any, d.client as any, d.taxonomy as any);

    await service.run('a1', 'cid-1');

    expect(order).toEqual(['running', 'analyze']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd education-service && npx jest src/drills/analysis/analysis.service.spec.ts`
Expected: FAIL — `Cannot find module './analysis.service'`.

- [ ] **Step 3: Write the service**

Create `education-service/src/drills/analysis/analysis.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { gradingOptionsFor, normalizeAnswer } from '../grading';
import { AnalysisClient } from './analysis.client';
import { AnalysisRepository } from './analysis.repository';
import {
  AnalyzedGapCluster,
  FailedBlank,
  PersistableCluster,
  PersistedFailedAnswer,
} from './contracts';
import { extractFailedBlanks } from './failed-blanks';
import { TaxonomyService } from './taxonomy';

/**
 * Turns one completed assignment's mistakes into grammar gap clusters.
 *
 * **Never throws.** It is called from a fire-and-forget job runner where an unhandled
 * rejection takes the process down, and where a thrown error would leave the run row
 * PENDING forever with nothing to show the student. Every failure path ends at
 * `markFailed`, which is a state the UI renders and the teacher can retry.
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: AnalysisRepository,
    private readonly client: AnalysisClient,
    private readonly taxonomy: TaxonomyService,
  ) {}

  async run(sourceAssignmentUuid: string, correlationId: string): Promise<void> {
    const started = Date.now();
    let runUuid: string | null = null;

    try {
      const assignment: any = await (this.prisma as any).drillAssignment.findUnique({
        where: { uuid: sourceAssignmentUuid },
        include: { items: { orderBy: { order: 'asc' } } },
      });

      if (!assignment) {
        throw new Error(`Assignment ${sourceAssignmentUuid} not found`);
      }

      runUuid = await this.repo.createRun(sourceAssignmentUuid, assignment.studentId);
      await this.repo.markRunning(runUuid);

      const attempts: any[] = await (this.prisma as any).drillAttempt.findMany({
        where: { assignmentUuid: sourceAssignmentUuid },
        orderBy: { attemptNo: 'asc' },
      });

      const failed = extractFailedBlanks(assignment.items ?? [], attempts);

      if (failed.length === 0) {
        await this.repo.markNoErrors(runUuid);
        this.logger.log(
          `Analysis: assignment=${sourceAssignmentUuid} no errors, no model call (correlationId=${correlationId})`,
        );
        return;
      }

      const allowed = await this.taxonomy.slugsFor(assignment.languageCode);

      const response = await this.client.analyze({
        languageCode: assignment.languageCode,
        materialLanguage: assignment.materialLanguage,
        level: assignment.level ?? null,
        allowedTopicSlugs: allowed,
        failures: failed.map((blank) => ({
          answer: blank.answer,
          sentence: blank.sentence,
          prompt: blank.prompt,
          wrongAttempts: blank.wrongAttempts,
          revealed: blank.revealed,
          mistakeCount: blank.mistakeCount,
        })),
        correlationId,
      });

      const clusters = this.attribute(
        response.clusters ?? [],
        failed,
        allowed,
        assignment.languageCode,
      );

      await this.repo.replaceClusters(
        runUuid,
        sourceAssignmentUuid,
        assignment.studentId,
        assignment.languageCode,
        assignment.materialLanguage,
        clusters,
      );
      await this.repo.markReady(runUuid);

      this.logger.log(
        `Analysis ready: assignment=${sourceAssignmentUuid} failures=${failed.length} clusters=${clusters.length} ms=${Date.now() - started} correlationId=${correlationId}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Analysis failed: assignment=${sourceAssignmentUuid} correlationId=${correlationId} — ${message}`,
      );

      if (runUuid) {
        try {
          await this.repo.markFailed(runUuid, message);
        } catch (writeError) {
          // The run row cannot even record its own failure. Nothing further can be done
          // here, but it must not be invisible: without this line the analysis simply
          // stops with the row stuck on RUNNING and no explanation anywhere.
          this.logger.error(
            `Analysis failure could not be recorded: assignment=${sourceAssignmentUuid} — ${
              writeError instanceof Error ? writeError.message : String(writeError)
            }`,
          );
        }
      }
    }
  }

  /**
   * Attaches each failed answer to exactly one cluster.
   *
   * The model is asked to cover every answer exactly once and usually does, but a
   * generated list is not a guarantee. Three rules make the result trustworthy regardless:
   * an answer claimed twice goes to the first claimant, an answer claimed by nobody goes
   * to the language fallback, and a cluster left holding nothing is dropped.
   *
   * Without the second rule a dropped answer would silently never be drilled again — the
   * exact gap this feature exists to close.
   */
  private attribute(
    raw: AnalyzedGapCluster[],
    failed: FailedBlank[],
    allowed: string[],
    languageCode: string,
  ): PersistableCluster[] {
    const options = gradingOptionsFor(languageCode);

    // Failed blanks collapsed per answer: the same word wrong in two sentences is one
    // entry whose mistakeCount is the sum, because it earns that many remedial sentences.
    const byNormalized = new Map<string, PersistedFailedAnswer>();
    for (const blank of failed) {
      const normalized = normalizeAnswer(blank.answer, options);
      const existing = byNormalized.get(normalized);
      if (existing) {
        existing.mistakeCount += blank.mistakeCount;
        existing.wrongAttempts.push(...blank.wrongAttempts);
      } else {
        byNormalized.set(normalized, {
          answer: blank.answer,
          normalized,
          mistakeCount: blank.mistakeCount,
          wrongAttempts: [...blank.wrongAttempts],
        });
      }
    }

    const unclaimed = new Set(byNormalized.keys());
    const clusters: PersistableCluster[] = [];

    for (const candidate of raw) {
      const { slug, coerced } = this.taxonomy.coerceSlug(candidate.topicSlug, allowed, languageCode);
      if (coerced) {
        this.logger.warn(
          `Analysis produced an out-of-taxonomy slug "${candidate.topicSlug}" for ${languageCode}; filed under ${slug}`,
        );
      }

      const claimed: PersistedFailedAnswer[] = [];
      for (const answer of candidate.answers ?? []) {
        const normalized = normalizeAnswer(answer, options);
        if (!unclaimed.has(normalized)) {
          continue;
        }
        unclaimed.delete(normalized);
        claimed.push(byNormalized.get(normalized)!);
      }

      if (claimed.length === 0) {
        // Nothing left for it after de-duplication. Storing it would show the student an
        // explanation with no mistakes attached.
        continue;
      }

      clusters.push({
        topicSlug: slug,
        title: candidate.title,
        explanation: candidate.explanation,
        rules: candidate.rules ?? [],
        examples: candidate.examples ?? [],
        failedAnswers: claimed,
      });
    }

    if (unclaimed.size > 0) {
      const leftovers = [...unclaimed].map((key) => byNormalized.get(key)!);
      this.logger.warn(
        `Analysis left ${leftovers.length} answer(s) unclustered; filing under the fallback topic: ${leftovers
          .map((a) => a.answer)
          .join(', ')}`,
      );

      const fallbackSlug = this.taxonomy.fallbackSlug(languageCode);
      const existing = clusters.find((c) => c.topicSlug === fallbackSlug);
      if (existing) {
        existing.failedAnswers.push(...leftovers);
      } else {
        clusters.push({
          topicSlug: fallbackSlug,
          title: '',
          explanation: '',
          rules: [],
          examples: [],
          failedAnswers: leftovers,
        });
      }
    }

    return clusters;
  }
}
```

A fallback cluster created for leftovers carries an empty `title` and `explanation` — there is no model text for it. Task 15's `GapCard` renders the taxonomy title in that case; Step 4 of Task 15 covers it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd education-service && npx jest src/drills/analysis/analysis.service.spec.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Verify the never-throws guarantee can fail**

Temporarily remove the `try`/`catch`, re-run, and confirm the "marks the run FAILED when the analyzer throws" test fails with an unhandled rejection. Restore it.

- [ ] **Step 6: Commit**

```bash
git add education-service/src/drills/analysis/analysis.service.ts \
        education-service/src/drills/analysis/analysis.service.spec.ts
git commit -m "feat(drills): cluster drill mistakes into grammar gaps with explanations"
```

---

### Task 10: Analysis job runner and the completion hook

**Files:**
- Create: `education-service/src/drills/analysis/analysis.job-runner.ts`
- Test: `education-service/src/drills/analysis/analysis.job-runner.spec.ts`
- Modify: `education-service/src/drills/runner/runner.service.ts:232-261`
- Test: `education-service/src/drills/runner/runner.service.spec.ts` (append)

**Interfaces:**
- Consumes: `AnalysisService`, `MasteryRepository`, `computeMasteryDeltas`
- Produces:
  - `class AnalysisJobRunner` with `enqueue(sourceAssignmentUuid: string): void`
  - `interface DrillCompletionAnalyzer { onCompleted(assignmentUuid: string): Promise<void> }` — the port `RunnerService` depends on

- [ ] **Step 1: Write the failing job-runner test**

Create `education-service/src/drills/analysis/analysis.job-runner.spec.ts`:

```ts
import { AnalysisJobRunner } from './analysis.job-runner';

describe('AnalysisJobRunner.enqueue', () => {
  it('returns before the analysis finishes', async () => {
    let resolveRun: () => void = () => undefined;
    const analysis = {
      run: jest.fn(() => new Promise<void>((resolve) => { resolveRun = resolve; })),
    };
    const runner = new AnalysisJobRunner(analysis as any);

    runner.enqueue('a1');

    expect(analysis.run).toHaveBeenCalled();
    resolveRun();
  });

  it('does not reject when the analysis throws — an unhandled rejection kills the process', async () => {
    const analysis = { run: jest.fn(async () => { throw new Error('boom'); }) };
    const runner = new AnalysisJobRunner(analysis as any);

    const unhandled = jest.fn();
    process.once('unhandledRejection', unhandled);

    runner.enqueue('a1');
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(unhandled).not.toHaveBeenCalled();
    process.removeListener('unhandledRejection', unhandled);
  });

  it('passes a correlation id through to the analysis', () => {
    const analysis = { run: jest.fn(async () => undefined) };
    new AnalysisJobRunner(analysis as any).enqueue('a1');

    expect(analysis.run).toHaveBeenCalledWith('a1', expect.any(String));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd education-service && npx jest src/drills/analysis/analysis.job-runner.spec.ts`
Expected: FAIL — `Cannot find module './analysis.job-runner'`.

- [ ] **Step 3: Write the job runner**

Create `education-service/src/drills/analysis/analysis.job-runner.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AnalysisService } from './analysis.service';

/**
 * Fire-and-forget runner for the analysis pipeline.
 *
 * `enqueue` returns immediately: it is called from the student's last answer request, and
 * a model call there would hold that request open for a minute.
 *
 * Nothing awaits the detached promise, so it must never reject — an unhandled rejection
 * takes the process down. `AnalysisService.run` already swallows its own failures onto the
 * run row; the catch here is the second belt, for anything thrown before that.
 */
@Injectable()
export class AnalysisJobRunner {
  private readonly logger = new Logger(AnalysisJobRunner.name);

  constructor(private readonly analysis: AnalysisService) {}

  enqueue(sourceAssignmentUuid: string): void {
    const correlationId = randomUUID();
    void this.analysis.run(sourceAssignmentUuid, correlationId).catch((error) => {
      this.logger.error(
        `Analysis job rejected: assignment=${sourceAssignmentUuid} correlationId=${correlationId} — ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd education-service && npx jest src/drills/analysis/analysis.job-runner.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the failing completion-hook test**

Append to `education-service/src/drills/runner/runner.service.spec.ts`, matching the existing stub construction in that file:

```ts
describe('RunnerService.check — completion analysis hook', () => {
  it('updates word mastery and enqueues the analysis when the assignment completes', async () => {
    const analyzer = { onCompleted: jest.fn(async () => undefined) };
    const service = buildServiceThatCompletesOnNextCheck({ analyzer });

    await service.check('a1', 7, { itemUuid: 'i1', blankIndex: 0, value: 'behind' });

    expect(analyzer.onCompleted).toHaveBeenCalledWith('a1');
  });

  it('does not enqueue the analysis while the assignment is still in progress', async () => {
    const analyzer = { onCompleted: jest.fn(async () => undefined) };
    const service = buildServiceWithBlanksRemaining({ analyzer });

    await service.check('a1', 7, { itemUuid: 'i1', blankIndex: 0, value: 'behind' });

    expect(analyzer.onCompleted).not.toHaveBeenCalled();
  });

  it('still completes the assignment when the analysis hook throws', async () => {
    const analyzer = { onCompleted: jest.fn(async () => { throw new Error('analysis down'); }) };
    const service = buildServiceThatCompletesOnNextCheck({ analyzer });

    const result = await service.check('a1', 7, { itemUuid: 'i1', blankIndex: 0, value: 'behind' });

    expect(result.assignmentCompleted).toBe(true);
  });
});
```

Write `buildServiceThatCompletesOnNextCheck` and `buildServiceWithBlanksRemaining` as local helpers in that file, reusing the Prisma and `AssignmentsRepository` stubs the existing tests already build. Read the existing `describe('RunnerService.check')` block first and follow its stub shape exactly — do not invent a second stub style.

- [ ] **Step 6: Run it to verify it fails**

Run: `cd education-service && npx jest src/drills/runner/runner.service.spec.ts -t "completion analysis hook"`
Expected: FAIL — the analyzer is never called.

- [ ] **Step 7: Add the port and the call to `RunnerService`**

In `education-service/src/drills/runner/runner.service.ts`, beside the existing `DrillCompletionNotifier` interface:

```ts
/**
 * The analysis side of completion, as a port.
 *
 * Declared here rather than importing `AnalysisJobRunner` directly so the runner keeps no
 * dependency on the analysis module's internals, and so the completion path can be tested
 * without it.
 */
export interface DrillCompletionAnalyzer {
  onCompleted(assignmentUuid: string): Promise<void>;
}
```

Add it to the constructor as an optional injected dependency, exactly as `notifications` already is.

Inside the `if (completed)` block, **after** the status write and beside the existing notification call:

```ts
      // After the completion write, never before: the analysis reads the assignment's
      // final state. Wrapped for the same reason as the notification below it — the
      // student's last answer must not 500 because the analyzer is down, and the
      // completion stands either way. The failure is logged, never swallowed silently.
      if (this.analyzer) {
        try {
          await this.analyzer.onCompleted(assignmentUuid);
        } catch (error) {
          this.logger.error(
            `Completion analysis could not be started for assignment ${assignmentUuid}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
```

- [ ] **Step 8: Write the completion adapter**

Append to `education-service/src/drills/analysis/analysis.job-runner.ts`:

```ts
/**
 * What `RunnerService` calls when an assignment completes.
 *
 * Two things happen, in this order and deliberately not merged:
 *
 * 1. **Mastery, synchronously.** The streak is a fact about what the student did, and it
 *    must be recorded whether or not any model is reachable. Doing it inside the analysis
 *    job would make a correct answer's credit depend on ai-microservice being up.
 * 2. **Analysis, fire-and-forget.** A model call the student's request must not wait for.
 */
@Injectable()
export class CompletionAnalysisAdapter {
  private readonly logger = new Logger(CompletionAnalysisAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryRepository,
    private readonly jobs: AnalysisJobRunner,
  ) {}

  async onCompleted(assignmentUuid: string): Promise<void> {
    const assignment: any = await (this.prisma as any).drillAssignment.findUnique({
      where: { uuid: assignmentUuid },
      include: { items: { orderBy: { order: 'asc' } } },
    });

    if (!assignment) {
      throw new Error(`Assignment ${assignmentUuid} vanished before completion analysis`);
    }

    const attempts: any[] = await (this.prisma as any).drillAttempt.findMany({
      where: { assignmentUuid },
      orderBy: { attemptNo: 'asc' },
    });

    const deltas = computeMasteryDeltas(
      assignment.items ?? [],
      attempts,
      assignment.languageCode,
    );
    await this.mastery.applyDeltas(
      assignment.studentId,
      assignment.languageCode,
      deltas,
      new Date(),
    );

    this.jobs.enqueue(assignmentUuid);
  }
}
```

Add the imports it needs at the top of the file: `PrismaService`, `MasteryRepository`, `computeMasteryDeltas`.

- [ ] **Step 9: Write the adapter test**

Append to `education-service/src/drills/analysis/analysis.job-runner.spec.ts`:

```ts
describe('CompletionAnalysisAdapter.onCompleted', () => {
  const assignment = {
    uuid: 'a1',
    studentId: 7,
    languageCode: 'en',
    items: [{ uuid: 'i1', order: 0, template: 'x {{0}}', blanks: [{ index: 0, answer: 'behind' }] }],
  };

  function deps() {
    return {
      prisma: {
        drillAssignment: { findUnique: jest.fn(async () => assignment) },
        drillAttempt: {
          findMany: jest.fn(async () => [
            { itemUuid: 'i1', blankIndex: 0, submittedValue: 'behind', isCorrect: true, revealed: false, attemptNo: 1 },
          ]),
        },
      } as any,
      mastery: { applyDeltas: jest.fn(async () => undefined) },
      jobs: { enqueue: jest.fn() },
    };
  }

  it('records mastery before enqueueing the analysis', async () => {
    const d = deps();
    const order: string[] = [];
    d.mastery.applyDeltas = jest.fn(async () => { order.push('mastery'); });
    d.jobs.enqueue = jest.fn(() => { order.push('enqueue'); });

    await new CompletionAnalysisAdapter(d.prisma, d.mastery as any, d.jobs as any).onCompleted('a1');

    expect(order).toEqual(['mastery', 'enqueue']);
  });

  it('passes the clean delta through to the mastery repository', async () => {
    const d = deps();

    await new CompletionAnalysisAdapter(d.prisma, d.mastery as any, d.jobs as any).onCompleted('a1');

    expect(d.mastery.applyDeltas).toHaveBeenCalledWith(
      7,
      'en',
      [{ normalizedAnswer: 'behind', displayAnswer: 'behind', clean: true, mistakes: 0 }],
      expect.any(Date),
    );
  });

  it('raises when the assignment is gone rather than silently doing nothing', async () => {
    const d = deps();
    d.prisma.drillAssignment.findUnique = jest.fn(async () => null);

    await expect(
      new CompletionAnalysisAdapter(d.prisma, d.mastery as any, d.jobs as any).onCompleted('a1'),
    ).rejects.toThrow(/vanished/);
  });
});
```

- [ ] **Step 10: Run every test touched by this task**

Run: `cd education-service && npx jest src/drills/analysis src/drills/runner/runner.service.spec.ts`
Expected: all PASS.

- [ ] **Step 11: Commit**

```bash
git add education-service/src/drills/analysis/analysis.job-runner.ts \
        education-service/src/drills/analysis/analysis.job-runner.spec.ts \
        education-service/src/drills/runner/runner.service.ts \
        education-service/src/drills/runner/runner.service.spec.ts
git commit -m "feat(drills): record mastery and start error analysis on drill completion"
```

---

### Task 11: Remedial composition (pure)

This is the task the whole feature's behaviour rests on. Every rule the owner specified —
`repeats = mistakeCount`, 100% error words, the 10-sentence minimum, the 20-sentence cap,
mastered-word exclusion — is decided here and nowhere else.

**Files:**
- Create: `education-service/src/drills/analysis/remedial-composition.ts`
- Test: `education-service/src/drills/analysis/remedial-composition.spec.ts`

**Interfaces:**
- Consumes: `PersistedFailedAnswer` from `./contracts`
- Produces:
  - `const MIN_REMEDIAL_SENTENCES = 10`
  - `const MAX_REMEDIAL_SENTENCES = 20`
  - `interface RemedialPart { part: number; totalParts: number; sentenceCount: number; requiredAnswers: Array<{ answer: string; normalized: string; occurrences: number }>; paddingCount: number }`
  - `function composeRemedial(answers: PersistedFailedAnswer[], masteredNormalized: Set<string>): RemedialPart[]`

- [ ] **Step 1: Write the failing test**

Create `education-service/src/drills/analysis/remedial-composition.spec.ts`:

```ts
import {
  MAX_REMEDIAL_SENTENCES,
  MIN_REMEDIAL_SENTENCES,
  composeRemedial,
} from './remedial-composition';

const answer = (text: string, mistakeCount: number) => ({
  answer: text,
  normalized: text,
  mistakeCount,
  wrongAttempts: [],
});

const totalOccurrences = (parts: ReturnType<typeof composeRemedial>, normalized: string) =>
  parts.reduce(
    (sum, part) =>
      sum + (part.requiredAnswers.find((a) => a.normalized === normalized)?.occurrences ?? 0),
    0,
  );

describe('composeRemedial — repetitions', () => {
  it('gives a word wrong once exactly one sentence', () => {
    const [part] = composeRemedial([answer('behind', 1)], new Set());

    expect(totalOccurrences([part], 'behind')).toBe(1);
  });

  it('gives a word wrong three times exactly three sentences', () => {
    const [part] = composeRemedial([answer('through', 3)], new Set());

    expect(totalOccurrences([part], 'through')).toBe(3);
  });

  it('applies no floor — a single mistake is not padded up to two', () => {
    const [part] = composeRemedial([answer('behind', 1)], new Set());

    expect(part.requiredAnswers.find((a) => a.normalized === 'behind')!.occurrences).toBe(1);
  });

  it('applies no cap — a word wrong six times gets six sentences', () => {
    const [part] = composeRemedial([answer('through', 6)], new Set());

    expect(totalOccurrences([part], 'through')).toBe(6);
  });
});

describe('composeRemedial — the ten-sentence minimum', () => {
  it('pads a short gap up to ten sentences without repeating the error words', () => {
    const [part] = composeRemedial([answer('behind', 1), answer('through', 2)], new Set());

    expect(part.sentenceCount).toBe(MIN_REMEDIAL_SENTENCES);
    expect(part.paddingCount).toBe(7);
    expect(totalOccurrences([part], 'behind')).toBe(1);
    expect(totalOccurrences([part], 'through')).toBe(2);
  });

  it('adds no padding when the errors already fill ten sentences', () => {
    const [part] = composeRemedial([answer('through', 6), answer('behind', 4)], new Set());

    expect(part.sentenceCount).toBe(10);
    expect(part.paddingCount).toBe(0);
  });

  it('adds no padding above the minimum', () => {
    const [part] = composeRemedial([answer('through', 12)], new Set());

    expect(part.sentenceCount).toBe(12);
    expect(part.paddingCount).toBe(0);
  });
});

describe('composeRemedial — splitting', () => {
  it('keeps a gap of twenty in one assignment', () => {
    const parts = composeRemedial([answer('through', 20)], new Set());

    expect(parts).toHaveLength(1);
    expect(parts[0].sentenceCount).toBe(MAX_REMEDIAL_SENTENCES);
    expect(parts[0].totalParts).toBe(1);
  });

  it('splits twenty-five into two parts', () => {
    const parts = composeRemedial([answer('through', 25)], new Set());

    expect(parts).toHaveLength(2);
    expect(parts.every((p) => p.sentenceCount <= MAX_REMEDIAL_SENTENCES)).toBe(true);
    expect(totalOccurrences(parts, 'through')).toBe(25);
  });

  it('numbers the parts from one and reports the total on each', () => {
    const parts = composeRemedial([answer('through', 25)], new Set());

    expect(parts.map((p) => p.part)).toEqual([1, 2]);
    expect(parts.every((p) => p.totalParts === 2)).toBe(true);
  });

  it('spreads one answer across parts rather than concentrating it', () => {
    const parts = composeRemedial(
      [answer('through', 15), answer('behind', 15)],
      new Set(),
    );

    expect(parts).toHaveLength(2);
    for (const part of parts) {
      expect(part.requiredAnswers.length).toBeGreaterThan(1);
    }
  });

  it('never leaves a part below the minimum by splitting badly', () => {
    const parts = composeRemedial([answer('through', 21)], new Set());

    for (const part of parts) {
      expect(part.sentenceCount).toBeGreaterThanOrEqual(MIN_REMEDIAL_SENTENCES);
    }
    expect(totalOccurrences(parts, 'through')).toBe(21);
  });

  it('preserves every occurrence across a three-part split', () => {
    const parts = composeRemedial(
      [answer('a', 20), answer('b', 20), answer('c', 15)],
      new Set(),
    );

    expect(totalOccurrences(parts, 'a')).toBe(20);
    expect(totalOccurrences(parts, 'b')).toBe(20);
    expect(totalOccurrences(parts, 'c')).toBe(15);
    expect(parts.every((p) => p.sentenceCount <= MAX_REMEDIAL_SENTENCES)).toBe(true);
  });
});

describe('composeRemedial — mastered words', () => {
  it('excludes a word the student has already mastered', () => {
    const parts = composeRemedial(
      [answer('behind', 2), answer('through', 3)],
      new Set(['behind']),
    );

    expect(totalOccurrences(parts, 'behind')).toBe(0);
    expect(totalOccurrences(parts, 'through')).toBe(3);
  });

  it('returns nothing when every word in the gap is mastered', () => {
    const parts = composeRemedial(
      [answer('behind', 2), answer('through', 3)],
      new Set(['behind', 'through']),
    );

    expect(parts).toEqual([]);
  });

  it('returns nothing for an empty answer list', () => {
    expect(composeRemedial([], new Set())).toEqual([]);
  });
});

describe('composeRemedial — sanity', () => {
  it('never emits a sentence count below the required occurrences in that part', () => {
    const parts = composeRemedial([answer('a', 7), answer('b', 9)], new Set());

    for (const part of parts) {
      const required = part.requiredAnswers.reduce((sum, a) => sum + a.occurrences, 0);
      expect(part.sentenceCount).toBeGreaterThanOrEqual(required);
      expect(part.sentenceCount).toBe(required + part.paddingCount);
    }
  });

  it('ignores an answer whose mistake count is zero', () => {
    const parts = composeRemedial([answer('behind', 0), answer('through', 2)], new Set());

    expect(totalOccurrences(parts, 'behind')).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd education-service && npx jest src/drills/analysis/remedial-composition.spec.ts`
Expected: FAIL — `Cannot find module './remedial-composition'`.

- [ ] **Step 3: Write the implementation**

Create `education-service/src/drills/analysis/remedial-composition.ts`:

```ts
import { PersistedFailedAnswer } from './contracts';

/**
 * The floor on assignment length.
 *
 * A three-sentence drill is not an assignment; it is a flashcard. Below this the gap is
 * padded with NEW sentences on the same grammar topic (different vocabulary), which tests
 * the rule the student broke rather than their memory of three specific words.
 */
export const MIN_REMEDIAL_SENTENCES = 10;

/**
 * The ceiling.
 *
 * Twenty sentences is roughly ten to fifteen minutes. Beyond that the drill stops being
 * something a student finishes in one sitting, so the gap splits into parts instead.
 */
export const MAX_REMEDIAL_SENTENCES = 20;

export interface RemedialPart {
  /** 1-based. */
  part: number;
  totalParts: number;
  /** Required occurrences plus padding. */
  sentenceCount: number;
  requiredAnswers: Array<{ answer: string; normalized: string; occurrences: number }>;
  /** Sentences on the same topic with different vocabulary. */
  paddingCount: number;
}

/**
 * Plans the remedial drill for one grammar gap.
 *
 * The rules, all decided here:
 *
 * - **`occurrences = mistakeCount`**, strictly. A word missed once earns one sentence; a
 *   word missed six times earns six. No floor and no cap: the floor would inflate a small
 *   gap into busywork, and the cap would under-drill the word the student most needs.
 * - **100% error words.** Nothing the student answered correctly is included.
 * - **Mastered words are excluded** — three consecutive first-try-clean appearances retire
 *   a word, and drilling it again spends attention on something already learned.
 * - **Padding only to reach the minimum**, never above it, and never by repeating an error
 *   word beyond its mistake count.
 * - **Splitting spreads answers**, so each part exercises the whole gap rather than one
 *   part being nothing but the worst word.
 */
export function composeRemedial(
  answers: PersistedFailedAnswer[],
  masteredNormalized: Set<string>,
): RemedialPart[] {
  const eligible = answers.filter(
    (a) => a.mistakeCount > 0 && !masteredNormalized.has(a.normalized),
  );

  if (eligible.length === 0) {
    return [];
  }

  // One slot per mistake, interleaved by answer so that any contiguous run of slots
  // touches as many different answers as possible. Splitting then falls out of slicing
  // this list, with no separate balancing pass.
  const slots = interleave(eligible);
  const totalParts = Math.max(1, Math.ceil(slots.length / MAX_REMEDIAL_SENTENCES));
  const perPart = Math.ceil(slots.length / totalParts);

  const parts: RemedialPart[] = [];

  for (let index = 0; index < totalParts; index++) {
    const slice = slots.slice(index * perPart, (index + 1) * perPart);
    if (slice.length === 0) {
      continue;
    }

    const counts = new Map<string, { answer: string; normalized: string; occurrences: number }>();
    for (const slot of slice) {
      const existing = counts.get(slot.normalized);
      if (existing) {
        existing.occurrences += 1;
      } else {
        counts.set(slot.normalized, {
          answer: slot.answer,
          normalized: slot.normalized,
          occurrences: 1,
        });
      }
    }

    const required = slice.length;
    const sentenceCount = Math.max(MIN_REMEDIAL_SENTENCES, required);

    parts.push({
      part: parts.length + 1,
      totalParts,
      sentenceCount,
      requiredAnswers: [...counts.values()],
      paddingCount: sentenceCount - required,
    });
  }

  // `totalParts` was computed before empty slices were dropped. Restate it so a part never
  // claims to be one of three when two exist.
  return parts.map((part) => ({ ...part, totalParts: parts.length }));
}

/**
 * One slot per mistake, round-robin across answers.
 *
 * `[a×3, b×1]` becomes `a, b, a, a` rather than `a, a, a, b`, so a split at any point
 * leaves both answers represented on both sides.
 */
function interleave(
  answers: PersistedFailedAnswer[],
): Array<{ answer: string; normalized: string }> {
  const remaining = answers.map((a) => ({
    answer: a.answer,
    normalized: a.normalized,
    left: a.mistakeCount,
  }));
  const slots: Array<{ answer: string; normalized: string }> = [];

  let anyLeft = true;
  while (anyLeft) {
    anyLeft = false;
    for (const entry of remaining) {
      if (entry.left > 0) {
        slots.push({ answer: entry.answer, normalized: entry.normalized });
        entry.left -= 1;
        anyLeft = anyLeft || entry.left > 0;
      }
    }
  }

  return slots;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd education-service && npx jest src/drills/analysis/remedial-composition.spec.ts`
Expected: PASS, 18 tests.

- [ ] **Step 5: Verify the strictness rules can fail**

Temporarily change the occurrence count to `Math.max(2, a.mistakeCount)`, re-run, and confirm the "applies no floor" test fails. Restore it. Then temporarily raise `MAX_REMEDIAL_SENTENCES` to 100, re-run, and confirm the split tests fail. Restore it.

- [ ] **Step 6: Commit**

```bash
git add education-service/src/drills/analysis/remedial-composition.ts \
        education-service/src/drills/analysis/remedial-composition.spec.ts
git commit -m "feat(drills): compose remedial drills from a gap's failed words"
```

---

### Task 12: RemedialService — plan to assignments

**Files:**
- Create: `education-service/src/drills/analysis/remedial.service.ts`
- Test: `education-service/src/drills/analysis/remedial.service.spec.ts`
- Modify: `education-service/src/drills/contracts.ts` (widen `DrillAssignmentOrigin`)
- Modify: `education-service/src/drills/orchestration/generation.service.ts` (accept `requiredAnswers`)
- Modify: `education-service/src/drills/orchestration/ai.client.ts` — no change needed if `GenerateDrillRequest` already carries free-text `instructions`; the required answers travel in the job and are rendered into `instructions` by `RemedialService`

**Interfaces:**
- Consumes: `AnalysisRepository`, `MasteryRepository`, `TaxonomyService`, `composeRemedial`, `JobRunner`, `ContentClient`, `PrismaService`
- Produces:
  - `class RemedialService`
  - `createForGap(gapUuid: string, teacherId: number, token: string): Promise<{ assignmentUuids: string[]; setUuid: string; reused: boolean }>`
  - `interface RemedialCreationResult` as above

- [ ] **Step 1: Widen the origin union**

In `education-service/src/drills/contracts.ts`, change:

```ts
export type DrillAssignmentOrigin = 'TEACHER' | 'SELF';
```

to:

```ts
/**
 * Where an assignment came from.
 *
 * `REMEDIAL` is a teacher-created drill built from one gap in a student's completed work —
 * it has a teacher, like `TEACHER`, but its items are chosen by the student's mistakes
 * rather than by the teacher's topic pick.
 */
export type DrillAssignmentOrigin = 'TEACHER' | 'SELF' | 'REMEDIAL';
```

- [ ] **Step 2: Compile and audit every origin switch**

Run: `cd education-service && npm run build`

The widened union makes the compiler flag every exhaustive `switch` and every filter that assumed two values. **Audit each one** — decide whether `REMEDIAL` belongs in that branch rather than defaulting it. Expect hits in `assignment.mapper.ts`, `assignments.repository.ts`, and `runner/assignments.service.ts`. In each, a remedial assignment behaves like a `TEACHER` one (it has a teacher, it goes through review, it appears in the student's outstanding list), so it belongs wherever `TEACHER` already is unless the branch is specifically about topic selection.

- [ ] **Step 3: Write the failing test**

Create `education-service/src/drills/analysis/remedial.service.spec.ts`:

```ts
import { RemedialService } from './remedial.service';

const gap = {
  uuid: 'g1',
  runUuid: 'run-1',
  sourceAssignmentUuid: 'a1',
  studentId: 7,
  topicSlug: 'en.prepositions-of-movement',
  languageCode: 'en',
  materialLanguage: 'ru',
  title: 'Предлоги движения',
  explanation: 'through — сквозь',
  rules: ['through — внутри и наружу'],
  examples: [],
  failedAnswers: [
    { answer: 'through', normalized: 'through', mistakeCount: 3, wrongAttempts: ['across'] },
    { answer: 'out of', normalized: 'out of', mistakeCount: 2, wrongAttempts: ['out'] },
  ],
  editedByTeacherId: null,
  editedAt: null,
  createdAt: new Date(),
};

const sourceAssignment = {
  uuid: 'a1',
  studentId: 7,
  lessonUuid: 'lesson-1',
  languageCode: 'en',
  materialLanguage: 'ru',
  level: 'A2',
  studentCourseUuid: null,
};

function deps(overrides: Record<string, any> = {}) {
  const created: any[] = [];
  return {
    created,
    analysis: {
      getCluster: jest.fn(async () => overrides.gap ?? gap),
      ...overrides.analysis,
    },
    mastery: {
      masteredAnswers: jest.fn(async () => overrides.mastered ?? new Set<string>()),
    },
    content: {
      resolveLanguageId: jest.fn(async () => 1),
    },
    jobs: { enqueue: jest.fn() },
    progress: { getStudentProgress: jest.fn(async () => ({ lessonOrder: 12, courseKey: 'en-a2' })) },
    prisma: {
      drillAssignment: {
        findUnique: jest.fn(async () => overrides.sourceAssignment ?? sourceAssignment),
        findMany: jest.fn(async () => overrides.existing ?? []),
        createMany: jest.fn(async ({ data }: any) => {
          created.push(...data);
          return { count: data.length };
        }),
      },
      drillAssignmentBatch: { create: jest.fn(async () => undefined) },
      $transaction: jest.fn(async function (this: any, fn: any) {
        return fn(this);
      }),
    } as any,
  };
}

function build(d: ReturnType<typeof deps>) {
  d.prisma.$transaction = jest.fn(async (fn: any) => fn(d.prisma));
  return new RemedialService(
    d.prisma,
    d.analysis as any,
    d.mastery as any,
    d.content as any,
    d.jobs as any,
    d.progress as any,
  );
}

describe('RemedialService.createForGap', () => {
  it('creates one assignment for a gap that fits in twenty sentences', async () => {
    const d = deps();

    const result = await build(d).createForGap('g1', 182, 'token');

    expect(result.assignmentUuids).toHaveLength(1);
    expect(d.created).toHaveLength(1);
    expect(d.created[0].origin).toBe('REMEDIAL');
    expect(d.created[0].sourceAnalysisUuid).toBe('g1');
    expect(d.created[0].status).toBe('GENERATING');
    // A gap that fits in one assignment is not "часть 1 of 1" — it carries no part
    // number and no suffix. Without these two assertions an implementation that always
    // numbered parts would pass every other test in this file.
    expect(d.created[0].remedialPart).toBeNull();
    expect(d.created[0].title).not.toContain('часть');
  });

  it('inherits the lesson and the student from the source assignment', async () => {
    const d = deps();

    await build(d).createForGap('g1', 182, 'token');

    expect(d.created[0].lessonUuid).toBe('lesson-1');
    expect(d.created[0].studentId).toBe(7);
    expect(d.created[0].teacherId).toBe(182);
  });

  it('titles the assignment after the gap', async () => {
    const d = deps();

    await build(d).createForGap('g1', 182, 'token');

    expect(d.created[0].title).toContain('Работа над ошибками');
    expect(d.created[0].title).toContain('Предлоги движения');
  });

  it('numbers the parts in the title when a gap splits', async () => {
    const d = deps({
      gap: {
        ...gap,
        failedAnswers: [
          { answer: 'through', normalized: 'through', mistakeCount: 20, wrongAttempts: [] },
          { answer: 'out of', normalized: 'out of', mistakeCount: 10, wrongAttempts: [] },
        ],
      },
    });

    const result = await build(d).createForGap('g1', 182, 'token');

    expect(result.assignmentUuids).toHaveLength(2);
    expect(d.created[0].title).toContain('часть 1');
    expect(d.created[1].title).toContain('часть 2');
    expect(d.created[0].remedialPart).toBe(1);
    expect(d.created[1].remedialPart).toBe(2);
  });

  it('queues one generation job per part, carrying the required answers', async () => {
    const d = deps();

    await build(d).createForGap('g1', 182, 'token');

    expect(d.jobs.enqueue).toHaveBeenCalledTimes(1);
    const job = d.jobs.enqueue.mock.calls[0][1];
    expect(job.itemCount).toBe(10);
    expect(job.topicSlugs).toEqual(['en.prepositions-of-movement']);
    expect(job.instructions).toContain('through');
    expect(job.instructions).toContain('out of');
  });

  it('asks for one sentence per mistake, not per word', async () => {
    const d = deps();

    await build(d).createForGap('g1', 182, 'token');

    const job = d.jobs.enqueue.mock.calls[0][1];
    // through ×3 + out of ×2 = 5 required, padded to the 10-sentence minimum.
    expect(job.instructions).toMatch(/through.*3/s);
    expect(job.instructions).toMatch(/out of.*2/s);
  });

  it('excludes a mastered word from the drill', async () => {
    const d = deps({ mastered: new Set(['through']) });

    await build(d).createForGap('g1', 182, 'token');

    const job = d.jobs.enqueue.mock.calls[0][1];
    expect(job.instructions).not.toMatch(/"through"/);
    expect(job.instructions).toContain('out of');
  });

  it('refuses when every word in the gap is already mastered', async () => {
    const d = deps({ mastered: new Set(['through', 'out of']) });

    await expect(build(d).createForGap('g1', 182, 'token')).rejects.toThrow(
      /already mastered/i,
    );
    expect(d.created).toHaveLength(0);
  });

  it('returns the existing assignments instead of creating a second set', async () => {
    const d = deps({ existing: [{ uuid: 'existing-1', status: 'PENDING_REVIEW' }] });

    const result = await build(d).createForGap('g1', 182, 'token');

    expect(result.reused).toBe(true);
    expect(result.assignmentUuids).toEqual(['existing-1']);
    expect(d.created).toHaveLength(0);
    expect(d.jobs.enqueue).not.toHaveBeenCalled();
  });

  it('creates a new set when the previous one was revoked', async () => {
    const d = deps({ existing: [] });

    const result = await build(d).createForGap('g1', 182, 'token');

    expect(result.reused).toBe(false);
    expect(d.created).toHaveLength(1);
  });

  it('raises when the gap does not exist', async () => {
    const d = deps();
    d.analysis.getCluster = jest.fn(async () => null);

    await expect(build(d).createForGap('g1', 182, 'token')).rejects.toThrow(/not found/i);
  });

  it('caps the lesson ceiling at the student progress reader\'s value', async () => {
    const d = deps();

    await build(d).createForGap('g1', 182, 'token');

    expect(d.jobs.enqueue.mock.calls[0][1].maxLessonOrder).toBe(12);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `cd education-service && npx jest src/drills/analysis/remedial.service.spec.ts`
Expected: FAIL — `Cannot find module './remedial.service'`.

- [ ] **Step 5: Write the service**

Create `education-service/src/drills/analysis/remedial.service.ts`:

```ts
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { JobRunner } from '../orchestration/job-runner.service';
import { ContentClient } from '../orchestration/content.client';
import { StudentProgressReader } from '../teacher/teacher-assignments.service';
import { AnalysisRepository } from './analysis.repository';
import { GapClusterRecord } from './contracts';
import { MasteryRepository } from './mastery.repository';
import { RemedialPart, composeRemedial } from './remedial-composition';

export interface RemedialCreationResult {
  assignmentUuids: string[];
  setUuid: string;
  /** True when an earlier, still-live remedial drill was returned instead of a new one. */
  reused: boolean;
}

/** Statuses that mean a remedial drill for this gap is still in play. */
const LIVE_STATUSES = ['GENERATING', 'PENDING_REVIEW', 'ASSIGNED', 'IN_PROGRESS'];

/**
 * Creates the "работа над ошибками" drill for one grammar gap.
 *
 * Teacher-initiated by design: the analysis runs for every completed drill, but only a
 * teacher decides that a gap is worth a second assignment. Generating one automatically on
 * every completion would spend a model call per finished drill whether or not anyone acts
 * on it.
 */
@Injectable()
export class RemedialService {
  private readonly logger = new Logger(RemedialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analysis: AnalysisRepository,
    private readonly mastery: MasteryRepository,
    private readonly content: ContentClient,
    private readonly jobs: JobRunner,
    private readonly progress: StudentProgressReader,
  ) {}

  async createForGap(
    gapUuid: string,
    teacherId: number,
    token: string,
  ): Promise<RemedialCreationResult> {
    const gap = await this.analysis.getCluster(gapUuid);
    if (!gap) {
      throw new NotFoundException('Gap analysis not found');
    }

    // Idempotence: a second click must not produce a second drill. Only live statuses
    // count — a revoked or cancelled drill leaves the gap open again.
    const existing: any[] = await (this.prisma as any).drillAssignment.findMany({
      where: { sourceAnalysisUuid: gapUuid, status: { in: LIVE_STATUSES } },
      select: { uuid: true, setUuid: true },
      orderBy: { remedialPart: 'asc' },
    });
    if (existing.length > 0) {
      this.logger.log(
        `Remedial drill already live for gap ${gapUuid}: returning ${existing.length} assignment(s)`,
      );
      return {
        assignmentUuids: existing.map((row) => row.uuid),
        setUuid: existing[0].setUuid,
        reused: true,
      };
    }

    const mastered = await this.mastery.masteredAnswers(
      gap.studentId,
      gap.languageCode,
      gap.failedAnswers.map((a) => a.normalized),
    );

    const parts = composeRemedial(gap.failedAnswers, mastered);
    if (parts.length === 0) {
      // Refusing beats generating ten sentences of pure padding: there is no gap left to
      // close, and the teacher should be told so rather than handed busywork.
      throw new BadRequestException({
        statusCode: 400,
        code: 'GAP_ALREADY_MASTERED',
        message: 'Every word in this gap is already mastered — there is nothing left to drill',
      });
    }

    const source: any = await (this.prisma as any).drillAssignment.findUnique({
      where: { uuid: gap.sourceAssignmentUuid },
    });
    if (!source) {
      throw new NotFoundException('Source assignment not found');
    }

    const languageId = await this.content.resolveLanguageId(gap.languageCode, token);
    const where = await this.progress.getStudentProgress(gap.studentId);

    const setUuid = randomUUID();
    const batchUuid = randomUUID();
    const assignmentUuids = parts.map(() => randomUUID());

    await (this.prisma as any).$transaction(async (tx: any) => {
      await tx.drillAssignmentBatch.create({
        data: {
          uuid: batchUuid,
          teacherId,
          instructions: gap.explanation,
          filter: {
            topicSlugs: [gap.topicSlug],
            remedialGapUuid: gapUuid,
            sourceAssignmentUuid: gap.sourceAssignmentUuid,
          },
        },
      });

      await tx.drillAssignment.createMany({
        data: parts.map((part, index) => ({
          uuid: assignmentUuids[index],
          setUuid,
          studentId: gap.studentId,
          teacherId,
          origin: 'REMEDIAL',
          lessonUuid: source.lessonUuid ?? null,
          studentCourseUuid: source.studentCourseUuid ?? null,
          batchUuid,
          sourceAnalysisUuid: gapUuid,
          remedialPart: parts.length > 1 ? part.part : null,
          title: this.titleFor(gap, part, parts.length),
          languageCode: gap.languageCode,
          materialLanguage: gap.materialLanguage,
          status: 'GENERATING',
          resourceLinks: [],
          generationProgress: {
            phase: 'RESOLVING',
            generated: 0,
            total: part.sentenceCount,
            etaSeconds: null,
            message: 'Queued',
            stalled: false,
          },
        })),
      });
    });

    parts.forEach((part, index) => {
      this.jobs.enqueue([assignmentUuids[index]], {
        setUuid,
        assignmentUuids: [assignmentUuids[index]],
        languageCode: gap.languageCode,
        materialLanguage: gap.materialLanguage,
        languageId,
        level: source.level ?? null,
        topicSlugs: [gap.topicSlug],
        topics: [{ slug: gap.topicSlug, title: gap.title || gap.topicSlug }],
        instructions: this.instructionsFor(gap, part),
        itemCount: part.sentenceCount,
        courseKey: where?.courseKey ?? null,
        maxLessonOrder: where?.lessonOrder ?? null,
        teacherId,
        title: this.titleFor(gap, part, parts.length),
        token,
        correlationId: randomUUID(),
      });
    });

    this.logger.log(
      `Remedial drill queued: gap=${gapUuid} topic=${gap.topicSlug} student=${gap.studentId} parts=${parts.length} teacher=${teacherId}`,
    );

    return { assignmentUuids, setUuid, reused: false };
  }

  private titleFor(gap: GapClusterRecord, part: RemedialPart, totalParts: number): string {
    const topic = gap.title || gap.topicSlug;
    const base = `Работа над ошибками: ${topic}`;
    return totalParts > 1 ? `${base} (часть ${part.part})` : base;
  }

  /**
   * The generator's brief for one part.
   *
   * The required answers carry their exact occurrence counts, because that is the whole
   * composition rule: a word missed three times must appear in three DIFFERENT sentences,
   * never the same one repeated. The padding request is stated separately so the generator
   * knows those sentences must test the same rule with other vocabulary — repeating the
   * error words to fill space would teach the words rather than the rule.
   */
  private instructionsFor(gap: GapClusterRecord, part: RemedialPart): string {
    const lines: string[] = [
      `This is a corrective drill ("работа над ошибками") for one student's specific mistakes.`,
      ``,
      `Grammar gap: ${gap.title || gap.topicSlug}`,
    ];

    if (gap.explanation) {
      lines.push(`The student has been given this explanation: ${gap.explanation}`);
    }

    lines.push(
      ``,
      `Each of these answers MUST be the blank in exactly the stated number of DIFFERENT sentences:`,
    );

    for (const required of part.requiredAnswers) {
      lines.push(`- "${required.answer}" — ${required.occurrences} sentence(s)`);
    }

    if (part.paddingCount > 0) {
      lines.push(
        ``,
        `Then add ${part.paddingCount} more sentence(s) testing the SAME grammar rule with DIFFERENT vocabulary — do not reuse the words listed above as the blank.`,
      );
    }

    lines.push(
      ``,
      `Never repeat a sentence. Every sentence must be usable on its own.`,
    );

    return lines.join('\n');
  }
}
```

`StudentProgressReader` is exported from `teacher/teacher-assignments.service.ts`. If importing it there creates a circular import, move the interface into `src/drills/contracts.ts` and re-export it from its current home — do not duplicate the interface.

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd education-service && npx jest src/drills/analysis/remedial.service.spec.ts`
Expected: PASS, 12 tests.

- [ ] **Step 7: Run the whole drills suite for regressions**

Run: `cd education-service && npx jest src/drills`
Expected: all PASS. The origin widening in Step 1 is the likeliest source of a break — fix any failures by auditing the branch rather than casting.

- [ ] **Step 8: Commit**

```bash
git add education-service/src/drills/analysis/remedial.service.ts \
        education-service/src/drills/analysis/remedial.service.spec.ts \
        education-service/src/drills/contracts.ts
git commit -m "feat(drills): create remedial assignments from a gap's failed words"
```

---

### Task 13: Controller routes and module wiring

**Files:**
- Modify: `education-service/src/drills/drills.controller.ts`
- Modify: `education-service/src/drills/drills.module.ts`
- Test: `education-service/src/drills/drills.controller.analysis.spec.ts` (new file, so the existing 21KB controller spec does not grow further)

**Interfaces:**
- Consumes: `AnalysisRepository`, `AnalysisJobRunner`, `RemedialService`, `TeacherAssignmentsService.lessonUuidFor`, `isStaffUser`
- Produces four routes on `@Controller('drill-assignments')`:
  - `GET  :uuid/analysis` — student (own) or owning teacher
  - `POST :uuid/analysis/retry` — owning teacher
  - `PATCH teacher/gaps/:gapUuid` — owning teacher
  - `POST  teacher/gaps/:gapUuid/remedial` — owning teacher

Routes live under `drill-assignments` to stay inside the existing guard and identity
resolution. `teacher/gaps/...` follows the `teacher/...` prefix the controller already uses
for staff-only routes.

- [ ] **Step 1: Write the failing controller test**

Create `education-service/src/drills/drills.controller.analysis.spec.ts`:

```ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DrillsController } from './drills.controller';

function build(overrides: Record<string, any> = {}) {
  const analysis = {
    getRunWithClusters: jest.fn(async () => ({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      studentId: 7,
      status: 'READY',
      errorMessage: null,
      attemptCount: 1,
      startedAt: new Date(),
      finishedAt: new Date(),
      clusters: [],
    })),
    getCluster: jest.fn(async () => ({ uuid: 'g1', sourceAssignmentUuid: 'a1', studentId: 7 })),
    updateCluster: jest.fn(async () => ({ uuid: 'g1', explanation: 'edited' })),
    ...overrides.analysis,
  };

  const jobs = { enqueue: jest.fn(), ...overrides.jobs };
  const remedial = {
    createForGap: jest.fn(async () => ({ assignmentUuids: ['r1'], setUuid: 's1', reused: false })),
    ...overrides.remedial,
  };

  const teacherAssignments = {
    lessonUuidFor: jest.fn(async () => 'lesson-1'),
    progressForTeacher: jest.fn(async () => ({})),
    ...overrides.teacherAssignments,
  };

  const identity = { resolveStudentId: jest.fn(async () => overrides.userId ?? 7) };

  const controller = new DrillsController(
    {} as any,
    {} as any,
    { ownerOf: jest.fn(async () => 7) } as any,
    identity as any,
    teacherAssignments as any,
    {} as any,
    {} as any,
    analysis as any,
    jobs as any,
    remedial as any,
  );

  return { controller, analysis, jobs, remedial, identity };
}

const studentReq = { authUser: { id: 'auth-uuid', roles: ['student'] } } as any;
const teacherReq = { authUser: { id: 'auth-uuid', roles: ['teacher'] } } as any;

describe('GET :uuid/analysis', () => {
  it('returns the run for the student who owns the assignment', async () => {
    const { controller, analysis } = build();

    const result: any = await controller.getAnalysis('a1', studentReq);

    expect(result.status).toBe('READY');
    expect(analysis.getRunWithClusters).toHaveBeenCalledWith('a1');
  });

  it('404s a student asking about another student\'s assignment', async () => {
    const { controller } = build({
      analysis: {
        getRunWithClusters: jest.fn(async () => ({
          uuid: 'run-1',
          sourceAssignmentUuid: 'a1',
          studentId: 999,
          status: 'READY',
          errorMessage: null,
          attemptCount: 1,
          startedAt: null,
          finishedAt: null,
          clusters: [],
        })),
      },
    });

    await expect(controller.getAnalysis('a1', studentReq)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reports NOT_ANALYZED rather than 404 when no run exists yet', async () => {
    const { controller } = build({
      analysis: { getRunWithClusters: jest.fn(async () => null) },
    });

    const result: any = await controller.getAnalysis('a1', studentReq);

    expect(result.status).toBe('NOT_ANALYZED');
    expect(result.clusters).toEqual([]);
  });

  it('keeps FAILED distinguishable from NO_ERRORS in the response', async () => {
    const { controller } = build({
      analysis: {
        getRunWithClusters: jest.fn(async () => ({
          uuid: 'run-1',
          sourceAssignmentUuid: 'a1',
          studentId: 7,
          status: 'FAILED',
          errorMessage: 'upstream 502',
          attemptCount: 2,
          startedAt: new Date(),
          finishedAt: new Date(),
          clusters: [],
        })),
      },
    });

    const result: any = await controller.getAnalysis('a1', studentReq);

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toBe('upstream 502');
  });
});

describe('POST :uuid/analysis/retry', () => {
  it('re-enqueues the analysis for a staff caller', async () => {
    const { controller, jobs } = build();

    await controller.retryAnalysis('a1', teacherReq);

    expect(jobs.enqueue).toHaveBeenCalledWith('a1');
  });

  it('refuses a student', async () => {
    const { controller, jobs } = build();

    await expect(controller.retryAnalysis('a1', studentReq)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });
});

describe('PATCH teacher/gaps/:gapUuid', () => {
  it('applies a teacher edit', async () => {
    const { controller, analysis } = build();

    await controller.updateGap('g1', { explanation: 'edited' }, teacherReq);

    expect(analysis.updateCluster).toHaveBeenCalledWith('g1', { explanation: 'edited' }, 7);
  });

  it('refuses a student', async () => {
    const { controller, analysis } = build();

    await expect(
      controller.updateGap('g1', { explanation: 'edited' }, studentReq),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(analysis.updateCluster).not.toHaveBeenCalled();
  });

  it('rejects an empty explanation rather than blanking the student\'s theory', async () => {
    const { controller } = build();

    await expect(
      controller.updateGap('g1', { explanation: '   ' }, teacherReq),
    ).rejects.toThrow(/explanation/i);
  });
});

describe('POST teacher/gaps/:gapUuid/remedial', () => {
  it('creates the remedial drill', async () => {
    const { controller, remedial } = build();

    const result: any = await controller.createRemedial('g1', teacherReq);

    expect(result.assignmentUuids).toEqual(['r1']);
    expect(remedial.createForGap).toHaveBeenCalledWith('g1', 7, expect.any(String));
  });

  it('refuses a student', async () => {
    const { controller, remedial } = build();

    await expect(controller.createRemedial('g1', studentReq)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(remedial.createForGap).not.toHaveBeenCalled();
  });
});
```

The controller constructor's argument list must match whatever `drills.controller.ts`
actually declares after Step 2 — read it and fix the test's `new DrillsController(...)`
call before running.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd education-service && npx jest src/drills/drills.controller.analysis.spec.ts`
Expected: FAIL — `controller.getAnalysis is not a function`.

- [ ] **Step 3: Add the routes**

Add to `education-service/src/drills/drills.controller.ts`, after the existing
`teacherProgress` route. Add `AnalysisRepository`, `AnalysisJobRunner` and `RemedialService`
to the constructor.

```ts
  /**
   * The error analysis for one completed assignment.
   *
   * Readable by the student who owns it and by staff. Returns `NOT_ANALYZED` rather than
   * 404 when no run exists: the drill may simply not be finished yet, and a 404 would make
   * the student's page render an error for a perfectly normal state.
   *
   * Every other status is passed through untouched. `NO_ERRORS` and `FAILED` must stay
   * distinguishable here — collapsing them is how a dead analyzer starts looking like a
   * flawless drill.
   */
  @Get(':uuid/analysis')
  async getAnalysis(@Param('uuid') uuid: string, @Req() req: Request): Promise<unknown> {
    const run = await this.analysis.getRunWithClusters(uuid);

    if (!run) {
      return {
        uuid: null,
        sourceAssignmentUuid: uuid,
        status: 'NOT_ANALYZED',
        errorMessage: null,
        attemptCount: 0,
        clusters: [],
      };
    }

    if (!isStaffUser(req.authUser)) {
      const studentId = await this.identity.resolveStudentId(req.authUser!.id);
      if (run.studentId !== studentId) {
        // 404, not 403: a distinguishable error would confirm another student's
        // assignment exists.
        throw new NotFoundException('Drill assignment not found');
      }
    }

    return run;
  }

  /** Re-run a failed or stalled analysis. Staff only — it costs a model call. */
  @Post(':uuid/analysis/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  async retryAnalysis(
    @Param('uuid') uuid: string,
    @Req() req: Request,
  ): Promise<{ queued: boolean }> {
    this.assertStaff(req);
    this.analysisJobs.enqueue(uuid);
    this.logger.log(`Analysis retry queued for assignment ${uuid}`);
    return { queued: true };
  }

  /** A teacher's edit to the theory a student will read. */
  @Patch('teacher/gaps/:gapUuid')
  @HttpCode(HttpStatus.OK)
  async updateGap(
    @Param('gapUuid') gapUuid: string,
    @Body() body: { title?: string; explanation?: string; rules?: string[]; examples?: Array<{ text: string; gloss: string }> },
    @Req() req: Request,
  ): Promise<unknown> {
    this.assertStaff(req);

    if (body.explanation !== undefined && body.explanation.trim().length === 0) {
      throw new BadRequestException('explanation cannot be empty');
    }
    if (body.title !== undefined && body.title.trim().length === 0) {
      throw new BadRequestException('title cannot be empty');
    }

    const teacherId = await this.identity.resolveStudentId(req.authUser!.id);
    return this.analysis.updateCluster(gapUuid, body, teacherId);
  }

  /**
   * Create the "работа над ошибками" drill for one gap.
   *
   * Teacher-initiated: the analysis is automatic, the second assignment is a judgement
   * call. Idempotent — a second call returns the drill the first one made.
   */
  @Post('teacher/gaps/:gapUuid/remedial')
  @HttpCode(HttpStatus.CREATED)
  async createRemedial(
    @Param('gapUuid') gapUuid: string,
    @Req() req: Request,
  ): Promise<unknown> {
    this.assertStaff(req);
    const teacherId = await this.identity.resolveStudentId(req.authUser!.id);
    return this.remedial.createForGap(gapUuid, teacherId, this.bearer(req));
  }
```

- [ ] **Step 4: Wire the module**

In `education-service/src/drills/drills.module.ts`, add to `providers`:

```ts
    AnalysisClient,
    AnalysisRepository,
    AnalysisService,
    AnalysisJobRunner,
    CompletionAnalysisAdapter,
    MasteryRepository,
    RemedialService,
    TaxonomyService,
```

and bind the completion port so `RunnerService` receives the adapter. Follow whatever
pattern the module already uses to bind `DrillCompletionNotifier` — read that binding and
mirror it exactly. If it is a `useClass`/`useExisting` token, add:

```ts
    { provide: DRILL_COMPLETION_ANALYZER, useExisting: CompletionAnalysisAdapter },
```

and inject it into `RunnerService` with the matching `@Inject`.

- [ ] **Step 5: Run the controller test**

Run: `cd education-service && npx jest src/drills/drills.controller.analysis.spec.ts`
Expected: PASS, 11 tests.

- [ ] **Step 6: Verify the module actually starts**

Run: `cd education-service && npx jest src/drills/drills.module.spec.ts && npm run build`
Expected: PASS and a clean build. A missing provider surfaces here as a Nest DI error, not at runtime in production.

- [ ] **Step 7: Commit**

```bash
git add education-service/src/drills/drills.controller.ts \
        education-service/src/drills/drills.module.ts \
        education-service/src/drills/drills.controller.analysis.spec.ts \
        education-service/src/drills/drills.module.spec.ts
git commit -m "feat(drills): analysis and remedial routes"
```

---

### Task 14: Frontend contracts and API client

**Files:**
- Create: `frontend/lib/drills/analysis/contracts.ts`
- Create: `frontend/lib/drills/analysis/api.ts`
- Test: `frontend/lib/drills/analysis/api.test.ts`

**Interfaces:**
- Consumes: `getAuthSession`, `getGatewayBaseUrl`, `DrillApiError` — read `lib/drills/teacher/api.ts` and reuse its request helper rather than writing a second one
- Produces:
  - `type AnalysisStatus = 'NOT_ANALYZED' | 'PENDING' | 'RUNNING' | 'READY' | 'NO_ERRORS' | 'FAILED'`
  - `interface GapCluster { uuid; topicSlug; title; explanation; rules: string[]; examples: Array<{text, gloss}>; failedAnswers: Array<{answer; normalized; mistakeCount; wrongAttempts: string[]}>; materialLanguage }`
  - `interface AnalysisResponse { uuid: string | null; sourceAssignmentUuid: string; status: AnalysisStatus; errorMessage: string | null; attemptCount: number; clusters: GapCluster[] }`
  - `fetchAnalysis(assignmentUuid: string): Promise<AnalysisResponse>`
  - `retryAnalysis(assignmentUuid: string): Promise<{ queued: boolean }>`
  - `updateGap(gapUuid: string, patch: GapPatch): Promise<GapCluster>`
  - `createRemedial(gapUuid: string): Promise<{ assignmentUuids: string[]; setUuid: string; reused: boolean }>`
  - `remedialSentenceCount(cluster: GapCluster): number` — what the teacher sees before clicking

- [ ] **Step 1: Write the contracts**

Create `frontend/lib/drills/analysis/contracts.ts`:

```ts
/**
 * Analysis states, mirroring education-service exactly.
 *
 * `NOT_ANALYZED`, `NO_ERRORS` and `FAILED` are three different things and the UI must show
 * three different things. Collapsing any pair is how a broken analyzer starts looking like
 * a flawless drill.
 */
export type AnalysisStatus =
  | 'NOT_ANALYZED'
  | 'PENDING'
  | 'RUNNING'
  | 'READY'
  | 'NO_ERRORS'
  | 'FAILED';

export interface GapExample {
  /** In the target language. */
  text: string;
  /** In the student's material language. */
  gloss: string;
}

export interface GapFailedAnswer {
  answer: string;
  normalized: string;
  /** How many sentences this answer earns in the remedial drill. */
  mistakeCount: number;
  wrongAttempts: string[];
}

export interface GapCluster {
  uuid: string;
  topicSlug: string;
  title: string;
  explanation: string;
  rules: string[];
  examples: GapExample[];
  failedAnswers: GapFailedAnswer[];
  materialLanguage: string;
}

export interface AnalysisResponse {
  uuid: string | null;
  sourceAssignmentUuid: string;
  status: AnalysisStatus;
  errorMessage: string | null;
  attemptCount: number;
  clusters: GapCluster[];
}

export interface GapPatch {
  title?: string;
  explanation?: string;
  rules?: string[];
  examples?: GapExample[];
}

export interface RemedialCreationResult {
  assignmentUuids: string[];
  setUuid: string;
  reused: boolean;
}

/** Statuses where polling should continue. */
export const IN_FLIGHT_STATUSES: AnalysisStatus[] = ['PENDING', 'RUNNING'];

/**
 * The floor and ceiling education-service applies, restated here for the preview count.
 *
 * DUPLICATED ON PURPOSE — the frontend cannot import from education-service. They must
 * match `remedial-composition.ts`, and Step 1b's drift test is what keeps them honest.
 */
export const MIN_REMEDIAL_SENTENCES = 10;
export const MAX_REMEDIAL_SENTENCES = 20;
```

- [ ] **Step 1b: Add the drift guard**

Create `education-service/src/drills/analysis/frontend-constants.drift.spec.ts`, following
the existing `template.drift.spec.ts` in that package:

```ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { MAX_REMEDIAL_SENTENCES, MIN_REMEDIAL_SENTENCES } from './remedial-composition';

/**
 * The frontend restates these two numbers to preview how long a remedial drill will be.
 * It cannot import them — different service, different build — so this test is the only
 * thing between a changed limit here and a teacher being shown a wrong count there.
 */
const frontendContracts = readFileSync(
  join(__dirname, '../../../../frontend/lib/drills/analysis/contracts.ts'),
  'utf8',
);

describe('frontend remedial constants', () => {
  it('matches the minimum', () => {
    expect(frontendContracts).toContain(
      `export const MIN_REMEDIAL_SENTENCES = ${MIN_REMEDIAL_SENTENCES};`,
    );
  });

  it('matches the maximum', () => {
    expect(frontendContracts).toContain(
      `export const MAX_REMEDIAL_SENTENCES = ${MAX_REMEDIAL_SENTENCES};`,
    );
  });
});
```

Run: `cd education-service && npx jest src/drills/analysis/frontend-constants.drift.spec.ts`
Expected: PASS. If the relative path does not resolve in this repo layout, fix the path —
do not delete the test.

- [ ] **Step 2: Write the failing API test**

Create `frontend/lib/drills/analysis/api.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { remedialSentenceCount } from './api';
import type { GapCluster } from './contracts';

const cluster = (mistakeCounts: number[]): GapCluster => ({
  uuid: 'g1',
  topicSlug: 'en.prepositions-of-movement',
  title: 'Предлоги движения',
  explanation: 'x',
  rules: [],
  examples: [],
  materialLanguage: 'ru',
  failedAnswers: mistakeCounts.map((mistakeCount, index) => ({
    answer: `w${index}`,
    normalized: `w${index}`,
    mistakeCount,
    wrongAttempts: [],
  })),
});

describe('remedialSentenceCount', () => {
  it('sums the mistake counts', () => {
    expect(remedialSentenceCount(cluster([6, 4, 2]))).toBe(12);
  });

  it('reports the ten-sentence minimum for a small gap', () => {
    expect(remedialSentenceCount(cluster([1, 2]))).toBe(10);
  });

  it('reports the full count above the minimum', () => {
    expect(remedialSentenceCount(cluster([12]))).toBe(12);
  });

  it('reports zero for a gap with no failed answers', () => {
    expect(remedialSentenceCount(cluster([]))).toBe(0);
  });
});

describe('fetchAnalysis', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects rather than returning an empty analysis when the request fails', async () => {
    const { fetchAnalysis } = await import('./api');
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ message: 'Bad Gateway' }),
    });

    await expect(fetchAnalysis('a1')).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd frontend && npx vitest run lib/drills/analysis/api.test.ts`
Expected: FAIL — cannot resolve `./api`.

- [ ] **Step 4: Write the API client**

Create `frontend/lib/drills/analysis/api.ts`. **Read `frontend/lib/drills/teacher/api.ts` first** and reuse its `request` helper, its `DrillApiError`, and its auth/base-url handling verbatim — do not write a second request helper. Then:

```ts
import type {
  AnalysisResponse,
  GapCluster,
  GapPatch,
  RemedialCreationResult,
} from './contracts';
import { MIN_REMEDIAL_SENTENCES } from './contracts';

/**
 * The error analysis for one completed assignment.
 *
 * Rejects on failure rather than returning an empty analysis: an empty one renders as
 * "no mistakes", which is the opposite of what a failed request means.
 */
export function fetchAnalysis(assignmentUuid: string): Promise<AnalysisResponse> {
  return request(`/drill-assignments/${encodeURIComponent(assignmentUuid)}/analysis`);
}

export function retryAnalysis(assignmentUuid: string): Promise<{ queued: boolean }> {
  return request(`/drill-assignments/${encodeURIComponent(assignmentUuid)}/analysis/retry`, {
    method: 'POST',
  });
}

export function updateGap(gapUuid: string, patch: GapPatch): Promise<GapCluster> {
  return request(`/drill-assignments/teacher/gaps/${encodeURIComponent(gapUuid)}`, {
    method: 'PATCH',
    body: patch,
  });
}

export function createRemedial(gapUuid: string): Promise<RemedialCreationResult> {
  return request(`/drill-assignments/teacher/gaps/${encodeURIComponent(gapUuid)}/remedial`, {
    method: 'POST',
  });
}

/**
 * How long the remedial drill for this gap will be, shown BEFORE the teacher clicks.
 *
 * Mirrors `composeRemedial` on the server: one sentence per mistake, floored at the
 * ten-sentence minimum. It deliberately does not account for already-mastered words — the
 * client does not know them, and the server's refusal is the authority. This is a
 * preview, not a promise.
 */
export function remedialSentenceCount(cluster: GapCluster): number {
  const required = cluster.failedAnswers.reduce((sum, a) => sum + a.mistakeCount, 0);
  if (required === 0) {
    return 0;
  }
  return Math.max(MIN_REMEDIAL_SENTENCES, required);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run lib/drills/analysis/api.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/drills/analysis
git commit -m "feat(drills): frontend contracts and client for gap analysis"
```

---

### Task 15: GapAnalysisBlock and GapCard components

**Files:**
- Create: `frontend/lib/drills/analysis/GapCard.tsx`
- Create: `frontend/lib/drills/analysis/GapAnalysisBlock.tsx`
- Test: `frontend/lib/drills/analysis/GapAnalysisBlock.test.tsx`

**Interfaces:**
- Consumes: `fetchAnalysis`, `retryAnalysis`, `remedialSentenceCount`, `IN_FLIGHT_STATUSES`
- Produces:
  - `<GapCard cluster={...} showRemedialAction={boolean} onCreateRemedial={(uuid) => void} busy={boolean} />`
  - `<GapAnalysisBlock assignmentUuid={string} audience={'student' | 'teacher'} onRemedialCreated={(result) => void} />`

- [ ] **Step 1: Write the failing test**

Create `frontend/lib/drills/analysis/GapAnalysisBlock.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GapAnalysisBlock } from './GapAnalysisBlock';

const mocks = vi.hoisted(() => ({
  fetchAnalysis: vi.fn(),
  retryAnalysis: vi.fn(),
  createRemedial: vi.fn(),
}));

vi.mock('@/lib/drills/analysis/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/drills/analysis/api')>(
    '@/lib/drills/analysis/api',
  );
  return { ...actual, ...mocks };
});

const readyCluster = {
  uuid: 'g1',
  topicSlug: 'en.prepositions-of-movement',
  title: 'Предлоги движения',
  explanation: 'through — движение сквозь что-то, across — поперёк.',
  rules: ['through — внутри и наружу', 'across — с одной стороны на другую'],
  examples: [{ text: 'Walk through the park.', gloss: 'Пройди через парк.' }],
  failedAnswers: [
    { answer: 'through', normalized: 'through', mistakeCount: 6, wrongAttempts: ['across'] },
  ],
  materialLanguage: 'ru',
};

function analysis(status: string, extra: Record<string, unknown> = {}) {
  return {
    uuid: 'run-1',
    sourceAssignmentUuid: 'a1',
    status,
    errorMessage: null,
    attemptCount: 1,
    clusters: [],
    ...extra,
  };
}

describe('GapAnalysisBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the explanation and rules when the analysis is ready', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('READY', { clusters: [readyCluster] }));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    expect(await screen.findByText('Предлоги движения')).toBeInTheDocument();
    expect(screen.getByText(/через что-то|сквозь что-то/)).toBeInTheDocument();
    expect(screen.getByText('through — внутри и наружу')).toBeInTheDocument();
  });

  it('shows the example with its gloss', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('READY', { clusters: [readyCluster] }));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    expect(await screen.findByText('Walk through the park.')).toBeInTheDocument();
    expect(screen.getByText('Пройди через парк.')).toBeInTheDocument();
  });

  it('says there were no mistakes when the run reports NO_ERRORS', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('NO_ERRORS'));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    expect(await screen.findByText(/ошибок нет/i)).toBeInTheDocument();
  });

  it('shows a visible error, NOT an empty block, when the run FAILED', async () => {
    mocks.fetchAnalysis.mockResolvedValue(
      analysis('FAILED', { errorMessage: 'upstream 502' }),
    );

    render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/не удался|failed/i);
    expect(screen.queryByText(/ошибок нет/i)).not.toBeInTheDocument();
  });

  it('shows a visible error when the request itself rejects', async () => {
    mocks.fetchAnalysis.mockRejectedValue(new Error('network down'));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('shows a working state while the analysis is running', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('RUNNING'));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    expect(await screen.findByText(/разбираем/i)).toBeInTheDocument();
  });

  it('offers no retry button to a student', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('FAILED', { errorMessage: 'x' }));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: /повторить|retry/i })).not.toBeInTheDocument();
  });

  it('offers a retry button to a teacher and calls the API', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('FAILED', { errorMessage: 'x' }));
    mocks.retryAnalysis.mockResolvedValue({ queued: true });

    render(<GapAnalysisBlock assignmentUuid="a1" audience="teacher" />);

    await userEvent.click(await screen.findByRole('button', { name: /повторить|retry/i }));

    await waitFor(() => expect(mocks.retryAnalysis).toHaveBeenCalledWith('a1'));
  });

  it('offers no remedial button to a student', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('READY', { clusters: [readyCluster] }));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    await screen.findByText('Предлоги движения');
    expect(screen.queryByRole('button', { name: /работу над ошибками/i })).not.toBeInTheDocument();
  });

  it('shows the teacher how many sentences the drill would be before they click', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('READY', { clusters: [readyCluster] }));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="teacher" />);

    expect(await screen.findByText(/10/)).toBeInTheDocument();
  });

  it('creates the remedial drill when the teacher clicks', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('READY', { clusters: [readyCluster] }));
    mocks.createRemedial.mockResolvedValue({
      assignmentUuids: ['r1'],
      setUuid: 's1',
      reused: false,
    });

    render(<GapAnalysisBlock assignmentUuid="a1" audience="teacher" />);

    await userEvent.click(await screen.findByRole('button', { name: /работу над ошибками/i }));

    await waitFor(() => expect(mocks.createRemedial).toHaveBeenCalledWith('g1'));
  });

  it('surfaces a failed remedial creation instead of silently doing nothing', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('READY', { clusters: [readyCluster] }));
    mocks.createRemedial.mockRejectedValue(new Error('Every word in this gap is already mastered'));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="teacher" />);

    await userEvent.click(await screen.findByRole('button', { name: /работу над ошибками/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/mastered/i);
  });

  it('renders nothing at all when the assignment has never been analyzed', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('NOT_ANALYZED', { uuid: null }));

    const { container } = render(<GapAnalysisBlock assignmentUuid="a1" audience="student" />);

    await waitFor(() => expect(mocks.fetchAnalysis).toHaveBeenCalled());
    expect(container.textContent?.trim()).toBe('');
  });

  it('lists the words the gap covers', async () => {
    mocks.fetchAnalysis.mockResolvedValue(analysis('READY', { clusters: [readyCluster] }));

    render(<GapAnalysisBlock assignmentUuid="a1" audience="teacher" />);

    expect(await screen.findByText(/through/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run lib/drills/analysis/GapAnalysisBlock.test.tsx`
Expected: FAIL — cannot resolve `./GapAnalysisBlock`.

- [ ] **Step 3: Write GapCard**

Create `frontend/lib/drills/analysis/GapCard.tsx`:

```tsx
'use client';

import type { GapCluster } from '@/lib/drills/analysis/contracts';
import { remedialSentenceCount } from '@/lib/drills/analysis/api';

interface GapCardProps {
  cluster: GapCluster;
  /** Teachers create the remedial drill; students only read the theory. */
  showRemedialAction: boolean;
  onCreateRemedial?: (gapUuid: string) => void;
  busy?: boolean;
}

/**
 * One grammar gap: the rule, why the student's attempts broke it, and examples.
 *
 * The same card renders below a finished drill and at the top of the remedial drill it
 * produced — one row, one explanation, two places. Do not fork it for either audience;
 * the only difference is the action button, which is a prop.
 */
export function GapCard({ cluster, showRemedialAction, onCreateRemedial, busy }: GapCardProps) {
  // A cluster the analyzer never wrote text for — the fallback bucket for answers no
  // cluster claimed. Its topic slug is all there is, and showing an empty card would be
  // worse than showing the slug.
  const heading = cluster.title || cluster.topicSlug;
  const sentenceCount = remedialSentenceCount(cluster);

  return (
    <section className="rounded border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <h3 className="text-lg font-semibold">{heading}</h3>

      {cluster.explanation ? (
        <p className="mt-2 whitespace-pre-line text-zinc-800 dark:text-zinc-200">
          {cluster.explanation}
        </p>
      ) : null}

      {cluster.rules.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-zinc-800 dark:text-zinc-200">
          {cluster.rules.map((rule, index) => (
            <li key={index}>{rule}</li>
          ))}
        </ul>
      ) : null}

      {cluster.examples.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {cluster.examples.map((example, index) => (
            <li key={index}>
              <span className="font-medium">{example.text}</span>{' '}
              <span className="text-zinc-600 dark:text-zinc-400">{example.gloss}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {cluster.failedAnswers.length > 0 ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          {cluster.failedAnswers
            .map((answer) => `${answer.answer} (${answer.mistakeCount})`)
            .join(', ')}
        </p>
      ) : null}

      {showRemedialAction ? (
        <button
          type="button"
          disabled={busy || sentenceCount === 0}
          onClick={() => onCreateRemedial?.(cluster.uuid)}
          className="mt-4 rounded bg-sky-700 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Создать работу над ошибками ({sentenceCount} предложений)
        </button>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Write GapAnalysisBlock**

Create `frontend/lib/drills/analysis/GapAnalysisBlock.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createRemedial,
  fetchAnalysis,
  retryAnalysis,
} from '@/lib/drills/analysis/api';
import {
  IN_FLIGHT_STATUSES,
  type AnalysisResponse,
  type RemedialCreationResult,
} from '@/lib/drills/analysis/contracts';
import { GapCard } from './GapCard';

const POLL_INTERVAL_MS = 4000;

interface GapAnalysisBlockProps {
  assignmentUuid: string;
  audience: 'student' | 'teacher';
  onRemedialCreated?: (result: RemedialCreationResult) => void;
}

/**
 * The grammar theory for one completed drill.
 *
 * Every state is rendered distinctly and deliberately:
 *
 * - `NOT_ANALYZED` renders nothing — the drill is not finished, and an empty state here
 *   would appear on every drill a student has open.
 * - `PENDING`/`RUNNING` say so and keep polling.
 * - `NO_ERRORS` says there were no mistakes.
 * - `FAILED`, and a rejected request, render a VISIBLE error. Never an empty block: an
 *   empty block reads as "no mistakes", which is the opposite of what happened.
 */
export function GapAnalysisBlock({
  assignmentUuid,
  audience,
  onRemedialCreated,
}: GapAnalysisBlockProps) {
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyGap, setBusyGap] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetchAnalysis(assignmentUuid);
      setAnalysis(response);
      setLoadError(null);
      return response;
    } catch (error) {
      // Never fall back to an empty analysis — see the component doc comment.
      setLoadError(
        error instanceof Error ? error.message : 'Не удалось загрузить разбор ошибок',
      );
      return null;
    }
  }, [assignmentUuid]);

  useEffect(() => {
    let active = true;

    const tick = async () => {
      const response = await load();
      if (!active) {
        return;
      }
      if (response && IN_FLIGHT_STATUSES.includes(response.status)) {
        timer.current = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    void tick();

    return () => {
      active = false;
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [load]);

  const onRetry = useCallback(async () => {
    setActionError(null);
    try {
      await retryAnalysis(assignmentUuid);
      await load();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Не удалось перезапустить разбор',
      );
    }
  }, [assignmentUuid, load]);

  const onCreateRemedial = useCallback(
    async (gapUuid: string) => {
      setActionError(null);
      setBusyGap(gapUuid);
      try {
        const result = await createRemedial(gapUuid);
        onRemedialCreated?.(result);
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : 'Не удалось создать работу над ошибками',
        );
      } finally {
        setBusyGap(null);
      }
    },
    [onRemedialCreated],
  );

  if (loadError) {
    return (
      <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
        Разбор ошибок не удался: {loadError}
      </p>
    );
  }

  if (!analysis || analysis.status === 'NOT_ANALYZED') {
    return null;
  }

  if (IN_FLIGHT_STATUSES.includes(analysis.status)) {
    return <p className="text-zinc-600 dark:text-zinc-400">Разбираем твои ошибки…</p>;
  }

  if (analysis.status === 'NO_ERRORS') {
    return (
      <p className="rounded border border-green-300 bg-green-50 p-4 text-green-900">
        Всё верно, ошибок нет.
      </p>
    );
  }

  if (analysis.status === 'FAILED') {
    return (
      <div className="space-y-2">
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
          Разбор ошибок не удался{analysis.errorMessage ? `: ${analysis.errorMessage}` : ''}
        </p>
        {audience === 'teacher' ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded border border-zinc-400 px-3 py-2 text-sm"
          >
            Повторить разбор
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionError ? (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
          {actionError}
        </p>
      ) : null}

      {analysis.clusters.map((cluster) => (
        <GapCard
          key={cluster.uuid}
          cluster={cluster}
          showRemedialAction={audience === 'teacher'}
          onCreateRemedial={onCreateRemedial}
          busy={busyGap === cluster.uuid}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run lib/drills/analysis/GapAnalysisBlock.test.tsx`
Expected: PASS, 14 tests. If the "shows the explanation" test fails on the regex, adjust the test's expected substring to match `readyCluster.explanation` exactly rather than loosening the component.

- [ ] **Step 6: Verify the FAILED path can regress**

Temporarily change the `FAILED` branch to `return null`, re-run, and confirm the "shows a visible error, NOT an empty block" test fails. Restore it.

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/drills/analysis/GapCard.tsx \
        frontend/lib/drills/analysis/GapAnalysisBlock.tsx \
        frontend/lib/drills/analysis/GapAnalysisBlock.test.tsx
git commit -m "feat(drills): grammar gap analysis block with distinct states"
```

---

### Task 16: Student practice page — the block below a finished drill

**Files:**
- Modify: `frontend/app/learner/practice/[uuid]/page.tsx`
- Test: `frontend/app/learner/practice/[uuid]/page.test.tsx` (new file — the page has none today)

**Interfaces:**
- Consumes: `GapAnalysisBlock`, existing `DrillRunner`, `fetchRunner`
- Produces: no new exports; the page renders `<GapAnalysisBlock audience="student" />` below the runner

- [ ] **Step 1: Write the failing test**

Create `frontend/app/learner/practice/[uuid]/page.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import PracticeRunnerPage from './page';

const mocks = vi.hoisted(() => ({
  fetchRunner: vi.fn(),
  fetchAnalysis: vi.fn(),
  useParams: vi.fn(() => ({ uuid: 'a1' })),
}));

vi.mock('next/navigation', () => ({ useParams: mocks.useParams }));
vi.mock('@/lib/drills/runner/api', () => ({ fetchRunner: mocks.fetchRunner }));
vi.mock('@/lib/drills/analysis/api', () => ({
  fetchAnalysis: mocks.fetchAnalysis,
  retryAnalysis: vi.fn(),
  createRemedial: vi.fn(),
  remedialSentenceCount: () => 10,
}));
vi.mock('@/lib/drills/runner/DrillRunner', () => ({
  DrillRunner: () => <div data-testid="runner" />,
}));

const runnerResponse = {
  assignment: { uuid: 'a1', title: 'Тренировка на английские предлоги', status: 'COMPLETED' },
  items: [],
};

describe('PracticeRunnerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchRunner.mockResolvedValue(runnerResponse);
  });

  it('renders the gap analysis below the runner', async () => {
    mocks.fetchAnalysis.mockResolvedValue({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      status: 'READY',
      errorMessage: null,
      attemptCount: 1,
      clusters: [
        {
          uuid: 'g1',
          topicSlug: 'en.prepositions-of-movement',
          title: 'Предлоги движения',
          explanation: 'through — сквозь',
          rules: [],
          examples: [],
          failedAnswers: [],
          materialLanguage: 'ru',
        },
      ],
    });

    render(<PracticeRunnerPage />);

    expect(await screen.findByTestId('runner')).toBeInTheDocument();
    expect(await screen.findByText('Предлоги движения')).toBeInTheDocument();
  });

  it('shows the grammar for a remedial assignment ABOVE the runner', async () => {
    mocks.fetchRunner.mockResolvedValue({
      ...runnerResponse,
      assignment: {
        ...runnerResponse.assignment,
        origin: 'REMEDIAL',
        sourceAnalysisUuid: 'g1',
        title: 'Работа над ошибками: Предлоги движения',
      },
    });
    mocks.fetchAnalysis.mockResolvedValue({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      status: 'READY',
      errorMessage: null,
      attemptCount: 1,
      clusters: [],
    });

    const { container } = render(<PracticeRunnerPage />);

    await screen.findByTestId('runner');

    const html = container.innerHTML;
    const theoryPosition = html.indexOf('data-testid="remedial-theory"');
    const runnerPosition = html.indexOf('data-testid="runner"');
    expect(theoryPosition).toBeGreaterThanOrEqual(0);
    expect(theoryPosition).toBeLessThan(runnerPosition);
  });

  it('shows a visible error when the analysis failed', async () => {
    mocks.fetchAnalysis.mockResolvedValue({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      status: 'FAILED',
      errorMessage: 'upstream 502',
      attemptCount: 2,
      clusters: [],
    });

    render(<PracticeRunnerPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/не удался/i);
  });

  it('offers no remedial button to the student', async () => {
    mocks.fetchAnalysis.mockResolvedValue({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      status: 'READY',
      errorMessage: null,
      attemptCount: 1,
      clusters: [
        {
          uuid: 'g1',
          topicSlug: 'en.other',
          title: 'Прочее',
          explanation: 'x',
          rules: [],
          examples: [],
          failedAnswers: [{ answer: 'w', normalized: 'w', mistakeCount: 1, wrongAttempts: [] }],
          materialLanguage: 'ru',
        },
      ],
    });

    render(<PracticeRunnerPage />);

    await screen.findByText('Прочее');
    expect(
      screen.queryByRole('button', { name: /работу над ошибками/i }),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run "app/learner/practice/[uuid]/page.test.tsx"`
Expected: FAIL — the analysis block is not rendered.

- [ ] **Step 3: Add a remedial-theory fetch to the runner contract**

The runner payload must carry `origin` and `sourceAnalysisUuid` so the page knows a drill is
remedial. In `education-service/src/drills/runner/runner.projection.ts`, add both fields to
the assignment projection, and mirror them in `frontend/lib/drills/contracts.ts`'s
`RunnerAssignment` type:

```ts
  origin: DrillAssignmentOrigin;
  /** Set on REMEDIAL assignments: the gap whose theory belongs above the items. */
  sourceAnalysisUuid: string | null;
```

Add a matching assertion to `education-service/src/drills/runner/runner.projection.spec.ts`:

```ts
  it('carries the origin and the source gap so the runner can show the theory', () => {
    const projected = projectRunner(
      { ...assignment, origin: 'REMEDIAL', sourceAnalysisUuid: 'g1' } as any,
      [],
      [],
    );

    expect(projected.assignment.origin).toBe('REMEDIAL');
    expect(projected.assignment.sourceAnalysisUuid).toBe('g1');
  });
```

Adjust `projectRunner`'s call signature in that assertion to match the file's existing tests.

- [ ] **Step 4: Add a single-gap fetch to the frontend API**

Append to `frontend/lib/drills/analysis/api.ts`:

```ts
/** One gap cluster, for the theory shown above a remedial drill. */
export function fetchGap(gapUuid: string): Promise<GapCluster> {
  return request(`/drill-assignments/gaps/${encodeURIComponent(gapUuid)}`);
}
```

Add the matching route to `education-service/src/drills/drills.controller.ts`, beside
`getAnalysis`:

```ts
  /**
   * One gap cluster.
   *
   * Readable by the student it belongs to — this is the theory shown above their remedial
   * drill, the same row the source drill renders below itself.
   *
   * Staff are scoped to the gaps of assignments they own, exactly as `getAnalysis`,
   * `updateGap` and `createRemedial` are. A cluster carries a named student's specific
   * wrong answers and the teaching written for them; "any staff user may read any gap"
   * would make that readable school-wide by guessing a uuid. Both mismatch cases are 404,
   * never 403 — a distinguishable error confirms the gap exists.
   */
  @Get('gaps/:gapUuid')
  async getGap(@Param('gapUuid') gapUuid: string, @Req() req: Request): Promise<unknown> {
    const cluster = await this.analysis.getCluster(gapUuid);
    if (!cluster) {
      throw new NotFoundException('Gap analysis not found');
    }

    if (isStaffUser(req.authUser)) {
      await this.assertOwnsGap(gapUuid, req);
    } else {
      const studentId = await this.identity.resolveStudentId(req.authUser!.id);
      if (cluster.studentId !== studentId) {
        throw new NotFoundException('Gap analysis not found');
      }
    }

    return cluster;
  }
```

Add its test to `drills.controller.analysis.spec.ts`:

```ts
describe('GET gaps/:gapUuid', () => {
  it('returns the gap to the student it belongs to', async () => {
    const { controller } = build();

    const result: any = await controller.getGap('g1', studentReq);

    expect(result.uuid).toBe('g1');
  });

  it('404s a student asking for another student\'s gap', async () => {
    const { controller } = build({
      analysis: { getCluster: jest.fn(async () => ({ uuid: 'g1', studentId: 999 })) },
    });

    await expect(controller.getGap('g1', studentReq)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s a gap that does not exist', async () => {
    const { controller } = build({ analysis: { getCluster: jest.fn(async () => null) } });

    await expect(controller.getGap('g1', studentReq)).rejects.toBeInstanceOf(NotFoundException);
  });

  // Both directions, deliberately. A single "staff may read it" test would pass just as
  // happily against a route with no staff scoping at all — which is exactly the bug these
  // two exist to catch.
  it('returns the gap to a teacher who owns its source assignment', async () => {
    const { controller } = build();

    const result: any = await controller.getGap('g1', teacherReq);

    expect(result.uuid).toBe('g1');
  });

  it('404s a staff caller who does not own the gap\'s source assignment', async () => {
    const { controller } = build({
      teacherAssignments: {
        getForTeacher: jest.fn(async () => {
          throw new NotFoundException('Drill assignment not found');
        }),
      },
    });

    await expect(controller.getGap('g1', teacherReq)).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 5: Update the page**

Rewrite `frontend/app/learner/practice/[uuid]/page.tsx`'s render body. Keep the existing
loading, error and `completed` handling exactly as it is; add the theory above and the
analysis below:

```tsx
        {theory ? (
          <div data-testid="remedial-theory">
            <GapCard cluster={theory} showRemedialAction={false} />
          </div>
        ) : null}

        {runner ? (
          <DrillRunner
            assignment={runner.assignment}
            items={runner.items}
            onComplete={onComplete}
          />
        ) : null}

        {completed ? (
          <p className="rounded border border-green-300 bg-green-50 p-4 text-green-900">
            Done — every blank is filled. Nice work.
          </p>
        ) : null}

        {uuid ? <GapAnalysisBlock assignmentUuid={uuid} audience="student" /> : null}
```

and add the theory fetch beside the existing runner fetch:

```tsx
  const [theory, setTheory] = useState<GapCluster | null>(null);

  useEffect(() => {
    const gapUuid = runner?.assignment?.sourceAnalysisUuid;
    if (!gapUuid) {
      return;
    }
    let active = true;
    fetchGap(gapUuid)
      .then((cluster) => {
        if (active) {
          setTheory(cluster);
        }
      })
      .catch((error) => {
        // The drill itself is still usable without the theory above it, so this does not
        // replace the page — but it must not vanish either.
        if (active) {
          setError(
            `Не удалось загрузить теорию к этой работе над ошибками: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      });
    return () => {
      active = false;
    };
  }, [runner]);
```

- [ ] **Step 6: Run the tests**

Run: `cd frontend && npx vitest run "app/learner/practice/[uuid]/page.test.tsx"`
Then: `cd education-service && npx jest src/drills/runner/runner.projection.spec.ts src/drills/drills.controller.analysis.spec.ts`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add "frontend/app/learner/practice/[uuid]" \
        frontend/lib/drills/analysis/api.ts \
        frontend/lib/drills/contracts.ts \
        education-service/src/drills/runner/runner.projection.ts \
        education-service/src/drills/runner/runner.projection.spec.ts \
        education-service/src/drills/drills.controller.ts \
        education-service/src/drills/drills.controller.analysis.spec.ts
git commit -m "feat(drills): show gap theory above remedial drills and analysis below finished ones"
```

---

### Task 17: Teacher progress page — the generate button

**Files:**
- Modify: `frontend/app/teacher/assignments/[uuid]/progress/page.tsx`
- Test: `frontend/app/teacher/assignments/[uuid]/progress/page.test.tsx` (append)

**Interfaces:**
- Consumes: `GapAnalysisBlock` with `audience="teacher"`
- Produces: no new exports

- [ ] **Step 1: Write the failing test**

Append to `frontend/app/teacher/assignments/[uuid]/progress/page.test.tsx`. **Read the file
first** and follow its existing mocking style — it already mocks `@/lib/drills/teacher/api`,
so add the analysis mock beside it rather than restructuring:

```tsx
describe('progress page — gap analysis', () => {
  it('renders the analysis below the sentence list', async () => {
    mocks.fetchAnalysis.mockResolvedValue({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      status: 'READY',
      errorMessage: null,
      attemptCount: 1,
      clusters: [
        {
          uuid: 'g1',
          topicSlug: 'en.prepositions-of-movement',
          title: 'Предлоги движения',
          explanation: 'through — сквозь',
          rules: [],
          examples: [],
          failedAnswers: [
            { answer: 'through', normalized: 'through', mistakeCount: 6, wrongAttempts: [] },
          ],
          materialLanguage: 'ru',
        },
      ],
    });

    render(<ProgressPage />);

    expect(await screen.findByText('Предлоги движения')).toBeInTheDocument();
  });

  it('offers the teacher a button that says how long the drill will be', async () => {
    mocks.fetchAnalysis.mockResolvedValue({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      status: 'READY',
      errorMessage: null,
      attemptCount: 1,
      clusters: [
        {
          uuid: 'g1',
          topicSlug: 'en.prepositions-of-movement',
          title: 'Предлоги движения',
          explanation: 'x',
          rules: [],
          examples: [],
          failedAnswers: [
            { answer: 'through', normalized: 'through', mistakeCount: 12, wrongAttempts: [] },
          ],
          materialLanguage: 'ru',
        },
      ],
    });

    render(<ProgressPage />);

    const button = await screen.findByRole('button', { name: /работу над ошибками/i });
    expect(button).toHaveTextContent('12');
  });

  it('offers a retry when the analysis failed', async () => {
    mocks.fetchAnalysis.mockResolvedValue({
      uuid: 'run-1',
      sourceAssignmentUuid: 'a1',
      status: 'FAILED',
      errorMessage: 'upstream 502',
      attemptCount: 1,
      clusters: [],
    });

    render(<ProgressPage />);

    expect(await screen.findByRole('button', { name: /повторить/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run "app/teacher/assignments/[uuid]/progress/page.test.tsx"`
Expected: FAIL on the new cases.

- [ ] **Step 3: Add the block to the page**

In `frontend/app/teacher/assignments/[uuid]/progress/page.tsx`, below the existing sentence
list, add:

```tsx
        {uuid ? (
          <GapAnalysisBlock
            assignmentUuid={uuid}
            audience="teacher"
            onRemedialCreated={(result) => {
              setNotice(
                result.reused
                  ? 'Работа над ошибками уже создана для этого пробела.'
                  : `Создано заданий: ${result.assignmentUuids.length}. Проверьте и отправьте студенту.`,
              );
            }}
          />
        ) : null}
```

Use whatever notice/banner state the page already has. If it has none, add a simple
`const [notice, setNotice] = useState<string | null>(null)` and render it above the list —
do not leave the teacher without confirmation that the click did something.

- [ ] **Step 4: Run the tests**

Run: `cd frontend && npx vitest run "app/teacher/assignments/[uuid]/progress/page.test.tsx"`
Expected: PASS, including the file's pre-existing cases.

- [ ] **Step 5: Commit**

```bash
git add "frontend/app/teacher/assignments/[uuid]/progress"
git commit -m "feat(drills): teacher can create работа над ошибками from a gap"
```

---

### Task 18: Full verification and deploy readiness

**Files:** none created; this task proves the whole feature works together.

- [ ] **Step 1: Run every suite**

```bash
cd /home/ssf/Documents/Github/speakasap/education-service && npx jest src/drills
cd /home/ssf/Documents/Github/speakasap/frontend && npx vitest run
cd /home/ssf/Documents/Github/ai-microservice && npx jest src/teacher-assistant
```

Expected: all PASS. Report any failure with its output; do not proceed past a red suite.

- [ ] **Step 2: Typecheck every changed service with its own compiler**

```bash
cd /home/ssf/Documents/Github/speakasap/education-service && npm run build
cd /home/ssf/Documents/Github/speakasap/frontend && npm run build
cd /home/ssf/Documents/Github/ai-microservice && npm run build
```

**Never `npx tsc`** — it runs an unrelated package and reads as a pass.

- [ ] **Step 3: Apply the migration to a scratch database**

```bash
# Schema-only dump of the education database, restored into a scratch DB, then:
cd /home/ssf/Documents/Github/speakasap/education-service
DATABASE_URL="<scratch-db-url>" npx prisma migrate deploy
DATABASE_URL="<scratch-db-url>" npx ts-node prisma/seed-grammar-topics.ts
```

Expected: migration applies cleanly, seed reports the topic count. An offline-generated
migration is unexecuted code — this step is what makes it tested code.

- [ ] **Step 4: Confirm the new env var is set**

`DRILL_ANALYSIS_CLIENT_TIMEOUT_MS` is optional (defaults to 120000). `AI_SERVICE_URL` and
`AI_SERVICE_JWT_SECRET` already exist for `AiClient` — verify they are present in
education-service's environment, because `AnalysisClient` shares them:

```bash
kubectl get secret <education-service-secret> -n statex-apps \
  -o go-template='{{range $k,$v := .data}}{{$k}}{{"\n"}}{{end}}' | grep -i ai_service
```

Key names only — never dump `.data` wholesale.

- [ ] **Step 5: Report ready; do NOT deploy**

Deploys are serialized and are the owner's call. Write the deploy boundary into `TASKS.md`
so the deferred deploy is not mistaken for unfinished work:

```markdown
- [ ] DEPLOY (deferred, owner runs): education-service + frontend + ai-microservice for
      работа над ошибками. Migration `<timestamp>_remedial_drills` applies first, then
      `prisma/seed-grammar-topics.ts` must run once against production.
```

- [ ] **Step 6: Commit**

```bash
git add TASKS.md
git commit -m "docs(drills): record the deferred remedial-drills deploy"
```

---

## Post-deploy verification (owner, after deploying)

Reproducing the original scenario is what proves this works — not a green suite.

1. Open the production assignment from the design doc:
   `https://speakasap.alfares.cz/teacher/assignments/159a0749-0d5f-421d-902f-b04938541932/progress`
   That drill is `IN_PROGRESS` with 12 mistakes, so it has no analysis yet — expect the
   block to render nothing.
2. Have a test student finish a drill with deliberate mistakes on two different grammar
   points. Confirm within a minute:
   - the student's page shows "Разбираем твои ошибки…" then the gap cards
   - the gaps are separate cards, not one merged card
   - the explanation is in Russian for a Russian-material course
3. On the teacher's progress page, confirm the sentence count on the button matches
   `Σ mistakeCount` (floored at 10), then click it.
4. Confirm the remedial assignment appears in `PENDING_REVIEW`, its items contain each
   failed word exactly `mistakeCount` times **in different sentences**, and the padding
   sentences use different vocabulary.
5. Approve it; confirm the student receives it and sees the same explanation above the
   items.
6. Have the student complete it cleanly. Confirm `StudentWordMastery.cleanStreak` advanced
   by exactly 1 per word:

```sql
SELECT normalized_answer, clean_streak, total_mistakes, mastered_at
FROM student_word_mastery WHERE student_id = <id> ORDER BY total_mistakes DESC;
```

7. Repeat twice more; confirm `mastered_at` is set on the third clean run and that the
   gap's remedial button then refuses with `GAP_ALREADY_MASTERED`.
