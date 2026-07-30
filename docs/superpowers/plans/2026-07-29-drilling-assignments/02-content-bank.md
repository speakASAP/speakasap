# Track A — Item Bank and Vocabulary Baseline (Wave 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate the two legacy exercise banks into content-service, and compute what vocabulary a student knows at any lesson.

**Service:** `speakasap/content-service` · **Depends on:** Track 0 · **Blocks:** Tracks A2, D

**Read first:** [`00-MASTER.md`](00-MASTER.md) (contracts C1–C3), spec §5 and §6.

**You own:** `content-service/prisma/schema.prisma` (drill models only), `content-service/src/drills/**`, `content-service/src/vocabulary/**`, `content-service/scripts/import-*.ts`. Do not touch other services.

---

### Task A.1: Prisma models for the bank

**Files:**
- Modify: `content-service/prisma/schema.prisma`
- Create: `content-service/prisma/migrations/<timestamp>_drill_bank/migration.sql` (generated)

**Interfaces:**
- Consumes: existing `Language`, `GrammarLesson`, `SevenLesson` models
- Produces: `DrillTopic`, `DrillItem`, `DrillItemRevision` Prisma models used by every later task in this track

**Table naming:** content-service's schema uses **no `@@map`** anywhere — its tables are
PascalCase (`"Language"`, `"SevenLesson"`). Drill models here follow that, so this
service's database keeps one naming style. (education-service is the opposite case and
does use `@@map`, because it maps legacy Django tables. Per-service convention wins.)

- [ ] **Step 1: Append the models to `schema.prisma`**

```prisma
model DrillTopic {
  id               Int      @id @default(autoincrement())
  slug             String   @db.VarChar(255)
  languageId       Int
  materialLanguage String   @db.VarChar(2)
  title            String   @db.VarChar(255)
  level            String?  @db.VarChar(4)
  grammarLessonId  Int?
  parentTopicId    Int?
  isNew            Boolean  @default(false)
  createdAt        DateTime @default(now())

  language Language    @relation(fields: [languageId], references: [id])
  items    DrillItem[]

  @@unique([languageId, materialLanguage, slug])
  @@index([languageId, materialLanguage])
}

model DrillItem {
  id                   Int      @id @default(autoincrement())
  languageId           Int
  materialLanguage     String   @db.VarChar(2)
  topicId              Int?
  level                String?  @db.VarChar(4)
  template             String   @db.Text
  blanks               Json
  plainText            String   @db.Text
  hint                 String?  @db.Text
  sourceType           String   @db.VarChar(16)
  sourceRef            String?  @db.VarChar(255)
  courseKey            String?  @db.VarChar(255)
  lessonOrder          Int?
  unknownWords         Json     @default("[]")
  hash                 String   @unique @db.VarChar(64)
  status               String   @default("ACTIVE") @db.VarChar(16)
  timesShown           Int      @default(0)
  timesCorrectFirstTry Int      @default(0)
  createdAt            DateTime @default(now())

  language  Language            @relation(fields: [languageId], references: [id])
  topic     DrillTopic?         @relation(fields: [topicId], references: [id])
  revisions DrillItemRevision[]

  @@index([languageId, materialLanguage, topicId, status])
  @@index([courseKey, lessonOrder])
}

model DrillItemRevision {
  id        Int      @id @default(autoincrement())
  itemId    Int
  template  String   @db.Text
  blanks    Json
  hint      String?  @db.Text
  reason    String   @db.VarChar(32)
  createdAt DateTime @default(now())

  item DrillItem @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@index([itemId, createdAt])
}
```

Add the back-relations to the existing `Language` model:

```prisma
  drillTopics DrillTopic[]
  drillItems  DrillItem[]
```

- [ ] **Step 2: Validate the schema**

```bash
cd /home/ssf/Documents/Github/speakasap/content-service
rtk npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 3: Generate the migration without applying it**

```bash
rtk npx prisma migrate dev --name drill_bank --create-only
```

Read the generated SQL. Confirm it contains only `CREATE TABLE` for the three
new tables and `CREATE INDEX` — **no `DROP`, no `ALTER` on existing tables** other
than nothing at all. If it proposes dropping anything, stop and report: the
schema has drifted from the database and that is not this task's problem to fix.

- [ ] **Step 4: Regenerate the client and typecheck**

```bash
rtk npx prisma generate && rtk npm run typecheck
```

- [ ] **Step 5: Commit (migration is applied later by the orchestrator)**

```bash
rtk git add prisma/
rtk git commit -m "feat(content): add drill bank models

Migration is created but NOT applied; the orchestrating session applies
migrations under the deploy lock.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task A.2: Template parser

The single most reused piece of code in this feature. Every other track depends
on it behaving identically.

**Files:**
- Create: `content-service/src/drills/template.ts`
- Test: `content-service/src/drills/template.spec.ts`

**Interfaces:**
- Consumes: `DrillBlank`, `ParsedTemplate`, `DRILL_BLANK_PATTERN` from `./contracts`
- Produces:
  - `parseTemplate(template: DrillTemplate): ParsedTemplate`
  - `hashItem(plainText: string, languageCode: string): string`
  - `toSegments(template: DrillTemplate): ({type:'text';value:string}|{type:'blank';index:number})[]`

  Track B imports `parseTemplate` and `toSegments`; Track D imports all three.

- [ ] **Step 1: Write the failing tests**

Create `content-service/src/drills/template.spec.ts`:

```ts
import { parseTemplate, hashItem, toSegments } from './template';

describe('parseTemplate', () => {
  it('extracts a single blank', () => {
    const r = parseTemplate('Ich gehe [in]{in} die Schule.');
    expect(r.blanks).toEqual([
      { index: 0, prompt: 'in', answer: 'in', alternatives: [] },
    ]);
    expect(r.plainText).toBe('Ich gehe in die Schule.');
  });

  it('extracts multiple blanks in order', () => {
    const r = parseTemplate('A whale is [big]{bigger} and [heavy]{heavier} than an elephant.');
    expect(r.blanks.map((b) => b.answer)).toEqual(['bigger', 'heavier']);
    expect(r.blanks.map((b) => b.index)).toEqual([0, 1]);
    expect(r.plainText).toBe('A whale is bigger and heavier than an elephant.');
  });

  it('accepts an empty prompt (suffix drill)', () => {
    const r = parseTemplate('Ich heiß[]{e} Peter.');
    expect(r.blanks).toEqual([{ index: 0, prompt: '', answer: 'e', alternatives: [] }]);
    expect(r.plainText).toBe('Ich heiße Peter.');
  });

  it('handles an apostrophe inside the answer', () => {
    const r = parseTemplate("Is [такой]{zo'} woordenboek ook duur?");
    expect(r.blanks[0].answer).toBe("zo'");
  });

  it('returns no blanks for a template without markup', () => {
    const r = parseTemplate('Das ist ein Satz.');
    expect(r.blanks).toEqual([]);
    expect(r.plainText).toBe('Das ist ein Satz.');
  });

  it('strips HTML from plainText but leaves it in the template', () => {
    const t = 'Ich gehe [in]{in} die Schule. <span class="mute">(gehen – идти)</span>';
    const r = parseTemplate(t);
    expect(r.plainText).toBe('Ich gehe in die Schule. (gehen – идти)');
  });
});

describe('toSegments', () => {
  it('interleaves text and blank markers without leaking answers', () => {
    const segs = toSegments('Ich gehe [in]{in} die Schule.');
    expect(segs).toEqual([
      { type: 'text', value: 'Ich gehe ' },
      { type: 'blank', index: 0 },
      { type: 'text', value: ' die Schule.' },
    ]);
    expect(JSON.stringify(segs)).not.toContain('{in}');
  });
});

describe('hashItem', () => {
  it('is stable and case/whitespace insensitive', () => {
    expect(hashItem('Ich gehe in die Schule.', 'de'))
      .toBe(hashItem('  ich   gehe in die schule. ', 'de'));
  });

  it('differs across languages', () => {
    expect(hashItem('Hallo', 'de')).not.toBe(hashItem('Hallo', 'en'));
  });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
rtk npm --prefix /home/ssf/Documents/Github/speakasap/content-service test -- template
```

Expected: FAIL, `Cannot find module './template'`.

- [ ] **Step 3: Implement**

Create `content-service/src/drills/template.ts`:

```ts
import { createHash } from 'crypto';
import { DrillBlank, DrillTemplate, ParsedTemplate } from './contracts';

const BLANK = /\[([^\]]*)\]\{([^}]*)\}/g;
const HTML_TAG = /<[^>]+>/g;

export function parseTemplate(template: DrillTemplate): ParsedTemplate {
  const blanks: DrillBlank[] = [];
  let index = 0;
  const substituted = template.replace(BLANK, (_m, prompt: string, answer: string) => {
    blanks.push({ index: index++, prompt, answer, alternatives: [] });
    return answer;
  });
  return { blanks, plainText: substituted.replace(HTML_TAG, '').trim() };
}

export function toSegments(
  template: DrillTemplate,
): ({ type: 'text'; value: string } | { type: 'blank'; index: number })[] {
  const segments: ({ type: 'text'; value: string } | { type: 'blank'; index: number })[] = [];
  let cursor = 0;
  let index = 0;
  for (const match of template.matchAll(BLANK)) {
    const at = match.index!;
    if (at > cursor) segments.push({ type: 'text', value: template.slice(cursor, at) });
    segments.push({ type: 'blank', index: index++ });
    cursor = at + match[0].length;
  }
  if (cursor < template.length) segments.push({ type: 'text', value: template.slice(cursor) });
  return segments;
}

export function hashItem(plainText: string, languageCode: string): string {
  const normalized = plainText.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(`${languageCode}::${normalized}`).digest('hex');
}
```

- [ ] **Step 4: Run and confirm PASS**

```bash
rtk npm --prefix /home/ssf/Documents/Github/speakasap/content-service test -- template
```

Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/ssf/Documents/Github/speakasap/content-service
rtk git add src/drills/template.ts src/drills/template.spec.ts
rtk git commit -m "feat(content): drill template parser

Handles the legacy [prompt]{answer} markup including empty prompts
(suffix drills) and apostrophes in answers. toSegments carries no
answers, so it is safe to send to a student.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task A.3: Grammar bank importer

**Files:**
- Create: `content-service/scripts/import-grammar-bank.ts`
- Create: `content-service/src/drills/legacy-parser.ts`
- Test: `content-service/src/drills/legacy-parser.spec.ts`
- Test fixture: `content-service/src/drills/__fixtures__/grammar-sample.py`

**Interfaces:**
- Consumes: `parseTemplate`, `hashItem` from `./template`
- Produces: `parseLegacyExerciseFile(source: string, filename: string): LegacyExerciseClass[]` where
  ```ts
  export interface LegacyExerciseItem { fieldName: string; label: string; }
  export interface LegacyExerciseClass { className: string; items: LegacyExerciseItem[]; }
  ```
  Task A.4 reuses this parser unchanged.

- [ ] **Step 1: Create the fixture**

Create `content-service/src/drills/__fixtures__/grammar-sample.py` with content
copied verbatim from the real bank, covering every awkward case:

```python
from marathon.forms import AnswerForm
from speakasap_site.forms import SmartExerciseField


class ComparisonAdjectivesEx1(AnswerForm):
    ex1 = SmartExerciseField(label='Мой лучший друг живёт в этом доме. My [good]{best} friend lives in this house. <span class="mute">(good – хороший)</span>')
    ex2 = SmartExerciseField(label='Кит больше. A whale is [big]{bigger} and [heavy]{heavier}.')
    ex3 = SmartExerciseField(
        label='Ich studier[]{e} nicht. <span class="mute">(studieren – учиться)</span>')


class DemonstrativePronounsEx1(AnswerForm):
    ex1 = SmartExerciseField(label='Is [такой]{zo\'} woordenboek ook duur?')
```

- [ ] **Step 2: Write the failing test**

Create `content-service/src/drills/legacy-parser.spec.ts`:

```ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseLegacyExerciseFile, topicSlugFromClassName } from './legacy-parser';

const source = readFileSync(join(__dirname, '__fixtures__/grammar-sample.py'), 'utf8');

describe('parseLegacyExerciseFile', () => {
  it('finds every AnswerForm class', () => {
    const classes = parseLegacyExerciseFile(source, 'german.py');
    expect(classes.map((c) => c.className))
      .toEqual(['ComparisonAdjectivesEx1', 'DemonstrativePronounsEx1']);
  });

  it('finds all fields including the one wrapped across lines', () => {
    const [first] = parseLegacyExerciseFile(source, 'german.py');
    expect(first.items.map((i) => i.fieldName)).toEqual(['ex1', 'ex2', 'ex3']);
  });

  it('preserves the empty-prompt suffix drill', () => {
    const [first] = parseLegacyExerciseFile(source, 'german.py');
    expect(first.items[2].label).toContain('studier[]{e}');
  });

  it('unescapes a backslash-escaped apostrophe', () => {
    const classes = parseLegacyExerciseFile(source, 'dutch.py');
    expect(classes[1].items[0].label).toContain("{zo'}");
  });
});

describe('topicSlugFromClassName', () => {
  it('strips the trailing exercise number and kebab-cases', () => {
    expect(topicSlugFromClassName('ComparisonAdjectivesEx1')).toBe('comparison-adjectives');
    expect(topicSlugFromClassName('Lesson1Ex1')).toBe('lesson1');
  });
});
```

- [ ] **Step 3: Run, confirm failure**

```bash
rtk npm --prefix /home/ssf/Documents/Github/speakasap/content-service test -- legacy-parser
```

- [ ] **Step 4: Implement the parser**

Create `content-service/src/drills/legacy-parser.ts`:

```ts
export interface LegacyExerciseItem {
  fieldName: string;
  label: string;
}

export interface LegacyExerciseClass {
  className: string;
  items: LegacyExerciseItem[];
}

const CLASS_RE = /^class\s+(\w+)\s*\(\s*AnswerForm\s*\)\s*:/gm;
const FIELD_RE = /(\bex\d+)\s*=\s*SmartExerciseField\(\s*label\s*=\s*(['"])([\s\S]*?)\2\s*\)/g;

function unescapePythonString(raw: string): string {
  return raw.replace(/\\(['"\\])/g, '$1');
}

export function parseLegacyExerciseFile(source: string, _filename: string): LegacyExerciseClass[] {
  const boundaries: { className: string; start: number }[] = [];
  for (const m of source.matchAll(CLASS_RE)) {
    boundaries.push({ className: m[1], start: m.index! + m[0].length });
  }

  return boundaries.map((b, i) => {
    const end = i + 1 < boundaries.length ? boundaries[i + 1].start : source.length;
    const body = source.slice(b.start, end);
    const items: LegacyExerciseItem[] = [];
    for (const f of body.matchAll(FIELD_RE)) {
      items.push({ fieldName: f[1], label: unescapePythonString(f[3]) });
    }
    return { className: b.className, items };
  });
}

export function topicSlugFromClassName(className: string): string {
  return className
    .replace(/Ex\d+$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}
```

- [ ] **Step 5: Run, confirm PASS**

Expected: 5 passed.

- [ ] **Step 6: Write the importer script**

Create `content-service/scripts/import-grammar-bank.ts`:

```ts
/**
 * One-time migration of speakasap-portal/grammar/exercises/*.py into DrillItem.
 * Idempotent on hash. Reads the legacy files as text; never executes them.
 *
 * Usage: npx ts-node scripts/import-grammar-bank.ts <path-to-portal> [--dry-run]
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { basename, join } from 'path';
import { PrismaClient } from '@prisma/client';
import { parseLegacyExerciseFile, topicSlugFromClassName } from '../src/drills/legacy-parser';
import { parseTemplate, hashItem } from '../src/drills/template';

interface Report {
  file: string;
  classes: number;
  itemsParsed: number;
  itemsInserted: number;
  itemsDuplicate: number;
  itemsSkippedNoBlanks: number;
  topicsUnmatched: string[];
}

function materialLanguageFor(file: string, dir: string): { ml: string; lang: string } {
  const name = basename(file, '.py');
  if (dir === 'fr' || dir === 'ru') return { ml: dir, lang: name };
  const parts = name.split('__');
  return parts.length === 2 ? { ml: parts[0], lang: parts[1] } : { ml: 'ru', lang: name };
}

async function main() {
  const portalRoot = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!portalRoot) throw new Error('usage: import-grammar-bank.ts <path-to-portal> [--dry-run]');

  const prisma = new PrismaClient();
  const base = join(portalRoot, 'grammar/exercises');
  const reports: Report[] = [];

  const entries: { path: string; dir: string }[] = [];
  for (const e of readdirSync(base)) {
    const p = join(base, e);
    if (statSync(p).isDirectory()) {
      for (const inner of readdirSync(p)) {
        if (inner.endsWith('.py') && inner !== '__init__.py') {
          entries.push({ path: join(p, inner), dir: e });
        }
      }
    } else if (e.endsWith('.py') && e !== '__init__.py') {
      entries.push({ path: p, dir: '' });
    }
  }

  for (const { path, dir } of entries) {
    const source = readFileSync(path, 'utf8');
    const report: Report = {
      file: path, classes: 0, itemsParsed: 0, itemsInserted: 0,
      itemsDuplicate: 0, itemsSkippedNoBlanks: 0, topicsUnmatched: [],
    };
    if (source.trim().length === 0) { reports.push(report); continue; }

    const { ml, lang } = materialLanguageFor(path, dir);
    const language = await prisma.language.findFirst({ where: { machineName: lang } });
    if (!language) { report.topicsUnmatched.push(`LANGUAGE_NOT_FOUND:${lang}`); reports.push(report); continue; }

    for (const cls of parseLegacyExerciseFile(source, path)) {
      report.classes++;
      const slug = topicSlugFromClassName(cls.className);

      const grammarLesson = await prisma.grammarLesson.findFirst({
        where: { OR: [{ alias: slug }, { url: slug }], course: { languageId: language.id } },
      });
      if (!grammarLesson) report.topicsUnmatched.push(slug);

      const topic = dryRun ? { id: -1 } : await prisma.drillTopic.upsert({
        where: { languageId_materialLanguage_slug: { languageId: language.id, materialLanguage: ml, slug } },
        create: {
          slug, languageId: language.id, materialLanguage: ml,
          title: slug.replace(/-/g, ' '), grammarLessonId: grammarLesson?.id ?? null,
        },
        update: {},
      });

      for (const item of cls.items) {
        report.itemsParsed++;
        const parsed = parseTemplate(item.label);
        if (parsed.blanks.length === 0) { report.itemsSkippedNoBlanks++; continue; }

        const hintMatch = item.label.match(/<span class="mute">(.*?)<\/span>/);
        const hash = hashItem(parsed.plainText, lang);

        if (dryRun) { report.itemsInserted++; continue; }
        try {
          await prisma.drillItem.create({
            data: {
              languageId: language.id, materialLanguage: ml, topicId: topic.id,
              template: item.label, blanks: parsed.blanks as any, plainText: parsed.plainText,
              hint: hintMatch ? hintMatch[1] : null,
              sourceType: 'BANK_GRAMMAR',
              sourceRef: `${basename(path, '.py')}.${cls.className}.${item.fieldName}`,
              hash,
            },
          });
          report.itemsInserted++;
        } catch (e: any) {
          if (e.code === 'P2002') report.itemsDuplicate++;
          else throw e;
        }
      }
    }
    reports.push(report);
  }

  console.log(JSON.stringify({ mode: dryRun ? 'dry-run' : 'apply', reports }, null, 2));
  const totals = reports.reduce(
    (a, r) => ({
      parsed: a.parsed + r.itemsParsed,
      inserted: a.inserted + r.itemsInserted,
      duplicate: a.duplicate + r.itemsDuplicate,
      skipped: a.skipped + r.itemsSkippedNoBlanks,
    }),
    { parsed: 0, inserted: 0, duplicate: 0, skipped: 0 },
  );
  console.log('TOTALS', JSON.stringify(totals));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 7: Dry-run against the real bank**

```bash
cd /home/ssf/Documents/Github/speakasap/content-service
rtk npx ts-node scripts/import-grammar-bank.ts \
  /home/ssf/Documents/Github/speakasap-portal --dry-run 2>&1 | tail -40
```

Read the totals. Record `parsed`, `skipped` and the unmatched topic count in the
status file — this is the coverage number the spec's risk section asks for. Do
not apply yet; the orchestrator applies migrations and imports under the lock.

- [ ] **Step 8: Commit**

```bash
rtk git add src/drills/legacy-parser.ts src/drills/legacy-parser.spec.ts \
  src/drills/__fixtures__ scripts/import-grammar-bank.ts
rtk git commit -m "feat(content): grammar bank importer

Parses the legacy SmartExerciseField files as text. Idempotent on hash,
reports coverage per file. Dry-run verified against the real bank.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task A.4: Course-material bank importer

**Files:**
- Create: `content-service/scripts/import-seven-bank.ts`
- Test: `content-service/src/drills/seven-mapping.spec.ts`
- Create: `content-service/src/drills/seven-mapping.ts`

**Interfaces:**
- Consumes: `parseLegacyExerciseFile`, `parseTemplate`, `hashItem`
- Produces: `lessonOrderFromClassName(className: string): number | null`, and `DrillItem` rows with `sourceType = 'BANK_SEVEN'`, `courseKey` and `lessonOrder` populated. **Task A.6 depends on these rows existing** to build the vocabulary baseline.

- [ ] **Step 1: Write the failing test**

Create `content-service/src/drills/seven-mapping.spec.ts`:

```ts
import { lessonOrderFromClassName, courseKeyFor } from './seven-mapping';

describe('lessonOrderFromClassName', () => {
  it('reads the lesson number', () => {
    expect(lessonOrderFromClassName('Lesson1Ex1')).toBe(1);
    expect(lessonOrderFromClassName('Lesson12Ex3')).toBe(12);
  });

  it('returns null for a non-lesson class', () => {
    expect(lessonOrderFromClassName('ComparisonAdjectivesEx1')).toBeNull();
  });
});

describe('courseKeyFor', () => {
  it('joins language and material language', () => {
    expect(courseKeyFor('german', 'ru')).toBe('seven:german:ru');
  });
});
```

- [ ] **Step 2: Run, confirm failure. Then implement**

Create `content-service/src/drills/seven-mapping.ts`:

```ts
export function lessonOrderFromClassName(className: string): number | null {
  const m = className.match(/^Lesson(\d+)Ex\d+$/);
  return m ? Number(m[1]) : null;
}

export function courseKeyFor(languageMachineName: string, materialLanguage: string): string {
  return `seven:${languageMachineName}:${materialLanguage}`;
}
```

- [ ] **Step 3: Run, confirm PASS (3 passed)**

- [ ] **Step 4: Write the importer**

Create `content-service/scripts/import-seven-bank.ts` as a copy of
`import-grammar-bank.ts` with these differences, and no others:

1. Base path is `join(portalRoot, 'seven/exercises')`.
2. `sourceType` is `'BANK_SEVEN'`.
3. Before inserting, compute:
   ```ts
   const lessonOrder = lessonOrderFromClassName(cls.className);
   const courseKey = courseKeyFor(lang, ml);
   ```
   and pass `courseKey` and `lessonOrder` in the `create` data.
4. Topic resolution uses the seven lesson, not the grammar lesson:
   ```ts
   const sevenLesson = lessonOrder === null ? null : await prisma.sevenLesson.findFirst({
     where: { order: lessonOrder, course: { languageId: language.id, materialLanguage: ml } },
   });
   ```
   Topic slug stays `topicSlugFromClassName(cls.className)`; when `sevenLesson`
   is found, set the topic title to `sevenLesson.title` instead of the
   de-kebabed slug.
5. Skip classes where `lessonOrder` is `null` and count them in the report as
   `itemsSkippedNoLesson` — a seven exercise that cannot be placed in a lesson
   is useless for the vocabulary baseline.

- [ ] **Step 5: Dry-run and record coverage**

```bash
rtk npx ts-node scripts/import-seven-bank.ts \
  /home/ssf/Documents/Github/speakasap-portal --dry-run 2>&1 | tail -40
```

Record totals in the status file, and specifically the per-language count of
items with a non-null `lessonOrder`. Task A.6 cannot build a useful baseline for
a language with zero such items — flag any language where that is the case.

- [ ] **Step 6: Commit**

```bash
rtk git add src/drills/seven-mapping.ts src/drills/seven-mapping.spec.ts \
  scripts/import-seven-bank.ts
rtk git commit -m "feat(content): course-material bank importer

Items land tagged with courseKey and lessonOrder, which is what makes the
vocabulary baseline computable.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task A.5: Tokenizer and stopwords

**Files:**
- Create: `content-service/src/vocabulary/tokenize.ts`
- Create: `content-service/src/vocabulary/stopwords.ts`
- Test: `content-service/src/vocabulary/tokenize.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `tokenizeContentWords(text: string, languageCode: string): string[]` — used by Task A.6 (baseline building), Task A.7 (ratio checking) and Track D (validation).

- [ ] **Step 1: Write the failing test**

```ts
import { tokenizeContentWords } from './tokenize';

describe('tokenizeContentWords', () => {
  it('lowercases and NFC-normalizes', () => {
    expect(tokenizeContentWords('Schule HAUS', 'de')).toEqual(['schule', 'haus']);
  });

  it('drops German stopwords', () => {
    expect(tokenizeContentWords('Ich gehe in die Schule', 'de')).toEqual(['gehe', 'schule']);
  });

  it('drops punctuation but keeps diacritics', () => {
    expect(tokenizeContentWords('Café, s\'il vous plaît!', 'fr')).toEqual(['café', 'plaît']);
  });

  it('returns an empty array for empty input', () => {
    expect(tokenizeContentWords('', 'de')).toEqual([]);
  });

  it('falls back to no stopword filtering for an unknown language', () => {
    expect(tokenizeContentWords('foo bar', 'xx')).toEqual(['foo', 'bar']);
  });
});
```

- [ ] **Step 2: Run, confirm failure. Then implement stopwords**

Create `content-service/src/vocabulary/stopwords.ts`. Include at minimum the
articles, pronouns, prepositions-as-function-words, auxiliaries and
conjunctions for the languages with a non-empty bank. Start with these five and
extend as coverage demands:

```ts
export const STOPWORDS: Record<string, ReadonlySet<string>> = {
  de: new Set(['der','die','das','den','dem','des','ein','eine','einen','einem','einer','eines',
    'ich','du','er','sie','es','wir','ihr','und','oder','aber','in','zu','mit','von','ist','sind',
    'war','waren','nicht','auch','als','wie','an','auf','für','bei','nach','aus','um']),
  en: new Set(['the','a','an','i','you','he','she','it','we','they','and','or','but','in','to',
    'with','of','is','are','was','were','not','also','as','like','on','for','at','from','about']),
  fr: new Set(['le','la','les','un','une','des','je','tu','il','elle','nous','vous','ils','elles',
    'et','ou','mais','dans','a','avec','de','est','sont','etait','pas','aussi','comme','sur',
    'pour','chez','s','il','y','en']),
  es: new Set(['el','la','los','las','un','una','yo','tu','el','ella','nosotros','vosotros','ellos',
    'y','o','pero','en','a','con','de','es','son','era','no','tambien','como','sobre','para','por']),
  ru: new Set(['и','в','во','не','что','он','на','я','с','со','как','а','то','все','она','так',
    'его','но','да','ты','к','у','же','вы','за','бы','по','только','ее','мне','было','вот','от']),
};

export function stopwordsFor(languageCode: string): ReadonlySet<string> {
  return STOPWORDS[languageCode] ?? new Set<string>();
}
```

- [ ] **Step 3: Implement the tokenizer**

```ts
import { stopwordsFor } from './stopwords';

const WORD = /[\p{L}\p{M}'’-]+/gu;

export function tokenizeContentWords(text: string, languageCode: string): string[] {
  if (!text) return [];
  const stop = stopwordsFor(languageCode);
  const out: string[] = [];
  for (const m of text.normalize('NFC').toLowerCase().matchAll(WORD)) {
    const w = m[0].replace(/^['’-]+|['’-]+$/g, '');
    if (w.length === 0) continue;
    if (stop.has(w)) continue;
    out.push(w);
  }
  return out;
}
```

- [ ] **Step 4: Run, confirm PASS (5 passed)**

Note the French case: `s'il` tokenizes to `s'il`, which is not in the stopword
list, so the third test will fail unless `s` and `il` are handled. Fix by adding
an apostrophe-split before filtering:

```ts
  for (const raw of text.normalize('NFC').toLowerCase().split(/[’']/).join(' ').matchAll(WORD)) {
```

Rerun until green. Do not weaken the test to make it pass.

- [ ] **Step 5: Commit**

```bash
rtk git add src/vocabulary/
rtk git commit -m "feat(content): content-word tokenizer with per-language stopwords

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task A.6: CourseVocabulary model and builder

**Files:**
- Modify: `content-service/prisma/schema.prisma`
- Create: `content-service/src/vocabulary/vocabulary.service.ts`
- Create: `content-service/scripts/build-course-vocabulary.ts`
- Test: `content-service/src/vocabulary/vocabulary.service.spec.ts`

**Interfaces:**
- Consumes: `tokenizeContentWords`, `DrillItem` rows with `sourceType='BANK_SEVEN'`
- Produces: `VocabularyService.getBaseline(courseKey, languageCode, maxLessonOrder): Promise<VocabularyBaseline>` — Track D calls this before every generation.

- [ ] **Step 1: Add the model**

```prisma
model CourseVocabulary {
  id          Int      @id @default(autoincrement())
  courseKey   String   @db.VarChar(255)
  languageId  Int
  lessonOrder Int
  word        String   @db.VarChar(255)
  lemma       String?  @db.VarChar(255)
  translation String?  @db.Text
  source      String   @db.VarChar(16)
  createdAt   DateTime @default(now())

  @@unique([courseKey, languageId, word, source])
  @@index([courseKey, languageId, lessonOrder])
}
```

Run `rtk npx prisma validate && rtk npx prisma migrate dev --name course_vocabulary --create-only`.

- [ ] **Step 2: Write the failing test**

```ts
import { VocabularyService } from './vocabulary.service';

const prisma = {
  courseVocabulary: { findMany: jest.fn() },
} as any;

describe('VocabularyService.getBaseline', () => {
  it('includes only lessons at or below maxLessonOrder and builds a lookup index', async () => {
    prisma.courseVocabulary.findMany.mockResolvedValue([
      { word: 'schule', lemma: null, translation: 'школа', lessonOrder: 1, source: 'THEME' },
      { word: 'wohnen', lemma: 'wohnen', translation: 'жить', lessonOrder: 3, source: 'ITEM' },
    ]);
    const svc = new VocabularyService(prisma);
    const baseline = await svc.getBaseline('seven:german:ru', 'de', 4);

    expect(prisma.courseVocabulary.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ lessonOrder: { lte: 4 } }) }),
    );
    expect(baseline.index).toEqual(expect.arrayContaining(['schule', 'wohnen']));
    expect(baseline.maxLessonOrder).toBe(4);
  });

  it('returns an empty baseline rather than throwing when a course has no vocabulary', async () => {
    prisma.courseVocabulary.findMany.mockResolvedValue([]);
    const svc = new VocabularyService(prisma);
    const baseline = await svc.getBaseline('seven:greek:ru', 'el', 5);
    expect(baseline.words).toEqual([]);
    expect(baseline.index).toEqual([]);
  });
});
```

- [ ] **Step 3: Run, confirm failure. Implement**

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VocabularyBaseline, VocabularyWord } from '../drills/contracts';

@Injectable()
export class VocabularyService {
  constructor(private readonly prisma: PrismaService) {}

  async getBaseline(
    courseKey: string,
    languageCode: string,
    maxLessonOrder: number,
  ): Promise<VocabularyBaseline> {
    const rows = await this.prisma.courseVocabulary.findMany({
      where: { courseKey, lessonOrder: { lte: maxLessonOrder } },
      select: { word: true, lemma: true, translation: true, lessonOrder: true, source: true },
    });

    const words: VocabularyWord[] = rows.map((r) => ({
      word: r.word,
      lemma: r.lemma,
      translation: r.translation,
      lessonOrder: r.lessonOrder,
      source: r.source as VocabularyWord['source'],
    }));

    const index = Array.from(
      new Set(words.flatMap((w) => (w.lemma ? [w.word, w.lemma] : [w.word]))),
    );

    return { courseKey, languageCode, maxLessonOrder, words, index };
  }
}
```

- [ ] **Step 4: Run, confirm PASS (2 passed)**

- [ ] **Step 5: Write the builder script**

Create `content-service/scripts/build-course-vocabulary.ts`. For each
`SevenCourse`, for each `SevenLesson` in order:

1. `THEME` source — words from `WordTheme` where `moduleClass` matches the
   course's module and `order <= lesson.order`, joined through
   `WordThemeRelation` to `Word` (take `word` and `translation`).
2. `ITEM` source — `tokenizeContentWords(item.plainText, languageCode)` over
   every `DrillItem` with this `courseKey` and `lessonOrder === lesson.order`.
3. `LESSON_BODY` source — `tokenizeContentWords(stripHtml(lesson.bodyHtml), languageCode)`.

Upsert each word with the **lowest** `lessonOrder` at which it appears — a word
introduced in lesson 2 must not be recorded as first seen in lesson 7. Use
`skipDuplicates` and a final pass that collapses duplicates to the minimum
`lessonOrder`.

Finish by printing a coverage table: one row per `courseKey` with the total word
count and the count at lessons 1–5. **A course with fewer than 50 words at
lesson 5 is flagged in the output as too thin for the 80/20 rule** — the spec's
named risk.

- [ ] **Step 6: Dry-run and record the coverage table in the status file**

```bash
rtk npx ts-node scripts/build-course-vocabulary.ts --dry-run 2>&1 | tail -40
```

- [ ] **Step 7: Commit**

```bash
rtk git add prisma/ src/vocabulary/ scripts/build-course-vocabulary.ts
rtk git commit -m "feat(content): course vocabulary baseline

Materializes what a student knows by lesson N from three sources.
Reports per-course coverage so thin courses are known before generation
depends on them.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task A.7: The 80/20 ratio checker

**Files:**
- Create: `content-service/src/vocabulary/ratio.ts`
- Test: `content-service/src/vocabulary/ratio.spec.ts`

**Interfaces:**
- Consumes: `tokenizeContentWords`, `VocabularyBaseline`, `VocabularyRatioResult`, `VOCABULARY_MIN_KNOWN_RATIO`, `VOCABULARY_MAX_NEW_WORDS_PER_SENTENCE`
- Produces: `checkVocabularyRatio(plainTexts: string[], baseline: VocabularyBaseline): VocabularyRatioResult` — called by Track D before the validation agent, and by Task A.8 to filter bank search results.

- [ ] **Step 1: Write the failing test — boundaries first**

```ts
import { checkVocabularyRatio } from './ratio';
import { VocabularyBaseline } from '../drills/contracts';

const baseline = (words: string[]): VocabularyBaseline => ({
  courseKey: 'seven:german:ru', languageCode: 'de', maxLessonOrder: 5,
  words: [], index: words,
});

describe('checkVocabularyRatio', () => {
  it('passes when every content word is known', () => {
    const r = checkVocabularyRatio(['Ich gehe zur Schule'], baseline(['gehe', 'zur', 'schule']));
    expect(r.knownRatio).toBe(1);
    expect(r.unknownWords).toEqual([]);
    expect(r.passes).toBe(true);
  });

  it('passes at exactly 80 percent', () => {
    // 5 content words, 1 unknown => 0.8
    const r = checkVocabularyRatio(
      ['Hund Katze Maus Vogel Elefant'],
      baseline(['hund', 'katze', 'maus', 'vogel']),
    );
    expect(r.knownRatio).toBeCloseTo(0.8);
    expect(r.passes).toBe(true);
  });

  it('fails just below 80 percent', () => {
    const r = checkVocabularyRatio(
      ['Hund Katze Maus Vogel Elefant Tiger Loewe Baer Fuchs Wolf'],
      baseline(['hund', 'katze', 'maus', 'vogel', 'elefant', 'tiger', 'loewe']),
    );
    expect(r.knownRatio).toBeCloseTo(0.7);
    expect(r.passes).toBe(false);
  });

  it('fails when one sentence has 3 unknown words even if the set ratio passes', () => {
    const known = Array.from({ length: 40 }, (_, i) => `w${i}`);
    const sentences = [known.slice(0, 20).join(' '), 'alpha beta gamma'];
    const r = checkVocabularyRatio(sentences, baseline(known));
    expect(r.knownRatio).toBeGreaterThanOrEqual(0.8);
    expect(r.perItemUnknownCount[1]).toBe(3);
    expect(r.passes).toBe(false);
  });

  it('reports unknown words deduplicated in first-appearance order', () => {
    const r = checkVocabularyRatio(['Zebra Zebra Yak'], baseline([]));
    expect(r.unknownWords).toEqual(['zebra', 'yak']);
  });

  it('treats an empty baseline as everything unknown, without dividing by zero', () => {
    const r = checkVocabularyRatio([''], baseline([]));
    expect(r.knownRatio).toBe(1);
    expect(r.passes).toBe(true);
  });
});
```

The last case matters: an empty input must not produce `NaN`. Decide it is
vacuously passing and assert it, rather than discovering it in production.

- [ ] **Step 2: Run, confirm failure. Implement**

```ts
import {
  VocabularyBaseline, VocabularyRatioResult,
  VOCABULARY_MIN_KNOWN_RATIO, VOCABULARY_MAX_NEW_WORDS_PER_SENTENCE,
} from '../drills/contracts';
import { tokenizeContentWords } from './tokenize';

export function checkVocabularyRatio(
  plainTexts: string[],
  baseline: VocabularyBaseline,
): VocabularyRatioResult {
  const known = new Set(baseline.index);
  const unknownWords: string[] = [];
  const seenUnknown = new Set<string>();
  const perItemUnknownCount: number[] = [];
  let total = 0;
  let knownCount = 0;

  for (const text of plainTexts) {
    const tokens = tokenizeContentWords(text, baseline.languageCode);
    let itemUnknown = 0;
    for (const t of tokens) {
      total++;
      if (known.has(t)) {
        knownCount++;
      } else {
        itemUnknown++;
        if (!seenUnknown.has(t)) { seenUnknown.add(t); unknownWords.push(t); }
      }
    }
    perItemUnknownCount.push(itemUnknown);
  }

  const knownRatio = total === 0 ? 1 : knownCount / total;
  const passes =
    knownRatio >= VOCABULARY_MIN_KNOWN_RATIO &&
    perItemUnknownCount.every((n) => n <= VOCABULARY_MAX_NEW_WORDS_PER_SENTENCE);

  return { knownRatio, unknownWords, perItemUnknownCount, passes };
}
```

- [ ] **Step 3: Run, confirm PASS (6 passed)**

- [ ] **Step 4: Commit**

```bash
rtk git add src/vocabulary/ratio.ts src/vocabulary/ratio.spec.ts
rtk git commit -m "feat(content): 80/20 vocabulary ratio checker

Set-level ratio plus a per-sentence cap, because a set-level ratio alone
lets one sentence become impenetrable while the set still passes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task A.8: Bank query API

**Files:**
- Create: `content-service/src/drills/drills.controller.ts`
- Create: `content-service/src/drills/drills.service.ts`
- Create: `content-service/src/drills/drills.module.ts`
- Create: `content-service/src/vocabulary/vocabulary.controller.ts`
- Modify: `content-service/src/app.module.ts`
- Test: `content-service/src/drills/drills.service.spec.ts`

**Interfaces:**
- Consumes: everything above
- Produces: the HTTP surface Track D and Track F call:
  - `GET /api/v1/drill-topics?languageCode=&materialLanguage=` → `DrillTopicDTO[]`
  - `POST /api/v1/drill-items/search` → `DrillItemSearchResponse`
  - `GET /api/v1/course-vocabulary?courseKey=&languageCode=&maxLessonOrder=` → `VocabularyBaseline`

- [ ] **Step 1: Write the failing service test**

```ts
import { DrillsService } from './drills.service';

const prisma = { drillItem: { findMany: jest.fn() }, drillTopic: { findMany: jest.fn() } } as any;
const vocabulary = { getBaseline: jest.fn() } as any;

describe('DrillsService.searchItems', () => {
  beforeEach(() => jest.resetAllMocks());

  it('excludes items whose hash is in excludeHashes', async () => {
    prisma.drillItem.findMany.mockResolvedValue([]);
    const svc = new DrillsService(prisma, vocabulary);
    await svc.searchItems({
      languageCode: 'de', materialLanguage: 'ru', topicSlugs: ['prepositions'],
      limit: 10, excludeHashes: ['abc'],
    });
    expect(prisma.drillItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ hash: { notIn: ['abc'] } }),
      }),
    );
  });

  it('restricts course-material items to maxLessonOrder', async () => {
    prisma.drillItem.findMany.mockResolvedValue([]);
    const svc = new DrillsService(prisma, vocabulary);
    await svc.searchItems({
      languageCode: 'de', materialLanguage: 'ru', topicSlugs: [],
      courseKey: 'seven:german:ru', maxLessonOrder: 4, limit: 10,
    });
    expect(prisma.drillItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lessonOrder: { lte: 4 } }),
      }),
    );
  });

  it('drops items violating the vocabulary baseline when one is supplied', async () => {
    prisma.drillItem.findMany.mockResolvedValue([
      { id: 1, plainText: 'bekannt wort', blanks: [], template: 'x', hash: 'h1',
        languageId: 1, materialLanguage: 'ru', sourceType: 'BANK_GRAMMAR',
        courseKey: null, lessonOrder: null, level: null, hint: null,
        unknownWords: [], topic: { slug: 'prepositions' } },
      { id: 2, plainText: 'unbekannt fremd exotisch', blanks: [], template: 'y', hash: 'h2',
        languageId: 1, materialLanguage: 'ru', sourceType: 'BANK_GRAMMAR',
        courseKey: null, lessonOrder: null, level: null, hint: null,
        unknownWords: [], topic: { slug: 'prepositions' } },
    ]);
    const svc = new DrillsService(prisma, vocabulary);
    const res = await svc.searchItems({
      languageCode: 'de', materialLanguage: 'ru', topicSlugs: ['prepositions'],
      limit: 10, vocabularyBaseline: ['bekannt', 'wort'],
    });
    expect(res.items.map((i) => i.id)).toEqual([1]);
  });
});
```

- [ ] **Step 2: Run, confirm failure. Implement the service**

Key points for the implementation:

- Build `where` incrementally; only add `lessonOrder: { lte }` when
  `maxLessonOrder` is defined, only add `hash: { notIn }` when `excludeHashes`
  is non-empty (an empty `notIn` array is a Prisma error, not a no-op).
- Apply the vocabulary filter **in memory after the query**, using
  `checkVocabularyRatio([item.plainText], syntheticBaseline)` per item — this is
  a per-item check, so `perItemUnknownCount[0] <= 2` is the operative condition.
- Ordering: `timesCorrectFirstTry / GREATEST(timesShown, 1)` inside the 0.55–0.90
  band first, then everything else, then a seeded shuffle. Implement the seeded
  shuffle as a small pure function so the `seed` parameter makes tests
  deterministic.
- Map rows to `DrillItemDTO` — note the DTO exposes `topicSlug`, not `topicId`.

- [ ] **Step 3: Run, confirm PASS (3 passed)**

- [ ] **Step 4: Write the controllers**

`DrillsController` with `@Controller('api/v1')` exposing `GET drill-topics` and
`POST drill-items/search`; `VocabularyController` exposing
`GET course-vocabulary`. Guard all three with the service's existing JWT guard —
read `content-service/src/auth/` and use the same guard the existing controllers
use. Do not invent a new auth mechanism.

`GET /api/v1/drill-topics` must compute `publicUrl` by joining `GrammarLesson`
and building the public URL the same way the existing grammar controller does.
Read `content-service/src/grammar/grammar.controller.ts` and reuse its helper
rather than duplicating the URL logic.

- [ ] **Step 5: Register the modules in `app.module.ts`, typecheck, run all tests**

```bash
cd /home/ssf/Documents/Github/speakasap/content-service
rtk npm run typecheck && rtk npm test
```

Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
rtk git add src/drills/ src/vocabulary/ src/app.module.ts
rtk git commit -m "feat(content): bank query and vocabulary API

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Track A completion checklist

- [ ] `rtk npm test` green in content-service
- [ ] `rtk npm run typecheck` clean
- [ ] Two migrations created, **neither applied** (orchestrator applies them)
- [ ] Both importers dry-run against the real portal, totals recorded
- [ ] Vocabulary coverage table recorded, thin courses named
- [ ] Status file at `status/track-a.md` with pasted output

**Hand off to Track A2 (library) and Track D (orchestration).** They need
`parseTemplate`, `checkVocabularyRatio`, `VocabularyService.getBaseline` and the
three HTTP endpoints.
