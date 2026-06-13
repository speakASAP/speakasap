import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

type CliOptions = {
  command: 'status' | 'period-summary' | 'help';
  period?: string;
  jsonReport?: string;
};

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function loadEnvFile(path: string) {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv: string[]): CliOptions {
  const [command = 'help', ...rest] = argv;
  const options: CliOptions = command === 'status' || command === 'period-summary'
    ? { command }
    : { command: 'help' };

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--period') {
      options.period = rest[++i];
      continue;
    }
    if (arg.startsWith('--period=')) {
      options.period = arg.slice('--period='.length);
      continue;
    }
    if (arg === '--json-report') {
      options.jsonReport = rest[++i];
      continue;
    }
    if (arg.startsWith('--json-report=')) {
      options.jsonReport = arg.slice('--json-report='.length);
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.command = 'help';
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function assertPeriod(period: string | undefined): string {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    throw new Error('period-summary requires --period YYYY-MM');
  }
  return period;
}

function periodBounds(period: string) {
  const [yearText, monthText] = period.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

function decimalToNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'object' && 'toString' in value) {
    return Number(value.toString());
  }
  return Number(value);
}

function printHelp() {
  console.log(`Salary CLI\n\nRead-only salary inspection commands. These commands never create salary rows, calculation runs, payout runs, or payment disbursements.\n\nUsage:\n  npm run salary:cli -- status [--json-report /tmp/salary-status.json]\n  npm run salary:cli -- period-summary --period YYYY-MM [--json-report /tmp/salary-period.json]\n\nEnvironment:\n  Uses SALARY_DATABASE_URL when present, otherwise DATABASE_URL. Also loads ../.env from the monorepo root.\n`);
}

function writeReport(path: string | undefined, report: JsonValue) {
  if (!path) {
    return;
  }
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
}

async function getStatus(prisma: PrismaClient) {
  const [
    salaryProfiles,
    salaryExpenses,
    employeeContracts,
    calculationRuns,
    payoutRuns,
    importedLessonExpenses,
    importedSupportBonuses,
    profilesWithoutAuth,
    lessonExpensesWithoutLessonUuid,
  ] = await Promise.all([
    prisma.salaryProfile.count(),
    prisma.salaryExpense.count(),
    prisma.employeeContract.count(),
    prisma.calculationRun.count(),
    prisma.payoutRun.count(),
    prisma.salaryExpense.count({ where: { kind: 'lesson' } }),
    prisma.salaryExpense.count({ where: { kind: 'support_bonus' } }),
    prisma.salaryProfile.count({ where: { authUserId: null } }),
    prisma.salaryExpense.count({ where: { kind: 'lesson', lessonUuid: null } }),
  ]);

  const warnings: string[] = [];
  if (profilesWithoutAuth > 0) {
    warnings.push('profiles_without_auth_mapping');
  }
  if (lessonExpensesWithoutLessonUuid > 0) {
    warnings.push('lesson_expenses_without_lesson_uuid');
  }

  return {
    command: 'status',
    generatedAt: new Date().toISOString(),
    mode: 'read_only',
    counts: {
      salaryProfiles,
      salaryExpenses,
      employeeContracts,
      calculationRuns,
      payoutRuns,
      importedLessonExpenses,
      importedSupportBonuses,
      profilesWithoutAuth,
      lessonExpensesWithoutLessonUuid,
    },
    warnings,
  };
}

async function getPeriodSummary(prisma: PrismaClient, period: string) {
  const { start, end } = periodBounds(period);
  const grouped = await prisma.salaryExpense.groupBy({
    by: ['currency', 'kind'],
    where: {
      date: {
        gte: start,
        lt: end,
      },
    },
    _count: { _all: true },
    _sum: {
      qty: true,
      price: true,
    },
    orderBy: [
      { currency: 'asc' },
      { kind: 'asc' },
    ],
  });

  const amountRows = await prisma.$queryRaw<Array<{ currency: string; kind: string; amount_sum: unknown }>>`
    select currency, kind::text as kind, coalesce(sum(price * qty), 0) as amount_sum
    from salary_expenses
    where date >= ${start}::date and date < ${end}::date
    group by currency, kind
    order by currency asc, kind asc
  `;
  const amountByKey = new Map(amountRows.map((row) => [`${row.currency}:${row.kind}`, decimalToNumber(row.amount_sum)]));

  return {
    command: 'period-summary',
    generatedAt: new Date().toISOString(),
    mode: 'read_only',
    period,
    items: grouped.map((row) => ({
      currency: row.currency,
      kind: row.kind,
      count: row._count._all,
      qtySum: decimalToNumber(row._sum.qty),
      priceSum: decimalToNumber(row._sum.price),
      amountSum: amountByKey.get(`${row.currency}:${row.kind}`) ?? 0,
    })),
  };
}

async function main() {
  loadEnvFile(join(__dirname, '../../.env'));
  process.env.DATABASE_URL = process.env.SALARY_DATABASE_URL || process.env.DATABASE_URL;

  const options = parseArgs(process.argv.slice(2));
  if (options.command === 'help') {
    printHelp();
    return;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL or SALARY_DATABASE_URL is required');
  }

  const prisma = new PrismaClient();
  try {
    const report = options.command === 'status'
      ? await getStatus(prisma)
      : await getPeriodSummary(prisma, assertPeriod(options.period));
    writeReport(options.jsonReport, report as JsonValue);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
