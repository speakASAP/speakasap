/**
 * One-time migration of speakasap-portal/grammar/exercises/*.py into DrillItem.
 * Idempotent on hash (DrillItem.hash is @unique). Reads the legacy files as
 * text; never imports or executes them.
 *
 * --dry-run performs ZERO database queries. Prisma is not even imported in
 * that code path — parseOnly() below only touches the filesystem and the
 * pure `parseLegacyExerciseFile` / `parseTemplate` / `hashItem` functions.
 * This lets the importer be exercised on a host with no reachable database
 * (this ecosystem requires k8s-mediated Postgres access). Apply mode (real
 * writes) is deliberately NOT run by this task — the orchestrator runs it
 * later, under the deploy lock, from a host that can reach Postgres.
 *
 * Usage:
 *   npx ts-node scripts/import-grammar-bank.ts <path-to-portal> --dry-run
 *   npx ts-node scripts/import-grammar-bank.ts <path-to-portal>          # apply (writes DB)
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { basename, join } from 'path';
import { parseLegacyExerciseFile, topicSlugFromClassName } from '../src/drills/legacy-parser';
import { parseTemplate, hashItem } from '../src/drills/template';
import { sanitizeTemplate } from '../src/drills/template-sanitize';

// Matches ANY `<word>Field(` call site (SmartExerciseField, TestField, and any field type a
// future bank might introduce). Used only to report coverage of what this importer intentionally
// does NOT attempt — never to parse those other field types.
const ANY_FIELD_CALL_RE = /\b\w+Field\(/g;
const SMART_FIELD_CALL_RE = /\bSmartExerciseField\(/g;

interface FileEntry {
  path: string;
  dir: string;
}

interface FileReport {
  file: string;
  materialLanguage: string;
  languageCode: string;
  empty: boolean;
  classes: number;
  itemsParsed: number;
  itemsInsertable: number;
  itemsSkippedNoBlanks: number;
  /** Same hash seen twice within this run (in-memory only — no DB round trip in dry-run). */
  itemsDuplicateInBatch: number;
  /**
   * Occurrences of a `*Field(` call that is NOT `SmartExerciseField(` — e.g. `TestField(label=...,
   * choices=(...))`, a multiple-choice format that is structurally incompatible with DrillItem's
   * fill-in-the-blank shape. Correctly not attempted; counted here purely so a coverage audit sees
   * the whole file, not just the subset this importer can ever produce.
   */
  otherFieldTypesSkipped: number;
}

interface ApplyFileReport extends FileReport {
  itemsInserted: number;
  itemsDuplicateInDb: number;
  topicsUnmatched: string[];
  languageMissing: boolean;
}

function materialLanguageFor(file: string, dir: string): { ml: string; lang: string } {
  const name = basename(file, '.py');
  if (dir === 'fr' || dir === 'ru') return { ml: dir, lang: name };
  const parts = name.split('__');
  return parts.length === 2 ? { ml: parts[0], lang: parts[1] } : { ml: 'ru', lang: name };
}

function collectEntries(base: string): FileEntry[] {
  const entries: FileEntry[] = [];
  for (const e of readdirSync(base)) {
    const p = join(base, e);
    if (statSync(p).isDirectory()) {
      for (const inner of readdirSync(p)) {
        const innerPath = join(p, inner);
        if (inner.endsWith('.py') && inner !== '__init__.py' && statSync(innerPath).isFile()) {
          entries.push({ path: innerPath, dir: e });
        }
      }
    } else if (e.endsWith('.py') && e !== '__init__.py') {
      entries.push({ path: p, dir: '' });
    }
  }
  return entries;
}

/** Pure parse pass: filesystem + parser + template only. No Prisma, no network. */
function parseOnly(entries: FileEntry[]): FileReport[] {
  const seenHashes = new Set<string>();
  const reports: FileReport[] = [];

  for (const { path, dir } of entries) {
    const source = readFileSync(path, 'utf8');
    const { ml, lang } = materialLanguageFor(path, dir);
    const report: FileReport = {
      file: path,
      materialLanguage: ml,
      languageCode: lang,
      empty: source.trim().length === 0,
      classes: 0,
      itemsParsed: 0,
      itemsInsertable: 0,
      itemsSkippedNoBlanks: 0,
      itemsDuplicateInBatch: 0,
      otherFieldTypesSkipped: 0,
    };

    if (!report.empty) {
      const anyFieldCalls = (source.match(ANY_FIELD_CALL_RE) ?? []).length;
      const smartFieldCalls = (source.match(SMART_FIELD_CALL_RE) ?? []).length;
      report.otherFieldTypesSkipped = anyFieldCalls - smartFieldCalls;

      for (const cls of parseLegacyExerciseFile(source, path)) {
        report.classes++;
        for (const item of cls.items) {
          report.itemsParsed++;
          const parsed = parseTemplate(item.label);
          if (parsed.blanks.length === 0) {
            report.itemsSkippedNoBlanks++;
            continue;
          }
          const hash = hashItem(parsed.plainText, lang);
          if (seenHashes.has(hash)) {
            report.itemsDuplicateInBatch++;
            continue;
          }
          seenHashes.add(hash);
          report.itemsInsertable++;
        }
      }
    }
    reports.push(report);
  }
  return reports;
}

function totalsOf(reports: FileReport[]) {
  return reports.reduce(
    (a, r) => ({
      files: a.files + 1,
      emptyFiles: a.emptyFiles + (r.empty ? 1 : 0),
      classes: a.classes + r.classes,
      parsed: a.parsed + r.itemsParsed,
      insertable: a.insertable + r.itemsInsertable,
      skippedNoBlanks: a.skippedNoBlanks + r.itemsSkippedNoBlanks,
      duplicateInBatch: a.duplicateInBatch + r.itemsDuplicateInBatch,
      otherFieldTypesSkipped: a.otherFieldTypesSkipped + r.otherFieldTypesSkipped,
    }),
    {
      files: 0,
      emptyFiles: 0,
      classes: 0,
      parsed: 0,
      insertable: 0,
      skippedNoBlanks: 0,
      duplicateInBatch: 0,
      otherFieldTypesSkipped: 0,
    },
  );
}

/**
 * Apply pass: real DB writes. Only reached when --dry-run is absent.
 * Prisma is imported lazily here so the dry-run code path above never even
 * loads the client.
 */
async function applyToDatabase(entries: FileEntry[]): Promise<ApplyFileReport[]> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const reports: ApplyFileReport[] = [];

  try {
    for (const { path, dir } of entries) {
      const source = readFileSync(path, 'utf8');
      const { ml, lang } = materialLanguageFor(path, dir);
      const report: ApplyFileReport = {
        file: path,
        materialLanguage: ml,
        languageCode: lang,
        empty: source.trim().length === 0,
        classes: 0,
        itemsParsed: 0,
        itemsInsertable: 0,
        itemsSkippedNoBlanks: 0,
        itemsDuplicateInBatch: 0,
        otherFieldTypesSkipped: 0,
        itemsInserted: 0,
        itemsDuplicateInDb: 0,
        topicsUnmatched: [],
        languageMissing: false,
      };

      if (report.empty) {
        reports.push(report);
        continue;
      }

      const language = await prisma.language.findFirst({ where: { machineName: lang } });
      if (!language) {
        report.languageMissing = true;
        reports.push(report);
        continue;
      }

      for (const cls of parseLegacyExerciseFile(source, path)) {
        report.classes++;
        const slug = topicSlugFromClassName(cls.className);

        // Topic -> GrammarLesson mapping status (verified against production, 2026-07-30):
        // GrammarLesson has 0 rows — the table exists but was never populated. Even once it is,
        // there is no mechanical mapping between exercise class slugs (English CamelCase -> kebab,
        // e.g. "comparison-adjectives") and real grammar lesson slugs (transliterated Russian,
        // e.g. "pravila-chteniya", "chislitelnye"). This lookup will therefore always miss until an
        // owner decides how (or whether) to bridge the two naming systems. Do not treat a growing
        // topicsUnmatched list as a parser bug to fix, and do not build a read-only "measure it"
        // mode for --dry-run — the answer for the current data is already known: unmatchable.
        const grammarLesson = await prisma.grammarLesson.findFirst({
          where: { OR: [{ alias: slug }, { url: slug }], course: { languageId: language.id } },
        });
        if (!grammarLesson) report.topicsUnmatched.push(slug);

        const topic = await prisma.drillTopic.upsert({
          where: { languageId_materialLanguage_slug: { languageId: language.id, materialLanguage: ml, slug } },
          create: {
            slug,
            languageId: language.id,
            materialLanguage: ml,
            title: slug.replace(/-/g, ' '),
            grammarLessonId: grammarLesson?.id ?? null,
          },
          update: {},
        });

        for (const item of cls.items) {
          report.itemsParsed++;
          const parsed = parseTemplate(item.label);
          if (parsed.blanks.length === 0) {
            report.itemsSkippedNoBlanks++;
            continue;
          }

          const hintMatch = item.label.match(/<span class="mute">(.*?)<\/span>/);
          const hash = hashItem(parsed.plainText, lang);

          try {
            await prisma.drillItem.create({
              data: {
                languageId: language.id,
                materialLanguage: ml,
                topicId: topic.id,
                // Sanitized, not raw: the label carries a trailing <span class="mute">
                // glossary that is ALSO extracted into `hint` below. Storing it here too
                // rendered the tag as literal text in the review screen and repeated the
                // glossary underneath. Nothing renders `template` as HTML, deliberately.
                template: sanitizeTemplate(item.label),
                blanks: parsed.blanks as any,
                plainText: parsed.plainText,
                hint: hintMatch ? hintMatch[1] : null,
                sourceType: 'BANK_GRAMMAR',
                sourceRef: `${basename(path, '.py')}.${cls.className}.${item.fieldName}`,
                hash,
              },
            });
            report.itemsInserted++;
          } catch (e: any) {
            if (e.code === 'P2002') report.itemsDuplicateInDb++;
            else throw e;
          }
        }
      }
      reports.push(report);
    }
  } finally {
    await prisma.$disconnect();
  }

  return reports;
}

async function main() {
  const portalRoot = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!portalRoot) throw new Error('usage: import-grammar-bank.ts <path-to-portal> [--dry-run]');

  const base = join(portalRoot, 'grammar/exercises');
  const entries = collectEntries(base);

  if (dryRun) {
    const reports = parseOnly(entries);
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          // Deliberately not an array (never `[]`) — an empty array here would read as "zero
          // topics unmatched" when the truth is "not measured". See topicsUnmatchedNote and the
          // comment above the grammarLesson lookup in applyToDatabase() for why this is not a
          // TODO: GrammarLesson has 0 rows in production, and there is no mechanical mapping
          // between exercise-class slugs and real (transliterated Russian) lesson slugs anyway.
          topicsUnmatched: null,
          topicsUnmatchedNote:
            'not measured in --dry-run (requires GrammarLesson DB lookups, which this mode never ' +
            'performs). Separately: GrammarLesson has 0 rows in production, and even populated it ' +
            'cannot mechanically match — exercise class slugs are English CamelCase-derived ' +
            '(e.g. "comparison-adjectives") while real lesson slugs are transliterated Russian ' +
            '(e.g. "pravila-chteniya"). Resolution is an owner decision, not something to measure.',
          reports,
        },
        null,
        2,
      ),
    );
    console.log('TOTALS', JSON.stringify(totalsOf(reports)));
    console.log(
      'NOTE: dry-run performed zero database queries (Prisma was never imported). ' +
        'Topic/GrammarLesson matching and true (DB-level) duplicate detection require apply mode, ' +
        'which the orchestrator runs under the deploy lock.',
    );
    return;
  }

  const reports = await applyToDatabase(entries);
  console.log(JSON.stringify({ mode: 'apply', reports }, null, 2));
  const totals = reports.reduce(
    (a, r) => ({
      inserted: a.inserted + r.itemsInserted,
      duplicateInDb: a.duplicateInDb + r.itemsDuplicateInDb,
      skippedNoBlanks: a.skippedNoBlanks + r.itemsSkippedNoBlanks,
      topicsUnmatched: a.topicsUnmatched + r.topicsUnmatched.length,
      languagesMissing: a.languagesMissing + (r.languageMissing ? 1 : 0),
    }),
    { inserted: 0, duplicateInDb: 0, skippedNoBlanks: 0, topicsUnmatched: 0, languagesMissing: 0 },
  );
  console.log('TOTALS', JSON.stringify(totals));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
