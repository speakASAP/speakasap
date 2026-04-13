/**
 * Phase-4 payment DB ETL: read-only legacy portal Postgres → speakasap_payment_db (Prisma).
 *
 *   npm run migrate:payment-data -- --dry-run
 *   npm run migrate:payment-data -- --load
 *   npm run migrate:payment-data -- --dry-run --write-docs
 *   npm run migrate:payment-data -- --dry-run --spot-check
 *   npm run migrate:payment-data -- --verify-post-load
 *
 * Env (speakasap/.env): PAYMENT_LEGACY_DATABASE_URL, PAYMENT_DATABASE_URL (or DATABASE_URL for target).
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, Prisma } from '../node_modules/.prisma/client';
import pg from 'pg';

/** Paths assume the CLI is run with cwd = payment-service (see package.json `migrate:payment-data`). */
const SPEAKASAP_ROOT = join(process.cwd(), '..');

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

type OrderStatus = 'draft' | 'awaiting_payment' | 'paid' | 'canceled' | 'expired';

function computeOrderStatus(row: {
  paid: boolean;
  trashed: boolean;
  till_date: Date | null;
}): OrderStatus {
  if (row.trashed) {
    return 'canceled';
  }
  if (row.paid) {
    return 'paid';
  }
  if (row.till_date) {
    const td = new Date(row.till_date);
    td.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (td <= today) {
      return 'expired';
    }
  }
  return 'awaiting_payment';
}

function mapDiscountType(raw: string): 'PERCENT' | 'FIXED' {
  if (raw === 'fixed') {
    return 'FIXED';
  }
  return 'PERCENT';
}

function buildOrderJson(
  data: unknown,
  additional: string | null,
): object {
  const base =
    data !== null && data !== undefined && typeof data === 'object' && !Array.isArray(data)
      ? { ...(data as Record<string, unknown>) }
      : {};
  if (additional && additional.trim()) {
    try {
      const parsed = JSON.parse(additional) as unknown;
      return { ...base, legacyAdditional: parsed };
    } catch {
      return { ...base, legacyAdditionalText: additional };
    }
  }
  return base;
}

function trashedAtFromOrder(row: { trashed: boolean; created: Date }): Date | null {
  return row.trashed ? row.created : null;
}

type LegacyStats = {
  orders: number;
  payments: number;
  paymentsAndroid: number;
  transactions: number;
  failedPayments: number;
  discountTemplates: number;
  discountOrders: number;
  discountM2mRows: number;
  orphanPayments: number;
  ordersMissingUser: number;
  subscriptionLikeTables: string[];
  /** Present `orders_*` payment subtype tables (empty = none detected). */
  paymentSubtypeTables: string[];
};

type PaySubKey =
  | 'external'
  | 'paypal'
  | 'invoice'
  | 'inner'
  | 'webpay'
  | 'card'
  | 'android';

const PAY_SUB_TABLES: Record<PaySubKey, string> = {
  external: 'orders_externalpayment',
  paypal: 'orders_paypalpayment',
  invoice: 'orders_invoicepayment',
  inner: 'orders_innerpayment',
  webpay: 'orders_webpaypayment',
  card: 'orders_cspayment',
  android: 'orders_androidpayment',
};

async function legacyTableExists(client: pg.Client, table: string): Promise<boolean> {
  const r = await client.query<{ ok: number }>(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [table],
  );
  return r.rowCount !== null && r.rowCount > 0;
}

async function detectPaymentSubtypeTables(client: pg.Client): Promise<Record<PaySubKey, boolean>> {
  const flags = {} as Record<PaySubKey, boolean>;
  for (const key of Object.keys(PAY_SUB_TABLES) as PaySubKey[]) {
    flags[key] = await legacyTableExists(client, PAY_SUB_TABLES[key]!);
  }
  const missing = (Object.keys(PAY_SUB_TABLES) as PaySubKey[]).filter((k) => !flags[k]).map(
    (k) => PAY_SUB_TABLES[k],
  );
  if (missing.length > 0) {
    log('legacy_payment_subtables_missing', { missing });
  }
  return flags;
}

function buildPaymentSql(t: Record<PaySubKey, boolean>): string {
  const joinLines: string[] = ['FROM orders_payment p'];
  const whenLines: string[] = [];

  if (t.external) {
    joinLines.push('LEFT JOIN orders_externalpayment ep ON ep.payment_ptr_id = p.id');
    whenLines.push(`WHEN ep.payment_ptr_id IS NOT NULL THEN COALESCE(ep.provider, 'external')`);
  }
  if (t.paypal) {
    joinLines.push('LEFT JOIN orders_paypalpayment pp ON pp.payment_ptr_id = p.id');
    whenLines.push(`WHEN pp.payment_ptr_id IS NOT NULL THEN 'paypal'`);
  }
  if (t.invoice) {
    joinLines.push('LEFT JOIN orders_invoicepayment ip ON ip.payment_ptr_id = p.id');
    whenLines.push(`WHEN ip.payment_ptr_id IS NOT NULL THEN 'invoice'`);
  }
  if (t.inner) {
    joinLines.push('LEFT JOIN orders_innerpayment inp ON inp.payment_ptr_id = p.id');
    whenLines.push(`WHEN inp.payment_ptr_id IS NOT NULL THEN 'inner'`);
  }
  if (t.webpay) {
    joinLines.push('LEFT JOIN orders_webpaypayment wp ON wp.payment_ptr_id = p.id');
    whenLines.push(`WHEN wp.payment_ptr_id IS NOT NULL THEN 'webpay'`);
  }
  if (t.card) {
    joinLines.push('LEFT JOIN orders_cspayment csp ON csp.payment_ptr_id = p.id');
    whenLines.push(`WHEN csp.payment_ptr_id IS NOT NULL THEN 'card'`);
  }
  if (t.android) {
    joinLines.push('LEFT JOIN orders_androidpayment ap ON ap.payment_ptr_id = p.id');
    whenLines.push(`WHEN ap.payment_ptr_id IS NOT NULL THEN 'android'`);
  }

  const legacyMethodExpr =
    whenLines.length > 0
      ? `CASE\n        ${whenLines.join('\n        ')}\n        ELSE 'legacy_unknown'\n      END AS legacy_method`
      : `'legacy_unknown' AS legacy_method`;

  const paypalCols = t.paypal
    ? 'pp.payment_id AS paypal_payment_id,\n      pp.url AS paypal_url,'
    : 'NULL::text AS paypal_payment_id,\n      NULL::text AS paypal_url,';
  const invoiceCols = t.invoice
    ? 'ip.number AS invoice_number,\n      ip.received AS invoice_received,\n      ip.actual_amount AS invoice_actual_amount,'
    : 'NULL::int AS invoice_number,\n      NULL::boolean AS invoice_received,\n      NULL::int AS invoice_actual_amount,';
  const externalCols = t.external
    ? 'ep.external_payment_id,\n      ep.status AS external_status,\n      ep.redirect_url AS external_redirect'
    : 'NULL::text AS external_payment_id,\n      NULL::text AS external_status,\n      NULL::text AS external_redirect';

  return `
    SELECT p.id, p.order_id, p.paid, p.amount, p.uuid::text AS uuid, p.trashed, p.created,
      ${legacyMethodExpr},
      ${paypalCols}
      ${invoiceCols}
      ${externalCols}
    ${joinLines.join('\n    ')}
  `;
}

async function collectLegacyStats(
  client: pg.Client,
  payTableFlags: Record<PaySubKey, boolean>,
): Promise<LegacyStats> {
  const one = async (sql: string): Promise<number> => {
    const r = await client.query<{ c: string }>(sql);
    return parseInt(r.rows[0]!.c, 10);
  };
  const subs = await client.query<{ table_name: string }>(
    `
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name ILIKE '%subscription%'
    ORDER BY table_name
  `,
  );
  let transactions = 0;
  try {
    transactions = await one('SELECT COUNT(*)::text AS c FROM orders_transaction');
  } catch {
    transactions = 0;
  }
  let failedPayments = 0;
  try {
    failedPayments = await one('SELECT COUNT(*)::text AS c FROM orders_failedpayment');
  } catch {
    failedPayments = 0;
  }
  let discountM2mRows = 0;
  try {
    discountM2mRows = await one(
      'SELECT COUNT(*)::text AS c FROM discount_discounttemplate_products',
    );
  } catch {
    discountM2mRows = 0;
  }
  let paymentsAndroid = 0;
  if (payTableFlags.android) {
    try {
      paymentsAndroid = await one(
        `SELECT COUNT(*)::text AS c FROM orders_payment p
         INNER JOIN orders_androidpayment a ON a.payment_ptr_id = p.id`,
      );
    } catch {
      paymentsAndroid = 0;
    }
  }
  const paymentSubtypeTables = (Object.keys(PAY_SUB_TABLES) as PaySubKey[])
    .filter((k) => payTableFlags[k])
    .map((k) => PAY_SUB_TABLES[k]!);
  return {
    orders: await one('SELECT COUNT(*)::text AS c FROM orders_order'),
    payments: await one('SELECT COUNT(*)::text AS c FROM orders_payment'),
    paymentsAndroid,
    transactions,
    failedPayments,
    discountTemplates: await one(
      'SELECT COUNT(*)::text AS c FROM discount_discounttemplate',
    ),
    discountOrders: await one('SELECT COUNT(*)::text AS c FROM discount_discountorder'),
    discountM2mRows,
    orphanPayments: await one(
      `SELECT COUNT(*)::text AS c FROM orders_payment p
       WHERE NOT EXISTS (SELECT 1 FROM orders_order o WHERE o.id = p.order_id)`,
    ),
    ordersMissingUser: await one(
      'SELECT COUNT(*)::text AS c FROM orders_order WHERE user_id IS NULL',
    ),
    subscriptionLikeTables: subs.rows.map((r) => r.table_name),
    paymentSubtypeTables,
  };
}

function paymentStatus(
  paid: Date | null,
  method: string,
  externalStatus: string | null,
): string {
  if (method === 'external' && externalStatus) {
    return externalStatus.toLowerCase();
  }
  if (paid) {
    return 'completed';
  }
  return 'pending';
}

function normalizeMethod(raw: string): string {
  if (raw === 'paypal') {
    return 'paypal';
  }
  if (raw === 'webpay') {
    return 'webpay';
  }
  if (raw === 'card') {
    return 'card';
  }
  if (raw === 'inner') {
    return 'inner';
  }
  if (raw === 'invoice') {
    return 'invoice';
  }
  if (raw === 'external') {
    return 'external';
  }
  return raw;
}

async function verifyPostLoad(envPath: string): Promise<void> {
  loadEnvFrom(envPath);
  const targetUrl = process.env.PAYMENT_DATABASE_URL || process.env.DATABASE_URL;
  if (!targetUrl) {
    throw new Error('PAYMENT_DATABASE_URL or DATABASE_URL is required for --verify-post-load.');
  }
  process.env.DATABASE_URL = targetUrl;
  const prisma = new PrismaClient();
  try {
    const paOrphan = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::bigint AS c FROM payment_attempts pa
      WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = pa.order_id)`;
    const doOrphan = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::bigint AS c FROM discount_orders d
      WHERE NOT EXISTS (SELECT 1 FROM discount_templates t WHERE t.code = d.discount_template_code)`;
    log('post_load_orphan_counts', {
      paymentAttemptsWithoutOrder: Number(paOrphan[0]!.c),
      discountOrdersWithoutTemplate: Number(doOrphan[0]!.c),
    });
    const paidOrders = await prisma.order.findMany({
      where: { paid: true },
      take: 5,
      orderBy: { id: 'asc' },
      include: {
        paymentAttempts: { orderBy: { createdAt: 'asc' }, take: 5 },
      },
    });
    log('spot_check_target_paid_orders', {
      rows: paidOrders.map((o) => ({
        id: o.id,
        status: o.status,
        priceMinor: o.priceMinor,
        paymentAttempts: o.paymentAttempts.map((p) => ({
          method: p.method,
          status: p.status,
          paidAt: p.paidAt,
        })),
      })),
    });
    const templates = await prisma.discountTemplate.findMany({
      take: 3,
      orderBy: { code: 'asc' },
    });
    const dOne = await prisma.discountOrder.findFirst({
      orderBy: { orderId: 'asc' },
      include: {
        order: { select: { id: true, priceMinor: true } },
        template: { select: { code: true, discountType: true } },
      },
    });
    log('spot_check_target_discounts', {
      templates: templates.map((t) => ({
        code: t.code,
        discountType: t.discountType,
        discount: t.discount.toString(),
      })),
      discountOrderSample: dOne
        ? {
            orderId: dOne.orderId,
            discountTemplateCode: dOne.discountTemplateCode,
            templateDiscountType: dOne.template.discountType,
            orderPriceMinor: dOne.order.priceMinor,
          }
        : null,
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const envPath = join(SPEAKASAP_ROOT, '.env');

  if (args.includes('--verify-post-load')) {
    await verifyPostLoad(envPath);
    return;
  }

  const doLoad = args.includes('--load');
  const writeDocs = args.includes('--write-docs');

  loadEnvFrom(envPath);

  const legacyUrl = process.env.PAYMENT_LEGACY_DATABASE_URL;
  const targetUrl =
    process.env.PAYMENT_DATABASE_URL || process.env.DATABASE_URL;
  if (!legacyUrl) {
    throw new Error('PAYMENT_LEGACY_DATABASE_URL is required (read-only legacy portal DB).');
  }
  if (!targetUrl) {
    throw new Error('PAYMENT_DATABASE_URL or DATABASE_URL is required for target DB.');
  }

  log('payment_etl_start', { dryRun: !doLoad, load: doLoad });

  const legacy = new pg.Client({ connectionString: legacyUrl, statement_timeout: 120000 });
  await legacy.connect();
  log('legacy_connected', {});

  const payTableFlags = await detectPaymentSubtypeTables(legacy);
  const stats = await collectLegacyStats(legacy, payTableFlags);
  log('legacy_counts', stats as unknown as Record<string, unknown>);

  process.env.DATABASE_URL = targetUrl;
  const prisma = new PrismaClient();

  const paymentSql = buildPaymentSql(payTableFlags);

  const ordersRes = await legacy.query<{
    id: number;
    user_id: number | null;
    price: number;
    title: string | null;
    comment: string | null;
    paid: boolean;
    sticky: boolean;
    discountable: boolean;
    deletable: boolean;
    created: Date;
    product_id: number | null;
    additional: string | null;
    data: unknown;
    till_date: Date | null;
    trashed: boolean;
  }>(
    `SELECT id, user_id, price, title, comment, paid, sticky, discountable, deletable,
            created, product_id, additional, data, till_date, trashed
     FROM orders_order ORDER BY id`,
  );

  const orderRowsWithUser = ordersRes.rows.filter((r) => r.user_id != null);
  const ordersSkippedNoUser = ordersRes.rows.length - orderRowsWithUser.length;
  if (ordersSkippedNoUser > 0) {
    log('orders_skipped_null_user', { count: ordersSkippedNoUser });
  }

  const paymentsRes = await legacy.query<{
    id: number;
    order_id: number;
    paid: Date | null;
    amount: number;
    uuid: string;
    trashed: boolean;
    created: Date;
    legacy_method: string;
    paypal_payment_id: string | null;
    paypal_url: string | null;
    invoice_number: number | null;
    invoice_received: boolean | null;
    invoice_actual_amount: number | null;
    external_payment_id: string | null;
    external_status: string | null;
    external_redirect: string | null;
  }>(paymentSql);

  const templatesRes = await legacy.query<{
    code: string;
    single_user: boolean;
    enabled: boolean;
    discount: number;
    discount_type: string;
    valid_till: Date | null;
    comment: string | null;
    permanent: boolean;
    course_discount: boolean;
  }>(
    `SELECT code, single_user, enabled, discount, discount_type, valid_till, comment, permanent, course_discount
     FROM discount_discounttemplate`,
  );

  const m2mRes = await legacy
    .query<{ discounttemplate_id: string; product_id: number }>(
      `SELECT discounttemplate_id, product_id FROM discount_discounttemplate_products`,
    )
    .catch(() => ({ rows: [] as { discounttemplate_id: string; product_id: number }[] }));

  const dOrderRes = await legacy.query<{
    order_id: number;
    discount_template_id: string;
  }>(
    `SELECT order_id, discount_template_id FROM discount_discountorder`,
  );

  const orderIdMap = new Map<number, string>();
  for (const row of orderRowsWithUser) {
    orderIdMap.set(row.id, uuidV5(`speakasap:payment-service:order:${row.id}`));
  }

  const ordersPayload = orderRowsWithUser.map((row) => ({
    id: orderIdMap.get(row.id)!,
    userId: String(row.user_id!),
    title: row.title || '',
    priceMinor: row.price,
    currency: 'EUR',
    paid: row.paid,
    status: computeOrderStatus(row) as OrderStatus,
    productId: row.product_id != null ? String(row.product_id) : null,
    data: buildOrderJson(row.data, row.additional),
    tillDate: row.till_date,
    comment: row.comment,
    sticky: row.sticky,
    discountable: row.discountable,
    deletable: row.deletable,
    trashedAt: trashedAtFromOrder(row),
    createdAt: row.created,
  }));

  const androidExcluded = paymentsRes.rows.filter((p) => p.legacy_method === 'android');
  const paymentsForLoad = paymentsRes.rows.filter(
    (p) => p.legacy_method !== 'android' && orderIdMap.has(p.order_id),
  );
  const paymentsSkippedMissingOrder = paymentsRes.rows.filter(
    (p) => p.legacy_method !== 'android' && !orderIdMap.has(p.order_id),
  );

  const paymentPayload = paymentsForLoad.map((p) => {
    const oid = orderIdMap.get(p.order_id)!;
    const method = normalizeMethod(p.legacy_method);
    const providerPaymentId =
      p.external_payment_id || p.paypal_payment_id || null;
    const payload: Record<string, unknown> = {
      legacyPaymentId: p.id,
      legacyMethod: p.legacy_method,
    };
    if (p.paypal_url) {
      payload.paypalUrl = p.paypal_url;
    }
    if (p.invoice_number != null) {
      payload.invoiceNumber = p.invoice_number;
      payload.invoiceReceived = p.invoice_received;
      payload.invoiceActualAmountMinor = p.invoice_actual_amount;
    }
    if (p.external_redirect) {
      payload.redirectUrl = p.external_redirect;
    }
    return {
      id: uuidV5(`speakasap:payment-service:payment:${p.id}`),
      orderId: oid,
      amountMinor: p.amount,
      paidAt: p.paid,
      publicUuid: p.uuid,
      providerPaymentId,
      method,
      status: paymentStatus(p.paid, method, p.external_status),
      providerPayload: payload as Prisma.InputJsonValue,
      createdAt: p.created,
    };
  });

  const templatesPayload = templatesRes.rows.map((t) => ({
    code: t.code.toUpperCase(),
    singleUser: t.single_user,
    enabled: t.enabled,
    discount: new Prisma.Decimal(t.discount),
    discountType: mapDiscountType(t.discount_type),
    validTill: t.valid_till,
    comment: t.comment,
    permanent: t.permanent,
    courseDiscount: t.course_discount,
  }));

  const productsPayload = m2mRes.rows.map((r) => ({
    templateCode: r.discounttemplate_id.toUpperCase(),
    productId: String(r.product_id),
  }));

  const discountOrdersPayload = dOrderRes.rows
    .filter((d) => orderIdMap.has(d.order_id))
    .map((d) => ({
      orderId: orderIdMap.get(d.order_id)!,
      discountTemplateCode: d.discount_template_id.toUpperCase(),
    }));

  const invoiceRows = paymentsForLoad.filter(
    (p) => p.invoice_number != null && p.legacy_method === 'invoice',
  );
  const orderByLegacyId = new Map(orderRowsWithUser.map((o) => [o.id, o]));
  const invoicesPayload = invoiceRows.map((p) => {
    const order = orderByLegacyId.get(p.order_id)!;
    return {
      id: uuidV5(`speakasap:payment-service:invoice:${p.id}`),
      orderId: orderIdMap.get(p.order_id)!,
      userId: String(order.user_id),
      number: p.invoice_number != null ? String(p.invoice_number) : null,
      received: Boolean(p.invoice_received),
      amountMinor: p.invoice_actual_amount ?? p.amount,
      currency: 'EUR',
      metadata: { legacyPaymentId: p.id, legacyInvoice: true },
      createdAt: p.created,
    };
  });

  log('transform_summary', {
    orders: ordersPayload.length,
    paymentAttempts: paymentPayload.length,
    paymentsSkippedAndroid: androidExcluded.length,
    paymentsSkippedMissingOrder: paymentsSkippedMissingOrder.length,
    discountTemplates: templatesPayload.length,
    discountProducts: productsPayload.length,
    discountOrders: discountOrdersPayload.length,
    invoices: invoicesPayload.length,
  });

  if (args.includes('--spot-check')) {
    const paidLegacy = orderRowsWithUser
      .filter((r) => computeOrderStatus(r) === 'paid')
      .slice(0, 5);
    const spotPaid = paidLegacy.map((row) => {
      const oid = orderIdMap.get(row.id)!;
      const op = ordersPayload.find((o) => o.id === oid)!;
      const pays = paymentPayload.filter((p) => p.orderId === oid);
      return {
        legacyOrderId: row.id,
        targetOrderId: oid,
        status: op.status,
        priceMinor: op.priceMinor,
        paymentAttempts: pays.map((p) => ({
          method: p.method,
          status: p.status,
          paidAt: p.paidAt,
          publicUuid: p.publicUuid,
        })),
      };
    });
    const spotTmpl = templatesPayload.slice(0, 3).map((t) => ({
      code: t.code,
      discountType: t.discountType,
      discount: t.discount.toString(),
    }));
    const d0 = discountOrdersPayload[0];
    log('spot_check_pre_load', {
      paidOrders: spotPaid,
      discountTemplatesSample: spotTmpl,
      discountOrderSample: d0
        ? { orderId: d0.orderId, discountTemplateCode: d0.discountTemplateCode }
        : null,
    });
  }

  if (doLoad) {
    log('load_batch_start', { step: 'discount_templates' });
    for (let i = 0; i < templatesPayload.length; i += 200) {
      const chunk = templatesPayload.slice(i, i + 200);
      await prisma.discountTemplate.createMany({ data: chunk, skipDuplicates: true });
      log('load_batch_progress', { step: 'discount_templates', at: Math.min(i + chunk.length, templatesPayload.length) });
    }
    for (let i = 0; i < productsPayload.length; i += 500) {
      const chunk = productsPayload.slice(i, i + 500);
      if (chunk.length) {
        await prisma.discountProduct.createMany({ data: chunk, skipDuplicates: true });
      }
    }
    for (let i = 0; i < ordersPayload.length; i += 200) {
      const chunk = ordersPayload.slice(i, i + 200);
      await prisma.order.createMany({ data: chunk, skipDuplicates: true });
      log('load_batch_progress', { step: 'orders', at: Math.min(i + chunk.length, ordersPayload.length) });
    }
    for (let i = 0; i < discountOrdersPayload.length; i += 300) {
      const chunk = discountOrdersPayload.slice(i, i + 300);
      if (chunk.length) {
        await prisma.discountOrder.createMany({ data: chunk, skipDuplicates: true });
      }
    }
    for (let i = 0; i < paymentPayload.length; i += 200) {
      const chunk = paymentPayload.slice(i, i + 200);
      await prisma.paymentAttempt.createMany({ data: chunk, skipDuplicates: true });
      log('load_batch_progress', {
        step: 'payment_attempts',
        at: Math.min(i + chunk.length, paymentPayload.length),
      });
    }
    for (let i = 0; i < invoicesPayload.length; i += 200) {
      const chunk = invoicesPayload.slice(i, i + 200);
      if (chunk.length) {
        await prisma.invoice.createMany({ data: chunk, skipDuplicates: true });
      }
    }
    log('load_complete', {});
  } else {
    log('dry_run_no_writes', {});
  }

  await legacy.end();
  await prisma.$disconnect();

  if (writeDocs) {
    const docDir = join(SPEAKASAP_ROOT, 'docs', 'refactoring');
    const logPath = join(docDir, 'PAYMENT_DATA_MIGRATION_LOG.md');
    const block = `\n## Run ${ts()}\n\n\`\`\`json\n${JSON.stringify(
      {
        dryRun: !doLoad,
        stats,
        ordersSkippedNoUser,
        transform: {
          orders: ordersPayload.length,
          paymentAttempts: paymentPayload.length,
          paymentsSkippedAndroid: androidExcluded.length,
          paymentsSkippedMissingOrder: paymentsSkippedMissingOrder.length,
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
  console.error(JSON.stringify({ timestamp: ts(), msg: 'payment_etl_fatal', error: String(e) }));
  process.exit(1);
});
