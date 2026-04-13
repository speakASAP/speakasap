/**
 * Phase-4 financial DB ETL: read-only legacy portal Postgres → speakasap_financial_db (Prisma).
 *
 *   npm run migrate:financial-data -- --dry-run
 *   npm run migrate:financial-data -- --load
 *   npm run migrate:financial-data -- --dry-run --write-docs
 *
 * Env (speakasap/.env): PAYMENT_LEGACY_DATABASE_URL (shared read-only portal), FINANCIAL_DATABASE_URL.
 * Optional: FINANCIAL_DISPLAY_CURRENCY (default CZK) for ledger rows without currency.
 *
 * Idempotency: upserts on unique keys (category/method month+key, ledger legacyTransactionId,
 * category snapshots by legacyCategoryId). Safe to rerun after partial failure.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';

const SPEAKASAP_ROOT = join(process.cwd(), '..');

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

function firstOfMonthUtc(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

function lastInstantOfMonthUtc(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
}

function monthKeyFromDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function normalizeMethodKeyRaw(raw: string | null): string {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return '__null__';
  }
  return String(raw).trim();
}

function toIntMinor(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : Number(v);
  if (!Number.isFinite(n)) {
    return 0;
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

type CatAggRow = {
  monthKey: string;
  periodDay: Date;
  categoryKey: string;
  legacyCategoryId: number | null;
  totalMinor: number;
  titleSnapshot: string | null;
};

type MethodAggRow = {
  monthKey: string;
  periodDay: Date;
  methodKeyRaw: string;
  totalMinor: number;
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const doLoad = args.includes('--load');
  const explicitDry = args.includes('--dry-run');
  const writeDocs = args.includes('--write-docs');
  if (explicitDry && doLoad) {
    throw new Error('Use either --dry-run or --load, not both');
  }

  loadEnvFrom(join(SPEAKASAP_ROOT, '.env'));

  const legacyUrl = process.env.PAYMENT_LEGACY_DATABASE_URL?.trim();
  const targetUrl = process.env.FINANCIAL_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  const displayCurrency = (process.env.FINANCIAL_DISPLAY_CURRENCY || 'CZK').trim();

  if (!legacyUrl) {
    throw new Error('PAYMENT_LEGACY_DATABASE_URL is required (read-only speakasap-portal Postgres)');
  }
  if (!targetUrl) {
    throw new Error('FINANCIAL_DATABASE_URL (or DATABASE_URL) is required');
  }

  process.env.DATABASE_URL = targetUrl;
  const prisma = new PrismaClient();

  log('financial_etl_start', { dryRun: !doLoad, load: doLoad, displayCurrency });

  const legacy = new pg.Client({ connectionString: legacyUrl });
  await legacy.connect();
  log('legacy_connected', {});

  const stats: Record<string, number> = {
    payment_stat_category_rows: 0,
    payment_stat_methods_rows: 0,
    orders_transaction_rows: 0,
    orphan_stat_category_fk: 0,
    non_salary_expense_rows: 0,
    category_snapshots_upserted: 0,
    monthly_category_upserts: 0,
    monthly_method_upserts: 0,
    ledger_upserts: 0,
    rollup_months: 0,
  };

  const tablesOk = {
    payment_stat_category: await legacyTableExists(legacy, 'payment_stat_category'),
    payment_stat_methods: await legacyTableExists(legacy, 'payment_stat_methods'),
    orders_transaction: await legacyTableExists(legacy, 'orders_transaction'),
    products_category: await legacyTableExists(legacy, 'products_category'),
    expenses_expense: await legacyTableExists(legacy, 'expenses_expense'),
    expenses_salaryexpense: await legacyTableExists(legacy, 'expenses_salaryexpense'),
  };
  log('legacy_tables', tablesOk);

  const catAgg = new Map<string, CatAggRow>();
  if (tablesOk.payment_stat_category) {
    log('legacy_fetch_start', { step: 'payment_stat_category' });
    const r = await legacy.query<{
      month_paid: Date;
      category_id: number | null;
      total_cat: string | number | null;
      title: string | null;
    }>(
      `SELECT month_paid::date AS month_paid, category_id,
              COALESCE(SUM(total_cat::bigint), 0)::text AS total_cat,
              MAX(title) AS title
         FROM payment_stat_category
        GROUP BY month_paid::date, category_id`,
    );
    stats.payment_stat_category_rows = r.rowCount ?? 0;
    for (const row of r.rows) {
      const monthKey = monthKeyFromDate(new Date(row.month_paid));
      const legacyCategoryId = row.category_id;
      const categoryKey = legacyCategoryId == null ? 'uncategorized' : String(legacyCategoryId);
      const mapKey = `${monthKey}|${categoryKey}`;
      const totalMinor = toIntMinor(row.total_cat);
      const prev = catAgg.get(mapKey);
      if (prev) {
        prev.totalMinor += totalMinor;
      } else {
        catAgg.set(mapKey, {
          monthKey,
          periodDay: firstOfMonthUtc(monthKey),
          categoryKey,
          legacyCategoryId,
          totalMinor,
          titleSnapshot: row.title,
        });
      }
    }
    log('legacy_fetch_done', { step: 'payment_stat_category', rows: stats.payment_stat_category_rows });
  }

  const methodAgg = new Map<string, MethodAggRow>();
  if (tablesOk.payment_stat_methods) {
    log('legacy_fetch_start', { step: 'payment_stat_methods' });
    const r = await legacy.query<{
      month_paid: Date;
      method: string | null;
      total: string | number | null;
    }>(
      `SELECT month_paid::date AS month_paid, method,
              COALESCE(SUM(total::bigint), 0)::text AS total
         FROM payment_stat_methods
        GROUP BY month_paid::date, method`,
    );
    stats.payment_stat_methods_rows = r.rowCount ?? 0;
    for (const row of r.rows) {
      const monthKey = monthKeyFromDate(new Date(row.month_paid));
      const methodKeyRaw = normalizeMethodKeyRaw(row.method);
      const mapKey = `${monthKey}|${methodKeyRaw}`;
      const totalMinor = toIntMinor(row.total);
      const prev = methodAgg.get(mapKey);
      if (prev) {
        prev.totalMinor += totalMinor;
      } else {
        methodAgg.set(mapKey, {
          monthKey,
          periodDay: firstOfMonthUtc(monthKey),
          methodKeyRaw,
          totalMinor,
        });
      }
    }
    log('legacy_fetch_done', { step: 'payment_stat_methods', rows: stats.payment_stat_methods_rows });
  }

  if (tablesOk.payment_stat_category && tablesOk.products_category) {
    const o = await legacy.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
         FROM payment_stat_category p
        WHERE p.category_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM products_category c WHERE c.id = p.category_id)`,
    );
    stats.orphan_stat_category_fk = toIntMinor(o.rows[0]?.n ?? 0);
    log('orphan_check', {
      step: 'payment_stat_category_missing_category',
      count: stats.orphan_stat_category_fk,
    });
  }

  if (tablesOk.expenses_expense && tablesOk.expenses_salaryexpense) {
    const e = await legacy.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
         FROM expenses_expense e
        WHERE NOT EXISTS (
                SELECT 1 FROM expenses_salaryexpense s WHERE s.expense_ptr_id = e.id
              )`,
    );
    stats.non_salary_expense_rows = toIntMinor(e.rows[0]?.n ?? 0);
    log('orphan_check', { step: 'non_salary_expenses_expense', count: stats.non_salary_expense_rows });
  }

  type TxRow = {
    id: number;
    user_id: number;
    created: Date;
    amount: number;
    comment: string | null;
    order_id: number | null;
    is_income: boolean;
    external: boolean;
  };

  const txRows: TxRow[] = [];
  if (tablesOk.orders_transaction) {
    log('legacy_fetch_start', { step: 'orders_transaction' });
    const r = await legacy.query<TxRow>(
      `SELECT id, user_id, created, amount, comment, order_id, is_income, external
         FROM orders_transaction
        ORDER BY id`,
    );
    stats.orders_transaction_rows = r.rowCount ?? 0;
    txRows.push(...r.rows);
    log('legacy_fetch_done', { step: 'orders_transaction', rows: stats.orders_transaction_rows });
  }

  const categoryIds = new Set<number>();
  for (const c of catAgg.values()) {
    if (c.legacyCategoryId != null) {
      categoryIds.add(c.legacyCategoryId);
    }
  }

  type CatSnap = { id: number; title: string; product_for_offers: boolean };
  const snaps: CatSnap[] = [];
  if (tablesOk.products_category && categoryIds.size > 0) {
    const ids = [...categoryIds];
    log('legacy_fetch_start', { step: 'products_category', ids: ids.length });
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const r = await legacy.query<CatSnap>(
        `SELECT id, title, COALESCE(product_for_offers, false) AS product_for_offers
           FROM products_category WHERE id = ANY($1::int[])`,
        [chunk],
      );
      snaps.push(...r.rows);
    }
    log('legacy_fetch_done', { step: 'products_category', rows: snaps.length });
  }

  const monthsSet = new Set<string>();
  for (const c of catAgg.values()) {
    monthsSet.add(c.monthKey);
  }
  for (const m of methodAgg.values()) {
    monthsSet.add(m.monthKey);
  }
  for (const t of txRows) {
    monthsSet.add(monthKeyFromDate(new Date(t.created)));
  }
  const monthsSorted = [...monthsSet].sort();

  log('reconciliation_precheck', {
    months: monthsSorted.length,
    sum_category_minor: [...catAgg.values()].reduce((s, r) => s + r.totalMinor, 0),
    sum_method_minor: [...methodAgg.values()].reduce((s, r) => s + r.totalMinor, 0),
    note: 'Category totals and method totals are different axes; large divergence should be investigated manually.',
  });

  if (doLoad) {
    log('load_batch_start', { step: 'category_axis_snapshots' });
    for (const s of snaps) {
      await prisma.categoryAxisSnapshot.upsert({
        where: { legacyCategoryId: s.id },
        create: {
          legacyCategoryId: s.id,
          title: s.title,
          productForOffers: s.product_for_offers,
        },
        update: {
          title: s.title,
          productForOffers: s.product_for_offers,
          syncedAt: new Date(),
        },
      });
      stats.category_snapshots_upserted += 1;
    }

    log('load_batch_start', { step: 'monthly_revenue_by_category' });
    for (const row of catAgg.values()) {
      await prisma.monthlyRevenueByCategory.upsert({
        where: {
          periodMonth_categoryKey: { periodMonth: row.periodDay, categoryKey: row.categoryKey },
        },
        create: {
          periodMonth: row.periodDay,
          categoryKey: row.categoryKey,
          legacyCategoryId: row.legacyCategoryId,
          totalMinor: row.totalMinor,
          currency: displayCurrency,
          titleSnapshot: row.titleSnapshot,
        },
        update: {
          totalMinor: row.totalMinor,
          currency: displayCurrency,
          titleSnapshot: row.titleSnapshot ?? undefined,
          legacyCategoryId: row.legacyCategoryId,
        },
      });
      stats.monthly_category_upserts += 1;
    }

    log('load_batch_start', { step: 'monthly_revenue_by_method' });
    for (const row of methodAgg.values()) {
      await prisma.monthlyRevenueByMethod.upsert({
        where: {
          periodMonth_methodKeyRaw: { periodMonth: row.periodDay, methodKeyRaw: row.methodKeyRaw },
        },
        create: {
          periodMonth: row.periodDay,
          methodKeyRaw: row.methodKeyRaw,
          totalMinor: row.totalMinor,
          currency: displayCurrency,
        },
        update: {
          totalMinor: row.totalMinor,
          currency: displayCurrency,
        },
      });
      stats.monthly_method_upserts += 1;
    }

    log('load_batch_start', { step: 'ledger_lines' });
    for (const t of txRows) {
      const amountMinor = Math.abs(toIntMinor(t.amount));
      await prisma.ledgerLine.upsert({
        where: { legacyTransactionId: t.id },
        create: {
          legacyTransactionId: t.id,
          legacyPortalUserId: t.user_id,
          amountMinor,
          isIncome: Boolean(t.is_income),
          legacyOrderId: t.order_id,
          comment: (t.comment ?? '').slice(0, 2000),
          external: Boolean(t.external),
          currency: displayCurrency,
          createdAt: new Date(t.created),
          source: 'ledger_transaction',
        },
        update: {
          amountMinor,
          isIncome: Boolean(t.is_income),
          legacyOrderId: t.order_id,
          comment: (t.comment ?? '').slice(0, 2000),
          external: Boolean(t.external),
          currency: displayCurrency,
          createdAt: new Date(t.created),
        },
      });
      stats.ledger_upserts += 1;
    }

    log('load_batch_start', { step: 'monthly_financial_rollups' });
    for (const month of monthsSorted) {
      const d = firstOfMonthUtc(month);
      const start = firstOfMonthUtc(month);
      const end = lastInstantOfMonthUtc(month);

      const cats = await prisma.monthlyRevenueByCategory.findMany({
        where: { periodMonth: d },
      });
      let totalPaid = 0;
      let currency = displayCurrency;
      for (const c of cats) {
        if (c.currency === displayCurrency) {
          totalPaid += c.totalMinor;
        }
      }
      if (cats.length > 0 && totalPaid === 0) {
        totalPaid = cats.reduce((s, c) => s + c.totalMinor, 0);
        currency = cats[0]?.currency || displayCurrency;
      }

      const ledgers = await prisma.ledgerLine.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          legacyOrderId: null,
        },
      });
      let totalTransactionsNet = 0;
      let operatingExpenseLedger = 0;
      for (const L of ledgers) {
        const signed = L.isIncome ? L.amountMinor : -L.amountMinor;
        totalTransactionsNet += signed;
        if (!L.isIncome) {
          operatingExpenseLedger += L.amountMinor;
        }
      }

      await prisma.monthlyFinancialRollup.upsert({
        where: { periodMonth: d },
        create: {
          periodMonth: d,
          totalPaidOrdersMinor: totalPaid,
          totalTransactionsNetMinor: totalTransactionsNet,
          currency,
          operatingExpenseLedgerMinor: operatingExpenseLedger,
        },
        update: {
          totalPaidOrdersMinor: totalPaid,
          totalTransactionsNetMinor: totalTransactionsNet,
          currency,
          operatingExpenseLedgerMinor: operatingExpenseLedger,
        },
      });
      stats.rollup_months += 1;
    }

    log('load_complete', stats);
  } else {
    log('dry_run_no_writes', {
      ...stats,
      would_upsert_categories: catAgg.size,
      would_upsert_methods: methodAgg.size,
      would_upsert_ledger: txRows.length,
      would_touch_snapshots: snaps.length,
    });
  }

  await legacy.end();
  await prisma.$disconnect();

  if (writeDocs) {
    const docDir = join(SPEAKASAP_ROOT, 'docs', 'refactoring');
    const logPath = join(docDir, 'FINANCIAL_DATA_MIGRATION_LOG.md');
    const block = `\n## Run ${ts()}\n\n\`\`\`json\n${JSON.stringify(
      {
        dryRun: !doLoad,
        stats,
        aggregates: {
          uniqueCategoryMonthKeys: catAgg.size,
          uniqueMethodMonthKeys: methodAgg.size,
          ledgerRows: txRows.length,
        },
      },
      null,
      2,
    )}\n\`\`\`\n`;
    appendFileSync(logPath, block);
    log('appended_migration_log', { path: logPath });
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ timestamp: ts(), msg: 'financial_etl_fatal', error: String(e) }));
  process.exit(1);
});
