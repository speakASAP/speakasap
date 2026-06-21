import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, SalaryExpenseKind } from '@prisma/client';

type Args = {
  period?: string;
  periodFrom?: string;
  periodTo?: string;
  jsonReport?: string;
  lessonUuidList?: string;
};

const PERIOD_RE = /^\d{4}-\d{2}$/;

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) {
        throw new Error(`${arg} requires a value`);
      }
      return argv[i];
    };
    if (arg === '--period') args.period = next();
    else if (arg === '--period-from') args.periodFrom = next();
    else if (arg === '--period-to') args.periodTo = next();
    else if (arg === '--json-report') args.jsonReport = next();
    else if (arg === '--lesson-uuid-list') args.lessonUuidList = next();
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (args.period) {
    args.periodFrom = args.period;
    args.periodTo = args.period;
  }
  if (!args.periodFrom || !args.periodTo) {
    throw new Error('--period or --period-from and --period-to are required');
  }
  assertPeriod(args.periodFrom, '--period-from');
  assertPeriod(args.periodTo, '--period-to');
  if (periodStart(args.periodTo) < periodStart(args.periodFrom)) {
    throw new Error('--period-to must be greater than or equal to --period-from');
  }
  return args;
}

function printHelp(): void {
  console.log(`Export imported salary lesson UUIDs.

Read-only sample:
  npm run export:salary-lesson-uuids -- --period 2026-05 --json-report /tmp/salary-lesson-uuids.json

Period window:
  npm run export:salary-lesson-uuids -- --period-from 2025-07 --period-to 2026-06 --json-report /tmp/salary-lesson-uuids.json --lesson-uuid-list /tmp/salary-lesson-uuids.txt

The report can be passed to education-service/scripts/backfill-lesson-record-durations.js with --lesson-uuid-report.
This command never creates salary rows, calculation runs, payout runs, payment disbursements, or education rows.`);
}

function assertPeriod(period: string, name: string): void {
  if (!PERIOD_RE.test(period)) {
    throw new Error(`${name} must be YYYY-MM`);
  }
}

function periodStart(period: string): Date {
  const [yearRaw, monthRaw] = period.split('-');
  return new Date(Date.UTC(Number(yearRaw), Number(monthRaw) - 1, 1));
}

function nextPeriodStart(period: string): Date {
  const start = periodStart(period);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}

function loadEnvFrom(filePath: string): void {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function configureEnv(): void {
  loadEnvFrom(join(__dirname, '..', '..', '.env'));
  process.env.DATABASE_URL = process.env.SALARY_DATABASE_URL || process.env.DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    throw new Error('SALARY_DATABASE_URL or DATABASE_URL is required');
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  configureEnv();
  const prisma = new PrismaClient();
  try {
    const start = periodStart(args.periodFrom!);
    const end = nextPeriodStart(args.periodTo!);
    const rows = await prisma.salaryExpense.findMany({
      where: {
        kind: SalaryExpenseKind.lesson,
        date: { gte: start, lt: end },
      },
      select: {
        id: true,
        legacyExpenseId: true,
        legacyPortalUserId: true,
        lessonUuid: true,
        date: true,
      },
      orderBy: [{ date: 'asc' }, { legacyPortalUserId: 'asc' }, { id: 'asc' }],
    });
    const lessonUuids = [...new Set(rows.map((row) => row.lessonUuid).filter((value): value is string => Boolean(value)))]
      .sort();
    const legacyPortalUserIds = [...new Set(rows.map((row) => row.legacyPortalUserId))].sort((a, b) => a - b);
    const report = {
      domain: 'salary_lesson_uuid_export',
      generatedAt: new Date().toISOString(),
      writes: false,
      periodFrom: args.periodFrom,
      periodTo: args.periodTo,
      counts: {
        salaryLessonExpenses: rows.length,
        withLessonUuid: rows.filter((row) => Boolean(row.lessonUuid)).length,
        missingLessonUuid: rows.filter((row) => !row.lessonUuid).length,
        uniqueLessonUuids: lessonUuids.length,
        legacyPortalUsers: legacyPortalUserIds.length,
      },
      lessonUuids,
      legacyPortalUserIds,
      samples: rows.slice(0, 20).map((row) => ({
        salaryExpenseId: row.id,
        legacyExpenseId: row.legacyExpenseId,
        legacyPortalUserId: row.legacyPortalUserId,
        lessonUuid: row.lessonUuid,
        date: row.date.toISOString(),
      })),
    };
    const json = `${JSON.stringify(report, null, 2)}\n`;
    if (args.jsonReport) {
      writeFileSync(args.jsonReport, json);
    }
    if (args.lessonUuidList) {
      writeFileSync(args.lessonUuidList, `${lessonUuids.join('\n')}\n`);
    }
    console.log(JSON.stringify({
      writes: false,
      periodFrom: args.periodFrom,
      periodTo: args.periodTo,
      counts: report.counts,
      jsonReport: args.jsonReport || null,
      lessonUuidList: args.lessonUuidList || null,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});
