/**
 * Phase-4 salary DB ETL: read-only legacy portal Postgres → speakasap_salary_db (Prisma).
 *
 *   npm run migrate:salary-data -- --dry-run
 *   npm run migrate:salary-data -- --load
 *   npm run migrate:salary-data -- --dry-run --write-docs
 *   (--dry-run wins over --load if both are passed.)
 *
 * Env (speakasap/.env): SALARY_LEGACY_DATABASE_URL, SALARY_DATABASE_URL (or DATABASE_URL for target).
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, Prisma, SalaryExpenseKind } from '@prisma/client';
import pg from 'pg';

const SPEAKASAP_ROOT = join(process.cwd(), '..');
const MIGRATION_LOG = join(SPEAKASAP_ROOT, 'docs/refactoring/SALARY_DATA_MIGRATION_LOG.md');

const NS_DNS = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');

function ts(): string {
  return new Date().toISOString();
}

function log(msg: string, meta?: Record<string, unknown>): void {
  console.log(JSON.stringify({ timestamp: ts(), msg, ...meta }));
}

function loadEnvFrom(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) {
      continue;
    }
    const eq = t.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

function uuidV5(name: string): string {
  const hash = createHash('sha1');
  hash.update(NS_DNS);
  hash.update(name, 'utf8');
  const buf = hash.digest().subarray(0, 16);
  buf[6] = (buf[6]! & 0x0f) | 0x50;
  buf[8] = (buf[8]! & 0x3f) | 0x80;
  const hex = buf.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function decStr(v: unknown): string {
  if (v === null || v === undefined) {
    return '0';
  }
  return String(v);
}

function normCurrency(c: string | null): string {
  const u = (c || 'EUR').trim().toUpperCase();
  if (u === 'EUR' || u === 'CZK' || u === 'RUB') {
    return u;
  }
  return u.length > 0 ? u : 'EUR';
}

function normPm(pm: string | null): string | null {
  if (pm === null || pm === undefined) {
    return null;
  }
  const t = pm.trim();
  if (!t) {
    return null;
  }
  if (t === 'transfergo' || t === 'account' || t === 'cash') {
    return t;
  }
  return t;
}

function toIntBound(v: unknown): number | null {
  if (v === null || v === undefined) {
    return null;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) {
    return null;
  }
  return Math.round(n);
}

async function legacyTableExists(client: pg.Client, table: string): Promise<boolean> {
  const r = await client.query<{ ok: number }>(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [table],
  );
  return r.rowCount !== null && r.rowCount > 0;
}

type LegacyStats = {
  salaryProfiles: number;
  salaryExpenseBaseRows: number;
  lessonSalaryExpenseRows: number;
  supportBonusRows: number;
  employeeContracts: number;
  authUsers: number;
  contractsUserMissingAuth: number;
  expensesUserWithoutProfile: number;
  lessonExpenseMissingLesson: number;
  courseSingleLessonSalaryRows: number;
  courseGroupLessonSalaryRows: number;
};

type PeriodRow = { period: string; currency: string; row_count: string; qty_sum: string; amount_sum: string };

async function collectLegacyStats(
  client: pg.Client,
  flags: { lesson: boolean; support: boolean },
): Promise<LegacyStats> {
  const p = await client.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM expenses_salaryprofile`);
  const se = await client.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM expenses_salaryexpense`);
  const au = await client.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM auth_user`);

  let lessonC = '0';
  if (flags.lesson) {
    const r = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM education_lessonsalaryexpense`,
    );
    lessonC = r.rows[0]?.c ?? '0';
  }

  let supportC = '0';
  if (flags.support) {
    const r = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM expenses_supportbonusexpense`,
    );
    supportC = r.rows[0]?.c ?? '0';
  }

  const ec = await client.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM employees_employeecontract`,
  );

  const missingAuth = await client.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM employees_employeecontract ec
     WHERE NOT EXISTS (SELECT 1 FROM auth_user u WHERE u.id = ec.user_id)`,
  );

  const noProfile = await client.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM expenses_salaryexpense se
     WHERE NOT EXISTS (
       SELECT 1 FROM expenses_salaryprofile sp WHERE sp.user_id = se.user_id
     )`,
  );

  let orphanLesson = '0';
  if (flags.lesson) {
    const r = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM education_lessonsalaryexpense lse
       WHERE NOT EXISTS (SELECT 1 FROM education_lesson l WHERE l.uuid = lse.lesson_id)`,
    );
    orphanLesson = r.rows[0]?.c ?? '0';
  }

  let cSingle = '0';
  let cGroup = '0';
  if (await legacyTableExists(client, 'courses_singlelessonsalaryexpense')) {
    const r = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM courses_singlelessonsalaryexpense`,
    );
    cSingle = r.rows[0]?.c ?? '0';
  }
  if (await legacyTableExists(client, 'courses_grouplessonsalaryexpense')) {
    const r = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM courses_grouplessonsalaryexpense`,
    );
    cGroup = r.rows[0]?.c ?? '0';
  }

  return {
    salaryProfiles: Number(p.rows[0]?.c ?? 0),
    salaryExpenseBaseRows: Number(se.rows[0]?.c ?? 0),
    lessonSalaryExpenseRows: Number(lessonC),
    supportBonusRows: Number(supportC),
    employeeContracts: Number(ec.rows[0]?.c ?? 0),
    authUsers: Number(au.rows[0]?.c ?? 0),
    contractsUserMissingAuth: Number(missingAuth.rows[0]?.c ?? 0),
    expensesUserWithoutProfile: Number(noProfile.rows[0]?.c ?? 0),
    lessonExpenseMissingLesson: Number(orphanLesson),
    courseSingleLessonSalaryRows: Number(cSingle),
    courseGroupLessonSalaryRows: Number(cGroup),
  };
}

async function payrollByPeriod(client: pg.Client): Promise<PeriodRow[]> {
  const r = await client.query<PeriodRow>(
    `SELECT to_char(e.date, 'YYYY-MM') AS period, e.currency,
            COUNT(*)::text AS row_count,
            COALESCE(SUM(e.qty), 0)::text AS qty_sum,
            COALESCE(SUM(e.price * e.qty), 0)::text AS amount_sum
     FROM expenses_salaryexpense se
     JOIN expenses_expense e ON e.id = se.expense_ptr_id
     GROUP BY 1, 2
     ORDER BY 1 DESC, 2`,
  );
  return r.rows;
}

function appendMigrationLog(summary: Record<string, unknown>): void {
  const block = `\n## Run ${ts()}\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n`;
  appendFileSync(MIGRATION_LOG, block, 'utf8');
  log('migration_log_appended', { path: MIGRATION_LOG });
}

const BATCH = 400;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const envPath = join(SPEAKASAP_ROOT, '.env');
  const doLoad = args.includes('--load') && !args.includes('--dry-run');
  const dryRun = !doLoad;
  const writeDocs = args.includes('--write-docs');

  loadEnvFrom(envPath);

  const legacyUrl = process.env.SALARY_LEGACY_DATABASE_URL;
  const targetUrl = process.env.SALARY_DATABASE_URL || process.env.DATABASE_URL;
  if (!legacyUrl) {
    throw new Error('SALARY_LEGACY_DATABASE_URL is required (read-only legacy portal DB).');
  }
  if (!targetUrl) {
    throw new Error('SALARY_DATABASE_URL or DATABASE_URL is required for target DB.');
  }

  log('salary_etl_start', { dryRun, load: doLoad, writeDocs });

  const legacy = new pg.Client({ connectionString: legacyUrl, statement_timeout: 120000 });
  await legacy.connect();
  log('legacy_connected', { timestamp: ts() });

  const hasLesson = await legacyTableExists(legacy, 'education_lessonsalaryexpense');
  const hasSupport = await legacyTableExists(legacy, 'expenses_supportbonusexpense');
  const flags = { lesson: hasLesson, support: hasSupport };
  log('legacy_table_flags', flags as unknown as Record<string, unknown>);

  const stats = await collectLegacyStats(legacy, flags);
  log('legacy_counts', stats as unknown as Record<string, unknown>);

  const t0 = Date.now();
  const periods = await payrollByPeriod(legacy);
  log('payroll_periods_loaded', { duration_ms: Date.now() - t0, periodRowCount: periods.length });

  const profileSql = `SELECT id, user_id, currency, preferable_pm, salary, rate, show_as_teacher, show_as_other,
      bank_account, paypal_account, work_duration_lower_bound, work_duration_upper_bound
     FROM expenses_salaryprofile ORDER BY id`;
  const tProfiles = Date.now();
  const profilesRes = await legacy.query<{
    id: number;
    user_id: number;
    currency: string;
    preferable_pm: string | null;
    salary: unknown;
    rate: unknown;
    show_as_teacher: boolean;
    show_as_other: boolean;
    bank_account: string | null;
    paypal_account: string | null;
    work_duration_lower_bound: unknown;
    work_duration_upper_bound: unknown;
  }>(profileSql);
  log('legacy_profiles_fetched', { count: profilesRes.rows.length, duration_ms: Date.now() - tProfiles });

  let lessonJoin = '';
  let supportJoin = '';
  let kindExpr = `'generic'::text`;
  let lessonIdSelect = 'NULL::int AS lesson_id';
  let studentSelect = 'NULL::int AS support_student_id';
  let groupSelect = 'NULL::int AS support_group_id';

  if (hasLesson) {
    lessonJoin = `LEFT JOIN education_lessonsalaryexpense lse ON lse.salaryexpense_ptr_id = se.expense_ptr_id`;
    lessonIdSelect = 'lse.lesson_id';
    kindExpr = `CASE WHEN lse.salaryexpense_ptr_id IS NOT NULL THEN 'lesson' ELSE ${kindExpr} END`;
  }
  if (hasSupport) {
    supportJoin = `LEFT JOIN expenses_supportbonusexpense sbe ON sbe.salaryexpense_ptr_id = se.expense_ptr_id`;
    studentSelect = 'sbe.student_id';
    groupSelect = 'sbe.group_id';
    if (hasLesson) {
      kindExpr = `CASE WHEN lse.salaryexpense_ptr_id IS NOT NULL THEN 'lesson' WHEN sbe.salaryexpense_ptr_id IS NOT NULL THEN 'support_bonus' ELSE 'generic' END`;
    } else {
      kindExpr = `CASE WHEN sbe.salaryexpense_ptr_id IS NOT NULL THEN 'support_bonus' ELSE 'generic' END`;
    }
  }

  const expenseSql = `
    SELECT se.expense_ptr_id AS id,
           se.user_id,
           e.date,
           e.price,
           e.qty,
           e.comment,
           e.currency,
           (${kindExpr}) AS kind,
           ${lessonIdSelect},
           ${studentSelect},
           ${groupSelect}
    FROM expenses_salaryexpense se
    JOIN expenses_expense e ON e.id = se.expense_ptr_id
    ${lessonJoin}
    ${supportJoin}
    ORDER BY se.expense_ptr_id
  `;

  const tExp = Date.now();
  const expensesRes = await legacy.query<{
    id: number;
    user_id: number;
    date: Date;
    price: unknown;
    qty: unknown;
    comment: string | null;
    currency: string;
    kind: string;
    lesson_id: number | null;
    support_student_id: number | null;
    support_group_id: number | null;
  }>(expenseSql);
  log('legacy_expenses_fetched', { count: expensesRes.rows.length, duration_ms: Date.now() - tExp });

  const contractsRes = await legacy.query<{
    id: number;
    user_id: number;
    document: string | null;
    verified: boolean;
    created: Date;
    valid_till: Date | null;
    valid_from: Date | null;
    main_id: number | null;
    contract_uid: string | null;
  }>(
    `SELECT id, user_id, document, verified, created, valid_till, valid_from, main_id, contract_uid
     FROM employees_employeecontract
     ORDER BY CASE WHEN main_id IS NULL THEN 0 ELSE 1 END, id`,
  );
  log('legacy_contracts_fetched', { count: contractsRes.rows.length });

  const legacyIdToProfileUuid = new Map<number, string>();
  const userToProfileUuid = new Map<number, string>();
  for (const row of profilesRes.rows) {
    const id = uuidV5(`speakasap:salary:profile:${row.id}`);
    legacyIdToProfileUuid.set(row.id, id);
    userToProfileUuid.set(row.user_id, id);
  }

  const profilePayload: Prisma.SalaryProfileCreateManyInput[] = profilesRes.rows.map((row) => ({
    id: legacyIdToProfileUuid.get(row.id)!,
    legacyProfileId: row.id,
    legacyPortalUserId: row.user_id,
    authUserId: null,
    currency: normCurrency(row.currency),
    preferablePm: normPm(row.preferable_pm),
    salary: decStr(row.salary),
    rate: decStr(row.rate),
    showAsTeacher: row.show_as_teacher,
    showAsOther: row.show_as_other,
    bankAccount: row.bank_account?.trim() ? row.bank_account : null,
    paypalAccount: row.paypal_account?.trim() ? row.paypal_account : null,
    workDurationLowerBound: toIntBound(row.work_duration_lower_bound),
    workDurationUpperBound: toIntBound(row.work_duration_upper_bound),
  }));

  const legacyContractIdToUuid = new Map<number, string>();
  for (const row of contractsRes.rows) {
    legacyContractIdToUuid.set(row.id, uuidV5(`speakasap:salary:contract:${row.id}`));
  }

  const mainContracts = contractsRes.rows.filter((r) => r.main_id == null);
  const subContracts = contractsRes.rows.filter((r) => r.main_id != null);

  const buildContractPayload = (row: (typeof contractsRes.rows)[0]): Prisma.EmployeeContractCreateManyInput => {
    const doc = row.document?.trim();
    return {
      id: legacyContractIdToUuid.get(row.id)!,
      legacyContractId: row.id,
      legacyPortalUserId: row.user_id,
      profileId: userToProfileUuid.get(row.user_id) ?? null,
      documentStorageKey: doc && doc.length > 0 ? doc : null,
      verified: row.verified,
      validFrom: row.valid_from,
      validTill: row.valid_till,
      mainContractId: null,
      contractUid: row.contract_uid?.trim() ? row.contract_uid : null,
      createdAt: row.created,
    };
  };

  const mainPayload = mainContracts.map(buildContractPayload);
  const subPayload = subContracts.map((row) => {
    const base = buildContractPayload(row);
    const parentUuid =
      row.main_id != null ? legacyContractIdToUuid.get(row.main_id) ?? null : null;
    return {
      ...base,
      mainContractId: parentUuid,
    };
  });

  let expensesSkippedNoProfile = 0;
  const expensePayload: Prisma.SalaryExpenseCreateManyInput[] = [];
  for (const row of expensesRes.rows) {
    const profileId = userToProfileUuid.get(row.user_id);
    if (!profileId) {
      expensesSkippedNoProfile += 1;
      continue;
    }
    let kind: SalaryExpenseKind = SalaryExpenseKind.generic;
    if (row.kind === 'lesson') {
      kind = SalaryExpenseKind.lesson;
    } else if (row.kind === 'support_bonus') {
      kind = SalaryExpenseKind.support_bonus;
    }
    expensePayload.push({
      id: uuidV5(`speakasap:salary:expense:${row.id}`),
      legacyExpenseId: row.id,
      profileId,
      legacyPortalUserId: row.user_id,
      date: row.date,
      price: decStr(row.price),
      qty: decStr(row.qty),
      comment: row.comment?.trim() ? row.comment.trim() : '',
      currency: normCurrency(row.currency),
      kind,
      lessonUuid: null,
      legacyStudentId: row.support_student_id,
      legacyStudentGroupId: row.support_group_id,
    });
  }

  const summary = {
    dryRun,
    load: doLoad,
    stats,
    transform: {
      salaryProfiles: profilePayload.length,
      salaryExpenses: expensePayload.length,
      employeeContracts: mainPayload.length + subPayload.length,
      expensesSkippedNoProfile,
      payrollPeriodRows: periods.length,
      payrollPeriodSample: periods.slice(0, 72),
    },
    legacyTableFlags: flags,
    note:
      'Lesson rows keep lessonUuid null until education-service backfill; see SALARY_DATA_MAPPING.md. Historical courses_* lesson expense tables are counted only — not merged into this ETL.',
  };

  log('transform_summary', summary as unknown as Record<string, unknown>);

  if (writeDocs) {
    appendMigrationLog(summary);
  }

  if (!doLoad) {
    log('dry_run_complete_no_writes', {});
    await legacy.end();
    return;
  }

  process.env.DATABASE_URL = targetUrl;
  const prisma = new PrismaClient();
  log('target_prisma_connected', { timestamp: ts() });

  const tLoad = Date.now();
  for (let i = 0; i < profilePayload.length; i += BATCH) {
    const chunk = profilePayload.slice(i, i + BATCH);
    await prisma.salaryProfile.createMany({ data: chunk, skipDuplicates: true });
    log('profiles_batch_written', { at: i, batch: chunk.length });
  }

  for (let i = 0; i < mainPayload.length; i += BATCH) {
    const chunk = mainPayload.slice(i, i + BATCH);
    await prisma.employeeContract.createMany({ data: chunk, skipDuplicates: true });
    log('contracts_main_batch_written', { at: i, batch: chunk.length });
  }

  for (let i = 0; i < subPayload.length; i += BATCH) {
    const chunk = subPayload.slice(i, i + BATCH);
    await prisma.employeeContract.createMany({ data: chunk, skipDuplicates: true });
    log('contracts_sub_batch_written', { at: i, batch: chunk.length });
  }

  for (let i = 0; i < expensePayload.length; i += BATCH) {
    const chunk = expensePayload.slice(i, i + BATCH);
    await prisma.salaryExpense.createMany({ data: chunk, skipDuplicates: true });
    log('expenses_batch_written', { at: i, batch: chunk.length });
  }

  log('load_complete', { duration_ms: Date.now() - tLoad });
  await prisma.$disconnect();
  await legacy.end();
}

main().catch((e) => {
  log('salary_etl_fatal', { error: String(e) });
  process.exit(1);
});
