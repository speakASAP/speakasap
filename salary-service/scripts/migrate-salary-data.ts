/**
 * Phase-4 salary DB ETL: read-only legacy portal Postgres → speakasap_salary_db (Prisma).
 *
 *   npm run migrate:salary-data -- --dry-run
 *   npm run migrate:salary-data -- --load
 *   npm run migrate:salary-data -- --dry-run --write-docs
 *   (--dry-run wins over --load if both are passed.)
 *   npm run migrate:salary-data -- --dry-run --lesson-uuid-backfill-only
 *
 * Env (speakasap/.env): SALARY_LEGACY_DATABASE_URL, SALARY_DATABASE_URL (or DATABASE_URL for target),
 * USER_DATABASE_URL for auth UUID mapping, EDUCATION_DATABASE_URL for lesson UUID verification.
 */
import { createHash } from 'node:crypto';
import {
  readFileSync,
  existsSync,
  appendFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, Prisma, SalaryExpenseKind } from '@prisma/client';
import pg from 'pg';

const SPEAKASAP_ROOT = join(process.cwd(), '..');
const MIGRATION_LOG = join(
  SPEAKASAP_ROOT,
  'docs/refactoring/SALARY_DATA_MIGRATION_LOG.md',
);

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

async function legacyTableExists(
  client: pg.Client,
  table: string,
): Promise<boolean> {
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

type PeriodRow = {
  period: string;
  currency: string;
  row_count: string;
  qty_sum: string;
  amount_sum: string;
};

type AuthUserMapping = {
  legacyPortalUserId: number;
  authUserId: string;
};

type ImportedLessonExpenseRow = {
  legacyExpenseId: number;
  lessonUuid: string | null;
};

async function collectLegacyStats(
  client: pg.Client,
  flags: { lesson: boolean; support: boolean },
): Promise<LegacyStats> {
  const p = await client.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM expenses_salaryprofile`,
  );
  const se = await client.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM expenses_salaryexpense`,
  );
  const au = await client.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM auth_user`,
  );

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

async function loadAuthUserMappings(
  userDatabaseUrl: string | undefined,
  legacyPortalUserIds: number[],
): Promise<Map<number, string>> {
  const uniqueIds = Array.from(new Set(legacyPortalUserIds)).sort(
    (a, b) => a - b,
  );
  if (!userDatabaseUrl || uniqueIds.length === 0) {
    return new Map();
  }

  const client = new pg.Client({
    connectionString: userDatabaseUrl,
    statement_timeout: 120000,
  });
  await client.connect();
  try {
    const result = await client.query<AuthUserMapping>(
      `SELECT legacy_portal_user_id AS "legacyPortalUserId", auth_user_id::text AS "authUserId"
       FROM user_identity_mirror
       WHERE legacy_portal_user_id = ANY($1::int[])
         AND auth_user_id IS NOT NULL`,
      [uniqueIds],
    );
    return new Map(
      result.rows.map((row) => [
        Number(row.legacyPortalUserId),
        row.authUserId,
      ]),
    );
  } finally {
    await client.end();
  }
}

async function updateSalaryProfileAuthUsers(
  prisma: PrismaClient,
  authUserByLegacyUser: Map<number, string>,
): Promise<number> {
  let updated = 0;
  for (const [
    legacyPortalUserId,
    authUserId,
  ] of authUserByLegacyUser.entries()) {
    const result = await prisma.salaryProfile.updateMany({
      where: {
        legacyPortalUserId,
        OR: [{ authUserId: null }, { authUserId: { not: authUserId } }],
      },
      data: { authUserId },
    });
    updated += result.count;
  }
  return updated;
}

async function loadExistingEducationLessonUuids(
  educationDatabaseUrl: string | undefined,
  lessonUuids: string[],
): Promise<Set<string> | null> {
  const uniqueUuids = Array.from(new Set(lessonUuids)).sort();
  if (!educationDatabaseUrl || uniqueUuids.length === 0) {
    return null;
  }

  const client = new pg.Client({
    connectionString: educationDatabaseUrl,
    statement_timeout: 120000,
  });
  await client.connect();
  try {
    const found = new Set<string>();
    for (let i = 0; i < uniqueUuids.length; i += 5000) {
      const batch = uniqueUuids.slice(i, i + 5000);
      const result = await client.query<{ uuid: string }>(
        `SELECT uuid::text AS uuid
         FROM education_lesson
         WHERE uuid = ANY($1::uuid[])`,
        [batch],
      );
      for (const row of result.rows) {
        found.add(row.uuid);
      }
    }
    return found;
  } finally {
    await client.end();
  }
}

async function loadImportedLessonExpenses(
  prisma: PrismaClient,
): Promise<ImportedLessonExpenseRow[]> {
  return prisma.$queryRaw<ImportedLessonExpenseRow[]>`
    SELECT legacy_expense_id AS "legacyExpenseId", lesson_uuid AS "lessonUuid"
    FROM salary_expenses
    WHERE kind = 'lesson'::"SalaryExpenseKind"
      AND legacy_expense_id IS NOT NULL
    ORDER BY legacy_expense_id
  `;
}

async function backfillImportedLessonUuids(
  prisma: PrismaClient,
  lessonUuidByLegacyExpenseId: Map<number, string>,
  rows: ImportedLessonExpenseRow[],
): Promise<number> {
  let updated = 0;
  const candidates = rows
    .map((row) => ({
      legacyExpenseId: Number(row.legacyExpenseId),
      lessonUuid: lessonUuidByLegacyExpenseId.get(Number(row.legacyExpenseId)),
      currentLessonUuid: row.lessonUuid,
    }))
    .filter(
      (row) => row.lessonUuid && row.currentLessonUuid !== row.lessonUuid,
    );

  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const valuesSql = batch
      .map((_, idx) => `($${idx * 2 + 1}::int, $${idx * 2 + 2}::text)`)
      .join(', ');
    const params = batch.flatMap((row) => [
      row.legacyExpenseId,
      row.lessonUuid!,
    ]);
    const result = await prisma.$executeRawUnsafe(
      `UPDATE salary_expenses AS se
       SET lesson_uuid = v.lesson_uuid,
           updated_at = NOW()
       FROM (VALUES ${valuesSql}) AS v(legacy_expense_id, lesson_uuid)
       WHERE se.legacy_expense_id = v.legacy_expense_id
         AND se.kind = 'lesson'::"SalaryExpenseKind"
         AND (se.lesson_uuid IS NULL OR se.lesson_uuid <> v.lesson_uuid)`,
      ...params,
    );
    updated += result;
    log('lesson_uuid_backfill_batch_written', {
      at: i,
      batch: batch.length,
      updated: result,
    });
  }
  return updated;
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

function argValue(args: string[], name: string): string | null {
  const inline = args.find((a) => a.startsWith(`${name}=`));
  if (inline) {
    return inline.slice(name.length + 1);
  }
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1]!.startsWith('--')) {
    return args[idx + 1]!;
  }
  return null;
}

function printHelp(): void {
  console.log(`Usage:
  npm run migrate:salary-data -- --dry-run [--json-report /tmp/speakasap-salary-dry-run.json]
  npm run migrate:salary-data -- --apply --confirm-write --approval-note NOTE --rollback-plan /tmp/speakasap-salary-rollback.sql [--json-report /tmp/speakasap-salary-apply.json]
  npm run migrate:salary-data -- --apply --auth-map-only --confirm-write --approval-note NOTE --rollback-plan /tmp/speakasap-salary-auth-rollback.sql [--json-report /tmp/speakasap-salary-auth-apply.json]
  npm run migrate:salary-data -- --dry-run --lesson-uuid-backfill-only [--json-report /tmp/speakasap-salary-lesson-backfill-dry-run.json]
  npm run migrate:salary-data -- --apply --lesson-uuid-backfill-only --confirm-write --approval-note NOTE --rollback-plan /tmp/speakasap-salary-lesson-backfill-rollback.sql [--json-report /tmp/speakasap-salary-lesson-backfill-apply.json]

Write mode is refused unless --apply, --confirm-write, --approval-note, and --rollback-plan are supplied.
Legacy --load is treated as write mode and requires the same gates.
--auth-map-only updates only salary_profiles.auth_user_id from user_identity_mirror.
--lesson-uuid-backfill-only updates only imported salary_expenses.lesson_uuid from education_lessonsalaryexpense.lesson_id.`);
}

async function targetCount(
  prisma: PrismaClient,
  model:
    | 'salaryProfile'
    | 'salaryExpense'
    | 'employeeContract'
    | 'calculationRun'
    | 'payoutRun',
): Promise<number> {
  return prisma[model].count();
}

async function targetIntConflicts(
  prisma: PrismaClient,
  table: string,
  column: string,
  values: number[],
): Promise<number[]> {
  if (!values.length) {
    return [];
  }
  const rows = await prisma.$queryRawUnsafe<{ v: number }[]>(
    `SELECT "${column}" AS v FROM "${table}" WHERE "${column}" = ANY($1::int[]) ORDER BY "${column}" LIMIT 100`,
    values,
  );
  return rows.map((r) => Number(r.v));
}

function writeRollbackSql(path: string): void {
  const sql = `-- Salary migration rollback generated ${ts()}\n-- Deletes only rows with legacy identifiers loaded by the salary migration.\nBEGIN;\nDELETE FROM "payout_lines" WHERE "salary_expense_id" IN (SELECT "id" FROM "salary_expenses" WHERE "legacy_expense_id" IS NOT NULL);\nDELETE FROM "calculation_lines" WHERE "profile_id" IN (SELECT "id" FROM "salary_profiles" WHERE "legacy_profile_id" IS NOT NULL);\nDELETE FROM "salary_expenses" WHERE "legacy_expense_id" IS NOT NULL;\nDELETE FROM "employee_contracts" WHERE "legacy_contract_id" IS NOT NULL;\nDELETE FROM "salary_profiles" WHERE "legacy_profile_id" IS NOT NULL;\nCOMMIT;\n`;
  writeFileSync(path, sql, 'utf8');
  log('rollback_sql_written', { path });
}

function writeAuthMappingRollbackSql(path: string): void {
  const sql = `-- Salary auth mapping rollback generated ${ts()}
-- Reverts only auth UUID mapping populated on imported salary profiles.
BEGIN;
UPDATE "salary_profiles"
SET "auth_user_id" = NULL, "updated_at" = NOW()
WHERE "legacy_profile_id" IS NOT NULL
  AND "auth_user_id" IS NOT NULL;
COMMIT;
`;
  writeFileSync(path, sql, 'utf8');
  log('auth_mapping_rollback_sql_written', { path });
}

function writeLessonUuidBackfillRollbackSql(path: string): void {
  const sql = `-- Salary lesson UUID backfill rollback generated ${ts()}
-- Reverts only lesson UUIDs populated on imported legacy lesson salary expenses.
BEGIN;
UPDATE "salary_expenses"
SET "lesson_uuid" = NULL, "updated_at" = NOW()
WHERE "kind" = 'lesson'::"SalaryExpenseKind"
  AND "legacy_expense_id" IS NOT NULL
  AND "lesson_uuid" IS NOT NULL;
COMMIT;
`;
  writeFileSync(path, sql, 'utf8');
  log('lesson_uuid_backfill_rollback_sql_written', { path });
}

function writeJson(path: string, value: Record<string, unknown>): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  log('json_report_written', { path });
}

const BATCH = 400;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }
  const envPath = join(SPEAKASAP_ROOT, '.env');
  const writeRequested = args.includes('--apply') || args.includes('--load');
  const dryRun = args.includes('--dry-run') || !writeRequested;
  const doLoad = writeRequested && !dryRun;
  const writeDocs = args.includes('--write-docs');
  const authMapOnly = args.includes('--auth-map-only');
  const lessonUuidBackfillOnly = args.includes('--lesson-uuid-backfill-only');
  const jsonReportPath = argValue(args, '--json-report');
  const approvalNote = argValue(args, '--approval-note');
  const rollbackPlan = argValue(args, '--rollback-plan');
  const confirmWrite = args.includes('--confirm-write');
  if (authMapOnly && lessonUuidBackfillOnly) {
    throw new Error(
      '--auth-map-only and --lesson-uuid-backfill-only are mutually exclusive.',
    );
  }
  if (doLoad && (!confirmWrite || !approvalNote || !rollbackPlan)) {
    throw new Error(
      'Write mode requires --apply --confirm-write --approval-note NOTE --rollback-plan PATH. Legacy --load also requires these gates.',
    );
  }

  loadEnvFrom(envPath);

  const legacyUrl = process.env.SALARY_LEGACY_DATABASE_URL;
  const targetUrl = process.env.SALARY_DATABASE_URL || process.env.DATABASE_URL;
  const userDatabaseUrl = process.env.USER_DATABASE_URL;
  const educationDatabaseUrl = process.env.EDUCATION_DATABASE_URL;
  if (!legacyUrl) {
    throw new Error(
      'SALARY_LEGACY_DATABASE_URL is required (read-only legacy portal DB).',
    );
  }
  if (!targetUrl) {
    throw new Error(
      'SALARY_DATABASE_URL or DATABASE_URL is required for target DB.',
    );
  }

  log('salary_etl_start', {
    dryRun,
    load: doLoad,
    writeDocs,
    authMapOnly,
    lessonUuidBackfillOnly,
    jsonReport: jsonReportPath ?? null,
    approvalNote: approvalNote ?? null,
    rollbackPlan: rollbackPlan ?? null,
    userDatabaseMapping: Boolean(userDatabaseUrl),
    educationLessonVerification: Boolean(educationDatabaseUrl),
  });

  const legacy = new pg.Client({
    connectionString: legacyUrl,
    statement_timeout: 120000,
  });
  await legacy.connect();
  log('legacy_connected', { timestamp: ts() });

  const hasLesson = await legacyTableExists(
    legacy,
    'education_lessonsalaryexpense',
  );
  const hasSupport = await legacyTableExists(
    legacy,
    'expenses_supportbonusexpense',
  );
  const flags = { lesson: hasLesson, support: hasSupport };
  log('legacy_table_flags', flags as unknown as Record<string, unknown>);

  const stats = await collectLegacyStats(legacy, flags);
  log('legacy_counts', stats as unknown as Record<string, unknown>);

  const t0 = Date.now();
  const periods = await payrollByPeriod(legacy);
  log('payroll_periods_loaded', {
    duration_ms: Date.now() - t0,
    periodRowCount: periods.length,
  });

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
  log('legacy_profiles_fetched', {
    count: profilesRes.rows.length,
    duration_ms: Date.now() - tProfiles,
  });

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
  log('legacy_expenses_fetched', {
    count: expensesRes.rows.length,
    duration_ms: Date.now() - tExp,
  });

  const legacyLessonUuidByExpenseId = new Map<number, string>();
  for (const row of expensesRes.rows) {
    if (row.kind === 'lesson' && row.lesson_id) {
      legacyLessonUuidByExpenseId.set(row.id, String(row.lesson_id));
    }
  }
  const allLegacyLessonUuids = Array.from(legacyLessonUuidByExpenseId.values());
  const existingEducationLessonUuids = await loadExistingEducationLessonUuids(
    educationDatabaseUrl,
    allLegacyLessonUuids,
  );
  const missingEducationLessonUuids = existingEducationLessonUuids
    ? allLegacyLessonUuids.filter(
        (uuid) => !existingEducationLessonUuids.has(uuid),
      )
    : [];
  const lessonUuidByExpenseId = new Map<number, string>();
  for (const [
    legacyExpenseId,
    lessonUuid,
  ] of legacyLessonUuidByExpenseId.entries()) {
    if (
      !existingEducationLessonUuids ||
      existingEducationLessonUuids.has(lessonUuid)
    ) {
      lessonUuidByExpenseId.set(legacyExpenseId, lessonUuid);
    }
  }
  log('legacy_lesson_salary_mappings_loaded', {
    count: legacyLessonUuidByExpenseId.size,
    educationVerification: educationDatabaseUrl
      ? 'configured'
      : 'not_configured',
    targetLessonUuidsFound: existingEducationLessonUuids?.size ?? null,
    missingTargetLessonUuids: missingEducationLessonUuids.length,
  });

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

  const authUserByLegacyUser = await loadAuthUserMappings(
    userDatabaseUrl,
    profilesRes.rows.map((row) => row.user_id),
  );
  log('auth_user_mappings_loaded', {
    requested: new Set(profilesRes.rows.map((row) => row.user_id)).size,
    resolved: authUserByLegacyUser.size,
    missing: profilesRes.rows.length - authUserByLegacyUser.size,
  });

  const legacyIdToProfileUuid = new Map<number, string>();
  const userToProfileUuid = new Map<number, string>();
  for (const row of profilesRes.rows) {
    const id = uuidV5(`speakasap:salary:profile:${row.id}`);
    legacyIdToProfileUuid.set(row.id, id);
    userToProfileUuid.set(row.user_id, id);
  }

  const profilePayload: Prisma.SalaryProfileCreateManyInput[] =
    profilesRes.rows.map((row) => ({
      id: legacyIdToProfileUuid.get(row.id)!,
      legacyProfileId: row.id,
      legacyPortalUserId: row.user_id,
      authUserId: authUserByLegacyUser.get(row.user_id) ?? null,
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
    legacyContractIdToUuid.set(
      row.id,
      uuidV5(`speakasap:salary:contract:${row.id}`),
    );
  }

  const mainContracts = contractsRes.rows.filter((r) => r.main_id == null);
  const subContracts = contractsRes.rows.filter((r) => r.main_id != null);

  const buildContractPayload = (
    row: (typeof contractsRes.rows)[0],
  ): Prisma.EmployeeContractCreateManyInput => {
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
      row.main_id != null
        ? (legacyContractIdToUuid.get(row.main_id) ?? null)
        : null;
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
      lessonUuid:
        kind === SalaryExpenseKind.lesson
          ? (lessonUuidByExpenseId.get(row.id) ?? null)
          : null,
      legacyStudentId: row.support_student_id,
      legacyStudentGroupId: row.support_group_id,
    });
  }

  process.env.DATABASE_URL = targetUrl;
  const prisma = new PrismaClient();
  log('target_prisma_connected', { timestamp: ts(), readOnly: dryRun });

  const profileIds = profilesRes.rows.map((row) => row.id);
  const expenseIds = expensesRes.rows.map((row) => row.id);
  const contractIds = contractsRes.rows.map((row) => row.id);
  const [
    targetSalaryProfiles,
    targetSalaryExpenses,
    targetEmployeeContracts,
    targetCalculationRuns,
    targetPayoutRuns,
    targetProfileConflicts,
    targetExpenseConflicts,
    targetContractConflicts,
    importedLessonExpenseRows,
  ] = await Promise.all([
    targetCount(prisma, 'salaryProfile'),
    targetCount(prisma, 'salaryExpense'),
    targetCount(prisma, 'employeeContract'),
    targetCount(prisma, 'calculationRun'),
    targetCount(prisma, 'payoutRun'),
    targetIntConflicts(
      prisma,
      'salary_profiles',
      'legacy_profile_id',
      profileIds,
    ),
    targetIntConflicts(
      prisma,
      'salary_expenses',
      'legacy_expense_id',
      expenseIds,
    ),
    targetIntConflicts(
      prisma,
      'employee_contracts',
      'legacy_contract_id',
      contractIds,
    ),
    loadImportedLessonExpenses(prisma),
  ]);

  const lessonBackfillCandidates = importedLessonExpenseRows.filter((row) => {
    const desiredLessonUuid = lessonUuidByExpenseId.get(
      Number(row.legacyExpenseId),
    );
    return Boolean(desiredLessonUuid && row.lessonUuid !== desiredLessonUuid);
  });
  const importedLessonRowsMissingLegacyMapping =
    importedLessonExpenseRows.filter(
      (row) => !legacyLessonUuidByExpenseId.has(Number(row.legacyExpenseId)),
    );

  const report = {
    domain: 'salary',
    generated_at: ts(),
    writes: doLoad,
    dryRun,
    load: doLoad,
    authMapOnly,
    lessonUuidBackfillOnly,
    source: {
      salary_profiles: stats.salaryProfiles,
      salary_expenses: stats.salaryExpenseBaseRows,
      lesson_salary_expenses: stats.lessonSalaryExpenseRows,
      support_bonus_expenses: stats.supportBonusRows,
      employee_contracts: stats.employeeContracts,
      course_single_lesson_salary_rows: stats.courseSingleLessonSalaryRows,
      course_group_lesson_salary_rows: stats.courseGroupLessonSalaryRows,
    },
    target: {
      salary_profiles_existing: targetSalaryProfiles,
      salary_expenses_existing: targetSalaryExpenses,
      employee_contracts_existing: targetEmployeeContracts,
      calculation_runs_existing: targetCalculationRuns,
      payout_runs_existing: targetPayoutRuns,
    },
    would_write: {
      salary_profiles: profilePayload.length,
      salary_expenses: expensePayload.length,
      employee_contracts: mainPayload.length + subPayload.length,
    },
    mapping: {
      profiles_missing_auth_uuid: {
        count: profilePayload.filter((profile) => !profile.authUserId).length,
        sample_legacy_profile_ids: profilesRes.rows
          .filter((row) => !authUserByLegacyUser.has(row.user_id))
          .slice(0, 50)
          .map((row) => row.id),
      },
      profiles_auth_uuid_resolved: {
        count: profilePayload.filter((profile) => Boolean(profile.authUserId))
          .length,
        sample_legacy_profile_ids: profilesRes.rows
          .filter((row) => authUserByLegacyUser.has(row.user_id))
          .slice(0, 50)
          .map((row) => row.id),
      },
      expenses_without_profile: {
        count: expensesSkippedNoProfile,
        sample_legacy_expense_ids: [],
      },
      lesson_expenses_missing_target_lesson: {
        count: stats.lessonExpenseMissingLesson,
        sample_legacy_expense_ids: [],
      },
      lesson_uuid_backfill: {
        source_lesson_salary_mappings: legacyLessonUuidByExpenseId.size,
        source_lesson_salary_mappings_verified_in_education:
          lessonUuidByExpenseId.size,
        education_verification: educationDatabaseUrl
          ? 'configured'
          : 'not_configured',
        missing_target_lesson_uuid: {
          count: missingEducationLessonUuids.length,
          sample_lesson_uuids: missingEducationLessonUuids.slice(0, 50),
        },
        imported_lesson_expenses_existing: importedLessonExpenseRows.length,
        imported_lesson_expenses_without_legacy_mapping: {
          count: importedLessonRowsMissingLegacyMapping.length,
          sample_legacy_expense_ids: importedLessonRowsMissingLegacyMapping
            .slice(0, 50)
            .map((row) => row.legacyExpenseId),
        },
        imported_lesson_expenses_with_null_lesson_uuid:
          importedLessonExpenseRows.filter((row) => row.lessonUuid === null)
            .length,
        imported_lesson_expenses_with_lesson_uuid:
          importedLessonExpenseRows.filter((row) => row.lessonUuid !== null)
            .length,
        would_update_imported_lesson_expenses: {
          count: lessonBackfillCandidates.length,
          sample_legacy_expense_ids: lessonBackfillCandidates
            .slice(0, 50)
            .map((row) => row.legacyExpenseId),
        },
        future_import_payload_lesson_uuid_count: expensePayload.filter(
          (expense) =>
            expense.kind === SalaryExpenseKind.lesson &&
            Boolean(expense.lessonUuid),
        ).length,
      },
      contracts_missing_parent: {
        count: subContracts.filter(
          (row) =>
            row.main_id != null && !legacyContractIdToUuid.has(row.main_id),
        ).length,
        sample_legacy_contract_ids: subContracts
          .filter(
            (row) =>
              row.main_id != null && !legacyContractIdToUuid.has(row.main_id),
          )
          .slice(0, 50)
          .map((row) => row.id),
      },
    },
    conflicts: {
      duplicate_legacy_profile_ids: [],
      duplicate_legacy_expense_ids: [],
      duplicate_legacy_contract_ids: [],
      target_legacy_profile_id_conflicts: targetProfileConflicts,
      target_legacy_expense_id_conflicts: targetExpenseConflicts,
      target_legacy_contract_id_conflicts: targetContractConflicts,
    },
    user_identity_mapping: {
      source: userDatabaseUrl ? 'user_identity_mirror' : 'not_configured',
      requested_legacy_user_ids: new Set(
        profilesRes.rows.map((row) => row.user_id),
      ).size,
      resolved_auth_user_ids: authUserByLegacyUser.size,
      missing_legacy_user_ids: profilesRes.rows
        .filter((row) => !authUserByLegacyUser.has(row.user_id))
        .slice(0, 50)
        .map((row) => row.user_id),
    },
    period_reconciliation: periods.slice(0, 240).map((row) => ({
      period: row.period,
      currency: row.currency,
      legacy_row_count: Number(row.row_count),
      target_row_count: null,
      legacy_qty_sum: row.qty_sum,
      target_qty_sum: null,
      legacy_amount_sum: row.amount_sum,
      target_amount_sum: null,
    })),
    approval: {
      required_for_apply: true,
      approval_note: approvalNote,
      rollback_plan: rollbackPlan,
    },
    legacyTableFlags: flags,
    note: 'Lesson salary expenses now resolve lessonUuid from education_lessonsalaryexpense.lesson_id; --lesson-uuid-backfill-only updates already imported rows behind the write gate. Historical courses_* lesson expense tables are counted only, not merged into this ETL.',
  };

  log('transform_summary', report as unknown as Record<string, unknown>);

  if (writeDocs) {
    appendMigrationLog(report);
  }
  if (jsonReportPath) {
    writeJson(jsonReportPath, report);
  }

  if (!doLoad) {
    log('dry_run_complete_no_writes', {});
    await prisma.$disconnect();
    await legacy.end();
    return;
  }

  if (rollbackPlan) {
    if (authMapOnly) {
      writeAuthMappingRollbackSql(rollbackPlan);
    } else if (lessonUuidBackfillOnly) {
      writeLessonUuidBackfillRollbackSql(rollbackPlan);
    } else {
      writeRollbackSql(rollbackPlan);
    }
  }

  const tLoad = Date.now();
  const authProfilesUpdated = await updateSalaryProfileAuthUsers(
    prisma,
    authUserByLegacyUser,
  );
  log('profile_auth_users_updated', { count: authProfilesUpdated });
  if (authMapOnly) {
    log('auth_map_only_complete', {
      duration_ms: Date.now() - tLoad,
      approvalNote,
      rollbackPlan,
      authProfilesUpdated,
    });
    await prisma.$disconnect();
    await legacy.end();
    return;
  }

  if (lessonUuidBackfillOnly) {
    const lessonUuidBackfilled = await backfillImportedLessonUuids(
      prisma,
      lessonUuidByExpenseId,
      importedLessonExpenseRows,
    );
    log('lesson_uuid_backfill_only_complete', {
      duration_ms: Date.now() - tLoad,
      approvalNote,
      rollbackPlan,
      lessonUuidBackfilled,
      candidates: lessonBackfillCandidates.length,
      educationVerification: educationDatabaseUrl
        ? 'configured'
        : 'not_configured',
      missingTargetLessonUuids: missingEducationLessonUuids.length,
    });
    await prisma.$disconnect();
    await legacy.end();
    return;
  }

  for (let i = 0; i < profilePayload.length; i += BATCH) {
    const chunk = profilePayload.slice(i, i + BATCH);
    await prisma.salaryProfile.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    log('profiles_batch_written', { at: i, batch: chunk.length });
  }

  for (let i = 0; i < mainPayload.length; i += BATCH) {
    const chunk = mainPayload.slice(i, i + BATCH);
    await prisma.employeeContract.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    log('contracts_main_batch_written', { at: i, batch: chunk.length });
  }

  for (let i = 0; i < subPayload.length; i += BATCH) {
    const chunk = subPayload.slice(i, i + BATCH);
    await prisma.employeeContract.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    log('contracts_sub_batch_written', { at: i, batch: chunk.length });
  }

  for (let i = 0; i < expensePayload.length; i += BATCH) {
    const chunk = expensePayload.slice(i, i + BATCH);
    await prisma.salaryExpense.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    log('expenses_batch_written', { at: i, batch: chunk.length });
  }

  const authProfilesUpdatedAfterInsert = await updateSalaryProfileAuthUsers(
    prisma,
    authUserByLegacyUser,
  );
  log('profile_auth_users_updated_after_insert', {
    count: authProfilesUpdatedAfterInsert,
  });
  log('load_complete', {
    duration_ms: Date.now() - tLoad,
    approvalNote,
    rollbackPlan,
    authProfilesUpdated,
    authProfilesUpdatedAfterInsert,
  });
  await prisma.$disconnect();
  await legacy.end();
}

main().catch((e) => {
  log('salary_etl_fatal', { error: String(e) });
  process.exit(1);
});
