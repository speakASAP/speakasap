#!/usr/bin/env node
/**
 * Scheduled sync: rebuild lesson-record rows from the portal, then fill their durations.
 *
 * WHY THIS EXISTS
 * ---------------
 * `education_lessonrecord` is a copy of the portal's recordings. Its original ETL
 * (`migrate-lesson-records-from-legacy.py`) was a one-shot MANUAL script that nothing ever
 * scheduled, so it went stale the day its last run finished — 2026-06-13 — and every
 * lesson after that had no duration. The salary aggregate joins duration by lesson uuid,
 * so those lessons quietly paid a flat full hour instead of their recorded length:
 * 2026-07 aggregated 128 lessons with 126 missing durations.
 *
 * Backfilling by hand fixed those months and then the copy REFROZE within two days —
 * five lessons taught on 2026-08-19/20 were missing again the moment anyone looked. The
 * owner calculates salary from the current and previous month, so the current month is
 * exactly the one a manual process leaves stale. Hence this, on a schedule.
 *
 * WHAT IT DOES
 * ------------
 * 1. `ingest-lesson-records-from-portal.js --apply` creates rows the portal has and this
 *    database does not.
 * 2. `backfill-lesson-record-durations.js --apply` probes each new row's object with
 *    ffprobe and writes `duration_seconds`.
 *
 * Both are idempotent: step 1 skips rows already present, step 2 only selects rows whose
 * duration is null. A run that finds nothing to do exits 0 having written nothing.
 *
 * WINDOW: the current and previous month by default, matching what salary is calculated
 * from. Older months are deliberately NOT chased — once salary is calculated, durations
 * are not needed again (owner decision 2026-08-19).
 *
 *   node scripts/sync-lesson-record-durations.js            # current + previous month
 *   node scripts/sync-lesson-record-durations.js --dry-run  # report only
 *   node scripts/sync-lesson-record-durations.js --months 3
 */
const { spawnSync } = require('child_process');
const { join } = require('path');
const { tmpdir } = require('os');

const HERE = __dirname;

function parseArgs(argv) {
  const args = { dryRun: false, months: 2 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--months') {
      i += 1;
      args.months = Number(argv[i]);
      if (!Number.isInteger(args.months) || args.months < 1 || args.months > 24) {
        throw new Error('--months must be an integer between 1 and 24');
      }
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return args;
}

/** First day of the month `back` months before the current one, as YYYY-MM-DD (UTC). */
function monthStart(back) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
  return d.toISOString().slice(0, 10);
}

/** First day of NEXT month — the exclusive upper bound, so today's lessons are included. */
function windowEnd() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return d.toISOString().slice(0, 10);
}

function run(label, script, scriptArgs) {
  console.log(`\n=== ${label} ===`);
  const res = spawnSync(process.execPath, [join(HERE, script), ...scriptArgs], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: process.env,
  });
  if (res.error) {
    throw new Error(`${label} could not start: ${res.error.message}`);
  }
  if (res.status !== 0) {
    // Never swallow this. A failed sync means the current month silently reverts to flat
    // fallback payments, which is the exact failure this job exists to prevent.
    throw new Error(`${label} exited ${res.status}`);
  }
}

/**
 * Write the lesson uuids in [from, to) that still need a duration, for the backfill's
 * `--lesson-uuid-report`. Returns null when there is nothing to do.
 *
 * Selects on the RECORD's `created`, matching the ingest's window, not the lesson's start:
 * a recording uploaded late belongs to the day it was uploaded.
 */
async function writeWindowUuidFile(from, to) {
  const { PrismaClient } = require('@prisma/client');
  const { writeFileSync } = require('fs');
  const prisma = new PrismaClient();
  const path = join(tmpdir(), `lesson-record-sync-${Date.now()}.json`);
  try {
    const rows = await prisma.lessonRecord.findMany({
      where: {
        processed: true,
        recordKey: { not: null },
        durationSeconds: null,
        createdAt: { gte: new Date(`${from}T00:00:00Z`), lt: new Date(`${to}T00:00:00Z`) },
      },
      select: { lessonUuid: true },
    });
    if (!rows.length) {
      return null;
    }
    writeFileSync(path, JSON.stringify({ lessonUuids: rows.map((r) => r.lessonUuid) }));
    console.log(`${rows.length} row(s) in the window need a duration`);
    return path;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const from = monthStart(args.months - 1);
  const to = windowEnd();
  const mode = args.dryRun ? '--dry-run' : '--apply';
  const note =
    'scheduled lesson-record sync: the portal owns recordings and this copy has no other ' +
    'writer; without it the current month pays flat fallbacks instead of recorded length';
  const rollback =
    'ingest: DELETE FROM education_lessonrecord WHERE uuid IN (createdUuids in the run log). ' +
    'backfill: UPDATE education_lessonrecord SET duration_seconds = NULL for the same rows.';

  console.log(`lesson-record sync — window ${from} .. ${to} (${mode})`);

  const gates = args.dryRun
    ? []
    : ['--confirm-write', '--approval-note', note, '--rollback-plan', rollback];

  run('ingest rows from portal', 'ingest-lesson-records-from-portal.js', [
    mode,
    '--from',
    from,
    '--to',
    to,
    ...gates,
  ]);

  // Scope the backfill to the SAME window, via the lesson-uuid list the ingest window
  // implies. Left unbounded it would try to probe every historical row with a null
  // duration — roughly 95,000 of them, almost all pointing at objects that no longer
  // exist — and spend the whole run on 404s instead of this month's lessons.
  const uuidFile = await writeWindowUuidFile(from, to);
  if (uuidFile === null) {
    console.log('\n=== backfill durations ===\nNothing in the window needs a duration.');
  } else {
    run('backfill durations', 'backfill-lesson-record-durations.js', [
      mode,
      '--lesson-uuid-report',
      uuidFile,
      ...(args.dryRun ? ['--probe-limit', '25'] : ['--limit', '500']),
      ...gates,
    ]);
  }

  console.log('\nlesson-record sync complete.');
}

main().catch((error) => {
  console.error(`\nLESSON RECORD SYNC FAILED: ${error.message}\n`);
  process.exit(1);
});
