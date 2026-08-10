/**
 * One-off: drop the leading full translation from DrillItem.template.
 *
 * Items for a Russian-taught English course carry the sentence twice — the Russian
 * translation, then the English sentence with the blanks:
 *
 *   "Она может сделать эту работу без моей помощи.
 *    She can do this work [без]{without} my help."
 *
 * The student is learning English, and each blank already carries its own prompt, so the
 * leading sentence hands her the whole meaning before she reads any English.
 *
 * SAFE TO RE-RUN: an already-stripped template strips to itself.
 *
 * `plainText` and `hash` are recomputed — both derive from the template, and a stale hash
 * would break dedup against newly imported items. A row whose stripped text collides with
 * an existing hash is REPORTED and skipped, never merged: collapsing two rows into one is
 * a content decision.
 *
 * stripLeadingTranslation refuses to change a template when doing so would lose a blank,
 * so a row that comes back unchanged is a row it declined to touch.
 *
 *   npx ts-node scripts/backfill-strip-translations.ts --dry-run [--language en]
 *   npx ts-node scripts/backfill-strip-translations.ts [--language en]
 */
import { PrismaClient } from '@prisma/client';
import { stripLeadingTranslation } from '../src/drills/strip-translation';
import { parseTemplate, hashItem } from '../src/drills/template';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const langFlag = process.argv.indexOf('--language');
const LANGUAGE = langFlag === -1 ? null : process.argv[langFlag + 1];

async function main() {
  const languages = new Map<number, string>();
  for (const l of await prisma.language.findMany({ select: { id: true, code: true } })) {
    languages.set(l.id, l.code);
  }

  const where: Record<string, unknown> = {};
  if (LANGUAGE) {
    const id = [...languages.entries()].find(([, code]) => code === LANGUAGE)?.[0];
    if (!id) throw new Error(`unknown language ${LANGUAGE}`);
    where.languageId = id;
  }

  const rows = await prisma.drillItem.findMany({
    where,
    select: { id: true, template: true, languageId: true, hash: true },
  });

  const report = {
    scanned: rows.length,
    updated: 0,
    unchanged: 0,
    skippedHashCollision: [] as number[],
    samples: [] as { before: string; after: string }[],
  };

  for (const row of rows) {
    const stripped = stripLeadingTranslation(row.template);
    if (stripped === row.template) {
      report.unchanged++;
      continue;
    }

    const parsed = parseTemplate(stripped);
    const code = languages.get(row.languageId) ?? '';
    const hash = hashItem(parsed.plainText, code);

    if (hash !== row.hash) {
      const clash = await prisma.drillItem.findUnique({ where: { hash }, select: { id: true } });
      if (clash && clash.id !== row.id) {
        report.skippedHashCollision.push(row.id);
        continue;
      }
    }

    if (report.samples.length < 5) {
      report.samples.push({ before: row.template.slice(0, 90), after: stripped.slice(0, 90) });
    }

    if (!DRY_RUN) {
      await prisma.drillItem.update({
        where: { id: row.id },
        data: { template: stripped, plainText: parsed.plainText, hash },
      });
    }
    report.updated++;
  }

  console.log(JSON.stringify({
    dryRun: DRY_RUN,
    language: LANGUAGE ?? 'all',
    scanned: report.scanned,
    updated: report.updated,
    unchanged: report.unchanged,
    skippedHashCollisionCount: report.skippedHashCollision.length,
    skippedHashCollision: report.skippedHashCollision.slice(0, 20),
    samples: report.samples,
  }, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
