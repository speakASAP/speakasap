/**
 * One-off: strip presentation markup out of DrillItem.template.
 *
 * The legacy bank importers stored each item's rich-text label verbatim, so 14,567 of
 * 27,627 rows carried a trailing `<span class="mute">` glossary — plus stray `<br>`,
 * `<b>` and `<i>`. Nothing renders `template` as HTML (deliberately: a bank is not a
 * trusted source of markup), so the teacher's review screen showed the raw tag as literal
 * text and then repeated the same glossary underneath it from `hint`.
 *
 * The importers now sanitize on the way in, and SetsService.upsertItem guards the write
 * path. This fixes the rows that already exist.
 *
 * SAFE TO RE-RUN: a clean template sanitizes to itself, so a second pass updates nothing.
 *
 * `plainText` and `hash` are recomputed, because both are derived from the template — a
 * hash left over from the markup version would break dedup against newly imported items.
 * A row whose sanitized text collides with an existing hash is REPORTED and skipped
 * rather than merged: two rows becoming one is a content decision, not a cleanup.
 *
 * Rows containing `<input>` are skipped and listed: their answer lives in an attribute
 * (`answer="by"`), so stripping the tag would delete it. Two production rows are shaped
 * that way and need a real conversion to `[prompt]{answer}`.
 *
 *   npx ts-node scripts/backfill-strip-template-html.ts --dry-run
 *   npx ts-node scripts/backfill-strip-template-html.ts
 */
import { PrismaClient } from '@prisma/client';
import { sanitizeTemplate, hasMarkup } from '../src/drills/template-sanitize';
import { parseTemplate, hashItem } from '../src/drills/template';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const languages = new Map<number, string>();
  for (const l of await prisma.language.findMany({ select: { id: true, code: true } })) {
    languages.set(l.id, l.code);
  }

  const rows = await prisma.drillItem.findMany({
    where: { template: { contains: '<' } },
    select: { id: true, template: true, languageId: true, hash: true },
  });

  const report = {
    scanned: rows.length,
    updated: 0,
    unchanged: 0,
    skippedInput: [] as number[],
    skippedHashCollision: [] as number[],
    failed: [] as { id: number; reason: string }[],
  };

  for (const row of rows) {
    if (!hasMarkup(row.template)) {
      report.unchanged++;
      continue;
    }

    let cleaned: string;
    try {
      cleaned = sanitizeTemplate(row.template);
    } catch (e) {
      // <input> rows: the answer is in an attribute. Never strip silently.
      report.skippedInput.push(row.id);
      continue;
    }

    if (cleaned === row.template) {
      report.unchanged++;
      continue;
    }

    if (!cleaned.trim()) {
      report.failed.push({ id: row.id, reason: 'sanitized to empty' });
      continue;
    }

    const parsed = parseTemplate(cleaned);
    if (parsed.blanks.length === 0) {
      // Sanitizing must never destroy the blanks — that would turn a drill into prose.
      report.failed.push({ id: row.id, reason: 'no blanks after sanitize' });
      continue;
    }

    const code = languages.get(row.languageId) ?? '';
    const hash = hashItem(parsed.plainText, code);

    if (hash !== row.hash) {
      const clash = await prisma.drillItem.findUnique({ where: { hash }, select: { id: true } });
      if (clash && clash.id !== row.id) {
        report.skippedHashCollision.push(row.id);
        continue;
      }
    }

    if (!DRY_RUN) {
      await prisma.drillItem.update({
        where: { id: row.id },
        data: { template: cleaned, plainText: parsed.plainText, hash },
      });
    }
    report.updated++;
  }

  console.log(JSON.stringify({ dryRun: DRY_RUN, ...report,
    skippedInput: report.skippedInput.slice(0, 20),
    skippedHashCollision: report.skippedHashCollision.slice(0, 20),
    skippedInputCount: report.skippedInput.length,
    skippedHashCollisionCount: report.skippedHashCollision.length,
    failedCount: report.failed.length,
  }, null, 2));

  if (report.failed.length > 0) {
    console.error('FAILED ROWS (not updated):', JSON.stringify(report.failed.slice(0, 20)));
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
